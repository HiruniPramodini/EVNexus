using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using EVNexus.PaymentService.Data;
using EVNexus.PaymentService.Models;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using Moq;

namespace EVNexus.PaymentService.Tests;

public class HistoryEndpointTests : IClassFixture<TestWebApplicationFactory>
{
    private readonly WebApplicationFactory<Program> _factory;
    private const string DummyJwtSecret = "Test_Dummy_Secret_Key_For_Tests_Only_2026_Secure!";

    private readonly Mock<IWalletRepository> _mockWalletRepo;
    private readonly Mock<IPaymentRepository> _mockPaymentRepo;
    private readonly Mock<IDatabaseInitializer> _mockDbInit;

    public HistoryEndpointTests(TestWebApplicationFactory factory)
    {
        _mockWalletRepo = new Mock<IWalletRepository>();
        _mockPaymentRepo = new Mock<IPaymentRepository>();
        _mockDbInit = new Mock<IDatabaseInitializer>();
        _mockDbInit.Setup(x => x.InitializeAsync()).Returns(Task.CompletedTask);

        Environment.SetEnvironmentVariable("Jwt__Key", DummyJwtSecret);
        Environment.SetEnvironmentVariable("Jwt__Issuer", "EVNexus.AuthService");
        Environment.SetEnvironmentVariable("Jwt__Audience", "EVNexus.Microservices");

        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                var wd = services.SingleOrDefault(d => d.ServiceType == typeof(IWalletRepository));
                if (wd != null) services.Remove(wd);
                services.AddScoped(_ => _mockWalletRepo.Object);

                var pd = services.SingleOrDefault(d => d.ServiceType == typeof(IPaymentRepository));
                if (pd != null) services.Remove(pd);
                services.AddScoped(_ => _mockPaymentRepo.Object);

                var dd = services.SingleOrDefault(d => d.ServiceType == typeof(IDatabaseInitializer));
                if (dd != null) services.Remove(dd);
                services.AddScoped(_ => _mockDbInit.Object);
            });
        });
    }

    private string GenerateToken(string role, string driverId = "")
    {
        var key = Encoding.UTF8.GetBytes(DummyJwtSecret);
        var claims = new List<Claim>
        {
            new Claim("role", role),
            new Claim(ClaimTypes.Role, role)
        };
        if (!string.IsNullOrEmpty(driverId)) claims.Add(new Claim("driver_id", driverId));

        var descriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.AddMinutes(10),
            Issuer = "EVNexus.AuthService",
            Audience = "EVNexus.Microservices",
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
        };
        return new JwtSecurityTokenHandler().WriteToken(new JwtSecurityTokenHandler().CreateToken(descriptor));
    }

    // ─── WALLET HISTORY TESTS ────────────────────────────────────────────────

    [Fact]
    public async Task WalletHistory_NoJwt_Returns401()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/payment/wallet/transactions");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task WalletHistory_ValidDriver_Returns200()
    {
        _mockWalletRepo
            .Setup(r => r.GetWalletTransactionsAsync("d-1", 1, 20))
            .ReturnsAsync((new List<WalletTransaction>(), 0));

        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", GenerateToken("Driver", "d-1"));

        var response = await client.GetAsync("/api/payment/wallet/transactions");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task WalletHistory_ReturnsOnlyCallerTransactions()
    {
        var txForD1 = new List<WalletTransaction>
        {
            new WalletTransaction { WalletId = "w-1", Type = "TOP_UP", Amount = 100m }
        };
        _mockWalletRepo
            .Setup(r => r.GetWalletTransactionsAsync("d-1", 1, 20))
            .ReturnsAsync((txForD1, 1));

        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", GenerateToken("Driver", "d-1"));

        var response = await client.GetAsync("/api/payment/wallet/transactions");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        // Verify the repo was called with d-1, never with d-2
        _mockWalletRepo.Verify(r => r.GetWalletTransactionsAsync("d-1", It.IsAny<int>(), It.IsAny<int>()), Times.Once);
        _mockWalletRepo.Verify(r => r.GetWalletTransactionsAsync(It.IsNotIn("d-1"), It.IsAny<int>(), It.IsAny<int>()), Times.Never);
    }

    [Fact]
    public async Task WalletHistory_EmptyList_Returns200WithEmptyData()
    {
        _mockWalletRepo
            .Setup(r => r.GetWalletTransactionsAsync("d-empty", 1, 20))
            .ReturnsAsync((new List<WalletTransaction>(), 0));

        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", GenerateToken("Driver", "d-empty"));

        var response = await client.GetAsync("/api/payment/wallet/transactions");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        var doc = JsonDocument.Parse(body).RootElement;
        Assert.True(doc.GetProperty("success").GetBoolean());
        Assert.Equal(0, doc.GetProperty("pagination").GetProperty("totalCount").GetInt32());
        Assert.Equal(0, doc.GetProperty("data").GetArrayLength());
    }

    [Fact]
    public async Task WalletHistory_InvalidPageSize_Returns400()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", GenerateToken("Driver", "d-1"));

        // pageSize=0 → invalid
        var r1 = await client.GetAsync("/api/payment/wallet/transactions?page=1&pageSize=0");
        Assert.Equal(HttpStatusCode.BadRequest, r1.StatusCode);

        // pageSize=101 → exceeds max
        var r2 = await client.GetAsync("/api/payment/wallet/transactions?page=1&pageSize=101");
        Assert.Equal(HttpStatusCode.BadRequest, r2.StatusCode);

        // page=0 → invalid
        var r3 = await client.GetAsync("/api/payment/wallet/transactions?page=0&pageSize=20");
        Assert.Equal(HttpStatusCode.BadRequest, r3.StatusCode);
    }

    // ─── PAYMENT HISTORY TESTS ───────────────────────────────────────────────

    [Fact]
    public async Task PaymentHistory_NoJwt_Returns401()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/payment/transactions");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task PaymentHistory_ValidDriver_Returns200()
    {
        _mockPaymentRepo
            .Setup(r => r.GetPaymentTransactionsAsync("d-1", 1, 20))
            .ReturnsAsync((new List<PaymentTransaction>(), 0));

        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", GenerateToken("Driver", "d-1"));

        var response = await client.GetAsync("/api/payment/transactions");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task PaymentHistory_ReturnsOnlyCallerTransactions()
    {
        var txForD1 = new List<PaymentTransaction>
        {
            new PaymentTransaction { DriverId = "d-1", SessionId = "s-1", Status = "COMPLETED" }
        };
        _mockPaymentRepo
            .Setup(r => r.GetPaymentTransactionsAsync("d-1", 1, 20))
            .ReturnsAsync((txForD1, 1));

        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", GenerateToken("Driver", "d-1"));

        var response = await client.GetAsync("/api/payment/transactions");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        _mockPaymentRepo.Verify(r => r.GetPaymentTransactionsAsync("d-1", It.IsAny<int>(), It.IsAny<int>()), Times.Once);
        _mockPaymentRepo.Verify(r => r.GetPaymentTransactionsAsync(It.IsNotIn("d-1"), It.IsAny<int>(), It.IsAny<int>()), Times.Never);
    }

    [Fact]
    public async Task PaymentHistory_DriverACannotSeeDriverBRecords()
    {
        // Driver A authenticates
        _mockPaymentRepo
            .Setup(r => r.GetPaymentTransactionsAsync("d-A", 1, 20))
            .ReturnsAsync((new List<PaymentTransaction>(), 0));

        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", GenerateToken("Driver", "d-A"));

        // Even if client sends ?driverId=d-B, it must be ignored — only JWT identity is used
        var response = await client.GetAsync("/api/payment/transactions?driverId=d-B");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        // Must have queried only for d-A
        _mockPaymentRepo.Verify(r => r.GetPaymentTransactionsAsync("d-A", It.IsAny<int>(), It.IsAny<int>()), Times.Once);
        _mockPaymentRepo.Verify(r => r.GetPaymentTransactionsAsync("d-B", It.IsAny<int>(), It.IsAny<int>()), Times.Never);
    }

    [Fact]
    public async Task PaymentHistory_Pagination_Works()
    {
        _mockPaymentRepo
            .Setup(r => r.GetPaymentTransactionsAsync("d-1", 2, 5))
            .ReturnsAsync((new List<PaymentTransaction>(), 0));

        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", GenerateToken("Driver", "d-1"));

        var response = await client.GetAsync("/api/payment/transactions?page=2&pageSize=5");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        _mockPaymentRepo.Verify(r => r.GetPaymentTransactionsAsync("d-1", 2, 5), Times.Once);
    }

    [Fact]
    public async Task PaymentHistory_InvalidPagination_Returns400()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", GenerateToken("Driver", "d-1"));

        var r1 = await client.GetAsync("/api/payment/transactions?page=1&pageSize=0");
        Assert.Equal(HttpStatusCode.BadRequest, r1.StatusCode);

        var r2 = await client.GetAsync("/api/payment/transactions?page=1&pageSize=200");
        Assert.Equal(HttpStatusCode.BadRequest, r2.StatusCode);
    }

    [Fact]
    public async Task PaymentHistory_CompanyAdmin_Returns403()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", GenerateToken("CompanyAdmin"));

        var response = await client.GetAsync("/api/payment/transactions");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }
}
