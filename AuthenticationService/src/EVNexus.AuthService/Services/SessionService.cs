using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using EVNexus.AuthService.Data;
using EVNexus.AuthService.DTOs;
using EVNexus.AuthService.Models;
using Microsoft.IdentityModel.Tokens;

namespace EVNexus.AuthService.Services;

public class SessionService : ISessionService
{
    private const string ActiveStatus = "Active";
    private readonly IRefreshTokenRepository _refreshTokenRepository;
    private readonly ITokenBlacklistService _tokenBlacklistService;
    private readonly IJwtTokenService _jwtTokenService;
    private readonly ITenantRepository _tenantRepository;
    private readonly IDriverRepository _driverRepository;
    private readonly ILogger<SessionService> _logger;

    public SessionService(
        IRefreshTokenRepository refreshTokenRepository,
        ITokenBlacklistService tokenBlacklistService,
        IJwtTokenService jwtTokenService,
        ITenantRepository tenantRepository,
        IDriverRepository driverRepository,
        ILogger<SessionService> logger)
    {
        _refreshTokenRepository = refreshTokenRepository;
        _tokenBlacklistService = tokenBlacklistService;
        _jwtTokenService = jwtTokenService;
        _tenantRepository = tenantRepository;
        _driverRepository = driverRepository;
        _logger = logger;
    }

    public async Task<string> GenerateAndSaveRefreshTokenAsync(
        string userId,
        string userType,
        string role,
        string? jwtId = null,
        CancellationToken cancellationToken = default)
    {
        var rawBytes = RandomNumberGenerator.GetBytes(48);
        var token = "RT-" + Convert.ToBase64String(rawBytes)
            .Replace("+", "-")
            .Replace("/", "_")
            .TrimEnd('=');

        var refreshToken = new RefreshToken
        {
            TokenId = "TOK-" + Guid.NewGuid().ToString("N")[..12].ToUpperInvariant(),
            Token = token,
            JwtId = jwtId,
            UserId = userId,
            UserType = userType,
            Role = role,
            ExpiresAt = DateTime.UtcNow.AddDays(7), // 7-day refresh window
            IsRevoked = false,
            CreatedAt = DateTime.UtcNow
        };

        await _refreshTokenRepository.SaveRefreshTokenAsync(refreshToken, cancellationToken);
        return token;
    }

    public async Task<RefreshTokenResponseDto> RefreshSessionAsync(
        string refreshToken,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(refreshToken))
        {
            throw new SecurityTokenException("Refresh token must not be empty.");
        }

        var existingToken = await _refreshTokenRepository.GetRefreshTokenAsync(refreshToken.Trim(), cancellationToken);
        if (existingToken == null)
        {
            throw new SecurityTokenException("Invalid refresh token.");
        }

        if (existingToken.IsRevoked)
        {
            throw new SecurityTokenException("Refresh token has been revoked.");
        }

        // AC 3: Expired refresh tokens are rejected with a 401
        if (existingToken.IsExpired)
        {
            throw new SecurityTokenExpiredException("Refresh token has expired. Please log in again.");
        }

        string newAccessToken;
        int expiresIn;
        string role;
        string userId = existingToken.UserId;

