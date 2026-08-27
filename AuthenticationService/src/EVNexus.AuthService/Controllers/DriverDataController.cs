using System.Security.Claims;
using EVNexus.AuthService.Attributes;
using EVNexus.AuthService.Data;
using EVNexus.AuthService.DTOs;
using EVNexus.AuthService.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EVNexus.AuthService.Controllers;

/// <summary>
/// Driver-only API controller providing driver profile and charging wallet data.
/// Enforces strict driver role authorization via [RequireRole(AppRoles.Driver)].
/// </summary>
[ApiController]
[Route("api/driver")]
[Produces("application/json")]
[Authorize(Roles = "Driver")]
[RequireRole(AppRoles.Driver)]
public class DriverDataController : ControllerBase
{
    private readonly IDriverRepository _driverRepository;
    private readonly ILogger<DriverDataController> _logger;

    public DriverDataController(
        IDriverRepository driverRepository,
        ILogger<DriverDataController> logger)
    {
        _driverRepository = driverRepository;
        _logger = logger;
    }

    private string? GetCallerDriverId()
    {
        return User.FindFirstValue("driver_id")
            ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
    }

    /// <summary>
    /// Driver-only endpoint returning the authenticated driver's charging wallet details.
    /// Rejects non-driver callers with 403 Forbidden.
    /// </summary>
    [HttpGet("wallet")]
    [ProducesResponseType(typeof(ApiResponse<DriverWalletDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetDriverWallet(CancellationToken cancellationToken)
    {
        var driverId = GetCallerDriverId();
        if (string.IsNullOrWhiteSpace(driverId))
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse<object>.Fail("Driver identification claim is missing from authentication token."));
        }

        try
        {
            var wallet = await _driverRepository.GetWalletByDriverIdAsync(driverId, cancellationToken);
            if (wallet == null)
            {
                return NotFound(ApiResponse<object>.Fail($"Charging wallet for driver '{driverId}' was not found."));
            }

            var dto = new DriverWalletDto
            {
                WalletId = wallet.WalletId,
                DriverId = wallet.DriverId,
                Balance = wallet.Balance,
                Currency = wallet.Currency,
                Status = wallet.Status,
                UpdatedAt = wallet.UpdatedAt
            };

            return Ok(ApiResponse<DriverWalletDto>.Ok(dto, "Driver charging wallet retrieved successfully."));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error retrieving wallet for driver {DriverId}", driverId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse<object>.Fail("An unexpected error occurred while retrieving wallet details."));
        }
    }

    /// <summary>
    /// Driver-only endpoint returning recent driver activity and charging session summary.
    /// Rejects non-driver callers with 403 Forbidden.
    /// </summary>
    [HttpGet("activity")]
    [ProducesResponseType(typeof(ApiResponse<DriverActivitySummaryDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetDriverActivity(CancellationToken cancellationToken)
    {
        var driverId = GetCallerDriverId();
        if (string.IsNullOrWhiteSpace(driverId))
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse<object>.Fail("Driver identification claim is missing from authentication token."));
        }

        var driver = await _driverRepository.GetDriverByIdAsync(driverId, cancellationToken);
        if (driver == null)
        {
            return NotFound(ApiResponse<object>.Fail($"Driver '{driverId}' was not found."));
        }

        var wallet = await _driverRepository.GetWalletByDriverIdAsync(driverId, cancellationToken);

        var summary = new DriverActivitySummaryDto
        {
            DriverId = driver.DriverId,
            Name = driver.Name,
            Email = driver.Email,
            TotalSessions = 0,
            TotalEnergyKwh = 0.0m,
            WalletBalance = wallet?.Balance ?? 0.0m,
            Currency = wallet?.Currency ?? "USD",
            AccountStatus = driver.Status,
            MemberSince = driver.CreatedAt
        };

        return Ok(ApiResponse<DriverActivitySummaryDto>.Ok(summary, "Driver activity retrieved successfully."));
    }
}
