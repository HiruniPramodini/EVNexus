using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using System.Net.Http.Json;
using EVNexus.PaymentService.Data;
using EVNexus.PaymentService.Models;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using Moq;

namespace EVNexus.PaymentService.Tests;

public class PaymentStatusEndpointTests : IClassFixture<TestWebApplicationFactory>
{
    private readonly WebApplicationFactory<Program> _factory;
    private const string DummyJwtSecret = "Test_Dummy_Secret_Key_For_Tests_Only_2026_Secure!";
    private readonly Mock<IPaymentRepository> _mockRepo;
    private readonly Mock<IWalletRepository> _mockWalletRepo;
    private readonly Mock<IDatabaseInitializer> _mockDbInit;

    public PaymentStatusEndpointTests(TestWebApplicationFactory factory)
    {
        _mockRepo = new Mock<IPaymentRepository>();
        _mockWalletRepo = new Mock<IWalletRepository>();
        _mockDbInit = new Mock<IDatabaseInitializer>();
        _mockDbInit.Setup(x => x.InitializeAsync()).Returns(Task.CompletedTask);

        Environment.SetEnvironmentVariable("Jwt__Key", DummyJwtSecret);
        Environment.SetEnvironmentVariable("Jwt__Issuer", "EVNexus.AuthService");
        Environment.SetEnvironmentVariable("Jwt__Audience", "EVNexus.Microservices");

        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.AddSingleton(_mockRepo.Object);
                services.AddSingleton(_mockWalletRepo.Object);
                services.AddSingleton(_mockDbInit.Object);
            });
        });
    }

    private HttpClient CreateClientWithToken(string driverId, string role = "Driver")
    {
        var client = _factory.CreateClient();
        var handler = new JwtSecurityTokenHandler();
        var key = Encoding.ASCII.GetBytes(DummyJwtSecret);
        var descriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(new[]
            {
                new Claim("driver_id", driverId),
                new Claim(ClaimTypes.Role, role)
            }),
            Expires = DateTime.UtcNow.AddHours(1),
            Issuer = "EVNexus.AuthService",
            Audience = "EVNexus.Microservices",
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
        };
        var token = handler.CreateToken(descriptor);
        var tokenString = handler.WriteToken(token);
        
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", tokenString);
        return client;
    }

    [Fact]
    public async Task GetPaymentStatus_Unauthenticated_ReturnsUnauthorized()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/payment/session/SESS-1/status");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetPaymentStatus_NonDriverRole_ReturnsForbidden()
    {
        var client = CreateClientWithToken("company123", role: "CompanyAdmin");
        var response = await client.GetAsync("/api/payment/session/SESS-1/status");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GetPaymentStatus_UnknownSession_ReturnsNotFound()
    {
        var client = CreateClientWithToken("driver-1");
        _mockRepo.Setup(r => r.GetPaymentBySessionForDriverAsync("SESS-UNKNOWN", "driver-1"))
                 .ReturnsAsync((PaymentTransaction)null);

        var response = await client.GetAsync("/api/payment/session/SESS-UNKNOWN/status");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetPaymentStatus_DriverA_CannotViewDriverB_ReturnsNotFound()
    {
        var client = CreateClientWithToken("driver-A");
        _mockRepo.Setup(r => r.GetPaymentBySessionForDriverAsync("SESS-B", "driver-A"))
                 .ReturnsAsync((PaymentTransaction)null); 

        var response = await client.GetAsync("/api/payment/session/SESS-B/status");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetPaymentStatus_AuthorizedPayment_ReturnsAuthorized()
    {
        var client = CreateClientWithToken("driver-1");
        var expectedPayment = new PaymentTransaction
        {
            SessionId = "SESS-1",
            PaymentId = "PAY-1",
            Status = "AUTHORIZED",
            EstimatedAmount = 10.50m,
            FinalAmount = 0m,
            Currency = "USD"
        };
        _mockRepo.Setup(r => r.GetPaymentBySessionForDriverAsync("SESS-1", "driver-1"))
                 .ReturnsAsync(expectedPayment);

        var response = await client.GetAsync("/api/payment/session/SESS-1/status");
        response.EnsureSuccessStatusCode();

        var result = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.True(result.GetProperty("success").GetBoolean());
        var data = result.GetProperty("data");
        Assert.Equal("AUTHORIZED", data.GetProperty("status").GetString());
        Assert.Equal(10.50m, data.GetProperty("amount").GetDecimal());
    }

    [Fact]
    public async Task GetPaymentStatus_CompletedPayment_ReturnsCompletedAndFinalAmount()
    {
        var client = CreateClientWithToken("driver-1");
        var expectedPayment = new PaymentTransaction
        {
            SessionId = "SESS-1",
            PaymentId = "PAY-1",
            Status = "COMPLETED",
            EstimatedAmount = 10.50m,
            FinalAmount = 8.75m,
            Currency = "USD",
            CompletedAt = DateTime.UtcNow
        };
        _mockRepo.Setup(r => r.GetPaymentBySessionForDriverAsync("SESS-1", "driver-1"))
                 .ReturnsAsync(expectedPayment);

        var response = await client.GetAsync("/api/payment/session/SESS-1/status");
        response.EnsureSuccessStatusCode();

        var result = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.True(result.GetProperty("success").GetBoolean());
        var data = result.GetProperty("data");
        Assert.Equal("COMPLETED", data.GetProperty("status").GetString());
        Assert.Equal(8.75m, data.GetProperty("amount").GetDecimal());
    }

    [Fact]
    public async Task GetPaymentStatus_FailedPayment_ReturnsFailed()
    {
        var client = CreateClientWithToken("driver-1");
        var expectedPayment = new PaymentTransaction
        {
            SessionId = "SESS-FAILED-1",
            PaymentId = "PAY-FAILED-1",
            Status = "FAILED",
            EstimatedAmount = 15.00m,
            FinalAmount = 0m,
            Currency = "USD"
        };
        _mockRepo.Setup(r => r.GetPaymentBySessionForDriverAsync("SESS-FAILED-1", "driver-1"))
                 .ReturnsAsync(expectedPayment);

        var response = await client.GetAsync("/api/payment/session/SESS-FAILED-1/status");
        response.EnsureSuccessStatusCode();

        var result = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.True(result.GetProperty("success").GetBoolean());
        var data = result.GetProperty("data");
        Assert.Equal("FAILED", data.GetProperty("status").GetString());
    }

    [Fact]
    public async Task GetPaymentStatus_DuplicateRequests_AreReadOnlyAndIdempotent()
    {
        var client = CreateClientWithToken("driver-1");
        var expectedPayment = new PaymentTransaction
        {
            SessionId = "SESS-REPEAT",
            PaymentId = "PAY-REPEAT",
            Status = "COMPLETED",
            FinalAmount = 5.50m,
            Currency = "USD"
        };
        _mockRepo.Setup(r => r.GetPaymentBySessionForDriverAsync("SESS-REPEAT", "driver-1"))
                 .ReturnsAsync(expectedPayment);

        for (int i = 0; i < 3; i++)
        {
            var response = await client.GetAsync("/api/payment/session/SESS-REPEAT/status");
            response.EnsureSuccessStatusCode();
            var result = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
            Assert.Equal("COMPLETED", result.GetProperty("data").GetProperty("status").GetString());
        }

        // Verify wallet charge was never invoked during read-only status calls
        _mockWalletRepo.Verify(w => w.ChargeWalletAndCompletePaymentAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<decimal>(), It.IsAny<string>(), It.IsAny<decimal>()), Times.Never);
    }
}
