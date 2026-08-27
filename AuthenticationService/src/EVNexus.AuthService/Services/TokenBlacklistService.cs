using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using EVNexus.AuthService.Data;
using EVNexus.AuthService.Models;

namespace EVNexus.AuthService.Services;

public class TokenBlacklistService : ITokenBlacklistService
{
    private readonly IRefreshTokenRepository _repository;
    private readonly ILogger<TokenBlacklistService> _logger;
    private readonly ConcurrentDictionary<string, DateTime> _revokedMemoryCache = new();

    public TokenBlacklistService(
        IRefreshTokenRepository repository,
        ILogger<TokenBlacklistService> logger)
    {
        _repository = repository;
        _logger = logger;
    }

    public async Task RevokeTokenAsync(
        string rawToken,
        string? jwtId,
        string? userId,
        DateTime expiresAt,
        CancellationToken cancellationToken = default)
    {
        var tokenHash = ComputeHash(rawToken);

        // Add to fast memory cache
        _revokedMemoryCache[tokenHash] = expiresAt;
        if (!string.IsNullOrWhiteSpace(jwtId))
        {
            _revokedMemoryCache[$"jti:{jwtId}"] = expiresAt;
        }

        // Persist to database
        try
        {
            await _repository.SaveRevokedTokenAsync(new RevokedToken
            {
                TokenHash = tokenHash,
                JwtId = jwtId,
                UserId = userId,
                ExpiresAt = expiresAt,
                RevokedAt = DateTime.UtcNow
            }, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to persist revoked token to database. Kept in memory blacklist.");
        }
    }

    public async Task<bool> IsTokenRevokedAsync(
        string? rawToken,
        string? jwtId = null,
        CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;

        // Check by raw token hash in memory
        if (!string.IsNullOrWhiteSpace(rawToken))
        {
            var hash = ComputeHash(rawToken);
            if (_revokedMemoryCache.TryGetValue(hash, out var exp))
            {
                if (now <= exp) return true;
                _revokedMemoryCache.TryRemove(hash, out _);
            }
        }

        // Check by JTI in memory
        if (!string.IsNullOrWhiteSpace(jwtId))
        {
            var jtiKey = $"jti:{jwtId}";
            if (_revokedMemoryCache.TryGetValue(jtiKey, out var exp))
            {
                if (now <= exp) return true;
                _revokedMemoryCache.TryRemove(jtiKey, out _);
            }
        }

        // Check database fallback
        try
        {
            var hashToCheck = !string.IsNullOrWhiteSpace(rawToken) ? ComputeHash(rawToken) : string.Empty;
            var isRevokedInDb = await _repository.IsTokenRevokedAsync(hashToCheck, jwtId, cancellationToken);
            if (isRevokedInDb)
            {
                if (!string.IsNullOrWhiteSpace(hashToCheck))
                    _revokedMemoryCache[hashToCheck] = now.AddHours(24);
                if (!string.IsNullOrWhiteSpace(jwtId))
                    _revokedMemoryCache[$"jti:{jwtId}"] = now.AddHours(24);
                return true;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Database check for revoked token failed. Relying on memory cache.");
        }

        return false;
    }

    private static string ComputeHash(string input)
    {
        if (string.IsNullOrEmpty(input)) return string.Empty;
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(input.Trim()));
        return Convert.ToHexString(bytes);
    }
}
