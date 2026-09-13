using System.Threading.Tasks;
using EVNexus.MapService.Models;

namespace EVNexus.MapService.Data;

public interface ISessionRepository
{
    Task<string> StartSessionAsync(ChargingSession session);
    Task<ChargingSession?> GetSessionByIdAsync(string id);
    Task<bool> StopSessionAsync(string id, decimal energy, decimal cost);
    Task<ChargingSession?> GetActiveSessionForDriverAsync(string driverId);
    Task<System.Collections.Generic.IEnumerable<ChargingSession>> GetSessionHistoryForDriverAsync(string driverId);
    Task<System.Collections.Generic.IEnumerable<ChargingSession>> GetActiveSessionsForTenantAsync(string tenantId);
}
