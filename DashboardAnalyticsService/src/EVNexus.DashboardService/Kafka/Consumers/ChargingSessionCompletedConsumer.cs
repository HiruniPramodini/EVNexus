using System.Text.Json;
using Confluent.Kafka;
using EVNexus.DashboardService.Data;
using EVNexus.DashboardService.Models;
using Microsoft.EntityFrameworkCore;

namespace EVNexus.DashboardService.Kafka;

// Matches the payload published by MapService (SessionsController.StopSession)
public record ChargingSessionCompletedEvent(
    string SessionId, string DriverId, string? CompanyId, string? StationId, string? StationName,
    string? ChargerId, DateTime? StartTime, DateTime? EndTime, DateTime? CompletedAt,
    double EnergyConsumedKwh, decimal FinalAmount);

public class ChargingSessionCompletedConsumer : BackgroundService
{
    private readonly IServiceScopeFactory _scopes;
    private readonly IConfiguration _cfg;
    private readonly ILogger<ChargingSessionCompletedConsumer> _log;

    public ChargingSessionCompletedConsumer(IServiceScopeFactory scopes, IConfiguration cfg,
        ILogger<ChargingSessionCompletedConsumer> log)
    { _scopes = scopes; _cfg = cfg; _log = log; }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        await Task.Yield();
        var config = new ConsumerConfig
        {
            BootstrapServers = _cfg["Kafka:BootstrapServers"] ?? "localhost:9092",
            GroupId = "dashboard-service",
            AutoOffsetReset = AutoOffsetReset.Earliest,
            EnableAutoCommit = false
        };
        var topic = _cfg["Kafka:Topics:ChargingSessionCompleted"] ?? _cfg["Kafka:Topic"] ?? "charging-session-completed";

        while (!ct.IsCancellationRequested)
        {
            try
            {
                using var consumer = new ConsumerBuilder<Ignore, string>(config).Build();
                consumer.Subscribe(topic);
                while (!ct.IsCancellationRequested)
                {
                    var msg = consumer.Consume(ct);
                    if (msg?.Message?.Value is null) continue;
                    await SaveAsync(msg.Message.Value, ct);
                    consumer.Commit(msg);
                }
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex) when (!ct.IsCancellationRequested)   // Kafka down must not crash the API
            {
                try { _log.LogWarning(ex, "Kafka consumer error, retrying in 10s"); } catch { }
                try { await Task.Delay(TimeSpan.FromSeconds(10), ct); } catch (OperationCanceledException) { break; }
            }
        }
    }

    private async Task SaveAsync(string json, CancellationToken ct)
    {
        var e = JsonSerializer.Deserialize<ChargingSessionCompletedEvent>(json,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        if (e is null || string.IsNullOrEmpty(e.SessionId) || string.IsNullOrEmpty(e.DriverId))
        {
            _log.LogWarning("Skipping invalid ChargingSessionCompleted event: {Json}", json);
            return;
        }

        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DashboardDbContext>();
        if (await db.Sessions.AnyAsync(s => s.Id == e.SessionId, ct)) return;   // idempotent

        var end = DateTime.SpecifyKind(e.EndTime ?? e.CompletedAt ?? DateTime.UtcNow, DateTimeKind.Utc);
        var start = DateTime.SpecifyKind(e.StartTime ?? end, DateTimeKind.Utc);

        db.Sessions.Add(new ChargingSessionRecord
        {
            Id = e.SessionId,
            DriverId = e.DriverId,
            CompanyId = e.CompanyId ?? "",
            StationId = e.StationId ?? "",
            StationName = e.StationName ?? "Unknown Station",
            ChargerId = e.ChargerId ?? "",
            StartUtc = start,
            EndUtc = end,
            DurationMinutes = Math.Max(0, (end - start).TotalMinutes),
            EnergyKwh = e.EnergyConsumedKwh,
            Cost = e.FinalAmount
        });
        await db.SaveChangesAsync(ct);
    }
}