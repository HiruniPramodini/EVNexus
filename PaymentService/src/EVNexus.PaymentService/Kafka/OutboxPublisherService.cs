using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using EVNexus.PaymentService.Data;
using EVNexus.PaymentService.Models;

namespace EVNexus.PaymentService.Kafka;

public class OutboxPublisherService : BackgroundService
{
    private readonly ILogger<OutboxPublisherService> _logger;
    private readonly IServiceProvider _serviceProvider;
    private readonly int _pollingIntervalMs;
    private readonly int _batchSize;

    public OutboxPublisherService(
        ILogger<OutboxPublisherService> logger, 
        IServiceProvider serviceProvider,
        IConfiguration configuration)
    {
        _logger = logger;
        _serviceProvider = serviceProvider;
        _pollingIntervalMs = configuration.GetValue<int>("Outbox:PollingIntervalMs", 2000);
        _batchSize = configuration.GetValue<int>("Outbox:BatchSize", 50);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("OutboxPublisherService is starting.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessPendingMessagesAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred while processing the outbox.");
            }

            await Task.Delay(_pollingIntervalMs, stoppingToken);
        }

        _logger.LogInformation("OutboxPublisherService is stopping.");
    }

    private async Task ProcessPendingMessagesAsync(CancellationToken stoppingToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var outboxRepo = scope.ServiceProvider.GetRequiredService<IOutboxRepository>();
        var kafkaProducer = scope.ServiceProvider.GetRequiredService<KafkaProducerService>();

        var messages = await outboxRepo.GetPendingMessagesAsync(_batchSize);
        
        foreach (var message in messages)
        {
            if (stoppingToken.IsCancellationRequested) break;

            try
            {
                // We use AggregateId (the paymentId) as the Kafka Key
                await kafkaProducer.PublishMessageAsync(message.AggregateId, message.Payload);
                await outboxRepo.MarkAsPublishedAsync(message.Id);
                
                _logger.LogInformation("Successfully published outbox message {MessageId} for {AggregateType} {AggregateId}", 
                    message.Id, message.AggregateType, message.AggregateId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to publish outbox message {MessageId}", message.Id);
                
                // Calculate backoff: e.g. 5s, 10s, 20s, 40s...
                var backoffSeconds = Math.Min(5 * Math.Pow(2, message.RetryCount), 300); // max 5 minutes
                var availableAt = DateTime.UtcNow.AddSeconds(backoffSeconds);
                
                // Record failure and schedule next retry
                await outboxRepo.RecordFailureAsync(message.Id, ex.Message, availableAt);
            }
        }
    }
}
