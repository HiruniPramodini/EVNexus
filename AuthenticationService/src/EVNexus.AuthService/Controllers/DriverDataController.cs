using System.Security.Claims;
using EVNexus.AuthService.Attributes;
using EVNexus.AuthService.Data;
using EVNexus.AuthService.DTOs;
using EVNexus.AuthService.Exceptions;
using EVNexus.AuthService.Security;
using EVNexus.AuthService.Services;
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
    private const string MissingDriverIdClaimMessage = "Driver identification claim is missing from authentication token.";

    private readonly IDriverRepository _driverRepository;
    private readonly ILogger<DriverDataController> _logger;
    private readonly IDriverAuthService? _driverAuthService;

    public DriverDataController(
        IDriverRepository driverRepository,
        ILogger<DriverDataController> logger,
        IDriverAuthService? driverAuthService = null)
    {
        _driverRepository = driverRepository;
        _logger = logger;
        _driverAuthService = driverAuthService;
    }

    private string? GetCallerDriverId()
    {
        return User.FindFirstValue("driver_id")
            ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
    }

    /// <summary>
    /// Returns the current driver's profile information.
    /// </summary>
    [HttpGet("profile")]
    [ProducesResponseType(typeof(ApiResponse<DriverProfileResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetProfile(CancellationToken cancellationToken)
    {
        var driverId = GetCallerDriverId();
        if (string.IsNullOrWhiteSpace(driverId))
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse<object>.Fail(MissingDriverIdClaimMessage));
        }

        try
        {
            if (_driverAuthService != null)
            {
                var profile = await _driverAuthService.GetDriverProfileAsync(driverId, cancellationToken);
                return Ok(ApiResponse<DriverProfileResponseDto>.Ok(profile, "Driver profile retrieved successfully."));
            }

            var driver = await _driverRepository.GetDriverByIdAsync(driverId, cancellationToken);
            if (driver == null)
            {
                return NotFound(ApiResponse<object>.Fail($"Driver '{driverId}' was not found."));
            }

            var wallet = await _driverRepository.GetWalletByDriverIdAsync(driverId, cancellationToken);
            var dto = new DriverProfileResponseDto
            {
                DriverId = driver.DriverId,
                Name = driver.Name,
                Email = driver.Email,
                Phone = driver.Phone,
                Role = driver.Role,
                Status = driver.Status,
                CreatedAt = driver.CreatedAt,
                UpdatedAt = driver.UpdatedAt,
                WalletId = wallet?.WalletId ?? string.Empty,
                WalletBalance = wallet?.Balance ?? 0.00m,
                Currency = wallet?.Currency ?? "USD"
            };

            return Ok(ApiResponse<DriverProfileResponseDto>.Ok(dto, "Driver profile retrieved successfully."));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error retrieving profile for driver {DriverId}", driverId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse<object>.Fail("An unexpected error occurred while retrieving profile information."));
        }
    }

    /// <summary>
    /// Updates the current driver's profile details (name and phone number).
    /// </summary>
    [HttpPut("profile")]
    [ProducesResponseType(typeof(ApiResponse<DriverProfileResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateProfile(
        [FromBody] UpdateDriverProfileRequestDto request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            var errors = ModelState.Values
                .SelectMany(v => v.Errors)
                .Select(e => e.ErrorMessage)
                .ToList();
            return BadRequest(ApiResponse<object>.Fail("Validation failed.", errors));
        }

        var driverId = GetCallerDriverId();
        if (string.IsNullOrWhiteSpace(driverId))
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse<object>.Fail(MissingDriverIdClaimMessage));
        }

        try
        {
            if (_driverAuthService != null)
            {
                var updated = await _driverAuthService.UpdateDriverProfileAsync(driverId, request, cancellationToken);
                return Ok(ApiResponse<DriverProfileResponseDto>.Ok(updated, "Driver profile updated successfully."));
            }

            var driver = await _driverRepository.GetDriverByIdAsync(driverId, cancellationToken);
            if (driver == null)
            {
                return NotFound(ApiResponse<object>.Fail($"Driver '{driverId}' was not found."));
            }

            await _driverRepository.UpdateDriverProfileAsync(driverId, request.Name, request.Phone, cancellationToken);
            var updatedDriver = await _driverRepository.GetDriverByIdAsync(driverId, cancellationToken);
            var wallet = await _driverRepository.GetWalletByDriverIdAsync(driverId, cancellationToken);

            var dto = new DriverProfileResponseDto
            {
                DriverId = updatedDriver?.DriverId ?? driverId,
                Name = updatedDriver?.Name ?? request.Name.Trim(),
                Email = updatedDriver?.Email ?? driver.Email,
                Phone = updatedDriver?.Phone ?? request.Phone.Trim(),
                Role = updatedDriver?.Role ?? driver.Role,
                Status = updatedDriver?.Status ?? driver.Status,
                CreatedAt = updatedDriver?.CreatedAt ?? driver.CreatedAt,
                UpdatedAt = updatedDriver?.UpdatedAt ?? DateTime.UtcNow,
                WalletId = wallet?.WalletId ?? string.Empty,
                WalletBalance = wallet?.Balance ?? 0.00m,
                Currency = wallet?.Currency ?? "USD"
            };

            return Ok(ApiResponse<DriverProfileResponseDto>.Ok(dto, "Driver profile updated successfully."));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error updating profile for driver {DriverId}", driverId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse<object>.Fail("An unexpected error occurred while updating profile information."));
        }
    }

    /// <summary>
    /// Changes the current driver's password after confirming their current password.
    /// </summary>
    [HttpPut("change-password")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ChangePassword(
        [FromBody] ChangeDriverPasswordRequestDto request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            var errors = ModelState.Values
                .SelectMany(v => v.Errors)
                .Select(e => e.ErrorMessage)
                .ToList();
            return BadRequest(ApiResponse<object>.Fail("Validation failed.", errors));
        }

        var driverId = GetCallerDriverId();
        if (string.IsNullOrWhiteSpace(driverId))
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse<object>.Fail(MissingDriverIdClaimMessage));
        }

        if (_driverAuthService != null)
        {
            try
            {
                await _driverAuthService.ChangeDriverPasswordAsync(driverId, request, cancellationToken);
                return Ok(ApiResponse<object>.Ok(new { }, "Password changed successfully."));
            }
            catch (InvalidCurrentPasswordException ex)
            {
                return BadRequest(ApiResponse<object>.Fail(ex.Message, new List<string> { ex.Message }));
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ApiResponse<object>.Fail(ex.Message, new List<string> { ex.Message }));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error changing password for driver {DriverId}", driverId);
                return StatusCode(StatusCodes.Status500InternalServerError,
                    ApiResponse<object>.Fail("An unexpected error occurred while processing password change."));
            }
        }

        return StatusCode(StatusCodes.Status501NotImplemented,
            ApiResponse<object>.Fail("Password change service is not configured."));
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
                ApiResponse<object>.Fail(MissingDriverIdClaimMessage));
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
                ApiResponse<object>.Fail(MissingDriverIdClaimMessage));
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
