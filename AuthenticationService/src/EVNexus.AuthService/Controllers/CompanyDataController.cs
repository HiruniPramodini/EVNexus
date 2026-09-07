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
[Authorize(Roles = $"{AppRoles.CompanyAdmin},{AppRoles.Operator}")]
[RequireRole(AppRoles.CompanyAdmin, AppRoles.Operator)]
public class CompanyDataController : ControllerBase
{
    private const string ValidTenantClaimsRequiredMessage = "Cross-tenant access forbidden. Valid tenant claims are required.";

    private readonly IStationRepository _stationRepository;
    private readonly ITenantContext _tenantContext;
    private readonly ILogger<CompanyDataController> _logger;
    private readonly ICompanyAuthService? _companyAuthService;
    private readonly ITenantRepository? _tenantRepository;

    public CompanyDataController(
        IStationRepository stationRepository,
        ITenantContext tenantContext,
        ILogger<CompanyDataController> logger,
        ICompanyAuthService? companyAuthService = null,
        ITenantRepository? tenantRepository = null)
    {
        _stationRepository = stationRepository;
        _tenantContext = tenantContext;
        _logger = logger;
        _companyAuthService = companyAuthService;
        _tenantRepository = tenantRepository;
    }

    private string? GetCallerTenantId()
    {
        return _tenantContext.TenantId
            ?? User.FindFirstValue("tenant_id")
            ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
    }

