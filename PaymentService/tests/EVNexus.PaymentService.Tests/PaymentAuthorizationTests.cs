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

public class PaymentAuthorizationTests : IClassFixture<TestWebApplicationFactory>
{
    private readonly WebApplicationFactory<Program> _factory;
    private const string DummyJwtSecret = "Test_Dummy_Secret_Key_For_Tests_Only_2026_Secure!";
    private readonly Mock<IPaymentRepository> _mockRepo;
    private readonly Mock<IWalletRepository> _mockWalletRepo;
    private readonly Mock<IDatabaseInitializer> _mockDbInit;

    public PaymentAuthorizationTests(TestWebApplicationFactory factory)
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
                // Replace the actual IPaymentRepository with our mock
                var repoDescriptor = services.SingleOrDefault(d => d.ServiceType == typeof(IPaymentRepository));
                if (repoDescriptor != null) services.Remove(repoDescriptor);
                services.AddScoped(_ => _mockRepo.Object);

                // Replace IWalletRepository
                var walletDescriptor = services.SingleOrDefault(d => d.ServiceType == typeof(IWalletRepository));
                if (walletDescriptor != null) services.Remove(walletDescriptor);
                services.AddScoped(_ => _mockWalletRepo.Object);

                // Replace DatabaseInitializer
                var dbDescriptor = services.SingleOrDefault(d => d.ServiceType == typeof(IDatabaseInitializer));
                if (dbDescriptor != null) services.Remove(dbDescriptor);
                services.AddScoped(_ => _mockDbInit.Object);
            });
        });
    }

    private string GenerateToken(string role, string driverId = "", string tenantId = "")
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.UTF8.GetBytes(DummyJwtSecret);
        
        var claims = new List<Claim>
        {
            new Claim("role", role),
            new Claim(ClaimTypes.Role, role)
        };
        
        if (!string.IsNullOrEmpty(driverId)) claims.Add(new Claim("driver_id", driverId));
        if (!string.IsNullOrEmpty(tenantId)) claims.Add(new Claim("tenant_id", tenantId));

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
    public async Task Test1_NoToken_ReturnsUnauthorized()
    {
        var client = _factory.CreateClient();
        
        var response = await client.PostAsJsonAsync("/api/payment/authorize", new { });
        
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Test2_InvalidToken_ReturnsUnauthorized()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "invalid_token_string");
        
        var response = await client.PostAsJsonAsync("/api/payment/authorize", new { });
        
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Test3_ValidDriverToken_ReturnsSuccess()
    {
        var client = _factory.CreateClient();
        var token = GenerateToken("Driver", driverId: "d-123");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        
        _mockRepo.Setup(x => x.GetPaymentBySessionIdAsync(It.IsAny<string>())).ReturnsAsync((PaymentTransaction?)null);
        _mockRepo.Setup(x => x.AuthorizePaymentAsync(It.IsAny<PaymentTransaction>())).ReturnsAsync("payment-id-123");
        _mockRepo.Setup(x => x.GetPaymentByIdAsync("payment-id-123")).ReturnsAsync(new PaymentTransaction());

        var response = await client.PostAsJsonAsync("/api/payment/authorize", new 
        { 
            SessionId = "s-123",
            EstimatedAmount = 100
        });
        
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Test4_WrongRole_ReturnsForbidden()
    {
        var client = _factory.CreateClient();
        // Endpoint requires 'Driver', we pass 'CompanyAdmin'
        var token = GenerateToken("CompanyAdmin", tenantId: "t-123");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        
        var response = await client.PostAsJsonAsync("/api/payment/authorize", new { });
        
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Test5_TenantMismatch_ReturnsForbidden()
    {
        var client = _factory.CreateClient();
        // Setup a mock payment belonging to "COMPANY-A"
        _mockRepo.Setup(x => x.GetPaymentByIdAsync("payment-1")).ReturnsAsync(new PaymentTransaction { CompanyId = "COMPANY-A", DriverId = "D-999", Status = "PENDING" });
        
        // We authenticate as CompanyAdmin for "COMPANY-B"
        var token = GenerateToken("CompanyAdmin", tenantId: "COMPANY-B");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        
        var response = await client.PostAsJsonAsync("/api/payment/payment-1/complete", new { FinalAmount = 100 });
        
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Test6_ClientCannotImpersonateDriver()
    {
        var client = _factory.CreateClient();
        var token = GenerateToken("Driver", driverId: "REAL_DRIVER");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        
        PaymentTransaction? capturedPayment = null;
        
        _mockRepo.Setup(x => x.GetPaymentBySessionIdAsync(It.IsAny<string>())).ReturnsAsync((PaymentTransaction?)null);
        _mockRepo.Setup(x => x.AuthorizePaymentAsync(It.IsAny<PaymentTransaction>()))
            .Callback<PaymentTransaction>(p => capturedPayment = p)
            .ReturnsAsync("p-123");
        _mockRepo.Setup(x => x.GetPaymentByIdAsync("p-123")).ReturnsAsync(new PaymentTransaction());

        // Client maliciously sends "FAKE_DRIVER" as DriverId in the body
        var response = await client.PostAsJsonAsync("/api/payment/authorize", new 
        { 
            SessionId = "s-123",
            DriverId = "FAKE_DRIVER",
            EstimatedAmount = 100
        });
        
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(capturedPayment);
        // The real driver ID from JWT should override the malicious payload
        Assert.Equal("REAL_DRIVER", capturedPayment!.DriverId);
    }
}
