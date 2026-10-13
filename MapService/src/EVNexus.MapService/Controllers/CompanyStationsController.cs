using System;
using System.Linq;
using System.Threading.Tasks;
using EVNexus.MapService.Data;
using EVNexus.MapService.DTOs;
using EVNexus.MapService.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EVNexus.MapService.Controllers;

[ApiController]
[Route("api/map/company/stations")]
[Authorize(Roles = "CompanyAdmin")]
public class CompanyStationsController : ControllerBase
{
    private readonly IStationRepository _repository;
    private readonly ITenantContext _tenantContext;

    public CompanyStationsController(IStationRepository repository, ITenantContext tenantContext)
    {
        _repository = repository;
        _tenantContext = tenantContext;
    }

    [HttpPost]
    public async Task<IActionResult> CreateStation([FromBody] CreateStationDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var tenantId = _tenantContext.TenantId;
        if (string.IsNullOrEmpty(tenantId))
            return Unauthorized("Tenant ID not found in token.");

        // Generate a 6-character random alphanumeric code
        var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        var random = new Random();
        var code = new string(Enumerable.Repeat(chars, 6).Select(s => s[random.Next(s.Length)]).ToArray());

        TimeSpan? peakStart = null;
        TimeSpan? peakEnd = null;

        if (!string.IsNullOrEmpty(dto.PeakStartTime) && !string.IsNullOrEmpty(dto.PeakEndTime))
        {
            if (TimeSpan.TryParse(dto.PeakStartTime, out var ps) && TimeSpan.TryParse(dto.PeakEndTime, out var pe))
            {
                peakStart = ps;
                peakEnd = pe;
            }
            else
            {
                return BadRequest("Invalid Peak Time format. Use HH:mm");
            }
        }

        var station = new Station
        {
            Id = Guid.NewGuid().ToString(),
            TenantId = tenantId,
            Name = dto.Name,
            Address = dto.Address,
            Latitude = dto.Latitude,
            Longitude = dto.Longitude,
            ConnectorType = dto.ConnectorType,
            CapacityKw = dto.CapacityKw,
            PricePerKwh = dto.PricePerKwh,
            ChargingCode = code,
            PeakPricePerKwh = dto.PeakPricePerKwh,
            OffPeakPricePerKwh = dto.OffPeakPricePerKwh,
            PeakStartTime = peakStart,
            PeakEndTime = peakEnd,
            IsActive = true
        };

        var id = await _repository.CreateStationAsync(station);
        return Created($"/api/company/stations/{id}", new { success = true, id, code });
    }

