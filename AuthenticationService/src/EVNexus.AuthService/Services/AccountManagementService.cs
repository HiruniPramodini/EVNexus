using EVNexus.AuthService.Data;
using EVNexus.AuthService.DTOs;
using EVNexus.AuthService.Models;

namespace EVNexus.AuthService.Services;

public class AccountManagementService : IAccountManagementService
{
    private const string ActiveStatus = "Active";
    private const string SuspendedStatus = "Suspended";
    private const string SuspendAction = "Suspend";
    private const string ReactivateAction = "Reactivate";

    private readonly ITenantRepository _tenantRepository;
    private readonly IDriverRepository _driverRepository;
    private readonly IAccountAuditRepository _auditRepository;
    private readonly IRefreshTokenRepository _refreshTokenRepository;
    private readonly ILogger<AccountManagementService> _logger;

    public AccountManagementService(
        ITenantRepository tenantRepository,
        IDriverRepository driverRepository,
        IAccountAuditRepository auditRepository,
        IRefreshTokenRepository refreshTokenRepository,
        ILogger<AccountManagementService> logger)
    {
        _tenantRepository = tenantRepository;
        _driverRepository = driverRepository;
        _auditRepository = auditRepository;
        _refreshTokenRepository = refreshTokenRepository;
        _logger = logger;
    }

    public async Task<AccountStatusResponseDto> SuspendCompanyAsync(
        string tenantId,
        string? reason,
        string performedBy,
        CancellationToken cancellationToken = default)
    {
        var tenant = await _tenantRepository.GetTenantByIdAsync(tenantId, cancellationToken);
        if (tenant == null)
        {
            throw new KeyNotFoundException($"Company with Tenant ID '{tenantId}' was not found.");
        }

        var previousStatus = tenant.Status;
        await _tenantRepository.UpdateTenantStatusAsync(tenantId, SuspendedStatus, cancellationToken);

        // Invalidate all active sessions server-side immediately
        await _refreshTokenRepository.RevokeAllUserTokensAsync(tenantId, cancellationToken);

        var now = DateTime.UtcNow;
        var audit = new AccountStatusAudit
        {
            AuditId = "AUD-" + Guid.NewGuid().ToString("N")[..12].ToUpperInvariant(),
            AccountId = tenantId,
            AccountType = "Company",
            Action = SuspendAction,
            PreviousStatus = previousStatus,
            NewStatus = SuspendedStatus,
            Reason = reason,
            PerformedBy = performedBy,
            Timestamp = now
        };

        await _auditRepository.RecordStatusAuditAsync(audit, cancellationToken);

        _logger.LogInformation("Company {TenantId} suspended by {Admin} at {Timestamp}. Reason: {Reason}",
            tenantId, performedBy, now, reason ?? "N/A");

        return new AccountStatusResponseDto
        {
            AccountId = tenantId,
            AccountType = "Company",
            Status = SuspendedStatus,
            PreviousStatus = previousStatus,
            Action = SuspendAction,
            Reason = reason,
            PerformedBy = performedBy,
            Timestamp = now,
            Message = $"Company account '{tenant.CompanyName}' has been suspended successfully."
        };
    }

    public async Task<AccountStatusResponseDto> ReactivateCompanyAsync(
        string tenantId,
        string? reason,
        string performedBy,
        CancellationToken cancellationToken = default)
    {
        var tenant = await _tenantRepository.GetTenantByIdAsync(tenantId, cancellationToken);
        if (tenant == null)
        {
            throw new KeyNotFoundException($"Company with Tenant ID '{tenantId}' was not found.");
        }

        var previousStatus = tenant.Status;
        await _tenantRepository.UpdateTenantStatusAsync(tenantId, ActiveStatus, cancellationToken);

        var now = DateTime.UtcNow;
        var audit = new AccountStatusAudit
        {
            AuditId = "AUD-" + Guid.NewGuid().ToString("N")[..12].ToUpperInvariant(),
            AccountId = tenantId,
            AccountType = "Company",
            Action = ReactivateAction,
            PreviousStatus = previousStatus,
            NewStatus = ActiveStatus,
            Reason = reason,
            PerformedBy = performedBy,
            Timestamp = now
        };

        await _auditRepository.RecordStatusAuditAsync(audit, cancellationToken);

        _logger.LogInformation("Company {TenantId} reactivated by {Admin} at {Timestamp}. Reason: {Reason}",
            tenantId, performedBy, now, reason ?? "N/A");

        return new AccountStatusResponseDto
        {
            AccountId = tenantId,
            AccountType = "Company",
            Status = ActiveStatus,
            PreviousStatus = previousStatus,
            Action = ReactivateAction,
            Reason = reason,
            PerformedBy = performedBy,
            Timestamp = now,
            Message = $"Company account '{tenant.CompanyName}' has been reactivated successfully."
        };
    }

