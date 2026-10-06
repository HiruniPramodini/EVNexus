using System;
using System.Collections.Generic;
using System.Reflection;
using System.Threading;
using System.Threading.Tasks;
using EVNexus.PaymentService.Data;
using EVNexus.PaymentService.Kafka;
using EVNexus.PaymentService.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace EVNexus.PaymentService.Tests;

public class OutboxPublisherTests
{
    private readonly Mock<ILogger<OutboxPublisherService>> _mockLogger;
    private readonly Mock<IServiceProvider> _mockServiceProvider;
    private readonly Mock<IServiceScopeFactory> _mockScopeFactory;
    private readonly Mock<IServiceScope> _mockScope;
    private readonly Mock<IServiceProvider> _mockScopedProvider;
    private readonly Mock<IConfiguration> _mockConfiguration;
    private readonly Mock<IOutboxRepository> _mockOutboxRepo;
    private readonly Mock<KafkaProducerService> _mockKafkaProducer;

    public OutboxPublisherTests()
    {
        _mockLogger = new Mock<ILogger<OutboxPublisherService>>();
        _mockServiceProvider = new Mock<IServiceProvider>();
        _mockScopeFactory = new Mock<IServiceScopeFactory>();
        _mockScope = new Mock<IServiceScope>();
        _mockScopedProvider = new Mock<IServiceProvider>();
        _mockOutboxRepo = new Mock<IOutboxRepository>();

        var inMemorySettings = new Dictionary<string, string> {
            {"Kafka:BootstrapServers", "kafka:9092"},
            {"Kafka:Topics:PaymentCompleted", "payment-completed"},
            {"Outbox:PollingIntervalMs", "2000"},
            {"Outbox:BatchSize", "50"}
        };

        IConfiguration configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(inMemorySettings)
            .Build();

        _mockConfiguration = new Mock<IConfiguration>(); // Just keeping reference, but we use the real one for the worker
        _mockKafkaProducer = new Mock<KafkaProducerService>(configuration, new Mock<ILogger<KafkaProducerService>>().Object);

        _mockServiceProvider.Setup(s => s.GetService(typeof(IServiceScopeFactory))).Returns(_mockScopeFactory.Object);
        _mockScopeFactory.Setup(s => s.CreateScope()).Returns(_mockScope.Object);
        _mockScope.Setup(s => s.ServiceProvider).Returns(_mockScopedProvider.Object);

        _mockScopedProvider.Setup(s => s.GetService(typeof(IOutboxRepository))).Returns(_mockOutboxRepo.Object);
        _mockScopedProvider.Setup(s => s.GetService(typeof(KafkaProducerService))).Returns(_mockKafkaProducer.Object);
    }

    private OutboxPublisherService CreateService(IConfiguration? config = null)
    {
        var inMemorySettings = new Dictionary<string, string> {
            {"Outbox:PollingIntervalMs", "2000"},
            {"Outbox:BatchSize", "50"}
        };
        IConfiguration defaultConfiguration = new ConfigurationBuilder().AddInMemoryCollection(inMemorySettings).Build();

        return new OutboxPublisherService(
            _mockLogger.Object,
            _mockServiceProvider.Object,
            config ?? defaultConfiguration
        );
    }

    private async Task InvokeProcessPendingMessagesAsync(OutboxPublisherService service)
    {
        var method = typeof(OutboxPublisherService).GetMethod("ProcessPendingMessagesAsync", BindingFlags.NonPublic | BindingFlags.Instance);
        var task = (Task)method!.Invoke(service, new object[] { CancellationToken.None })!;
        await task;
    }

