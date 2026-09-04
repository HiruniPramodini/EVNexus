using EVNexus.AuthService.Models;

namespace EVNexus.AuthService.Data;

public interface IRefreshTokenRepository
{
    Task<RefreshToken> SaveRefreshTokenAsync(RefreshToken token, CancellationToken cancellationToken = default);
    Task<RefreshToken?> GetRefreshTokenAsync(string token, CancellationToken cancellationToken = default);
    Task<bool> RevokeRefreshTokenAsync(string token, string? replacedByToken = null, CancellationToken cancellationToken = default);
    Task<bool> RevokeAllUserTokensAsync(string userId, CancellationToken cancellationToken = default);
    Task SaveRevokedTokenAsync(RevokedToken token, CancellationToken cancellationToken = default);
    Task<bool> IsTokenRevokedAsync(string tokenHash, string? jwtId = null, CancellationToken cancellationToken = default);
}
