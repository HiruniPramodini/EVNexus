using System;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Confluent.Kafka;
using EVNexus.PaymentService.Data;
using EVNexus.PaymentService.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace EVNexus.PaymentService.Kafka;

public class ChargingSessionCompletedConsumer : BackgroundService
{
    private readonly ILogger<ChargingSessionCompletedConsumer> _logger;
    private readonly IServiceProvider _serviceProvider;
    private readonly string _topic;
    private readonly IConsumer<string, string> _consumer;

    public ChargingSessionCompletedConsumer(
        IConfiguration config,
        ILogger<ChargingSessionCompletedConsumer> logger,
        IServiceProvider serviceProvider)
    {
        _logger = logger;
        _serviceProvider = serviceProvider;

        var bootstrapServers = config.GetValue<string>("Kafka:BootstrapServers") ?? "kafka:9092";
        _topic = config.GetValue<string>("Kafka:Topics:ChargingSessionCompleted") ?? "charging-session-completed";
        var groupId = config.GetValue<string>("Kafka:ConsumerGroup") ?? "evnexus-payment-service";

        var consumerConfig = new ConsumerConfig
        {
            BootstrapServers = bootstrapServers,
            GroupId = groupId,
            AutoOffsetReset = AutoOffsetReset.Earliest,
            EnableAutoCommit = false
        };

        _consumer = new ConsumerBuilder<string, string>(consumerConfig).Build();
    }

    protected override Task ExecuteAsync(CancellationToken stoppingToken)
    {
        return Task.Run(() => StartConsumerLoop(stoppingToken), stoppingToken);
    }

    private async Task StartConsumerLoop(CancellationToken cancellationToken)
    {
        _consumer.Subscribe(_topic);
        _logger.LogInformation("Kafka Consumer Subscribed to {Topic}", _topic);

        try
        {
            while (!cancellationToken.IsCancellationRequested)
            {
                try
                {
                    var consumeResult = _consumer.Consume(cancellationToken);
                    if (consumeResult == null) continue;

                    var eventData = JsonSerializer.Deserialize<ChargingSessionCompletedEvent>(consumeResult.Message.Value);
                    if (eventData != null)
                    {
                        await ProcessEventAsync(eventData);
                    }

                    _consumer.Commit(consumeResult);
                }
                catch (ConsumeException e)
                {
                    _logger.LogError(e, "Consume error: {ErrorReason}", e.Error.Reason);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Unexpected error processing message.");
                }
            }
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("Kafka Consumer cancelled.");
        }
        finally
        {
            _consumer.Close();
        }
    }

    private async Task ProcessEventAsync(ChargingSessionCompletedEvent sessionEvent)
    {
        using var scope = _serviceProvider.CreateScope();
        var paymentRepo = scope.ServiceProvider.GetRequiredService<IPaymentRepository>();
        var walletRepo = scope.ServiceProvider.GetRequiredService<IWalletRepository>();
        var kafkaProducer = scope.ServiceProvider.GetRequiredService<KafkaProducerService>();

        if (string.IsNullOrEmpty(sessionEvent.SessionId))
        {
            _logger.LogWarning("Event missing SessionId. Cannot process.");
            return;
        }

        var payment = await paymentRepo.GetPaymentBySessionIdAsync(sessionEvent.SessionId);
        if (payment == null)
        {
            _logger.LogInformation("No pre-authorized payment found for SessionId: {SessionId}. Creating payment record automatically.", sessionEvent.SessionId);
            payment = new PaymentTransaction
            {
                PaymentId = Guid.NewGuid().ToString(),
                SessionId = sessionEvent.SessionId,
                DriverId = sessionEvent.DriverId,
                CompanyId = sessionEvent.CompanyId,
                StationId = sessionEvent.StationId,
                ChargerId = sessionEvent.ChargerId,
                EstimatedAmount = sessionEvent.FinalAmount,
                FinalAmount = sessionEvent.FinalAmount,
                EnergyConsumedKwh = sessionEvent.EnergyConsumedKwh,
                Currency = string.IsNullOrEmpty(sessionEvent.Currency) ? "USD" : sessionEvent.Currency,
                PaymentMethod = "WALLET",
                Status = "AUTHORIZED"
            };
            await paymentRepo.AuthorizePaymentAsync(payment);
        }

        if (payment.Status == "COMPLETED")
        {
            _logger.LogInformation("Payment for SessionId {SessionId} is already COMPLETED. Ignoring duplicate event.", sessionEvent.SessionId);
            return;
        }

        if (payment.Status == "FAILED")
        {
            _logger.LogInformation("Payment for SessionId {SessionId} is already marked FAILED. Skipping.", sessionEvent.SessionId);
            return;
        }

        if (payment.DriverId != sessionEvent.DriverId || 
            payment.CompanyId != sessionEvent.CompanyId ||
            payment.StationId != sessionEvent.StationId ||
            payment.ChargerId != sessionEvent.ChargerId)
        {
            _logger.LogWarning("Identity mismatch for SessionId: {SessionId}. Event Driver: {EventDriver}, Payment Driver: {PaymentDriver}, Event Company: {EventCompany}, Payment Company: {PaymentCompany}", 
                sessionEvent.SessionId, sessionEvent.DriverId, payment.DriverId, sessionEvent.CompanyId, payment.CompanyId);
            return;
        }

        var success = await walletRepo.ChargeWalletAndCompletePaymentAsync(payment.DriverId, payment.PaymentId, sessionEvent.FinalAmount, payment.SessionId, sessionEvent.EnergyConsumedKwh);

        if (success)
        {
            _logger.LogInformation("Successfully completed payment {PaymentId} for SessionId {SessionId}. Event saved to outbox.", payment.PaymentId, sessionEvent.SessionId);
        }
        else
        {
            _logger.LogWarning("Failed to charge wallet for Payment {PaymentId}. Insufficient balance or atomic update failed. Marking payment FAILED.", payment.PaymentId);
            await paymentRepo.UpdatePaymentStatusAsync(payment.PaymentId, "FAILED");
        }
    }

    public override void Dispose()
    {
        _consumer?.Dispose();
        base.Dispose();
    }
}