    [HttpGet]
    public async Task<IActionResult> GetStations()
    {
        var tenantId = _tenantContext.TenantId;
        if (string.IsNullOrEmpty(tenantId))
            return Unauthorized();

        var stations = await _repository.GetAllByTenantIdAsync(tenantId);
        return Ok(new { success = true, data = stations });
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetStation(string id)
    {
        var tenantId = _tenantContext.TenantId;
        var station = await _repository.GetStationByIdAsync(id, tenantId);

        if (station == null)
            return NotFound();

        return Ok(new { success = true, data = station });
    }

    [HttpGet("{id}/qr")]
    public async Task<IActionResult> GetStationQr(string id)
    {
        var tenantId = _tenantContext.TenantId;
        var station = await _repository.GetStationByIdAsync(id, tenantId);

        if (station == null || !station.IsActive)
            return NotFound(new { success = false, message = "Station not found or inactive." });

        var payload = new {
            system = "EVNEXUS",
            companyId = station.TenantId,
            stationId = station.Id,
            chargerId = station.Id // Fallback for frontend compatibility
        };

        return Ok(new { success = true, data = payload });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateStation(string id, [FromBody] UpdateStationDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var tenantId = _tenantContext.TenantId;
        var station = await _repository.GetStationByIdAsync(id, tenantId);

        if (station == null)
            return NotFound("Station not found or you don't have access.");

        TimeSpan? peakStart = null;
        TimeSpan? peakEnd = null;

        if (!string.IsNullOrEmpty(dto.PeakStartTime) && !string.IsNullOrEmpty(dto.PeakEndTime))
        {
            if (TimeSpan.TryParse(dto.PeakStartTime, out var ps) && TimeSpan.TryParse(dto.PeakEndTime, out var pe))
            {
                peakStart = ps;
                peakEnd = pe;
            }
            else
            {
                return BadRequest("Invalid Peak Time format. Use HH:mm");
            }
        }

        station.Address = dto.Address;
        station.PricePerKwh = dto.PricePerKwh;
        station.CapacityKw = dto.CapacityKw;
        station.ConnectorType = dto.ConnectorType;
        station.PeakPricePerKwh = dto.PeakPricePerKwh;
        station.OffPeakPricePerKwh = dto.OffPeakPricePerKwh;
        station.PeakStartTime = peakStart;
        station.PeakEndTime = peakEnd;

        var updated = await _repository.UpdateStationAsync(station);
        if (updated)
            return Ok(new { success = true });

        return BadRequest("Failed to update station.");
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "CompanyAdmin")]
    public async Task<IActionResult> DeactivateStation(string id)
    {
        var success = await _repository.DeactivateStationAsync(id, _tenantContext.TenantId);
        if (!success)
            return NotFound(new { success = false, message = "Station not found or already deactivated." });

        return Ok(new { success = true, message = "Station deactivated successfully." });
    }

    [HttpGet("sessions/active")]
    [Authorize(Roles = "CompanyAdmin")]
    public async Task<IActionResult> GetActiveCompanySessions([FromServices] ISessionRepository sessionRepo)
    {
        var sessions = await sessionRepo.GetActiveSessionsForTenantAsync(_tenantContext.TenantId);

        var allStations = await _repository.GetAllByTenantIdAsync(_tenantContext.TenantId);
        var enrichedSessions = sessions.Select(s => {
            var station = allStations.FirstOrDefault(st => st.Id == s.StationId);
            return new {
                session = s,
                stationName = station?.Name ?? "Unknown Station",
                chargingCode = station?.ChargingCode ?? "N/A"
            };
        }).ToList();

        return Ok(new { success = true, data = enrichedSessions });
    }

    [HttpGet("{stationId}/chargers")]
    public async Task<IActionResult> GetChargers(string stationId, [FromServices] IChargerRepository chargerRepo)
    {
        var tenantId = _tenantContext.TenantId;
        var station = await _repository.GetStationByIdAsync(stationId, tenantId);
        if (station == null)
            return NotFound(new { success = false, message = "Station not found." });

        var chargers = await chargerRepo.GetChargersByStationIdAsync(stationId);
        return Ok(new { success = true, data = chargers });
    }

    [HttpPost("{stationId}/chargers")]
    public async Task<IActionResult> CreateCharger(string stationId, [FromBody] ChargerDto dto, [FromServices] IChargerRepository chargerRepo)
    {
        var tenantId = _tenantContext.TenantId;
        var station = await _repository.GetStationByIdAsync(stationId, tenantId);
        if (station == null)
            return NotFound(new { success = false, message = "Station not found." });

        var charger = new Charger
        {
            Id = Guid.NewGuid().ToString(),
            StationId = stationId,
            Type = dto.Type,
            PowerKw = dto.PowerKw,
            PricePerKwh = dto.PricePerKwh,
            Status = "Available"
        };

        var id = await chargerRepo.CreateChargerAsync(charger);
        return Ok(new { success = true, id });
    }

    [HttpPut("{stationId}/chargers/{chargerId}")]
    public async Task<IActionResult> UpdateCharger(string stationId, string chargerId, [FromBody] ChargerDto dto, [FromServices] IChargerRepository chargerRepo)
    {
        var tenantId = _tenantContext.TenantId;
        var station = await _repository.GetStationByIdAsync(stationId, tenantId);
        if (station == null)
            return NotFound(new { success = false, message = "Station not found." });

        var charger = await chargerRepo.GetChargerByIdAsync(chargerId, stationId);
        if (charger == null)
            return NotFound(new { success = false, message = "Charger not found." });

        charger.Type = dto.Type;
        charger.PowerKw = dto.PowerKw;
        charger.PricePerKwh = dto.PricePerKwh;

        var updated = await chargerRepo.UpdateChargerAsync(charger);
        if (updated)
            return Ok(new { success = true });

        return BadRequest(new { success = false, message = "Failed to update charger." });
    }

    [HttpDelete("{stationId}/chargers/{chargerId}")]
    public async Task<IActionResult> DeleteCharger(string stationId, string chargerId, [FromServices] IChargerRepository chargerRepo, [FromServices] ISessionRepository sessionRepo)
    {
        var tenantId = _tenantContext.TenantId;
        var station = await _repository.GetStationByIdAsync(stationId, tenantId);
        if (station == null)
            return NotFound(new { success = false, message = "Station not found." });

        var charger = await chargerRepo.GetChargerByIdAsync(chargerId, stationId);
        if (charger == null)
            return NotFound(new { success = false, message = "Charger not found." });

        // Step 6: check if charger is involved in active session
        var activeSessions = await sessionRepo.GetActiveSessionsForTenantAsync(tenantId);
        if (activeSessions.Any(s => s.ChargerId == chargerId))
            return BadRequest(new { success = false, message = "Cannot delete charger with an active session." });

        var deleted = await chargerRepo.DeleteChargerAsync(chargerId, stationId);
        if (deleted)
            return Ok(new { success = true });

        return BadRequest(new { success = false, message = "Failed to delete charger." });
    }

    [HttpGet("{stationId}/chargers/{chargerId}/qr")]
    public async Task<IActionResult> GetChargerQr(string stationId, string chargerId, [FromServices] IChargerRepository chargerRepo)
    {
        var tenantId = _tenantContext.TenantId;
        var station = await _repository.GetStationByIdAsync(stationId, tenantId);
        if (station == null || !station.IsActive)
            return NotFound(new { success = false, message = "Station not found or inactive." });

        var charger = await chargerRepo.GetChargerByIdAsync(chargerId, stationId);
        if (charger == null)
            return NotFound(new { success = false, message = "Charger not found." });

        var payload = new {
            system = "EVNEXUS",
            companyId = station.TenantId,
            stationId = station.Id,
            chargerId = charger.Id
        };

        return Ok(new { success = true, data = payload });
    }
}
