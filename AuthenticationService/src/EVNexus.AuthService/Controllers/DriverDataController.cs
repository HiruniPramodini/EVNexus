using System.Security.Claims;
using EVNexus.AuthService.Attributes;
using EVNexus.AuthService.Data;
using EVNexus.AuthService.DTOs;
using EVNexus.AuthService.Exceptions;
using EVNexus.AuthService.Models;
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
    private const string ValidationFailedMessage = "Validation failed.";

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
            var vehicles = (await _driverRepository.GetVehiclesByDriverIdAsync(driverId, cancellationToken)) ?? Array.Empty<DriverVehicle>();
            var dto = new DriverProfileResponseDto
            {
                DriverId = driver.DriverId,
                Name = driver.Name,
                Email = driver.Email,
                Phone = driver.Phone,
                Role = driver.Role,
                Status = driver.Status,
                IsEmailVerified = driver.IsEmailVerified,
                CreatedAt = driver.CreatedAt,
                UpdatedAt = driver.UpdatedAt,
                WalletId = wallet?.WalletId ?? string.Empty,
                WalletBalance = wallet?.Balance ?? 0.00m,
                Currency = wallet?.Currency ?? "USD",
                Vehicles = vehicles.Select(v => new DriverVehicleDto
                {
                    VehicleId = v.VehicleId,
                    DriverId = v.DriverId,
                    Make = v.Make,
                    Model = v.Model,
                    PlateNumber = v.PlateNumber,
                    ConnectorType = v.ConnectorType,
                    IsDefault = v.IsDefault,
                    CreatedAt = v.CreatedAt,
                    UpdatedAt = v.UpdatedAt
                }).ToList()
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
            return BadRequest(ApiResponse<object>.Fail(ValidationFailedMessage, errors));
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
            return BadRequest(ApiResponse<object>.Fail(ValidationFailedMessage, errors));
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

    /// <summary>
    /// Returns the list of registered electric vehicles for the calling driver.
    /// Scoped strictly to the logged-in driver's account.
    /// </summary>
    [HttpGet("vehicles")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<DriverVehicleDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetVehicles(CancellationToken cancellationToken)
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
                var vehicles = await _driverAuthService.GetDriverVehiclesAsync(driverId, cancellationToken);
                return Ok(ApiResponse<IReadOnlyList<DriverVehicleDto>>.Ok(vehicles, "Driver vehicles retrieved successfully."));
            }

            var repoVehicles = (await _driverRepository.GetVehiclesByDriverIdAsync(driverId, cancellationToken)) ?? Array.Empty<DriverVehicle>();
            var dtoList = repoVehicles.Select(v => new DriverVehicleDto
            {
                VehicleId = v.VehicleId,
                DriverId = v.DriverId,
                Make = v.Make,
                Model = v.Model,
                PlateNumber = v.PlateNumber,
                ConnectorType = v.ConnectorType,
                IsDefault = v.IsDefault,
                CreatedAt = v.CreatedAt,
                UpdatedAt = v.UpdatedAt
            }).ToList();

            return Ok(ApiResponse<IReadOnlyList<DriverVehicleDto>>.Ok(dtoList, "Driver vehicles retrieved successfully."));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error retrieving vehicles for driver {DriverId}", driverId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse<object>.Fail("An unexpected error occurred while retrieving vehicles."));
        }
    }

    /// <summary>
    /// Registers a new vehicle for the calling driver.
    /// </summary>
    [HttpPost("vehicles")]
    [ProducesResponseType(typeof(ApiResponse<DriverVehicleDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> AddVehicle(
        [FromBody] CreateDriverVehicleRequestDto request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            var errors = ModelState.Values
                .SelectMany(v => v.Errors)
                .Select(e => e.ErrorMessage)
                .ToList();
            return BadRequest(ApiResponse<object>.Fail(ValidationFailedMessage, errors));
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
                var vehicle = await _driverAuthService.AddDriverVehicleAsync(driverId, request, cancellationToken);
                return StatusCode(StatusCodes.Status201Created,
                    ApiResponse<DriverVehicleDto>.Ok(vehicle, "Vehicle registered successfully."));
            }

            var entity = new DriverVehicle
            {
                VehicleId = $"VEH-{Guid.NewGuid():N}".ToUpperInvariant(),
                DriverId = driverId,
                Make = request.Make.Trim(),
                Model = request.Model.Trim(),
                PlateNumber = request.PlateNumber.Trim().ToUpperInvariant(),
                ConnectorType = request.ConnectorType.Trim(),
                IsDefault = request.IsDefault,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            var created = await _driverRepository.CreateVehicleAsync(entity, cancellationToken);
            var dto = new DriverVehicleDto
            {
                VehicleId = created.VehicleId,
                DriverId = created.DriverId,
                Make = created.Make,
                Model = created.Model,
                PlateNumber = created.PlateNumber,
                ConnectorType = created.ConnectorType,
                IsDefault = created.IsDefault,
                CreatedAt = created.CreatedAt,
                UpdatedAt = created.UpdatedAt
            };

            return StatusCode(StatusCodes.Status201Created,
                ApiResponse<DriverVehicleDto>.Ok(dto, "Vehicle registered successfully."));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error adding vehicle for driver {DriverId}", driverId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse<object>.Fail("An unexpected error occurred while adding vehicle."));
        }
    }

    /// <summary>
    /// Updates an existing vehicle belonging to the calling driver.
    /// </summary>
    [HttpPut("vehicles/{vehicleId}")]
    [ProducesResponseType(typeof(ApiResponse<DriverVehicleDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateVehicle(
        [FromRoute] string vehicleId,
        [FromBody] UpdateDriverVehicleRequestDto request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            var errors = ModelState.Values
                .SelectMany(v => v.Errors)
                .Select(e => e.ErrorMessage)
                .ToList();
            return BadRequest(ApiResponse<object>.Fail(ValidationFailedMessage, errors));
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
                var vehicle = await _driverAuthService.UpdateDriverVehicleAsync(driverId, vehicleId, request, cancellationToken);
                return Ok(ApiResponse<DriverVehicleDto>.Ok(vehicle, "Vehicle updated successfully."));
            }

            var updated = await _driverRepository.UpdateVehicleAsync(
                vehicleId,
                driverId,
                request.Make.Trim(),
                request.Model.Trim(),
                request.PlateNumber.Trim().ToUpperInvariant(),
                request.ConnectorType.Trim(),
                request.IsDefault,
                cancellationToken);

            if (updated == null)
            {
                return NotFound(ApiResponse<object>.Fail($"Vehicle '{vehicleId}' was not found."));
            }

            var dto = new DriverVehicleDto
            {
                VehicleId = updated.VehicleId,
                DriverId = updated.DriverId,
                Make = updated.Make,
                Model = updated.Model,
                PlateNumber = updated.PlateNumber,
                ConnectorType = updated.ConnectorType,
                IsDefault = updated.IsDefault,
                CreatedAt = updated.CreatedAt,
                UpdatedAt = updated.UpdatedAt
            };

            return Ok(ApiResponse<DriverVehicleDto>.Ok(dto, "Vehicle updated successfully."));
        }
        catch (KeyNotFoundException)
        {
            return NotFound(ApiResponse<object>.Fail($"Vehicle '{vehicleId}' was not found."));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error updating vehicle {VehicleId} for driver {DriverId}", vehicleId, driverId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse<object>.Fail("An unexpected error occurred while updating vehicle."));
        }
    }

    /// <summary>
    /// Deletes an existing vehicle belonging to the calling driver.
    /// </summary>
    [HttpDelete("vehicles/{vehicleId}")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteVehicle(
        [FromRoute] string vehicleId,
        CancellationToken cancellationToken)
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
                await _driverAuthService.DeleteDriverVehicleAsync(driverId, vehicleId, cancellationToken);
                return Ok(ApiResponse<object>.Ok(new { }, "Vehicle deleted successfully."));
            }

            var success = await _driverRepository.DeleteVehicleAsync(vehicleId, driverId, cancellationToken);
            if (!success)
            {
                return NotFound(ApiResponse<object>.Fail($"Vehicle '{vehicleId}' was not found."));
            }

            return Ok(ApiResponse<object>.Ok(new { }, "Vehicle deleted successfully."));
        }
        catch (KeyNotFoundException)
        {
            return NotFound(ApiResponse<object>.Fail($"Vehicle '{vehicleId}' was not found."));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error deleting vehicle {VehicleId} for driver {DriverId}", vehicleId, driverId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse<object>.Fail("An unexpected error occurred while deleting vehicle."));
        }
    }

    /// <summary>
    /// Marks a specific vehicle as the default vehicle for the calling driver.
    /// </summary>
    [HttpPatch("vehicles/{vehicleId}/default")]
    [HttpPut("vehicles/{vehicleId}/default")]
    [ProducesResponseType(typeof(ApiResponse<DriverVehicleDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SetDefaultVehicle(
        [FromRoute] string vehicleId,
        CancellationToken cancellationToken)
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
                var vehicle = await _driverAuthService.SetDefaultDriverVehicleAsync(driverId, vehicleId, cancellationToken);
                return Ok(ApiResponse<DriverVehicleDto>.Ok(vehicle, "Vehicle marked as default successfully."));
            }

            var success = await _driverRepository.SetDefaultVehicleAsync(vehicleId, driverId, cancellationToken);
            if (!success)
            {
                return NotFound(ApiResponse<object>.Fail($"Vehicle '{vehicleId}' was not found."));
            }

            var vehicleObj = await _driverRepository.GetVehicleByIdAsync(vehicleId, driverId, cancellationToken);
            var dto = new DriverVehicleDto
            {
                VehicleId = vehicleObj!.VehicleId,
                DriverId = vehicleObj.DriverId,
                Make = vehicleObj.Make,
                Model = vehicleObj.Model,
                PlateNumber = vehicleObj.PlateNumber,
                ConnectorType = vehicleObj.ConnectorType,
                IsDefault = vehicleObj.IsDefault,
                CreatedAt = vehicleObj.CreatedAt,
                UpdatedAt = vehicleObj.UpdatedAt
            };

            return Ok(ApiResponse<DriverVehicleDto>.Ok(dto, "Vehicle marked as default successfully."));
        }
        catch (KeyNotFoundException)
        {
            return NotFound(ApiResponse<object>.Fail($"Vehicle '{vehicleId}' was not found."));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error setting default vehicle {VehicleId} for driver {DriverId}", vehicleId, driverId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse<object>.Fail("An unexpected error occurred while updating default vehicle."));
        }
    }
}
