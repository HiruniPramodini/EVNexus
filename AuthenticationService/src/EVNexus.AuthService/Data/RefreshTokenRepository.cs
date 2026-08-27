using EVNexus.AuthService.Models;
using MySqlConnector;

namespace EVNexus.AuthService.Data;

public class RefreshTokenRepository : IRefreshTokenRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public RefreshTokenRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<RefreshToken> SaveRefreshTokenAsync(RefreshToken token, CancellationToken cancellationToken = default)
    {
        const string sql = @"
            INSERT INTO refresh_tokens (
                token_id, token, jwt_id, user_id, user_type, role, expires_at, is_revoked, created_at, revoked_at, replaced_by_token
            ) VALUES (
                @token_id, @token, @jwt_id, @user_id, @user_type, @role, @expires_at, @is_revoked, @created_at, @revoked_at, @replaced_by_token
            );
        ";

        await using var connection = await _connectionFactory.CreateOpenConnectionAsync(cancellationToken);
        await using var command = new MySqlCommand(sql, connection);
        command.Parameters.Add("@token_id", MySqlDbType.VarChar, 50).Value = token.TokenId;
        command.Parameters.Add("@token", MySqlDbType.VarChar, 255).Value = token.Token;
        command.Parameters.Add("@jwt_id", MySqlDbType.VarChar, 100).Value = (object?)token.JwtId ?? DBNull.Value;
        command.Parameters.Add("@user_id", MySqlDbType.VarChar, 50).Value = token.UserId;
        command.Parameters.Add("@user_type", MySqlDbType.VarChar, 50).Value = token.UserType;
        command.Parameters.Add("@role", MySqlDbType.VarChar, 50).Value = token.Role;
        command.Parameters.Add("@expires_at", MySqlDbType.DateTime).Value = token.ExpiresAt;
        command.Parameters.Add("@is_revoked", MySqlDbType.Bool).Value = token.IsRevoked;
        command.Parameters.Add("@created_at", MySqlDbType.DateTime).Value = token.CreatedAt;
        command.Parameters.Add("@revoked_at", MySqlDbType.DateTime).Value = (object?)token.RevokedAt ?? DBNull.Value;
        command.Parameters.Add("@replaced_by_token", MySqlDbType.VarChar, 255).Value = (object?)token.ReplacedByToken ?? DBNull.Value;

        await command.ExecuteNonQueryAsync(cancellationToken);
        return token;
    }

    public async Task<RefreshToken?> GetRefreshTokenAsync(string token, CancellationToken cancellationToken = default)
    {
        const string sql = @"
            SELECT token_id, token, jwt_id, user_id, user_type, role, expires_at, is_revoked, created_at, revoked_at, replaced_by_token
            FROM refresh_tokens
            WHERE token = @token
            LIMIT 1;
        ";

        await using var connection = await _connectionFactory.CreateOpenConnectionAsync(cancellationToken);
        await using var command = new MySqlCommand(sql, connection);
        command.Parameters.Add("@token", MySqlDbType.VarChar, 255).Value = token.Trim();

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (await reader.ReadAsync(cancellationToken))
        {
            var jwtIdOrdinal = reader.GetOrdinal("jwt_id");
            var revokedAtOrdinal = reader.GetOrdinal("revoked_at");
            var replacedOrdinal = reader.GetOrdinal("replaced_by_token");

            return new RefreshToken
            {
                TokenId = reader.GetString("token_id"),
                Token = reader.GetString("token"),
                JwtId = !reader.IsDBNull(jwtIdOrdinal) ? reader.GetString(jwtIdOrdinal) : null,
                UserId = reader.GetString("user_id"),
                UserType = reader.GetString("user_type"),
                Role = reader.GetString("role"),
                ExpiresAt = reader.GetDateTime("expires_at"),
                IsRevoked = reader.GetBoolean("is_revoked"),
                CreatedAt = reader.GetDateTime("created_at"),
                RevokedAt = !reader.IsDBNull(revokedAtOrdinal) ? reader.GetDateTime(revokedAtOrdinal) : null,
                ReplacedByToken = !reader.IsDBNull(replacedOrdinal) ? reader.GetString(replacedOrdinal) : null
            };
        }

        return null;
    }

    public async Task<bool> RevokeRefreshTokenAsync(string token, string? replacedByToken = null, CancellationToken cancellationToken = default)
    {
        const string sql = @"
            UPDATE refresh_tokens
            SET is_revoked = TRUE, revoked_at = CURRENT_TIMESTAMP, replaced_by_token = @replaced_by_token
            WHERE token = @token;
        ";

        await using var connection = await _connectionFactory.CreateOpenConnectionAsync(cancellationToken);
        await using var command = new MySqlCommand(sql, connection);
        command.Parameters.Add("@token", MySqlDbType.VarChar, 255).Value = token.Trim();
        command.Parameters.Add("@replaced_by_token", MySqlDbType.VarChar, 255).Value = (object?)replacedByToken ?? DBNull.Value;

        var affected = await command.ExecuteNonQueryAsync(cancellationToken);
        return affected > 0;
    }

    public async Task<bool> RevokeAllUserTokensAsync(string userId, CancellationToken cancellationToken = default)
    {
        const string sql = @"
            UPDATE refresh_tokens
            SET is_revoked = TRUE, revoked_at = CURRENT_TIMESTAMP
            WHERE user_id = @user_id AND is_revoked = FALSE;
        ";

        await using var connection = await _connectionFactory.CreateOpenConnectionAsync(cancellationToken);
        await using var command = new MySqlCommand(sql, connection);
        command.Parameters.Add("@user_id", MySqlDbType.VarChar, 50).Value = userId.Trim();

        var affected = await command.ExecuteNonQueryAsync(cancellationToken);
        return affected > 0;
    }

    public async Task SaveRevokedTokenAsync(RevokedToken token, CancellationToken cancellationToken = default)
    {
        const string sql = @"
            INSERT INTO revoked_tokens (token_hash, jwt_id, user_id, expires_at, revoked_at)
            VALUES (@token_hash, @jwt_id, @user_id, @expires_at, @revoked_at)
            ON DUPLICATE KEY UPDATE revoked_at = @revoked_at;
        ";

        await using var connection = await _connectionFactory.CreateOpenConnectionAsync(cancellationToken);
        await using var command = new MySqlCommand(sql, connection);
        command.Parameters.Add("@token_hash", MySqlDbType.VarChar, 64).Value = token.TokenHash;
        command.Parameters.Add("@jwt_id", MySqlDbType.VarChar, 100).Value = (object?)token.JwtId ?? DBNull.Value;
        command.Parameters.Add("@user_id", MySqlDbType.VarChar, 50).Value = (object?)token.UserId ?? DBNull.Value;
        command.Parameters.Add("@expires_at", MySqlDbType.DateTime).Value = token.ExpiresAt;
        command.Parameters.Add("@revoked_at", MySqlDbType.DateTime).Value = token.RevokedAt;

        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<bool> IsTokenRevokedAsync(string tokenHash, string? jwtId = null, CancellationToken cancellationToken = default)
    {
        const string sql = @"
            SELECT COUNT(1)
            FROM revoked_tokens
            WHERE token_hash = @token_hash OR (@jwt_id IS NOT NULL AND jwt_id = @jwt_id);
        ";

        await using var connection = await _connectionFactory.CreateOpenConnectionAsync(cancellationToken);
        await using var command = new MySqlCommand(sql, connection);
        command.Parameters.Add("@token_hash", MySqlDbType.VarChar, 64).Value = tokenHash;
        command.Parameters.Add("@jwt_id", MySqlDbType.VarChar, 100).Value = (object?)jwtId ?? DBNull.Value;

        var count = Convert.ToInt64(await command.ExecuteScalarAsync(cancellationToken));
        return count > 0;
    }
}
