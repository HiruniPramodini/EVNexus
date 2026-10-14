using System.Text.Json;
using Confluent.Kafka;
using DashboardService.Data;
using DashboardService.Models;
using Microsoft.EntityFrameworkCore;

namespace DashboardService.Services;

public class SessionCompletedConsumer : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IConfiguration _config;
    private readonly ILogger<SessionCompletedConsumer> _logger;
    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };

    public SessionCompletedConsumer(IServiceScopeFactory scopeFactory, IConfiguration config,
        ILogger<SessionCompletedConsumer> logger)
    {
        _scopeFactory = scopeFactory; _config = config; _logger = logger;
    }

    protected override Task ExecuteAsync(CancellationToken stoppingToken) =>
        Task.Run(() => RunAsync(stoppingToken), stoppingToken);

    private async Task RunAsync(CancellationToken ct)
    {
        var topic = _config["Kafka:Topics:ChargingSessionCompleted"] ?? "charging-session-completed";
        var cfg = new ConsumerConfig
        {
            BootstrapServers = _config["Kafka:BootstrapServers"] ?? "localhost:9092",
            GroupId = "dashboard-service",
            AutoOffsetReset = AutoOffsetReset.Earliest,
            EnableAutoCommit = false
        };

        while (!ct.IsCancellationRequested)
        {
            try
            {
                using var consumer = new ConsumerBuilder<string, string>(cfg).Build();
                consumer.Subscribe(topic);
                _logger.LogInformation("Kafka consumer subscribed to {Topic}", topic);

                while (!ct.IsCancellationRequested)
                {
                    var result = consumer.Consume(ct);
                    if (result?.Message?.Value is null) continue;

                    await SaveAsync(result.Message.Value, ct);
                    consumer.Commit(result);
                }
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Kafka consumer error. Retrying in 10s...");
                await Task.Delay(TimeSpan.FromSeconds(10), ct);
            }
        }
    }

    private async Task SaveAsync(string json, CancellationToken ct)
    {
        var evt = JsonSerializer.Deserialize<ChargingSessionCompletedEvent>(json, JsonOpts);
        if (evt is null || string.IsNullOrWhiteSpace(evt.SessionId) || string.IsNullOrWhiteSpace(evt.TenantId))
        {
            _logger.LogWarning("Skipping invalid session event: {Json}", json);
            return;
        }

        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DashboardDbContext>();

        if (await db.Sessions.AnyAsync(s => s.SessionId == evt.SessionId, ct)) return; // duplicate

        db.Sessions.Add(new SessionRecord
        {
            SessionId = evt.SessionId,
            TenantId = evt.TenantId,
            StationId = evt.StationId,
            StationName = evt.StationName,
            ChargerId = evt.ChargerId,
            DriverId = evt.DriverId,
            StartTime = DateTime.SpecifyKind(evt.StartTime, DateTimeKind.Utc),
            EndTime = DateTime.SpecifyKind(evt.EndTime, DateTimeKind.Utc),
            EnergyKwh = evt.EnergyConsumedKwh,
            TotalCost = evt.TotalCost,
            PaymentStatus = evt.PaymentStatus
        });
        await db.SaveChangesAsync(ct);
    }
}