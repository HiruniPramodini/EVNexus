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

[ApiController]
[Route("api/company")]
[Produces("application/json")]
[Authorize(Roles = "CompanyAdmin")]
[RequireRole(AppRoles.CompanyAdmin)]
public class CompanyDataController : ControllerBase
{
    private const string ValidTenantClaimsRequiredMessage = "Cross-tenant access forbidden. Valid tenant claims are required.";

    private readonly IStationRepository _stationRepository;
    private readonly ITenantContext _tenantContext;
    private readonly ILogger<CompanyDataController> _logger;

    public CompanyDataController(
        IStationRepository stationRepository,
        ITenantContext tenantContext,
        ILogger<CompanyDataController> logger)
    {
        _stationRepository = stationRepository;
        _tenantContext = tenantContext;
        _logger = logger;
    }

    private string? GetCallerTenantId()
    {
        return _tenantContext.TenantId
            ?? User.FindFirstValue("tenant_id")
            ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
    }

    /// <summary>
    /// Returns all charging stations scoped to the authenticated caller's tenant.
    /// </summary>
    [HttpGet("stations")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<StationResponseDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetStations(CancellationToken cancellationToken)
    {
        var tenantId = GetCallerTenantId();
        if (string.IsNullOrWhiteSpace(tenantId))
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse<object>.Fail(ValidTenantClaimsRequiredMessage));
        }

        try
        {
            var stations = await _stationRepository.GetStationsAsync(cancellationToken);
            var dtos = stations.Select(MapToDto).ToList();
            return Ok(ApiResponse<IReadOnlyList<StationResponseDto>>.Ok(dtos, "Stations retrieved successfully."));
        }
        catch (CrossTenantAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail(ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error occurred while fetching stations for tenant {TenantId}", tenantId);
            return StatusCode(StatusCodes.Status500InternalServerError, ApiResponse<object>.Fail("An unexpected error occurred."));
        }
    }

