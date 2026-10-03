using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using EVNexus.MapService.Data;
using EVNexus.MapService.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EVNexus.MapService.Controllers;

[ApiController]
[Route("api/company/sessions")]
[Route("api/map/company/sessions")]
[Authorize(Roles = "CompanyAdmin")]
public class CompanySessionsController : ControllerBase
{
    private readonly ISessionRepository _sessionRepo;
    private readonly IStationRepository _stationRepo;
    private readonly IChargerRepository _chargerRepo;
    private readonly ITenantContext _tenantContext;

    public CompanySessionsController(
        ISessionRepository sessionRepo,
        IStationRepository stationRepo,
        IChargerRepository chargerRepo,
        ITenantContext tenantContext)
    {
        _sessionRepo = sessionRepo;
        _stationRepo = stationRepo;
        _chargerRepo = chargerRepo;
        _tenantContext = tenantContext;
    }

    [HttpGet("active")]
    public async Task<IActionResult> GetActiveCompanySessions()
    {
        var tenantId = _tenantContext.TenantId;
        if (string.IsNullOrEmpty(tenantId))
        {
            return Forbid();
        }

        var sessions = await _sessionRepo.GetActiveSessionsForTenantAsync(tenantId);
        var allStations = await _stationRepo.GetAllByTenantIdAsync(tenantId);

        var enrichedSessions = new List<object>();
        foreach (var s in sessions)
        {
            var station = allStations.FirstOrDefault(st => st.Id == s.StationId);
            Charger? charger = null;
            if (!string.IsNullOrEmpty(s.ChargerId))
            {
                charger = await _chargerRepo.GetChargerByIdAsync(s.ChargerId, s.StationId);
            }

            var chargerLabel = charger != null ? $"{charger.Type} ({charger.PowerKw}kW)" : (s.ChargerId ?? "Charger");
            var portType = charger?.Type ?? station?.ConnectorType ?? "Standard";

            enrichedSessions.Add(new
            {
                sessionId = s.Id,
                driverId = s.DriverId,
                driver = s.DriverId,
                stationId = s.StationId,
                station = station?.Name ?? "Unknown Station",
                stationName = station?.Name ?? "Unknown Station",
                chargingCode = station?.ChargingCode ?? "N/A",
                chargerId = s.ChargerId,
                charger = chargerLabel,
                port = portType,
                connectorType = portType,
                startTime = s.StartTime,
                currentStatus = s.Status,
                status = s.Status,
                energyConsumed = s.EnergyConsumedKwh,
                energyConsumedKwh = s.EnergyConsumedKwh,
                estimatedCost = s.EstimatedCost,
                currentCost = s.TotalCost,
                session = s
            });
        }

        return Ok(new { success = true, data = enrichedSessions });
    }
}
