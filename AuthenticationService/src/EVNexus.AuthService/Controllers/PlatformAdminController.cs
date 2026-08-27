using System.Security.Claims;
using EVNexus.AuthService.Attributes;
using EVNexus.AuthService.DTOs;
using EVNexus.AuthService.Security;
using EVNexus.AuthService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EVNexus.AuthService.Controllers;

[ApiController]
[Route("api/admin")]
[Route("api/auth/admin")]
[Authorize(Roles = AppRoles.PlatformAdmin)]
[RequireRole(AppRoles.PlatformAdmin)]
public class PlatformAdminController : ControllerBase
{
    private readonly IAccountManagementService _accountManagementService;
    private readonly IStatusNotificationService? _notificationService;
    private readonly ILogger<PlatformAdminController> _logger;

    public PlatformAdminController(
        IAccountManagementService accountManagementService,
        ILogger<PlatformAdminController> logger,
        IStatusNotificationService? notificationService = null)
    {
        _accountManagementService = accountManagementService;
        _logger = logger;
        _notificationService = notificationService;
    }

    [HttpPost("company/{tenantId}/suspend")]
    [HttpPatch("company/{tenantId}/suspend")]
    public async Task<IActionResult> SuspendCompany(
        [FromRoute] string tenantId,
        [FromBody] SuspendAccountRequestDto? request,
        CancellationToken cancellationToken)
    {
        try
        {
            var adminUser = GetCurrentAdminIdentifier();
            var response = await _accountManagementService.SuspendCompanyAsync(
                tenantId, request?.Reason, adminUser, cancellationToken);

            return Ok(new ApiResponse<AccountStatusResponseDto>
            {
                Success = true,
                Message = response.Message,
                Data = response
            });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to suspend company {TenantId}", tenantId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new ApiResponse<object> { Success = false, Message = "An unexpected error occurred while suspending the company account." });
        }
    }

    [HttpPost("company/{tenantId}/reactivate")]
    [HttpPatch("company/{tenantId}/reactivate")]
    public async Task<IActionResult> ReactivateCompany(
        [FromRoute] string tenantId,
        [FromBody] ReactivateAccountRequestDto? request,
        CancellationToken cancellationToken)
    {
        try
        {
            var adminUser = GetCurrentAdminIdentifier();
            var response = await _accountManagementService.ReactivateCompanyAsync(
                tenantId, request?.Reason, adminUser, cancellationToken);

            return Ok(new ApiResponse<AccountStatusResponseDto>
            {
                Success = true,
                Message = response.Message,
                Data = response
            });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to reactivate company {TenantId}", tenantId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new ApiResponse<object> { Success = false, Message = "An unexpected error occurred while reactivating the company account." });
        }
    }

    [HttpPost("driver/{driverId}/suspend")]
    [HttpPatch("driver/{driverId}/suspend")]
    public async Task<IActionResult> SuspendDriver(
        [FromRoute] string driverId,
        [FromBody] SuspendAccountRequestDto? request,
        CancellationToken cancellationToken)
    {
        try
        {
            var adminUser = GetCurrentAdminIdentifier();
            var response = await _accountManagementService.SuspendDriverAsync(
                driverId, request?.Reason, adminUser, cancellationToken);

            return Ok(new ApiResponse<AccountStatusResponseDto>
            {
                Success = true,
                Message = response.Message,
                Data = response
            });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to suspend driver {DriverId}", driverId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new ApiResponse<object> { Success = false, Message = "An unexpected error occurred while suspending the driver account." });
        }
    }

    [HttpPost("driver/{driverId}/reactivate")]
    [HttpPatch("driver/{driverId}/reactivate")]
    public async Task<IActionResult> ReactivateDriver(
        [FromRoute] string driverId,
        [FromBody] ReactivateAccountRequestDto? request,
        CancellationToken cancellationToken)
    {
        try
        {
            var adminUser = GetCurrentAdminIdentifier();
            var response = await _accountManagementService.ReactivateDriverAsync(
                driverId, request?.Reason, adminUser, cancellationToken);

            return Ok(new ApiResponse<AccountStatusResponseDto>
            {
                Success = true,
                Message = response.Message,
                Data = response
            });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to reactivate driver {DriverId}", driverId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new ApiResponse<object> { Success = false, Message = "An unexpected error occurred while reactivating the driver account." });
        }
    }

