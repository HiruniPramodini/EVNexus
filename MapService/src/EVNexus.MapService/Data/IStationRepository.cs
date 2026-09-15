using System.Collections.Generic;
using System.Threading.Tasks;
using EVNexus.MapService.Models;

namespace EVNexus.MapService.Data;

public interface IStationRepository
{
    Task<string> CreateStationAsync(Station station);
    Task<bool> UpdateStationAsync(Station station);
    Task<bool> DeactivateStationAsync(string id, string tenantId);
    Task<Station?> GetStationByIdAsync(string id, string tenantId);
    Task<IEnumerable<Station>> GetAllByTenantIdAsync(string tenantId);
    Task<IEnumerable<Station>> GetAllActiveStationsAsync();
}