    public async Task<AccountStatusResponseDto> SuspendDriverAsync(
        string driverId,
        string? reason,
        string performedBy,
        CancellationToken cancellationToken = default)
    {
        var driver = await _driverRepository.GetDriverByIdAsync(driverId, cancellationToken);
        if (driver == null)
        {
            throw new KeyNotFoundException($"Driver with ID '{driverId}' was not found.");
        }

        var previousStatus = driver.Status;
        await _driverRepository.UpdateDriverStatusAsync(driverId, SuspendedStatus, cancellationToken);

        // Invalidate all active sessions server-side immediately
        await _refreshTokenRepository.RevokeAllUserTokensAsync(driverId, cancellationToken);

        var now = DateTime.UtcNow;
        var audit = new AccountStatusAudit
        {
            AuditId = "AUD-" + Guid.NewGuid().ToString("N")[..12].ToUpperInvariant(),
            AccountId = driverId,
            AccountType = "Driver",
            Action = SuspendAction,
            PreviousStatus = previousStatus,
            NewStatus = SuspendedStatus,
            Reason = reason,
            PerformedBy = performedBy,
            Timestamp = now
        };

        await _auditRepository.RecordStatusAuditAsync(audit, cancellationToken);

        _logger.LogInformation("Driver {DriverId} suspended by {Admin} at {Timestamp}. Reason: {Reason}",
            driverId, performedBy, now, reason ?? "N/A");

        return new AccountStatusResponseDto
        {
            AccountId = driverId,
            AccountType = "Driver",
            Status = SuspendedStatus,
            PreviousStatus = previousStatus,
            Action = SuspendAction,
            Reason = reason,
            PerformedBy = performedBy,
            Timestamp = now,
            Message = $"Driver account '{driver.Name}' has been suspended successfully."
        };
    }

    public async Task<AccountStatusResponseDto> ReactivateDriverAsync(
        string driverId,
        string? reason,
        string performedBy,
        CancellationToken cancellationToken = default)
    {
        var driver = await _driverRepository.GetDriverByIdAsync(driverId, cancellationToken);
        if (driver == null)
        {
            throw new KeyNotFoundException($"Driver with ID '{driverId}' was not found.");
        }

        var previousStatus = driver.Status;
        await _driverRepository.UpdateDriverStatusAsync(driverId, ActiveStatus, cancellationToken);

        var now = DateTime.UtcNow;
        var audit = new AccountStatusAudit
        {
            AuditId = "AUD-" + Guid.NewGuid().ToString("N")[..12].ToUpperInvariant(),
            AccountId = driverId,
            AccountType = "Driver",
            Action = ReactivateAction,
            PreviousStatus = previousStatus,
            NewStatus = ActiveStatus,
            Reason = reason,
            PerformedBy = performedBy,
            Timestamp = now
        };

        await _auditRepository.RecordStatusAuditAsync(audit, cancellationToken);

        _logger.LogInformation("Driver {DriverId} reactivated by {Admin} at {Timestamp}. Reason: {Reason}",
            driverId, performedBy, now, reason ?? "N/A");

        return new AccountStatusResponseDto
        {
            AccountId = driverId,
            AccountType = "Driver",
            Status = ActiveStatus,
            PreviousStatus = previousStatus,
            Action = ReactivateAction,
            Reason = reason,
            PerformedBy = performedBy,
            Timestamp = now,
            Message = $"Driver account '{driver.Name}' has been reactivated successfully."
        };
    }

    public async Task<IReadOnlyList<AccountStatusAuditDto>> GetAccountAuditHistoryAsync(
        string accountId,
        CancellationToken cancellationToken = default)
    {
        var audits = await _auditRepository.GetAuditHistoryByAccountIdAsync(accountId, cancellationToken);
        return audits.Select(a => new AccountStatusAuditDto
        {
            AuditId = a.AuditId,
            AccountId = a.AccountId,
            AccountType = a.AccountType,
            Action = a.Action,
            PreviousStatus = a.PreviousStatus,
            NewStatus = a.NewStatus,
            Reason = a.Reason,
            PerformedBy = a.PerformedBy,
            Timestamp = a.Timestamp
        }).ToList();
    }
}
