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
    Task<Tenant?> UpdateTenantProfileAsync(string tenantId, string companyName, string phone, string address, string? logoUrl, CancellationToken cancellationToken = default);
    Task<bool> UpdateTenantEmailAsync(string tenantId, string newEmail, CancellationToken cancellationToken = default);
    Task SaveEmailVerificationCodeAsync(string tenantId, string newEmail, string code, DateTime expiresAt, CancellationToken cancellationToken = default);
    Task<bool> ValidateAndConsumeVerificationCodeAsync(string tenantId, string newEmail, string code, CancellationToken cancellationToken = default);
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
                logo_url,
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
                @logo_url,
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
        command.Parameters.Add("@logo_url", MySqlDbType.LongText).Value = (object?)tenant.LogoUrl ?? DBNull.Value;
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
            SELECT tenant_id, company_name, registration_number, business_email, phone, address, logo_url,
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
            SELECT tenant_id, company_name, registration_number, business_email, phone, address, logo_url,
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

    public async Task<Tenant?> UpdateTenantProfileAsync(
        string tenantId,
        string companyName,
        string phone,
        string address,
        string? logoUrl,
        CancellationToken cancellationToken = default)
    {
        const string sql = @"
            UPDATE tenants
            SET company_name = @company_name,
                phone = @phone,
                address = @address,
                logo_url = @logo_url,
                updated_at = @updated_at
            WHERE tenant_id = @tenant_id;
        ";

        await using var connection = await _connectionFactory.CreateOpenConnectionAsync(cancellationToken);
        await using var command = new MySqlCommand(sql, connection);

        command.Parameters.Add("@tenant_id", MySqlDbType.VarChar, 50).Value = tenantId;
        command.Parameters.Add("@company_name", MySqlDbType.VarChar, 255).Value = companyName.Trim();
        command.Parameters.Add("@phone", MySqlDbType.VarChar, 50).Value = phone.Trim();
        command.Parameters.Add("@address", MySqlDbType.Text).Value = address.Trim();
        command.Parameters.Add("@logo_url", MySqlDbType.LongText).Value = (object?)logoUrl?.Trim() ?? DBNull.Value;
        command.Parameters.Add("@updated_at", MySqlDbType.DateTime).Value = DateTime.UtcNow;

        var rowsAffected = await command.ExecuteNonQueryAsync(cancellationToken);
        if (rowsAffected == 0)
        {
            return null;
        }

        return await GetTenantByIdAsync(tenantId, cancellationToken);
    }

    public async Task<bool> UpdateTenantEmailAsync(
        string tenantId,
        string newEmail,
        CancellationToken cancellationToken = default)
    {
        const string sql = @"
            UPDATE tenants
            SET business_email = @business_email,
                updated_at = @updated_at
            WHERE tenant_id = @tenant_id;
        ";

        await using var connection = await _connectionFactory.CreateOpenConnectionAsync(cancellationToken);
        await using var command = new MySqlCommand(sql, connection);

        command.Parameters.Add("@tenant_id", MySqlDbType.VarChar, 50).Value = tenantId;
        command.Parameters.Add("@business_email", MySqlDbType.VarChar, 255).Value = newEmail.Trim().ToLowerInvariant();
        command.Parameters.Add("@updated_at", MySqlDbType.DateTime).Value = DateTime.UtcNow;

        var rowsAffected = await command.ExecuteNonQueryAsync(cancellationToken);
        return rowsAffected > 0;
    }

    public async Task SaveEmailVerificationCodeAsync(
        string tenantId,
        string newEmail,
        string code,
        DateTime expiresAt,
        CancellationToken cancellationToken = default)
    {
        const string sql = @"
            INSERT INTO email_verification_tokens (
                token_id,
                tenant_id,
                new_email,
                verification_code,
                expires_at,
                is_used,
                created_at
            ) VALUES (
                @token_id,
                @tenant_id,
                @new_email,
                @code,
                @expires_at,
                FALSE,
                @created_at
            );
        ";

        await using var connection = await _connectionFactory.CreateOpenConnectionAsync(cancellationToken);
        await using var command = new MySqlCommand(sql, connection);

        command.Parameters.Add("@token_id", MySqlDbType.VarChar, 50).Value = $"EVT-{Guid.NewGuid():N}".ToUpperInvariant();
        command.Parameters.Add("@tenant_id", MySqlDbType.VarChar, 50).Value = tenantId;
        command.Parameters.Add("@new_email", MySqlDbType.VarChar, 255).Value = newEmail.Trim().ToLowerInvariant();
        command.Parameters.Add("@code", MySqlDbType.VarChar, 50).Value = code.Trim();
        command.Parameters.Add("@expires_at", MySqlDbType.DateTime).Value = expiresAt;
        command.Parameters.Add("@created_at", MySqlDbType.DateTime).Value = DateTime.UtcNow;

        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<bool> ValidateAndConsumeVerificationCodeAsync(
        string tenantId,
        string newEmail,
        string code,
        CancellationToken cancellationToken = default)
    {
        const string selectSql = @"
            SELECT token_id 
            FROM email_verification_tokens
            WHERE tenant_id = @tenant_id
              AND new_email = @new_email
              AND verification_code = @code
              AND is_used = FALSE
              AND expires_at > @now
            ORDER BY created_at DESC
            LIMIT 1;
        ";

        await using var connection = await _connectionFactory.CreateOpenConnectionAsync(cancellationToken);
        await using var selectCommand = new MySqlCommand(selectSql, connection);

        selectCommand.Parameters.Add("@tenant_id", MySqlDbType.VarChar, 50).Value = tenantId;
        selectCommand.Parameters.Add("@new_email", MySqlDbType.VarChar, 255).Value = newEmail.Trim().ToLowerInvariant();
        selectCommand.Parameters.Add("@code", MySqlDbType.VarChar, 50).Value = code.Trim();
        selectCommand.Parameters.Add("@now", MySqlDbType.DateTime).Value = DateTime.UtcNow;

        var tokenIdObj = await selectCommand.ExecuteScalarAsync(cancellationToken);
        if (tokenIdObj == null)
        {
            return false;
        }

        var tokenId = tokenIdObj.ToString();
        const string updateSql = @"
            UPDATE email_verification_tokens
            SET is_used = TRUE
            WHERE token_id = @token_id;
        ";

        await using var updateCommand = new MySqlCommand(updateSql, connection);
        updateCommand.Parameters.Add("@token_id", MySqlDbType.VarChar, 50).Value = tokenId;
        await updateCommand.ExecuteNonQueryAsync(cancellationToken);

        return true;
    }

    private static Tenant MapTenant(MySqlDataReader reader)
    {
        var logoColOrdinal = reader.GetOrdinal("logo_url");
        string? logoUrl = !reader.IsDBNull(logoColOrdinal) ? reader.GetString(logoColOrdinal) : null;

        return new Tenant
        {
            TenantId = reader.GetString("tenant_id"),
            CompanyName = reader.GetString("company_name"),
            RegistrationNumber = reader.GetString("registration_number"),
            BusinessEmail = reader.GetString("business_email"),
            Phone = reader.GetString("phone"),
            Address = reader.GetString("address"),
            LogoUrl = logoUrl,
            PasswordHash = reader.GetString("password_hash"),
            Role = reader.GetString("role"),
            Status = reader.GetString("status"),
            CreatedAt = reader.GetDateTime("created_at"),
            UpdatedAt = reader.GetDateTime("updated_at")
        };
    }
}