    [Fact]
    public async Task Test1_PendingEventIsPublished()
    {
        // 1. Arrange
        var service = CreateService();
        var messages = new List<OutboxMessage>
        {
            new OutboxMessage { Id = 1, AggregateId = "PAY-1", Payload = "{ \"status\": \"success\" }", Status = "PENDING" }
        };

        _mockOutboxRepo.Setup(r => r.GetPendingMessagesAsync(It.IsAny<int>())).ReturnsAsync(messages);
        _mockKafkaProducer.Setup(k => k.PublishMessageAsync("PAY-1", It.IsAny<string>())).Returns(Task.CompletedTask);

        // 2. Act
        await InvokeProcessPendingMessagesAsync(service);

        // 3. Assert
        _mockKafkaProducer.Verify(k => k.PublishMessageAsync("PAY-1", "{ \"status\": \"success\" }"), Times.Once);
        _mockOutboxRepo.Verify(r => r.MarkAsPublishedAsync(1), Times.Once);
        _mockOutboxRepo.Verify(r => r.RecordFailureAsync(It.IsAny<long>(), It.IsAny<string>(), It.IsAny<DateTime>()), Times.Never);
    }

    [Fact]
    public async Task Test2_KafkaFailure_RecordsFailureAndRetries()
    {
        // 1. Arrange
        var service = CreateService();
        var messages = new List<OutboxMessage>
        {
            new OutboxMessage { Id = 2, AggregateId = "PAY-2", Payload = "payload", Status = "PENDING", RetryCount = 1 }
        };

        _mockOutboxRepo.Setup(r => r.GetPendingMessagesAsync(It.IsAny<int>())).ReturnsAsync(messages);
        _mockKafkaProducer.Setup(k => k.PublishMessageAsync("PAY-2", It.IsAny<string>()))
                          .ThrowsAsync(new Exception("Kafka down"));

        // 2. Act
        await InvokeProcessPendingMessagesAsync(service);

        // 3. Assert
        _mockKafkaProducer.Verify(k => k.PublishMessageAsync("PAY-2", "payload"), Times.Once);
        _mockOutboxRepo.Verify(r => r.MarkAsPublishedAsync(2), Times.Never);
        // Backoff for RetryCount = 1 should be 5 * 2^1 = 10 seconds. We can just verify it is called.
        _mockOutboxRepo.Verify(r => r.RecordFailureAsync(2, "Kafka down", It.IsAny<DateTime>()), Times.Once);
    }

    [Fact]
    public async Task Test3_AlreadyPublishedEvent_Ignored()
    {
        // 1. Arrange
        var service = CreateService();
        // The repository queries ONLY PENDING events. If an event is PUBLISHED, the repository returns an empty list.
        var messages = new List<OutboxMessage>(); 

        _mockOutboxRepo.Setup(r => r.GetPendingMessagesAsync(It.IsAny<int>())).ReturnsAsync(messages);

        // 2. Act
        await InvokeProcessPendingMessagesAsync(service);

        // 3. Assert
        _mockKafkaProducer.Verify(k => k.PublishMessageAsync(It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        _mockOutboxRepo.Verify(r => r.MarkAsPublishedAsync(It.IsAny<long>()), Times.Never);
    }

    [Fact]
    public async Task Test4_MultiplePendingEvents_ProcessedSafely()
    {
        // 1. Arrange
        var service = CreateService();
        var messages = new List<OutboxMessage>
        {
            new OutboxMessage { Id = 3, AggregateId = "PAY-3", Payload = "p3" },
            new OutboxMessage { Id = 4, AggregateId = "PAY-4", Payload = "p4" }
        };

        _mockOutboxRepo.Setup(r => r.GetPendingMessagesAsync(It.IsAny<int>())).ReturnsAsync(messages);
        _mockKafkaProducer.Setup(k => k.PublishMessageAsync(It.IsAny<string>(), It.IsAny<string>())).Returns(Task.CompletedTask);

        // 2. Act
        await InvokeProcessPendingMessagesAsync(service);

        // 3. Assert
        _mockKafkaProducer.Verify(k => k.PublishMessageAsync("PAY-3", "p3"), Times.Once);
        _mockOutboxRepo.Verify(r => r.MarkAsPublishedAsync(3), Times.Once);

        _mockKafkaProducer.Verify(k => k.PublishMessageAsync("PAY-4", "p4"), Times.Once);
        _mockOutboxRepo.Verify(r => r.MarkAsPublishedAsync(4), Times.Once);
    }
}
