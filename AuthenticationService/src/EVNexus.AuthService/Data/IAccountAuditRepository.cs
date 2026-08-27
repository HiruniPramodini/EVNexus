using EVNexus.AuthService.Models;

namespace EVNexus.AuthService.Data;

public interface IAccountAuditRepository
{
    Task RecordStatusAuditAsync(AccountStatusAudit audit, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AccountStatusAudit>> GetAuditHistoryByAccountIdAsync(string accountId, CancellationToken cancellationToken = default);
}
