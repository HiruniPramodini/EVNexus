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
    private readonly IChargerRepository _chargerRepo;
    private readonly Microsoft.Extensions.Configuration.IConfiguration _config;

    public SessionsController(ISessionRepository sessionRepo, IStationRepository stationRepo, IChargerRepository chargerRepo, Microsoft.Extensions.Configuration.IConfiguration config)
    {
        _sessionRepo = sessionRepo;
        _stationRepo = stationRepo;
        _chargerRepo = chargerRepo;
        _config = config;
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

        if (!string.IsNullOrEmpty(request.CompanyId) && station.TenantId != request.CompanyId)
            return BadRequest(new { success = false, message = "Station does not belong to the requested company." });

        if (!string.IsNullOrEmpty(request.StationId) && station.Id != request.StationId)
            return BadRequest(new { success = false, message = "Station mismatch." });

        if (string.IsNullOrEmpty(request.ChargerId))
            return BadRequest(new { success = false, message = "ChargerId is required." });

        var charger = await _chargerRepo.GetChargerByIdAsync(request.ChargerId, station.Id);
        if (charger == null)
            return NotFound(new { success = false, message = "Charger not found for the requested station." });

        if (charger.Status != "Available")
            return BadRequest(new { success = false, message = "Charger is not available." });

        // 2. Check if driver already has an active session
        var activeSession = await _sessionRepo.GetActiveSessionForDriverAsync(driverId);
        if (activeSession != null)
            return BadRequest(new { success = false, message = "You already have an active charging session." });

        // 3. For MVP, we simulate a wallet check - assume balance is okay if they have a token.

        // 4. Start the session
        var session = new ChargingSession
        {
            StationId = station.Id,
            CompanyId = station.TenantId,
            ChargerId = charger.Id,
            DriverId = driverId,
            EstimatedCost = request.EstimatedCost
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

        var charger = await _chargerRepo.GetChargerByIdAsync(session.ChargerId, session.StationId);
        var price = charger?.PricePerKwh ?? 0.5m;

        var cost = energy * price;

        await _sessionRepo.StopSessionAsync(id, energy, cost);

        // Fetch updated
        var updatedSession = await _sessionRepo.GetSessionByIdAsync(id);

        try
        {
            var bootstrapServers = _config.GetValue<string>("Kafka:BootstrapServers") ?? "kafka:9092";
            var config = new Confluent.Kafka.ProducerConfig 
            { 
                BootstrapServers = bootstrapServers,
                MessageTimeoutMs = 3000,
                SocketTimeoutMs = 3000
            };
            using var producer = new Confluent.Kafka.ProducerBuilder<string, string>(config).Build();

            var eventPayload = new
            {
                EventId = Guid.NewGuid().ToString(),
                SessionId = updatedSession.Id,
                DriverId = updatedSession.DriverId,
                CompanyId = updatedSession.CompanyId,
                StationId = updatedSession.StationId,
                ChargerId = updatedSession.ChargerId,
                EnergyConsumedKwh = updatedSession.EnergyConsumedKwh,
                FinalAmount = updatedSession.TotalCost,
                PricePerKwh = price,
                Currency = "USD",
                CompletedAt = DateTime.UtcNow
            };

            var message = new Confluent.Kafka.Message<string, string>
            {
                Key = updatedSession.Id,
                Value = System.Text.Json.JsonSerializer.Serialize(eventPayload)
            };

            await producer.ProduceAsync("charging-session-completed", message);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error publishing Kafka event: {ex.Message}");
        }

        return Ok(new { success = true, data = updatedSession });
    }

    [HttpGet("active")]
    public async Task<IActionResult> GetActiveSession([FromServices] ITenantContext tenantContext)
    {
        var driverId = tenantContext.UserId;
        if (string.IsNullOrEmpty(driverId)) return Unauthorized();

        var session = await _sessionRepo.GetActiveSessionForDriverAsync(driverId);
        if (session == null)
            return Ok(new { success = true, data = (object?)null });
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
    public string CompanyId { get; set; } = string.Empty;
    public string StationId { get; set; } = string.Empty;
    public string ChargerId { get; set; } = string.Empty;
    public decimal EstimatedCost { get; set; }
    public string PaymentId { get; set; } = string.Empty;
}
