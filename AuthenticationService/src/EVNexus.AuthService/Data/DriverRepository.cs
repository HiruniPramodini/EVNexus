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
}

public class DriverRepository : IDriverRepository
{
    private const string DriverIdParameter = "@driver_id";

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
            SELECT driver_id, name, email, phone, password_hash, role, status, created_at, updated_at
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
            SELECT driver_id, name, email, phone, password_hash, role, status, created_at, updated_at
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
        return new Driver
        {
            DriverId = reader.GetString("driver_id"),
            Name = reader.GetString("name"),
            Email = reader.GetString("email"),
            Phone = reader.GetString("phone"),
            PasswordHash = reader.GetString("password_hash"),
            Role = reader.GetString("role"),
            Status = reader.GetString("status"),
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
}
