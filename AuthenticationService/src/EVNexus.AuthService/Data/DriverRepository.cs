using System.Data;
using EVNexus.AuthService.Models;
using MySqlConnector;

namespace EVNexus.AuthService.Data;

public interface IDriverRepository
{
    Task<bool> IsEmailRegisteredAsync(string email, CancellationToken cancellationToken = default);
    Task<(Driver Driver, Wallet Wallet)> CreateDriverWithWalletAsync(Driver driver, Wallet wallet, CancellationToken cancellationToken = default);
    Task<Driver?> GetDriverByIdAsync(string driverId, CancellationToken cancellationToken = default);
    Task<Driver?> GetDriverByEmailAsync(string email, CancellationToken cancellationToken = default);
    Task<Wallet?> GetWalletByDriverIdAsync(string driverId, CancellationToken cancellationToken = default);
    Task UpdateDriverProfileAsync(string driverId, string name, string phone, CancellationToken cancellationToken = default);
    Task UpdateDriverPasswordAsync(string driverId, string passwordHash, CancellationToken cancellationToken = default);
    Task SaveDriverVerificationCodeAsync(string driverId, string email, string code, DateTime expiresAt, CancellationToken cancellationToken = default);
    Task<(bool Success, string? Status)> ValidateAndConsumeDriverVerificationCodeAsync(string email, string code, CancellationToken cancellationToken = default);
    Task<bool> MarkDriverEmailAsVerifiedAsync(string driverIdOrEmail, CancellationToken cancellationToken = default);
    Task<bool> IsDriverEmailVerifiedAsync(string driverIdOrEmail, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<DriverVehicle>> GetVehiclesByDriverIdAsync(string driverId, CancellationToken cancellationToken = default);
    Task<DriverVehicle?> GetVehicleByIdAsync(string vehicleId, string driverId, CancellationToken cancellationToken = default);
    Task<DriverVehicle> CreateVehicleAsync(DriverVehicle vehicle, CancellationToken cancellationToken = default);
    Task<DriverVehicle?> UpdateVehicleAsync(string vehicleId, string driverId, string make, string model, string plateNumber, string connectorType, bool? isDefault, CancellationToken cancellationToken = default);
    Task<bool> DeleteVehicleAsync(string vehicleId, string driverId, CancellationToken cancellationToken = default);
    Task<bool> SetDefaultVehicleAsync(string vehicleId, string driverId, CancellationToken cancellationToken = default);
}

public class DriverRepository : IDriverRepository
{
    private const string DriverIdParameter = "@driver_id";
    private const string VehicleIdParameter = "@vehicle_id";

    private readonly IDbConnectionFactory _connectionFactory;

    public DriverRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<bool> IsEmailRegisteredAsync(string email, CancellationToken cancellationToken = default)
    {
        const string sql = "SELECT COUNT(1) FROM drivers WHERE email = @email;";
        await using var connection = await _connectionFactory.CreateOpenConnectionAsync(cancellationToken);
        await using var command = new MySqlCommand(sql, connection);
        command.Parameters.Add("@email", MySqlDbType.VarChar, 255).Value = email.Trim().ToLowerInvariant();

        var count = Convert.ToInt64(await command.ExecuteScalarAsync(cancellationToken));
        return count > 0;
    }