    [HttpGet("accounts/{accountId}/audit-history")]
    [HttpGet("accounts/{accountId}/audit-logs")]
    public async Task<IActionResult> GetAccountAuditHistory(
        [FromRoute] string accountId,
        CancellationToken cancellationToken)
    {
        try
        {
            var history = await _accountManagementService.GetAccountAuditHistoryAsync(accountId, cancellationToken);
            return Ok(new ApiResponse<IReadOnlyList<AccountStatusAuditDto>>
            {
                Success = true,
                Message = $"Retrieved {history.Count} audit records for account '{accountId}'.",
                Data = history
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve audit history for account {AccountId}", accountId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new ApiResponse<object> { Success = false, Message = "An unexpected error occurred while retrieving account audit history." });
        }
    }

    [HttpPost("company/{tenantId}/approve")]
    [HttpPatch("company/{tenantId}/approve")]
    public async Task<IActionResult> ApproveCompany(
        [FromRoute] string tenantId,
        [FromBody] ApproveCompanyRequestDto? request,
        CancellationToken cancellationToken)
    {
        try
        {
            var adminUser = GetCurrentAdminIdentifier();
            var response = await _accountManagementService.ApproveCompanyAsync(
                tenantId, request?.Notes, adminUser, cancellationToken);

            return Ok(new ApiResponse<CompanyApprovalResponseDto>
            {
                Success = true,
                Message = response.Message,
                Data = response
            });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to approve company {TenantId}", tenantId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new ApiResponse<object> { Success = false, Message = "An unexpected error occurred while approving the company account." });
        }
    }

    [HttpPost("company/{tenantId}/reject")]
    [HttpPatch("company/{tenantId}/reject")]
    public async Task<IActionResult> RejectCompany(
        [FromRoute] string tenantId,
        [FromBody] RejectCompanyRequestDto? request,
        CancellationToken cancellationToken)
    {
        try
        {
            var adminUser = GetCurrentAdminIdentifier();
            var response = await _accountManagementService.RejectCompanyAsync(
                tenantId, request?.Reason, adminUser, cancellationToken);

            return Ok(new ApiResponse<CompanyApprovalResponseDto>
            {
                Success = true,
                Message = response.Message,
                Data = response
            });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to reject company {TenantId}", tenantId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new ApiResponse<object> { Success = false, Message = "An unexpected error occurred while rejecting the company account." });
        }
    }

    [HttpGet("companies/pending")]
    public async Task<IActionResult> GetPendingCompanies(CancellationToken cancellationToken)
    {
        try
        {
            var companies = await _accountManagementService.GetPendingCompaniesAsync(cancellationToken);
            return Ok(new ApiResponse<IReadOnlyList<EVNexus.AuthService.Models.Tenant>>
            {
                Success = true,
                Message = $"Found {companies.Count} pending company accounts.",
                Data = companies
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve pending companies");
            return StatusCode(StatusCodes.Status500InternalServerError,
                new ApiResponse<object> { Success = false, Message = "An unexpected error occurred while retrieving pending companies." });
        }
    }

    [HttpGet("companies/{tenantId}/notifications")]
    public IActionResult GetCompanyNotifications([FromRoute] string tenantId)
    {
        var notifications = _notificationService?.GetSentNotifications(tenantId)
            ?? Array.Empty<SimulatedNotificationDto>();

        return Ok(new ApiResponse<IReadOnlyList<SimulatedNotificationDto>>
        {
            Success = true,
            Message = $"Found {notifications.Count} notifications for company '{tenantId}'.",
            Data = notifications
        });
    }

    private string GetCurrentAdminIdentifier()
    {
        return User.FindFirstValue(ClaimTypes.Name)
            ?? User.FindFirstValue("name")
            ?? User.FindFirstValue(ClaimTypes.Email)
            ?? User.FindFirstValue("email")
            ?? User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub")
            ?? "PlatformAdmin";
    }
}
