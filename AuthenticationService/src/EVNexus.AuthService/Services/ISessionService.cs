using System.Security.Claims;
using EVNexus.AuthService.DTOs;

namespace EVNexus.AuthService.Services;

public interface ISessionService
{
    Task<string> GenerateAndSaveRefreshTokenAsync(
        string userId,
        string userType,
        string role,
        string? jwtId = null,
        CancellationToken cancellationToken = default);

    Task<RefreshTokenResponseDto> RefreshSessionAsync(
        string refreshToken,
        CancellationToken cancellationToken = default);

    Task LogoutSessionAsync(
        string? bearerToken,
        string? refreshToken,
        ClaimsPrincipal? principal,
        CancellationToken cancellationToken = default);
}
