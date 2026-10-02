using System.Collections.Generic;
using System.Threading.Tasks;
using EVNexus.PaymentService.Models;

namespace EVNexus.PaymentService.Data;

public interface IOutboxRepository
{
    Task<long> SaveMessageAsync(OutboxMessage message);
    Task<long> SaveMessageAsync(OutboxMessage message, System.Data.IDbConnection connection, System.Data.IDbTransaction? transaction);
    Task<IEnumerable<OutboxMessage>> GetPendingMessagesAsync(int batchSize = 50);
    Task MarkAsPublishedAsync(long id);
    Task RecordFailureAsync(long id, string error, System.DateTime availableAt);
}