    public async Task<(Driver Driver, Wallet Wallet)> CreateDriverWithWalletAsync(Driver driver, Wallet wallet, CancellationToken cancellationToken = default)
    {
        await using var connection = await _connectionFactory.CreateOpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        try
        {
            // 1. Insert Driver Record
            const string insertDriverSql = @"
                INSERT INTO drivers (
                    driver_id,
                    name,
                    email,
                    phone,
                    password_hash,
                    role,
                    status,
                    is_email_verified,
                    created_at,
                    updated_at
                ) VALUES (
                    @driver_id,
                    @name,
                    @email,
                    @phone,
                    @password_hash,
                    @role,
                    @status,
                    @is_email_verified,
                    @created_at,
                    @updated_at
                );
            ";

            await using var driverCommand = new MySqlCommand(insertDriverSql, connection, transaction);
            driverCommand.Parameters.Add(DriverIdParameter, MySqlDbType.VarChar, 50).Value = driver.DriverId;
            driverCommand.Parameters.Add("@name", MySqlDbType.VarChar, 255).Value = driver.Name;
            driverCommand.Parameters.Add("@email", MySqlDbType.VarChar, 255).Value = driver.Email.Trim().ToLowerInvariant();
            driverCommand.Parameters.Add("@phone", MySqlDbType.VarChar, 50).Value = driver.Phone;
            driverCommand.Parameters.Add("@password_hash", MySqlDbType.VarChar, 255).Value = driver.PasswordHash;
            driverCommand.Parameters.Add("@role", MySqlDbType.VarChar, 50).Value = driver.Role;
            driverCommand.Parameters.Add("@status", MySqlDbType.VarChar, 50).Value = driver.Status;
            driverCommand.Parameters.Add("@is_email_verified", MySqlDbType.Bool).Value = driver.IsEmailVerified;
            driverCommand.Parameters.Add("@created_at", MySqlDbType.DateTime).Value = driver.CreatedAt;
            driverCommand.Parameters.Add("@updated_at", MySqlDbType.DateTime).Value = driver.UpdatedAt;

            await driverCommand.ExecuteNonQueryAsync(cancellationToken);

            // 2. Insert Associated Wallet Record
            const string insertWalletSql = @"
                INSERT INTO wallets (
                    wallet_id,
                    driver_id,
                    balance,
                    currency,
                    status,
                    created_at,
                    updated_at
                ) VALUES (
                    @wallet_id,
                    @driver_id,
                    @balance,
                    @currency,
                    @status,
                    @created_at,
                    @updated_at
                );
            ";

            await using var walletCommand = new MySqlCommand(insertWalletSql, connection, transaction);
            walletCommand.Parameters.Add("@wallet_id", MySqlDbType.VarChar, 50).Value = wallet.WalletId;
            walletCommand.Parameters.Add(DriverIdParameter, MySqlDbType.VarChar, 50).Value = wallet.DriverId;
            walletCommand.Parameters.Add("@balance", MySqlDbType.Decimal).Value = wallet.Balance;
            walletCommand.Parameters.Add("@currency", MySqlDbType.VarChar, 10).Value = wallet.Currency;
            walletCommand.Parameters.Add("@status", MySqlDbType.VarChar, 50).Value = wallet.Status;
            walletCommand.Parameters.Add("@created_at", MySqlDbType.DateTime).Value = wallet.CreatedAt;
            walletCommand.Parameters.Add("@updated_at", MySqlDbType.DateTime).Value = wallet.UpdatedAt;

            await walletCommand.ExecuteNonQueryAsync(cancellationToken);

            // Commit atomic transaction
            await transaction.CommitAsync(cancellationToken);

            return (driver, wallet);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    public async Task<Driver?> GetDriverByIdAsync(string driverId, CancellationToken cancellationToken = default)
    {
        const string sql = @"
            SELECT driver_id, name, email, phone, password_hash, role, status, is_email_verified, created_at, updated_at
            FROM drivers
            WHERE driver_id = @driver_id
            LIMIT 1;
        ";

        await using var connection = await _connectionFactory.CreateOpenConnectionAsync(cancellationToken);
        await using var command = new MySqlCommand(sql, connection);
        command.Parameters.Add(DriverIdParameter, MySqlDbType.VarChar, 50).Value = driverId;

        await using var reader = await command.ExecuteReaderAsync(CommandBehavior.SingleRow, cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }

        return MapDriver(reader);
    }

    public async Task<Driver?> GetDriverByEmailAsync(string email, CancellationToken cancellationToken = default)
    {
        const string sql = @"
            SELECT driver_id, name, email, phone, password_hash, role, status, is_email_verified, created_at, updated_at
            FROM drivers
            WHERE email = @email
            LIMIT 1;
        ";

        await using var connection = await _connectionFactory.CreateOpenConnectionAsync(cancellationToken);
        await using var command = new MySqlCommand(sql, connection);
        command.Parameters.Add("@email", MySqlDbType.VarChar, 255).Value = email.Trim().ToLowerInvariant();

        await using var reader = await command.ExecuteReaderAsync(CommandBehavior.SingleRow, cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }

        return MapDriver(reader);
    }

    public async Task<Wallet?> GetWalletByDriverIdAsync(string driverId, CancellationToken cancellationToken = default)
    {
        const string sql = @"
            SELECT wallet_id, driver_id, balance, currency, status, created_at, updated_at
            FROM wallets
            WHERE driver_id = @driver_id
            LIMIT 1;
        ";

        await using var connection = await _connectionFactory.CreateOpenConnectionAsync(cancellationToken);
        await using var command = new MySqlCommand(sql, connection);
        command.Parameters.Add(DriverIdParameter, MySqlDbType.VarChar, 50).Value = driverId;

        await using var reader = await command.ExecuteReaderAsync(CommandBehavior.SingleRow, cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }

        return MapWallet(reader);
    }

    private static Driver MapDriver(MySqlDataReader reader)
    {
        var verifiedColOrdinal = reader.GetOrdinal("is_email_verified");
        bool isEmailVerified = !reader.IsDBNull(verifiedColOrdinal) && reader.GetBoolean(verifiedColOrdinal);

        return new Driver
        {
            DriverId = reader.GetString("driver_id"),
            Name = reader.GetString("name"),
            Email = reader.GetString("email"),
            Phone = reader.GetString("phone"),
            PasswordHash = reader.GetString("password_hash"),
            Role = reader.GetString("role"),
            Status = reader.GetString("status"),
            IsEmailVerified = isEmailVerified,
            CreatedAt = reader.GetDateTime("created_at"),
            UpdatedAt = reader.GetDateTime("updated_at")
        };
    }

    private static Wallet MapWallet(MySqlDataReader reader)
    {
        return new Wallet
        {
            WalletId = reader.GetString("wallet_id"),
            DriverId = reader.GetString("driver_id"),
            Balance = reader.GetDecimal("balance"),
            Currency = reader.GetString("currency"),
            Status = reader.GetString("status"),
            CreatedAt = reader.GetDateTime("created_at"),
            UpdatedAt = reader.GetDateTime("updated_at")
        };
    }

    public async Task UpdateDriverProfileAsync(string driverId, string name, string phone, CancellationToken cancellationToken = default)
    {
        const string sql = @"
            UPDATE drivers
            SET name = @name,
                phone = @phone,
                updated_at = CURRENT_TIMESTAMP
            WHERE driver_id = @driver_id;
        ";

        await using var connection = await _connectionFactory.CreateOpenConnectionAsync(cancellationToken);
        await using var command = new MySqlCommand(sql, connection);
        command.Parameters.Add(DriverIdParameter, MySqlDbType.VarChar, 50).Value = driverId;
        command.Parameters.Add("@name", MySqlDbType.VarChar, 255).Value = name.Trim();
        command.Parameters.Add("@phone", MySqlDbType.VarChar, 50).Value = phone.Trim();

        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task UpdateDriverPasswordAsync(string driverId, string passwordHash, CancellationToken cancellationToken = default)
    {
        const string sql = @"
            UPDATE drivers
            SET password_hash = @password_hash,
                updated_at = CURRENT_TIMESTAMP
            WHERE driver_id = @driver_id;
        ";

        await using var connection = await _connectionFactory.CreateOpenConnectionAsync(cancellationToken);
        await using var command = new MySqlCommand(sql, connection);
        command.Parameters.Add(DriverIdParameter, MySqlDbType.VarChar, 50).Value = driverId;
        command.Parameters.Add("@password_hash", MySqlDbType.VarChar, 255).Value = passwordHash;

        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task SaveDriverVerificationCodeAsync(
        string driverId,
        string email,
        string code,
        DateTime expiresAt,
        CancellationToken cancellationToken = default)
    {
        const string sql = @"
            INSERT INTO driver_email_verification_tokens (
                token_id,
                driver_id,
                email,
                verification_code,
                expires_at,
                is_used,
                created_at
            ) VALUES (
                @token_id,
                @driver_id,
                @email,
                @code,
                @expires_at,
                FALSE,
                @created_at
            );
        ";

        await using var connection = await _connectionFactory.CreateOpenConnectionAsync(cancellationToken);
        await using var command = new MySqlCommand(sql, connection);
        command.Parameters.Add("@token_id", MySqlDbType.VarChar, 50).Value = $"DEVT-{Guid.NewGuid():N}".ToUpperInvariant();
        command.Parameters.Add(DriverIdParameter, MySqlDbType.VarChar, 50).Value = driverId;
        command.Parameters.Add("@email", MySqlDbType.VarChar, 255).Value = email.Trim().ToLowerInvariant();
        command.Parameters.Add("@code", MySqlDbType.VarChar, 50).Value = code.Trim();
        command.Parameters.Add("@expires_at", MySqlDbType.DateTime).Value = expiresAt;
        command.Parameters.Add("@created_at", MySqlDbType.DateTime).Value = DateTime.UtcNow;

        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<(bool Success, string? Status)> ValidateAndConsumeDriverVerificationCodeAsync(
        string email,
        string code,
        CancellationToken cancellationToken = default)
    {
        const string selectSql = @"
            SELECT token_id, is_used, expires_at
            FROM driver_email_verification_tokens
            WHERE email = @email
              AND verification_code = @code
            ORDER BY created_at DESC
            LIMIT 1;
        ";

        await using var connection = await _connectionFactory.CreateOpenConnectionAsync(cancellationToken);
        await using var selectCommand = new MySqlCommand(selectSql, connection);
        selectCommand.Parameters.Add("@email", MySqlDbType.VarChar, 255).Value = email.Trim().ToLowerInvariant();
        selectCommand.Parameters.Add("@code", MySqlDbType.VarChar, 50).Value = code.Trim();

        await using var reader = await selectCommand.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return (false, "NotFound");
        }

        var tokenId = reader.GetString("token_id");
        var isUsed = reader.GetBoolean("is_used");
        var expiresAt = reader.GetDateTime("expires_at");
        await reader.CloseAsync();

        if (isUsed)
        {
            return (false, "AlreadyUsed");
        }

        if (expiresAt <= DateTime.UtcNow)
        {
            return (false, "Expired");
        }

        const string updateSql = @"
            UPDATE driver_email_verification_tokens
            SET is_used = TRUE
            WHERE token_id = @token_id;
        ";

        await using var updateCommand = new MySqlCommand(updateSql, connection);
        updateCommand.Parameters.Add("@token_id", MySqlDbType.VarChar, 50).Value = tokenId;
        await updateCommand.ExecuteNonQueryAsync(cancellationToken);

        return (true, "Valid");
    }

    public async Task<bool> MarkDriverEmailAsVerifiedAsync(string driverIdOrEmail, CancellationToken cancellationToken = default)
    {
        const string sql = @"
            UPDATE drivers
            SET is_email_verified = TRUE,
                updated_at = CURRENT_TIMESTAMP
            WHERE driver_id = @identifier OR email = @identifier;
        ";

        await using var connection = await _connectionFactory.CreateOpenConnectionAsync(cancellationToken);
        await using var command = new MySqlCommand(sql, connection);
        command.Parameters.Add("@identifier", MySqlDbType.VarChar, 255).Value = driverIdOrEmail.Trim().ToLowerInvariant();

        var rows = await command.ExecuteNonQueryAsync(cancellationToken);
        return rows > 0;
    }

    public async Task<bool> IsDriverEmailVerifiedAsync(string driverIdOrEmail, CancellationToken cancellationToken = default)
    {
        const string sql = @"
            SELECT is_email_verified
            FROM drivers
            WHERE driver_id = @identifier OR email = @identifier
            LIMIT 1;
        ";

        await using var connection = await _connectionFactory.CreateOpenConnectionAsync(cancellationToken);
        await using var command = new MySqlCommand(sql, connection);
        command.Parameters.Add("@identifier", MySqlDbType.VarChar, 255).Value = driverIdOrEmail.Trim().ToLowerInvariant();

        var result = await command.ExecuteScalarAsync(cancellationToken);
        return result != null && Convert.ToBoolean(result);
    }

    public async Task<IReadOnlyList<DriverVehicle>> GetVehiclesByDriverIdAsync(string driverId, CancellationToken cancellationToken = default)
    {
        const string sql = @"
            SELECT vehicle_id, driver_id, make, model, plate_number, connector_type, is_default, created_at, updated_at
            FROM driver_vehicles
            WHERE driver_id = @driver_id
            ORDER BY is_default DESC, created_at DESC;
        ";

        var vehicles = new List<DriverVehicle>();
        await using var connection = await _connectionFactory.CreateOpenConnectionAsync(cancellationToken);
        await using var command = new MySqlCommand(sql, connection);
        command.Parameters.Add(DriverIdParameter, MySqlDbType.VarChar, 50).Value = driverId.Trim();

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            vehicles.Add(MapVehicle(reader));
        }

        return vehicles;
    }

    public async Task<DriverVehicle?> GetVehicleByIdAsync(string vehicleId, string driverId, CancellationToken cancellationToken = default)
    {
        const string sql = @"
            SELECT vehicle_id, driver_id, make, model, plate_number, connector_type, is_default, created_at, updated_at
            FROM driver_vehicles
            WHERE vehicle_id = @vehicle_id AND driver_id = @driver_id
            LIMIT 1;
        ";

        await using var connection = await _connectionFactory.CreateOpenConnectionAsync(cancellationToken);
        await using var command = new MySqlCommand(sql, connection);
        command.Parameters.Add(VehicleIdParameter, MySqlDbType.VarChar, 50).Value = vehicleId.Trim();
        command.Parameters.Add(DriverIdParameter, MySqlDbType.VarChar, 50).Value = driverId.Trim();

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (await reader.ReadAsync(cancellationToken))
        {
            return MapVehicle(reader);
        }

        return null;
    }

    public async Task<DriverVehicle> CreateVehicleAsync(DriverVehicle vehicle, CancellationToken cancellationToken = default)
    {
        await using var connection = await _connectionFactory.CreateOpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        try
        {
            // Check count of existing vehicles for this driver
            const string countSql = "SELECT COUNT(1) FROM driver_vehicles WHERE driver_id = @driver_id;";
            await using var countCmd = new MySqlCommand(countSql, connection, transaction);
            countCmd.Parameters.Add(DriverIdParameter, MySqlDbType.VarChar, 50).Value = vehicle.DriverId.Trim();
            var existingCount = Convert.ToInt64(await countCmd.ExecuteScalarAsync(cancellationToken));

            // If first vehicle, force it to be default
            if (existingCount == 0)
            {
                vehicle.IsDefault = true;
            }

            // If marked default, unset default on other vehicles
            if (vehicle.IsDefault && existingCount > 0)
            {
                const string unsetDefaultSql = @"
                    UPDATE driver_vehicles 
                    SET is_default = FALSE, updated_at = CURRENT_TIMESTAMP 
                    WHERE driver_id = @driver_id;
                ";
                await using var unsetCmd = new MySqlCommand(unsetDefaultSql, connection, transaction);
                unsetCmd.Parameters.Add(DriverIdParameter, MySqlDbType.VarChar, 50).Value = vehicle.DriverId.Trim();
                await unsetCmd.ExecuteNonQueryAsync(cancellationToken);
            }

            const string insertSql = @"
                INSERT INTO driver_vehicles (
                    vehicle_id, driver_id, make, model, plate_number, connector_type, is_default, created_at, updated_at
                ) VALUES (
                    @vehicle_id, @driver_id, @make, @model, @plate_number, @connector_type, @is_default, @created_at, @updated_at
                );
            ";

            await using var insertCmd = new MySqlCommand(insertSql, connection, transaction);
            insertCmd.Parameters.Add(VehicleIdParameter, MySqlDbType.VarChar, 50).Value = vehicle.VehicleId;
            insertCmd.Parameters.Add(DriverIdParameter, MySqlDbType.VarChar, 50).Value = vehicle.DriverId.Trim();
            insertCmd.Parameters.Add("@make", MySqlDbType.VarChar, 100).Value = vehicle.Make.Trim();
            insertCmd.Parameters.Add("@model", MySqlDbType.VarChar, 100).Value = vehicle.Model.Trim();
            insertCmd.Parameters.Add("@plate_number", MySqlDbType.VarChar, 50).Value = vehicle.PlateNumber.Trim();
            insertCmd.Parameters.Add("@connector_type", MySqlDbType.VarChar, 50).Value = vehicle.ConnectorType.Trim();
            insertCmd.Parameters.Add("@is_default", MySqlDbType.Bool).Value = vehicle.IsDefault;
            insertCmd.Parameters.Add("@created_at", MySqlDbType.DateTime).Value = vehicle.CreatedAt;
            insertCmd.Parameters.Add("@updated_at", MySqlDbType.DateTime).Value = vehicle.UpdatedAt;

            await insertCmd.ExecuteNonQueryAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return vehicle;
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    public async Task<DriverVehicle?> UpdateVehicleAsync(string vehicleId, string driverId, string make, string model, string plateNumber, string connectorType, bool? isDefault, CancellationToken cancellationToken = default)
    {
        await using var connection = await _connectionFactory.CreateOpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        try
        {
            // Verify existing vehicle ownership
            const string selectSql = @"
                SELECT vehicle_id, driver_id, make, model, plate_number, connector_type, is_default, created_at, updated_at
                FROM driver_vehicles
                WHERE vehicle_id = @vehicle_id AND driver_id = @driver_id
                LIMIT 1;
            ";
            await using var selectCmd = new MySqlCommand(selectSql, connection, transaction);
            selectCmd.Parameters.Add(VehicleIdParameter, MySqlDbType.VarChar, 50).Value = vehicleId.Trim();
            selectCmd.Parameters.Add(DriverIdParameter, MySqlDbType.VarChar, 50).Value = driverId.Trim();

            DriverVehicle? existing = null;
            await using (var reader = await selectCmd.ExecuteReaderAsync(cancellationToken))
            {
                if (await reader.ReadAsync(cancellationToken))
                {
                    existing = MapVehicle(reader);
                }
            }

            if (existing == null)
            {
                await transaction.RollbackAsync(cancellationToken);
                return null;
            }

            var newDefault = isDefault ?? existing.IsDefault;

            if (newDefault && !existing.IsDefault)
            {
                const string unsetDefaultSql = @"
                    UPDATE driver_vehicles 
                    SET is_default = FALSE, updated_at = CURRENT_TIMESTAMP 
                    WHERE driver_id = @driver_id;
                ";
                await using var unsetCmd = new MySqlCommand(unsetDefaultSql, connection, transaction);
                unsetCmd.Parameters.Add(DriverIdParameter, MySqlDbType.VarChar, 50).Value = driverId.Trim();
                await unsetCmd.ExecuteNonQueryAsync(cancellationToken);
            }

            const string updateSql = @"
                UPDATE driver_vehicles
                SET make = @make,
                    model = @model,
                    plate_number = @plate_number,
                    connector_type = @connector_type,
                    is_default = @is_default,
                    updated_at = CURRENT_TIMESTAMP
                WHERE vehicle_id = @vehicle_id AND driver_id = @driver_id;
            ";

            await using var updateCmd = new MySqlCommand(updateSql, connection, transaction);
            updateCmd.Parameters.Add(VehicleIdParameter, MySqlDbType.VarChar, 50).Value = vehicleId.Trim();
            updateCmd.Parameters.Add(DriverIdParameter, MySqlDbType.VarChar, 50).Value = driverId.Trim();
            updateCmd.Parameters.Add("@make", MySqlDbType.VarChar, 100).Value = make.Trim();
            updateCmd.Parameters.Add("@model", MySqlDbType.VarChar, 100).Value = model.Trim();
            updateCmd.Parameters.Add("@plate_number", MySqlDbType.VarChar, 50).Value = plateNumber.Trim();
            updateCmd.Parameters.Add("@connector_type", MySqlDbType.VarChar, 50).Value = connectorType.Trim();
            updateCmd.Parameters.Add("@is_default", MySqlDbType.Bool).Value = newDefault;

            await updateCmd.ExecuteNonQueryAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            existing.Make = make.Trim();
            existing.Model = model.Trim();
            existing.PlateNumber = plateNumber.Trim();
            existing.ConnectorType = connectorType.Trim();
            existing.IsDefault = newDefault;
            existing.UpdatedAt = DateTime.UtcNow;

            return existing;
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    public async Task<bool> DeleteVehicleAsync(string vehicleId, string driverId, CancellationToken cancellationToken = default)
    {
        await using var connection = await _connectionFactory.CreateOpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        try
        {
            const string checkSql = @"
                SELECT is_default
                FROM driver_vehicles
                WHERE vehicle_id = @vehicle_id AND driver_id = @driver_id
                LIMIT 1;
            ";

            await using var checkCmd = new MySqlCommand(checkSql, connection, transaction);
            checkCmd.Parameters.Add(VehicleIdParameter, MySqlDbType.VarChar, 50).Value = vehicleId.Trim();
            checkCmd.Parameters.Add(DriverIdParameter, MySqlDbType.VarChar, 50).Value = driverId.Trim();

            var defaultObj = await checkCmd.ExecuteScalarAsync(cancellationToken);
            if (defaultObj == null)
            {
                await transaction.RollbackAsync(cancellationToken);
                return false;
            }

            var wasDefault = Convert.ToBoolean(defaultObj);

            const string deleteSql = "DELETE FROM driver_vehicles WHERE vehicle_id = @vehicle_id AND driver_id = @driver_id;";
            await using var deleteCmd = new MySqlCommand(deleteSql, connection, transaction);
            deleteCmd.Parameters.Add(VehicleIdParameter, MySqlDbType.VarChar, 50).Value = vehicleId.Trim();
            deleteCmd.Parameters.Add(DriverIdParameter, MySqlDbType.VarChar, 50).Value = driverId.Trim();
            await deleteCmd.ExecuteNonQueryAsync(cancellationToken);

            // If the deleted vehicle was default, promote one remaining vehicle if any exist
            if (wasDefault)
            {
                const string promoteSql = @"
                    UPDATE driver_vehicles
                    SET is_default = TRUE, updated_at = CURRENT_TIMESTAMP
                    WHERE driver_id = @driver_id
                    ORDER BY created_at DESC
                    LIMIT 1;
                ";
                await using var promoteCmd = new MySqlCommand(promoteSql, connection, transaction);
                promoteCmd.Parameters.Add(DriverIdParameter, MySqlDbType.VarChar, 50).Value = driverId.Trim();
                await promoteCmd.ExecuteNonQueryAsync(cancellationToken);
            }

            await transaction.CommitAsync(cancellationToken);
            return true;
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    public async Task<bool> SetDefaultVehicleAsync(string vehicleId, string driverId, CancellationToken cancellationToken = default)
    {
        await using var connection = await _connectionFactory.CreateOpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        try
        {
            const string checkSql = "SELECT COUNT(1) FROM driver_vehicles WHERE vehicle_id = @vehicle_id AND driver_id = @driver_id;";
            await using var checkCmd = new MySqlCommand(checkSql, connection, transaction);
            checkCmd.Parameters.Add(VehicleIdParameter, MySqlDbType.VarChar, 50).Value = vehicleId.Trim();
            checkCmd.Parameters.Add(DriverIdParameter, MySqlDbType.VarChar, 50).Value = driverId.Trim();

            var exists = Convert.ToInt64(await checkCmd.ExecuteScalarAsync(cancellationToken)) > 0;
            if (!exists)
            {
                await transaction.RollbackAsync(cancellationToken);
                return false;
            }

            const string unsetSql = @"
                UPDATE driver_vehicles
                SET is_default = FALSE, updated_at = CURRENT_TIMESTAMP
                WHERE driver_id = @driver_id;
            ";
            await using var unsetCmd = new MySqlCommand(unsetSql, connection, transaction);
            unsetCmd.Parameters.Add(DriverIdParameter, MySqlDbType.VarChar, 50).Value = driverId.Trim();
            await unsetCmd.ExecuteNonQueryAsync(cancellationToken);

            const string setSql = @"
                UPDATE driver_vehicles
                SET is_default = TRUE, updated_at = CURRENT_TIMESTAMP
                WHERE vehicle_id = @vehicle_id AND driver_id = @driver_id;
            ";
            await using var setCmd = new MySqlCommand(setSql, connection, transaction);
            setCmd.Parameters.Add(VehicleIdParameter, MySqlDbType.VarChar, 50).Value = vehicleId.Trim();
            setCmd.Parameters.Add(DriverIdParameter, MySqlDbType.VarChar, 50).Value = driverId.Trim();
            await setCmd.ExecuteNonQueryAsync(cancellationToken);

            await transaction.CommitAsync(cancellationToken);
            return true;
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    private static DriverVehicle MapVehicle(IDataRecord record)
    {
        return new DriverVehicle
        {
            VehicleId = record.GetString(record.GetOrdinal("vehicle_id")),
            DriverId = record.GetString(record.GetOrdinal("driver_id")),
            Make = record.GetString(record.GetOrdinal("make")),
            Model = record.GetString(record.GetOrdinal("model")),
            PlateNumber = record.GetString(record.GetOrdinal("plate_number")),
            ConnectorType = record.GetString(record.GetOrdinal("connector_type")),
            IsDefault = record.GetBoolean(record.GetOrdinal("is_default")),
            CreatedAt = record.GetDateTime(record.GetOrdinal("created_at")),
            UpdatedAt = record.GetDateTime(record.GetOrdinal("updated_at"))
        };
    }
}