    /// <summary>
    /// Returns the current company's profile details including logo and contact information.
    /// </summary>
    [HttpGet("profile")]
    [ProducesResponseType(typeof(ApiResponse<CompanyProfileResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetProfile(CancellationToken cancellationToken)
    {
        var tenantId = GetCallerTenantId();
        if (string.IsNullOrWhiteSpace(tenantId))
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse<object>.Fail(ValidTenantClaimsRequiredMessage));
        }

        if (_companyAuthService == null)
        {
            return StatusCode(StatusCodes.Status501NotImplemented,
                ApiResponse<object>.Fail("Profile service not configured."));
        }

        try
        {
            var profile = await _companyAuthService.GetCompanyProfileAsync(tenantId, cancellationToken);
            return Ok(ApiResponse<CompanyProfileResponseDto>.Ok(profile, "Company profile retrieved successfully."));
        }
        catch (TenantNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
    }

    /// <summary>
    /// Updates the current company's profile details (name, phone, address, logo).
    /// </summary>
    [HttpPut("profile")]
    [Authorize(Roles = "CompanyAdmin")]
    [RequireRole(AppRoles.CompanyAdmin)]
    [ProducesResponseType(typeof(ApiResponse<CompanyProfileResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateProfile(
        [FromBody] UpdateCompanyProfileRequestDto request,
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

        if (_companyAuthService == null)
        {
            return StatusCode(StatusCodes.Status501NotImplemented,
                ApiResponse<object>.Fail("Profile service not configured."));
        }

        try
        {
            var updated = await _companyAuthService.UpdateCompanyProfileAsync(tenantId, request, cancellationToken);
            return Ok(ApiResponse<CompanyProfileResponseDto>.Ok(updated, "Company profile updated successfully."));
        }
        catch (BusinessEmailChangeRequiresVerificationException ex)
        {
            return BadRequest(ApiResponse<object>.Fail(ex.Message));
        }
        catch (EmailVerificationException ex)
        {
            return BadRequest(ApiResponse<object>.Fail(ex.Message));
        }
        catch (DuplicateEmailException ex)
        {
            return Conflict(ApiResponse<object>.Fail(ex.Message));
        }
        catch (TenantNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
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

        // AC 3: Pending companies cannot create charging stations until approved
        if (_tenantRepository != null)
        {
            var tenant = await _tenantRepository.GetTenantByIdAsync(tenantId, cancellationToken);
            if (tenant != null && !string.Equals(tenant.Status, "Active", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("Station creation rejected: Tenant {TenantId} has status {Status}", tenantId, tenant.Status);
                return StatusCode(StatusCodes.Status403Forbidden,
                    ApiResponse<object>.Fail("Company account is pending approval. You cannot create charging stations until your account has been approved by a platform admin."));
            }
        }
        else if (_companyAuthService != null)
        {
            try
            {
                var profile = await _companyAuthService.GetCompanyProfileAsync(tenantId, cancellationToken);
                if (profile != null && !string.Equals(profile.Status, "Active", StringComparison.OrdinalIgnoreCase))
                {
                    _logger.LogWarning("Station creation rejected: Tenant {TenantId} has status {Status}", tenantId, profile.Status);
                    return StatusCode(StatusCodes.Status403Forbidden,
                        ApiResponse<object>.Fail("Company account is pending approval. You cannot create charging stations until your account has been approved by a platform admin."));
                }
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Could not fetch company profile to verify status prior to station creation.");
            }
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

    /// <summary>
    /// Returns the list of staff members under the caller's tenant.
    /// Restricted to CompanyAdmin role only.
    /// </summary>
    [HttpGet("staff")]
    [Authorize(Roles = "CompanyAdmin")]
    [RequireRole(AppRoles.CompanyAdmin)]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<StaffResponseDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetStaffMembers(CancellationToken cancellationToken)
    {
        var tenantId = GetCallerTenantId();
        if (string.IsNullOrWhiteSpace(tenantId))
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail(ValidTenantClaimsRequiredMessage));
        }

        if (_companyAuthService == null)
        {
            return StatusCode(StatusCodes.Status501NotImplemented, ApiResponse<object>.Fail("Auth service not configured."));
        }

        var staff = await _companyAuthService.GetStaffMembersAsync(tenantId, cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<StaffResponseDto>>.Ok(staff, "Staff members retrieved successfully."));
    }

    /// <summary>
    /// Creates a staff account strictly scoped to the authenticated admin's tenant.
    /// Restricted to CompanyAdmin role only.
    /// </summary>
    [HttpPost("staff")]
    [Authorize(Roles = "CompanyAdmin")]
    [RequireRole(AppRoles.CompanyAdmin)]
    [ProducesResponseType(typeof(ApiResponse<StaffResponseDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreateStaffMember(
        [FromBody] CreateStaffRequestDto request,
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
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail(ValidTenantClaimsRequiredMessage));
        }

        if (_companyAuthService == null)
        {
            return StatusCode(StatusCodes.Status501NotImplemented, ApiResponse<object>.Fail("Auth service not configured."));
        }

        try
        {
            var created = await _companyAuthService.CreateStaffMemberAsync(tenantId, request, cancellationToken);
            return StatusCode(StatusCodes.Status201Created, ApiResponse<StaffResponseDto>.Ok(created, "Staff member created successfully."));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<object>.Fail(ex.Message));
        }
        catch (DuplicateEmailException ex)
        {
            return Conflict(ApiResponse<object>.Fail(ex.Message, new List<string> { ex.Message }));
        }
    }

    /// <summary>
    /// Deactivates a staff account scoped under the caller's tenant.
    /// Restricted to CompanyAdmin role only.
    /// </summary>
    [HttpPatch("staff/{userId}/deactivate")]
    [HttpPut("staff/{userId}/deactivate")]
    [Authorize(Roles = "CompanyAdmin")]
    [RequireRole(AppRoles.CompanyAdmin)]
    [ProducesResponseType(typeof(ApiResponse<StaffResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeactivateStaffMember(string userId, CancellationToken cancellationToken)
    {
        var tenantId = GetCallerTenantId();
        if (string.IsNullOrWhiteSpace(tenantId))
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail(ValidTenantClaimsRequiredMessage));
        }

        if (_companyAuthService == null)
        {
            return StatusCode(StatusCodes.Status501NotImplemented, ApiResponse<object>.Fail("Auth service not configured."));
        }

        try
        {
            var result = await _companyAuthService.DeactivateStaffMemberAsync(tenantId, userId, cancellationToken);
            return Ok(ApiResponse<StaffResponseDto>.Ok(result, "Staff account deactivated successfully."));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
    }

    /// <summary>
    /// Reactivates a staff account scoped under the caller's tenant.
    /// Restricted to CompanyAdmin role only.
    /// </summary>
    [HttpPatch("staff/{userId}/reactivate")]
    [HttpPut("staff/{userId}/reactivate")]
    [Authorize(Roles = "CompanyAdmin")]
    [RequireRole(AppRoles.CompanyAdmin)]
    [ProducesResponseType(typeof(ApiResponse<StaffResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ReactivateStaffMember(string userId, CancellationToken cancellationToken)
    {
        var tenantId = GetCallerTenantId();
        if (string.IsNullOrWhiteSpace(tenantId))
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail(ValidTenantClaimsRequiredMessage));
        }

        if (_companyAuthService == null)
        {
            return StatusCode(StatusCodes.Status501NotImplemented, ApiResponse<object>.Fail("Auth service not configured."));
        }

        try
        {
            var result = await _companyAuthService.ReactivateStaffMemberAsync(tenantId, userId, cancellationToken);
            return Ok(ApiResponse<StaffResponseDto>.Ok(result, "Staff account reactivated successfully."));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
    }

    /// <summary>
    /// Deletes the company account.
    /// Restricted to CompanyAdmin role only. Operators cannot delete the company.
    /// </summary>
    [HttpDelete]
    [Authorize(Roles = "CompanyAdmin")]
    [RequireRole(AppRoles.CompanyAdmin)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteCompany(CancellationToken cancellationToken)
    {
        var tenantId = GetCallerTenantId();
        if (string.IsNullOrWhiteSpace(tenantId))
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail(ValidTenantClaimsRequiredMessage));
        }

        if (_companyAuthService == null)
        {
            return StatusCode(StatusCodes.Status501NotImplemented, ApiResponse<object>.Fail("Auth service not configured."));
        }

        try
        {
            await _companyAuthService.DeleteCompanyAsync(tenantId, cancellationToken);
            return Ok(ApiResponse<object>.Ok(new { tenantId }, "Company account deleted successfully."));
        }
        catch (TenantNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
    }

    /// <summary>
    /// Retrieves company billing and subscription details.
    /// Restricted to CompanyAdmin role only. Operators cannot manage billing.
    /// </summary>
    [HttpGet("billing")]
    [Authorize(Roles = "CompanyAdmin")]
    [RequireRole(AppRoles.CompanyAdmin)]
    [ProducesResponseType(typeof(ApiResponse<BillingInfoDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetBillingInfo(CancellationToken cancellationToken)
    {
        var tenantId = GetCallerTenantId();
        if (string.IsNullOrWhiteSpace(tenantId))
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail(ValidTenantClaimsRequiredMessage));
        }

        if (_companyAuthService == null)
        {
            return StatusCode(StatusCodes.Status501NotImplemented, ApiResponse<object>.Fail("Auth service not configured."));
        }

        try
        {
            var billing = await _companyAuthService.GetBillingInfoAsync(tenantId, cancellationToken);
            return Ok(ApiResponse<BillingInfoDto>.Ok(billing, "Billing information retrieved successfully."));
        }
        catch (TenantNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
    }

    /// <summary>
    /// Updates company billing and payment information.
    /// Restricted to CompanyAdmin role only. Operators cannot manage billing.
    /// </summary>
    [HttpPut("billing")]
    [Authorize(Roles = "CompanyAdmin")]
    [RequireRole(AppRoles.CompanyAdmin)]
    [ProducesResponseType(typeof(ApiResponse<BillingInfoDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> UpdateBillingInfo(
        [FromBody] UpdateBillingRequestDto request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ApiResponse<object>.Fail("Validation failed."));
        }

        var tenantId = GetCallerTenantId();
        if (string.IsNullOrWhiteSpace(tenantId))
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail(ValidTenantClaimsRequiredMessage));
        }

        if (_companyAuthService == null)
        {
            return StatusCode(StatusCodes.Status501NotImplemented, ApiResponse<object>.Fail("Auth service not configured."));
        }

        try
        {
            var billing = await _companyAuthService.UpdateBillingInfoAsync(tenantId, request, cancellationToken);
            return Ok(ApiResponse<BillingInfoDto>.Ok(billing, "Billing information updated successfully."));
        }
        catch (TenantNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
    }
}