        if (string.Equals(existingToken.UserType, "Tenant", StringComparison.OrdinalIgnoreCase))
        {
            var tenant = await _tenantRepository.GetTenantByIdAsync(existingToken.UserId, cancellationToken);
            if (tenant != null && string.Equals(tenant.Status, "Suspended", StringComparison.OrdinalIgnoreCase))
            {
                throw new SecurityTokenException("Account is suspended. Please contact platform support.");
            }

            if (tenant == null || !string.Equals(tenant.Status, ActiveStatus, StringComparison.OrdinalIgnoreCase))
            {
                throw new SecurityTokenException("Tenant account is inactive or not found.");
            }

            var tokenResult = _jwtTokenService.GenerateToken(tenant);
            newAccessToken = tokenResult.Token;
            expiresIn = tokenResult.ExpiresInSeconds;
            role = tenant.Role;
        }
        else if (string.Equals(existingToken.UserType, "Staff", StringComparison.OrdinalIgnoreCase))
        {
            var staff = await _tenantRepository.GetStaffUserByIdAsync(existingToken.UserId, cancellationToken);
            if (staff == null || !string.Equals(staff.Status, ActiveStatus, StringComparison.OrdinalIgnoreCase))
            {
                throw new SecurityTokenException("Staff account is inactive or not found.");
            }

            var tenant = await _tenantRepository.GetTenantByIdAsync(staff.TenantId, cancellationToken);
            if (tenant != null && string.Equals(tenant.Status, "Suspended", StringComparison.OrdinalIgnoreCase))
            {
                throw new SecurityTokenException("Account is suspended. Please contact platform support.");
            }

            if (tenant == null || !string.Equals(tenant.Status, ActiveStatus, StringComparison.OrdinalIgnoreCase))
            {
                throw new SecurityTokenException("Company tenant account is inactive.");
            }

            var tokenResult = _jwtTokenService.GenerateStaffToken(staff, tenant);
            newAccessToken = tokenResult.Token;
            expiresIn = tokenResult.ExpiresInSeconds;
            role = staff.Role;
        }
        else if (string.Equals(existingToken.UserType, "Driver", StringComparison.OrdinalIgnoreCase))
        {
            var driver = await _driverRepository.GetDriverByIdAsync(existingToken.UserId, cancellationToken);
            if (driver != null && string.Equals(driver.Status, "Suspended", StringComparison.OrdinalIgnoreCase))
            {
                throw new SecurityTokenException("Account is suspended. Please contact platform support.");
            }

            if (driver == null || !string.Equals(driver.Status, ActiveStatus, StringComparison.OrdinalIgnoreCase))
            {
                throw new SecurityTokenException("Driver account is inactive or not found.");
            }

            var tokenResult = _jwtTokenService.GenerateDriverToken(driver);
            newAccessToken = tokenResult.Token;
            expiresIn = tokenResult.ExpiresInSeconds;
            role = driver.Role;
        }
        else
        {
            throw new SecurityTokenException("Unsupported user type for token refresh.");
        }

        // Token rotation: Issue new refresh token and revoke the previous one
        var newRefreshToken = await GenerateAndSaveRefreshTokenAsync(
            existingToken.UserId,
            existingToken.UserType,
            existingToken.Role,
            null,
            cancellationToken);

        await _refreshTokenRepository.RevokeRefreshTokenAsync(existingToken.Token, newRefreshToken, cancellationToken);

        _logger.LogInformation("Refreshed session successfully for User {UserId} ({UserType}, {Role})",
            existingToken.UserId, existingToken.UserType, role);

        return new RefreshTokenResponseDto
        {
            AccessToken = newAccessToken,
            RefreshToken = newRefreshToken,
            TokenType = "Bearer",
            ExpiresIn = expiresIn,
            Role = role,
            UserId = userId
        };
    }

    public async Task LogoutSessionAsync(
        string? bearerToken,
        string? refreshToken,
        ClaimsPrincipal? principal,
        CancellationToken cancellationToken = default)
    {
        string? jwtId = principal?.FindFirstValue(JwtRegisteredClaimNames.Jti)
                     ?? principal?.FindFirstValue("jti");

        string? userId = principal?.FindFirstValue("tenant_id")
                      ?? principal?.FindFirstValue("driver_id")
                      ?? principal?.FindFirstValue("user_id")
                      ?? principal?.FindFirstValue(ClaimTypes.NameIdentifier);

        // Revoke access token in blacklist
        if (!string.IsNullOrWhiteSpace(bearerToken))
        {
            var cleanToken = bearerToken.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
                ? bearerToken["Bearer ".Length..].Trim()
                : bearerToken.Trim();

            var expiresAt = DateTime.UtcNow.AddHours(24);
            await _tokenBlacklistService.RevokeTokenAsync(cleanToken, jwtId, userId, expiresAt, cancellationToken);
            _logger.LogInformation("Revoked access token server-side for User {UserId}", userId ?? "Anonymous");
        }

        // Revoke refresh token if provided
        if (!string.IsNullOrWhiteSpace(refreshToken))
        {
            await _refreshTokenRepository.RevokeRefreshTokenAsync(refreshToken.Trim(), null, cancellationToken);
            _logger.LogInformation("Revoked provided refresh token");
        }

        // If user is identified, also revoke all active refresh tokens for this user
        if (!string.IsNullOrWhiteSpace(userId))
        {
            await _refreshTokenRepository.RevokeAllUserTokensAsync(userId, cancellationToken);
        }
    }
}
