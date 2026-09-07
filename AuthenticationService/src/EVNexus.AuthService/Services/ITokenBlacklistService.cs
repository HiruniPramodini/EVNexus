namespace EVNexus.AuthService.Services;

public interface ITokenBlacklistService
{
    Task RevokeTokenAsync(string rawToken, string? jwtId, string? userId, DateTime expiresAt, CancellationToken cancellationToken = default);
    Task<bool> IsTokenRevokedAsync(string? rawToken, string? jwtId = null, CancellationToken cancellationToken = default);
}