    /// <summary>
    /// Creates a new charging station automatically stamped with the caller's Tenant ID.
    /// </summary>
    [HttpPost("stations")]
    [ProducesResponseType(typeof(ApiResponse<StationResponseDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> CreateStation(
        [FromBody] CreateStationRequestDto request,
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

        var tenantId = GetCallerTenantId();
        if (string.IsNullOrWhiteSpace(tenantId))
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse<object>.Fail(ValidTenantClaimsRequiredMessage));
        }

        try
        {
            var station = new Station
            {
                StationId = $"STN-{Guid.NewGuid():N}".ToUpperInvariant(),
                TenantId = tenantId,
                Name = request.Name.Trim(),
                Location = request.Location.Trim(),
                Latitude = request.Latitude,
                Longitude = request.Longitude,
                Status = "Active",
                TotalPorts = request.TotalPorts,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            var created = await _stationRepository.CreateStationAsync(station, cancellationToken);
            return StatusCode(StatusCodes.Status201Created,
                ApiResponse<StationResponseDto>.Ok(MapToDto(created), "Charging station created successfully."));
        }
        catch (CrossTenantAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail(ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error occurred while creating station for tenant {TenantId}", tenantId);
            return StatusCode(StatusCodes.Status500InternalServerError, ApiResponse<object>.Fail("An unexpected error occurred."));
        }
    }

    /// <summary>
    /// Retrieves a specific station by ID. If the station belongs to another tenant, returns 403 Forbidden.
    /// </summary>
    [HttpGet("stations/{stationId}")]
    [ProducesResponseType(typeof(ApiResponse<StationResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetStationById(string stationId, CancellationToken cancellationToken)
    {
        var tenantId = GetCallerTenantId();
        if (string.IsNullOrWhiteSpace(tenantId))
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse<object>.Fail(ValidTenantClaimsRequiredMessage));
        }

        try
        {
            var station = await _stationRepository.GetStationByIdAsync(stationId, cancellationToken);
            if (station != null)
            {
                return Ok(ApiResponse<StationResponseDto>.Ok(MapToDto(station), "Station retrieved successfully."));
            }

            // Check if resource exists under a different tenant to enforce explicit 403 Forbidden
            var globalStation = await _stationRepository.GetStationByIdGlobalAsync(stationId, cancellationToken);
            if (globalStation != null && !string.Equals(globalStation.TenantId, tenantId, StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("Cross-tenant access attempt: Tenant {CallerTenant} attempted to access station {StationId} owned by Tenant {OwnerTenant}",
                    tenantId, stationId, globalStation.TenantId);

                return StatusCode(StatusCodes.Status403Forbidden,
                    ApiResponse<object>.Fail("Cross-tenant access forbidden. You cannot access data belonging to another tenant."));
            }

            return NotFound(ApiResponse<object>.Fail($"Station with ID '{stationId}' was not found."));
        }
        catch (CrossTenantAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail(ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error occurred while fetching station {StationId}", stationId);
            return StatusCode(StatusCodes.Status500InternalServerError, ApiResponse<object>.Fail("An unexpected error occurred."));
        }
    }

    /// <summary>
    /// Scoped endpoint verifying that a requested tenant path matches the caller's JWT tenant.
    /// If caller attempts to access another tenant's URL, returns 403 Forbidden.
    /// </summary>
    [HttpGet("tenants/{targetTenantId}/stations")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<StationResponseDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetStationsForTenant(string targetTenantId, CancellationToken cancellationToken)
    {
        var callerTenantId = GetCallerTenantId();
        if (string.IsNullOrWhiteSpace(callerTenantId) || !string.Equals(callerTenantId, targetTenantId, StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("Cross-tenant route access attempt: Caller {CallerTenant} tried to access data of Tenant {TargetTenant}",
                callerTenantId, targetTenantId);

            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse<object>.Fail($"Cross-tenant access forbidden. You cannot access data belonging to tenant '{targetTenantId}'."));
        }

        var stations = await _stationRepository.GetStationsAsync(cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<StationResponseDto>>.Ok(stations.Select(MapToDto).ToList(), "Stations retrieved successfully."));
    }

    /// <summary>
    /// Updates a station if it belongs to the caller's tenant. Rejects cross-tenant updates with 403 Forbidden.
    /// </summary>
    [HttpPut("stations/{stationId}")]
    [ProducesResponseType(typeof(ApiResponse<StationResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateStation(
        string stationId,
        [FromBody] UpdateStationRequestDto request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ApiResponse<object>.Fail("Validation failed."));
        }

        var tenantId = GetCallerTenantId();
        if (string.IsNullOrWhiteSpace(tenantId))
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse<object>.Fail(ValidTenantClaimsRequiredMessage));
        }

        var existing = await _stationRepository.GetStationByIdAsync(stationId, cancellationToken);
        if (existing == null)
        {
            var globalStation = await _stationRepository.GetStationByIdGlobalAsync(stationId, cancellationToken);
            if (globalStation != null && !string.Equals(globalStation.TenantId, tenantId, StringComparison.OrdinalIgnoreCase))
            {
                return StatusCode(StatusCodes.Status403Forbidden,
                    ApiResponse<object>.Fail("Cross-tenant access forbidden. You cannot modify data belonging to another tenant."));
            }

            return NotFound(ApiResponse<object>.Fail($"Station with ID '{stationId}' was not found."));
        }

        existing.Name = request.Name.Trim();
        existing.Location = request.Location.Trim();
        existing.Latitude = request.Latitude;
        existing.Longitude = request.Longitude;
        existing.Status = request.Status;
        existing.TotalPorts = request.TotalPorts;

        await _stationRepository.UpdateStationAsync(existing, cancellationToken);
        return Ok(ApiResponse<StationResponseDto>.Ok(MapToDto(existing), "Station updated successfully."));
    }

    /// <summary>
    /// Deletes a station if it belongs to the caller's tenant. Rejects cross-tenant deletion with 403 Forbidden.
    /// </summary>
    [HttpDelete("stations/{stationId}")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteStation(string stationId, CancellationToken cancellationToken)
    {
        var tenantId = GetCallerTenantId();
        if (string.IsNullOrWhiteSpace(tenantId))
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse<object>.Fail(ValidTenantClaimsRequiredMessage));
        }

        var existing = await _stationRepository.GetStationByIdAsync(stationId, cancellationToken);
        if (existing == null)
        {
            var globalStation = await _stationRepository.GetStationByIdGlobalAsync(stationId, cancellationToken);
            if (globalStation != null && !string.Equals(globalStation.TenantId, tenantId, StringComparison.OrdinalIgnoreCase))
            {
                return StatusCode(StatusCodes.Status403Forbidden,
                    ApiResponse<object>.Fail("Cross-tenant access forbidden. You cannot delete data belonging to another tenant."));
            }

            return NotFound(ApiResponse<object>.Fail($"Station with ID '{stationId}' was not found."));
        }

        await _stationRepository.DeleteStationAsync(stationId, cancellationToken);
        return Ok(ApiResponse<object>.Ok(new { stationId }, "Station deleted successfully."));
    }

    private static StationResponseDto MapToDto(Station station)
    {
        return new StationResponseDto
        {
            StationId = station.StationId,
            TenantId = station.TenantId,
            Name = station.Name,
            Location = station.Location,
            Latitude = station.Latitude,
            Longitude = station.Longitude,
            Status = station.Status,
            TotalPorts = station.TotalPorts,
            CreatedAt = station.CreatedAt,
            UpdatedAt = station.UpdatedAt
        };
    }
}
