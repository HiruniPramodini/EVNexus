using System.Data;
using EVNexus.AuthService.Models;
using MySqlConnector;

namespace EVNexus.AuthService.Data;

public interface ITenantRepository
{
    Task<bool> IsEmailRegisteredAsync(string email, CancellationToken cancellationToken = default);
    Task<bool> IsRegistrationNumberRegisteredAsync(string registrationNumber, CancellationToken cancellationToken = default);
    Task<Tenant> CreateTenantAsync(Tenant tenant, CancellationToken cancellationToken = default);
    Task<Tenant?> GetTenantByIdAsync(string tenantId, CancellationToken cancellationToken = default);
    Task<Tenant?> GetTenantByEmailAsync(string email, CancellationToken cancellationToken = default);
}

public class TenantRepository : ITenantRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public TenantRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<bool> IsEmailRegisteredAsync(string email, CancellationToken cancellationToken = default)
    {
        const string sql = "SELECT COUNT(1) FROM tenants WHERE business_email = @email;";
        await using var connection = await _connectionFactory.CreateOpenConnectionAsync(cancellationToken);
        await using var command = new MySqlCommand(sql, connection);
        command.Parameters.Add("@email", MySqlDbType.VarChar, 255).Value = email.Trim().ToLowerInvariant();

        var count = Convert.ToInt64(await command.ExecuteScalarAsync(cancellationToken));
        return count > 0;
    }

    public async Task<bool> IsRegistrationNumberRegisteredAsync(string registrationNumber, CancellationToken cancellationToken = default)
    {
        const string sql = "SELECT COUNT(1) FROM tenants WHERE registration_number = @regNum;";
        await using var connection = await _connectionFactory.CreateOpenConnectionAsync(cancellationToken);
        await using var command = new MySqlCommand(sql, connection);
        command.Parameters.Add("@regNum", MySqlDbType.VarChar, 100).Value = registrationNumber.Trim();

        var count = Convert.ToInt64(await command.ExecuteScalarAsync(cancellationToken));
        return count > 0;
    }

    public async Task<Tenant> CreateTenantAsync(Tenant tenant, CancellationToken cancellationToken = default)
    {
        const string sql = @"
            INSERT INTO tenants (
                tenant_id,
                company_name,
                registration_number,
                business_email,
                phone,
                address,
                password_hash,
                role,
                status,
                created_at,
                updated_at
            ) VALUES (
                @tenant_id,
                @company_name,
                @registration_number,
                @business_email,
                @phone,
                @address,
                @password_hash,
                @role,
                @status,
                @created_at,
                @updated_at
            );
        ";

        await using var connection = await _connectionFactory.CreateOpenConnectionAsync(cancellationToken);
        await using var command = new MySqlCommand(sql, connection);

        command.Parameters.Add("@tenant_id", MySqlDbType.VarChar, 50).Value = tenant.TenantId;
        command.Parameters.Add("@company_name", MySqlDbType.VarChar, 255).Value = tenant.CompanyName;
        command.Parameters.Add("@registration_number", MySqlDbType.VarChar, 100).Value = tenant.RegistrationNumber;
        command.Parameters.Add("@business_email", MySqlDbType.VarChar, 255).Value = tenant.BusinessEmail.Trim().ToLowerInvariant();
        command.Parameters.Add("@phone", MySqlDbType.VarChar, 50).Value = tenant.Phone;
        command.Parameters.Add("@address", MySqlDbType.Text).Value = tenant.Address;
        command.Parameters.Add("@password_hash", MySqlDbType.VarChar, 255).Value = tenant.PasswordHash;
        command.Parameters.Add("@role", MySqlDbType.VarChar, 50).Value = tenant.Role;
        command.Parameters.Add("@status", MySqlDbType.VarChar, 50).Value = tenant.Status;
        command.Parameters.Add("@created_at", MySqlDbType.DateTime).Value = tenant.CreatedAt;
        command.Parameters.Add("@updated_at", MySqlDbType.DateTime).Value = tenant.UpdatedAt;

        await command.ExecuteNonQueryAsync(cancellationToken);
        return tenant;
    }

    public async Task<Tenant?> GetTenantByIdAsync(string tenantId, CancellationToken cancellationToken = default)
    {
        const string sql = @"
            SELECT tenant_id, company_name, registration_number, business_email, phone, address,
                   password_hash, role, status, created_at, updated_at
            FROM tenants
            WHERE tenant_id = @tenant_id
            LIMIT 1;
        ";

        await using var connection = await _connectionFactory.CreateOpenConnectionAsync(cancellationToken);
        await using var command = new MySqlCommand(sql, connection);
        command.Parameters.Add("@tenant_id", MySqlDbType.VarChar, 50).Value = tenantId;

        await using var reader = await command.ExecuteReaderAsync(CommandBehavior.SingleRow, cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }

        return MapTenant(reader);
    }

    public async Task<Tenant?> GetTenantByEmailAsync(string email, CancellationToken cancellationToken = default)
    {
        const string sql = @"
            SELECT tenant_id, company_name, registration_number, business_email, phone, address,
                   password_hash, role, status, created_at, updated_at
            FROM tenants
            WHERE business_email = @email
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

        return MapTenant(reader);
    }

    private static Tenant MapTenant(MySqlDataReader reader)
    {
        return new Tenant
        {
            TenantId = reader.GetString("tenant_id"),
            CompanyName = reader.GetString("company_name"),
            RegistrationNumber = reader.GetString("registration_number"),
            BusinessEmail = reader.GetString("business_email"),
            Phone = reader.GetString("phone"),
            Address = reader.GetString("address"),
            PasswordHash = reader.GetString("password_hash"),
            Role = reader.GetString("role"),
            Status = reader.GetString("status"),
            CreatedAt = reader.GetDateTime("created_at"),
            UpdatedAt = reader.GetDateTime("updated_at")
        };
    }
}
