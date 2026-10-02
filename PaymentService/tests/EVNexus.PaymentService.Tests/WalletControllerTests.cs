using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using System.Net.Http.Json;
using EVNexus.PaymentService.Data;
using EVNexus.PaymentService.Models;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using Moq;

namespace EVNexus.PaymentService.Tests;

public class WalletControllerTests : IClassFixture<TestWebApplicationFactory>
{
    private readonly WebApplicationFactory<Program> _factory;
    private const string DummyJwtSecret = "Test_Dummy_Secret_Key_For_Tests_Only_2026_Secure!";
    private readonly Mock<IWalletRepository> _mockRepo;
    private readonly Mock<IDatabaseInitializer> _mockDbInit;

    public WalletControllerTests(TestWebApplicationFactory factory)
    {
        _mockRepo = new Mock<IWalletRepository>();
        _mockDbInit = new Mock<IDatabaseInitializer>();
        _mockDbInit.Setup(x => x.InitializeAsync()).Returns(Task.CompletedTask);

        Environment.SetEnvironmentVariable("Jwt__Key", DummyJwtSecret);
        Environment.SetEnvironmentVariable("Jwt__Issuer", "EVNexus.AuthService");
        Environment.SetEnvironmentVariable("Jwt__Audience", "EVNexus.Microservices");

        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                var repoDescriptor = services.SingleOrDefault(d => d.ServiceType == typeof(IWalletRepository));
                if (repoDescriptor != null) services.Remove(repoDescriptor);
                services.AddScoped(_ => _mockRepo.Object);

                var dbDescriptor = services.SingleOrDefault(d => d.ServiceType == typeof(IDatabaseInitializer));
                if (dbDescriptor != null) services.Remove(dbDescriptor);
                services.AddScoped(_ => _mockDbInit.Object);
            });
        });
    }

    private string GenerateToken(string role, string driverId = "")
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.UTF8.GetBytes(DummyJwtSecret);
        
        var claims = new List<Claim>
        {
            new Claim("role", role),
            new Claim(ClaimTypes.Role, role)
        };
        
        if (!string.IsNullOrEmpty(driverId)) claims.Add(new Claim("driver_id", driverId));

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.AddMinutes(10),
            Issuer = "EVNexus.AuthService",
            Audience = "EVNexus.Microservices",
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        return tokenHandler.WriteToken(token);
    }

    [Fact]
    public async Task WalletCreation_WhenWalletDoesNotExist_CreatesWallet()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", GenerateToken("Driver", "d-1"));
        
        _mockRepo.Setup(x => x.GetWalletByDriverIdAsync("d-1")).ReturnsAsync((Wallet?)null);
        _mockRepo.Setup(x => x.CreateWalletAsync("d-1")).ReturnsAsync(new Wallet { DriverId = "d-1" });

        var response = await client.GetAsync("/api/payment/wallet");
        
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        _mockRepo.Verify(x => x.CreateWalletAsync("d-1"), Times.Once);
    }

    [Fact]
    public async Task WalletIsolation_CannotAccessAnotherDriversWallet()
    {
        var client = _factory.CreateClient();
        // The token only contains d-1. There's no way to pass another driver ID to GET /wallet
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", GenerateToken("Driver", "d-1"));
        
        _mockRepo.Setup(x => x.GetWalletByDriverIdAsync("d-1")).ReturnsAsync(new Wallet { DriverId = "d-1" });

        var response = await client.GetAsync("/api/payment/wallet");
        
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        _mockRepo.Verify(x => x.GetWalletByDriverIdAsync("d-1"), Times.Once);
        _mockRepo.Verify(x => x.GetWalletByDriverIdAsync(It.IsNotIn("d-1")), Times.Never);
    }

    [Fact]
    public async Task TopUp_IncreasesBalance()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", GenerateToken("Driver", "d-1"));
        
        _mockRepo.Setup(x => x.TopUpAsync("d-1", 50, It.IsAny<string?>())).ReturnsAsync(true);
        _mockRepo.Setup(x => x.GetWalletByDriverIdAsync("d-1")).ReturnsAsync(new Wallet { DriverId = "d-1", Balance = 50 });

        var response = await client.PostAsJsonAsync("/api/payment/wallet/topup", new { Amount = 50 });
        
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        _mockRepo.Verify(x => x.TopUpAsync("d-1", 50, It.IsAny<string?>()), Times.Once);
    }

    [Fact]
    public async Task NegativeOrZeroAmount_Rejected()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", GenerateToken("Driver", "d-1"));
        
        var responseZero = await client.PostAsJsonAsync("/api/payment/wallet/topup", new { Amount = 0 });
        var responseNeg = await client.PostAsJsonAsync("/api/payment/wallet/topup", new { Amount = -10 });
        
        Assert.Equal(HttpStatusCode.BadRequest, responseZero.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, responseNeg.StatusCode);
        _mockRepo.Verify(x => x.TopUpAsync(It.IsAny<string>(), It.IsAny<decimal>(), It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task ExcessiveAmount_Rejected()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", GenerateToken("Driver", "d-1"));
        
        var responseExcess = await client.PostAsJsonAsync("/api/payment/wallet/topup", new { Amount = 10000 });
        
        Assert.Equal(HttpStatusCode.BadRequest, responseExcess.StatusCode);
        _mockRepo.Verify(x => x.TopUpAsync(It.IsAny<string>(), It.IsAny<decimal>(), It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task TopUp_WithIdempotencyKey_PassedToRepository()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", GenerateToken("Driver", "d-1"));
        
        _mockRepo.Setup(x => x.TopUpAsync("d-1", 100, "KEY-123")).ReturnsAsync(true);
        _mockRepo.Setup(x => x.GetWalletByDriverIdAsync("d-1")).ReturnsAsync(new Wallet { DriverId = "d-1", Balance = 100 });

        var response = await client.PostAsJsonAsync("/api/payment/wallet/topup", new { Amount = 100, IdempotencyKey = "KEY-123" });
        
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        _mockRepo.Verify(x => x.TopUpAsync("d-1", 100, "KEY-123"), Times.Once);
    }

    [Fact]
    public async Task GetWalletTransactions_Paginated_ReturnsTransactions()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", GenerateToken("Driver", "d-1"));
        
        var txList = new List<WalletTransaction>
        {
            new WalletTransaction { WalletId = "w-1", Type = "TOP_UP", Amount = 50, ReferenceId = "REF-1" }
        };
        _mockRepo.Setup(x => x.GetWalletTransactionsAsync("d-1", 1, 20)).ReturnsAsync((txList, 1));

        var response = await client.GetAsync("/api/payment/wallet/transactions?page=1&pageSize=20");
        
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        _mockRepo.Verify(x => x.GetWalletTransactionsAsync("d-1", 1, 20), Times.Once);
    }

    [Fact]
    public async Task UnauthorizedAccess_Returns401()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/payment/wallet");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task WrongRole_Returns403()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", GenerateToken("CompanyAdmin", "c-1"));
        
        var response = await client.GetAsync("/api/payment/wallet");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }
}
