using System;
using System.Linq;
using System.Threading.Tasks;
using EVNexus.MapService.Data;
using EVNexus.MapService.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EVNexus.MapService.Controllers;

[ApiController]
[Route("api/map/driver/sessions")]
[Authorize]
public class SessionsController : ControllerBase
{
    private readonly ISessionRepository _sessionRepo;
    private readonly IStationRepository _stationRepo;

    public SessionsController(ISessionRepository sessionRepo, IStationRepository stationRepo)
    {
        _sessionRepo = sessionRepo;
        _stationRepo = stationRepo;
    }

    [HttpPost("start")]
    public async Task<IActionResult> StartSession([FromBody] StartSessionDto request, [FromServices] ITenantContext tenantContext)
    {
        var driverId = tenantContext.UserId;
        if (string.IsNullOrEmpty(driverId)) return Unauthorized();

        // 1. Get all active stations and find the one matching the ChargingCode
        var allStations = await _stationRepo.GetAllActiveStationsAsync();
        var station = allStations.FirstOrDefault(s => s.ChargingCode == request.ChargingCode);
        
        if (station == null)
            return BadRequest(new { success = false, message = "Invalid or inactive Charging Code." });

        // 2. Check if driver already has an active session
        var activeSession = await _sessionRepo.GetActiveSessionForDriverAsync(driverId);
        if (activeSession != null)
            return BadRequest(new { success = false, message = "You already have an active charging session." });

        // 3. For MVP, we simulate a wallet check - assume balance is okay if they have a token.
        
        // 4. Start the session
        var session = new ChargingSession
        {
            StationId = station.Id,
            DriverId = driverId
        };

        await _sessionRepo.StartSessionAsync(session);

        return Ok(new { success = true, data = session, station = station });
    }

    [HttpPost("{id}/stop")]
    public async Task<IActionResult> StopSession(string id, [FromServices] ITenantContext tenantContext)
    {
        var driverId = tenantContext.UserId;
        
        var session = await _sessionRepo.GetSessionByIdAsync(id);
        if (session == null || session.DriverId != driverId)
            return NotFound(new { success = false, message = "Session not found." });

        if (session.Status != "Active")
            return BadRequest(new { success = false, message = "Session is already completed." });

        // Simulate duration and energy
        var duration = DateTime.UtcNow - session.StartTime;
        var energy = (decimal)(duration.TotalMinutes * 0.5); // Mock 0.5 kWh per minute
        if (energy < 0.1m) energy = 0.5m; // minimum
        
        var allStations = await _stationRepo.GetAllActiveStationsAsync();
        var station = allStations.FirstOrDefault(s => s.Id == session.StationId);
        var price = station?.PricePerKwh ?? 0.5m;

        var cost = energy * price;

        await _sessionRepo.StopSessionAsync(id, energy, cost);

        // Fetch updated
        var updatedSession = await _sessionRepo.GetSessionByIdAsync(id);

        return Ok(new { success = true, data = updatedSession });
    }

    [HttpGet("active")]
    public async Task<IActionResult> GetActiveSession([FromServices] ITenantContext tenantContext)
    {
        var driverId = tenantContext.UserId;
        if (string.IsNullOrEmpty(driverId)) return Unauthorized();

        var session = await _sessionRepo.GetActiveSessionForDriverAsync(driverId);
        if (session == null)
            return Ok(new { success = true, data = (object)null });

        var allStations = await _stationRepo.GetAllActiveStationsAsync();
        var station = allStations.FirstOrDefault(s => s.Id == session.StationId);

        return Ok(new { success = true, data = session, station = station });
    }

    [HttpGet("history")]
    public async Task<IActionResult> GetSessionHistory([FromServices] ITenantContext tenantContext)
    {
        var driverId = tenantContext.UserId;
        if (string.IsNullOrEmpty(driverId)) return Unauthorized();

        var history = await _sessionRepo.GetSessionHistoryForDriverAsync(driverId);
        
        // Let's enrich with station details
        var allStations = await _stationRepo.GetAllActiveStationsAsync();
        var enrichedHistory = history.Select(h => {
            var station = allStations.FirstOrDefault(s => s.Id == h.StationId);
            return new {
                session = h,
                stationName = station?.Name ?? "Unknown Station",
                address = station?.Address ?? "Unknown Address"
            };
        }).ToList();

        return Ok(new { success = true, data = enrichedHistory });
    }
}

public class StartSessionDto
{
    public string ChargingCode { get; set; } = string.Empty;
}
