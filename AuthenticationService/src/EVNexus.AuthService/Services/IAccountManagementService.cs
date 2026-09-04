using EVNexus.AuthService.DTOs;

namespace EVNexus.AuthService.Services;

public interface IAccountManagementService
{
    Task<AccountStatusResponseDto> SuspendCompanyAsync(string tenantId, string? reason, string performedBy, CancellationToken cancellationToken = default);
    Task<AccountStatusResponseDto> ReactivateCompanyAsync(string tenantId, string? reason, string performedBy, CancellationToken cancellationToken = default);
    Task<AccountStatusResponseDto> SuspendDriverAsync(string driverId, string? reason, string performedBy, CancellationToken cancellationToken = default);
    Task<AccountStatusResponseDto> ReactivateDriverAsync(string driverId, string? reason, string performedBy, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AccountStatusAuditDto>> GetAccountAuditHistoryAsync(string accountId, CancellationToken cancellationToken = default);
    Task<CompanyApprovalResponseDto> ApproveCompanyAsync(string tenantId, string? notes, string performedBy, CancellationToken cancellationToken = default);
    Task<CompanyApprovalResponseDto> RejectCompanyAsync(string tenantId, string? reason, string performedBy, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<EVNexus.AuthService.Models.Tenant>> GetPendingCompaniesAsync(CancellationToken cancellationToken = default);
}
