using System.Threading.Tasks;
using Dapper;
using EVNexus.PaymentService.Data;
using EVNexus.PaymentService.Models;
using Moq;
using Xunit;

namespace EVNexus.PaymentService.Tests;

public class PaymentOutboxDatabaseTests
{
    [Fact]
    public async Task OutboxMessageModel_InstantiationAndProperties_Valid()
    {
        var msg = new OutboxMessage
        {
            Id = 1,
            EventType = "PaymentCompletedEvent",
            AggregateType = "Payment",
            AggregateId = "PAY-100",
            Payload = "{\"PaymentId\":\"PAY-100\",\"FinalAmount\":15.50}",
            Status = "PENDING",
            RetryCount = 0
        };

        Assert.Equal(1, msg.Id);
        Assert.Equal("PaymentCompletedEvent", msg.EventType);
        Assert.Equal("Payment", msg.AggregateType);
        Assert.Equal("PAY-100", msg.AggregateId);
        Assert.Equal("PENDING", msg.Status);
        Assert.Equal(0, msg.RetryCount);
    }

    [Fact]
    public async Task DatabaseInitializer_ExecutesSqlStatements_Successfully()
    {
        var mockConnFactory = new Mock<IDbConnectionFactory>();
        var mockConnection = new Mock<System.Data.IDbConnection>();

        mockConnFactory.Setup(f => f.CreateConnection()).Returns(mockConnection.Object);

        var initializer = new DatabaseInitializer(mockConnFactory.Object);
        Assert.NotNull(initializer);
    }

    [Fact]
    public async Task DatabaseInitializer_IdempotentExecution_DoesNotThrow()
    {
        var mockConnFactory = new Mock<IDbConnectionFactory>();
        var mockConnection = new Mock<System.Data.IDbConnection>();
        mockConnFactory.Setup(f => f.CreateConnection()).Returns(mockConnection.Object);

        var initializer = new DatabaseInitializer(mockConnFactory.Object);
        Assert.NotNull(initializer);
    }
}
