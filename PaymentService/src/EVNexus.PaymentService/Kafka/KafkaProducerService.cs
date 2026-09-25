using System;
using System.Text.Json;
using System.Threading.Tasks;
using Confluent.Kafka;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace EVNexus.PaymentService.Kafka;

public class KafkaProducerService
{
    private readonly IProducer<Null, string> _producer;
    private readonly ILogger<KafkaProducerService> _logger;
    private readonly string _topic;

    public KafkaProducerService(IConfiguration config, ILogger<KafkaProducerService> logger)
    {
        _logger = logger;
        
        var brokerList = config.GetValue<string>("Kafka:BootstrapServers") ?? "kafka:9092";
        _topic = config.GetValue<string>("Kafka:Topics:PaymentCompleted") ?? "payment-completed";

        var producerConfig = new ProducerConfig { BootstrapServers = brokerList };
        _producer = new ProducerBuilder<Null, string>(producerConfig).Build();
    }

    public async Task PublishPaymentCompletedAsync(Models.PaymentTransaction payment)
    {
        var eventPayload = new
        {
            eventId = "EVT-" + Guid.NewGuid().ToString(),
            eventType = "PaymentCompleted",
            transactionId = payment.TransactionId,
            paymentId = payment.PaymentId,
            sessionId = payment.SessionId,
            driverId = payment.DriverId,
            companyId = payment.CompanyId,
            stationId = payment.StationId,
            chargerId = payment.ChargerId,
            amount = payment.FinalAmount,
            currency = payment.Currency,
            paymentMethod = payment.PaymentMethod,
            status = payment.Status,
            timestamp = payment.CompletedAt ?? DateTime.UtcNow
        };

        var message = new Message<Null, string> { Value = JsonSerializer.Serialize(eventPayload) };

        try
        {
            var result = await _producer.ProduceAsync(_topic, message);
            _logger.LogInformation($"Delivered '{result.Value}' to '{result.TopicPartitionOffset}'");
        }
        catch (ProduceException<Null, string> e)
        {
            _logger.LogError($"Delivery failed: {e.Error.Reason}");
            // In a robust system, we would use an outbox pattern here.
            // For MVP, we log the failure.
            throw;
        }
    }
}
