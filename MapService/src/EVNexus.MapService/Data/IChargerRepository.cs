using System.Collections.Generic;
using System.Threading.Tasks;
using EVNexus.MapService.Models;

namespace EVNexus.MapService.Data;

public interface IChargerRepository
{
    Task<IEnumerable<Charger>> GetChargersByStationIdAsync(string stationId);
    Task<Charger?> GetChargerByIdAsync(string id, string stationId);
    Task<string> CreateChargerAsync(Charger charger);
    Task<bool> UpdateChargerAsync(Charger charger);
    Task<bool> DeleteChargerAsync(string id, string stationId);
}
