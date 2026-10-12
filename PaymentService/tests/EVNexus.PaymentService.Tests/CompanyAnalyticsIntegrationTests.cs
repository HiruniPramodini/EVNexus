using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using EVNexus.PaymentService.Data;
using EVNexus.PaymentService.Forecasting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using Moq;
using Xunit;

namespace EVNexus.PaymentService.Tests;

/// <summary>
/// Sprint 4 QA Integration Tests for Company Analytics API endpoints:
/// - TC-IT-01: GET /api/payment/analytics/company/{companyId} (Overview KPIs)
/// - TC-IT-02: Tenant Isolation & RBAC (Driver role & Tenant mismatch return 403)
/// - TC-IT-03: GET /api/payment/analytics/company/{companyId}/revenue-trend
/// - TC-IT-04: GET /api/payment/analytics/company/{companyId}/transactions
/// - TC-IT-05: GET /api/payment/analytics/company/{companyId}/stations
/// - TC-IT-06: GET /api/payment/analytics/company/{companyId}/forecast (Validation 400 & Success 200)
/// - TC-IT-07: Unauthenticated request returns 401 Unauthorized
/// </summary>
public class CompanyAnalyticsIntegrationTests : IClassFixture<TestWebApplicationFactory>
{
    private readonly WebApplicationFactory<Program> _factory;
    private const string DummyJwtSecret = "Test_Dummy_Secret_Key_For_Tests_Only_2026_Secure!";

    private readonly Mock<ICompanyAnalyticsRepository> _mockAnalyticsRepo;
    private readonly Mock<IForecastService> _mockForecastService;
    private readonly Mock<IDatabaseInitializer> _mockDbInit;

    public CompanyAnalyticsIntegrationTests(TestWebApplicationFactory factory)
    {
        _mockAnalyticsRepo = new Mock<ICompanyAnalyticsRepository>();
        _mockForecastService = new Mock<IForecastService>();
        _mockDbInit = new Mock<IDatabaseInitializer>();
        _mockDbInit.Setup(x => x.InitializeAsync()).Returns(Task.CompletedTask);

        Environment.SetEnvironmentVariable("Jwt__Key", DummyJwtSecret);
        Environment.SetEnvironmentVariable("Jwt__Issuer", "EVNexus.AuthService");
        Environment.SetEnvironmentVariable("Jwt__Audience", "EVNexus.Microservices");

        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                var ar = services.SingleOrDefault(d => d.ServiceType == typeof(ICompanyAnalyticsRepository));
                if (ar != null) services.Remove(ar);
                services.AddScoped(_ => _mockAnalyticsRepo.Object);

                var fs = services.SingleOrDefault(d => d.ServiceType == typeof(IForecastService));
                if (fs != null) services.Remove(fs);
                services.AddScoped(_ => _mockForecastService.Object);

                var dd = services.SingleOrDefault(d => d.ServiceType == typeof(IDatabaseInitializer));
                if (dd != null) services.Remove(dd);
                services.AddScoped(_ => _mockDbInit.Object);
            });
        });
    }

    private string GenerateToken(string role, string tenantId = "")
    {
        var key = Encoding.UTF8.GetBytes(DummyJwtSecret);
        var claims = new List<Claim>
        {
            new("role", role),
            new(ClaimTypes.Role, role)
        };
        if (!string.IsNullOrEmpty(tenantId))
        {
            claims.Add(new Claim("tenant_id", tenantId));
        }

        var descriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.AddMinutes(15),
            Issuer = "EVNexus.AuthService",
            Audience = "EVNexus.Microservices",
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
        };

        var handler = new JwtSecurityTokenHandler();
        var token = handler.CreateToken(descriptor);
        return handler.WriteToken(token);
    }

    // =========================================================================
    // 1. DASHBOARD OVERVIEW (SCRUM-123 & SCRUM-130)
    // =========================================================================

    [Fact]
    public async Task GetDashboardAnalytics_AuthorizedCompanyAdmin_Returns200WithDto()
    {
        // Arrange
        var companyId = "company-101";
        var client = _factory.CreateClient();
        var token = GenerateToken("CompanyAdmin", tenantId: companyId);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var expectedDto = new DashboardAnalyticsDto
        {
            TotalRevenue = 1520.50m,
            TotalRevenueToday = 340.00m,
            TotalEnergyKwh = 450.25m,
            CompletedTransactions = 18
        };

        _mockAnalyticsRepo
            .Setup(r => r.GetDashboardAnalyticsAsync(companyId, It.IsAny<DateTime?>(), It.IsAny<DateTime?>(), It.IsAny<string?>()))
            .ReturnsAsync(expectedDto);

        // Act
        var response = await client.GetAsync($"/api/payment/analytics/company/{companyId}");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<DashboardAnalyticsDto>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        Assert.NotNull(result);
        Assert.Equal(1520.50m, result.TotalRevenue);
        Assert.Equal(18, result.CompletedTransactions);
    }

    [Fact]
    public async Task GetDashboardAnalytics_TenantMismatch_Returns403Forbidden()
    {
        // Arrange: User belongs to company-999 but tries to query company-101
        var client = _factory.CreateClient();
        var token = GenerateToken("CompanyAdmin", tenantId: "company-999");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        // Act
        var response = await client.GetAsync("/api/payment/analytics/company/company-101");

        // Assert
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GetDashboardAnalytics_DriverRole_Returns403Forbidden()
    {
        // Arrange: Authenticated driver trying to access company analytics
        var companyId = "company-101";
        var client = _factory.CreateClient();
        var token = GenerateToken("Driver", tenantId: companyId);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        // Act
        var response = await client.GetAsync($"/api/payment/analytics/company/{companyId}");

        // Assert
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GetDashboardAnalytics_WithoutToken_Returns401Unauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync("/api/payment/analytics/company/company-101");

        // Assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // =========================================================================
    // 2. REVENUE TREND (SCRUM-132)
    // =========================================================================

    [Fact]
    public async Task GetCompanyRevenueTrend_WithDateFilter_Returns200AndTrendList()
    {
        // Arrange
        var companyId = "company-101";
        var client = _factory.CreateClient();
        var token = GenerateToken("CompanyAdmin", tenantId: companyId);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var trends = new List<RevenueTrendDto>
        {
            new() { Date = "2026-10-08", Revenue = 250m, EnergyKwh = 50m, Sessions = 4 },
            new() { Date = "2026-10-09", Revenue = 400m, EnergyKwh = 80m, Sessions = 7 }
        };

        _mockAnalyticsRepo
            .Setup(r => r.GetCompanyRevenueTrendAsync(companyId, It.IsAny<DateTime?>(), It.IsAny<DateTime?>(), null))
            .ReturnsAsync(trends);

        // Act
        var response = await client.GetAsync($"/api/payment/analytics/company/{companyId}/revenue-trend?startDate=2026-10-01&endDate=2026-10-10");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<List<RevenueTrendDto>>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        Assert.NotNull(result);
        Assert.Equal(2, result.Count);
        Assert.Equal(250m, result[0].Revenue);
    }

    // =========================================================================
    // 3. TRANSACTIONS / CSV DATA SOURCE (SCRUM-128 & SCRUM-131)
    // =========================================================================

    [Fact]
    public async Task GetCompanyTransactions_ValidCall_Returns200WithTransactions()
    {
        // Arrange
        var companyId = "company-101";
        var client = _factory.CreateClient();
        var token = GenerateToken("CompanyAdmin", tenantId: companyId);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var transactions = new List<TransactionDto>
        {
            new() { Id = "tx-1", StationId = "st-1", Amount = 75.00m, EnergyConsumedKwh = 15m, Status = "Completed", Timestamp = "2026-10-10T12:00:00Z" }
        };

        _mockAnalyticsRepo
            .Setup(r => r.GetCompanyTransactionsAsync(companyId, 50, null, null, null))
            .ReturnsAsync(transactions);

        // Act
        var response = await client.GetAsync($"/api/payment/analytics/company/{companyId}/transactions?limit=50");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<List<TransactionDto>>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        Assert.NotNull(result);
        Assert.Single(result);
        Assert.Equal("tx-1", result[0].Id);
    }

    // =========================================================================
    // 4. STATION TRAFFIC (SCRUM-124 & SCRUM-168)
    // =========================================================================

    [Fact]
    public async Task GetStationAnalytics_Returns200WithStationList()
    {
        // Arrange
        var companyId = "company-101";
        var client = _factory.CreateClient();
        var token = GenerateToken("CompanyAdmin", tenantId: companyId);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var stations = new List<StationAnalyticsDto>
        {
            new() { StationId = "st-alpha", Sessions = 40, Revenue = 800m, EnergyKwh = 160m },
            new() { StationId = "st-beta", Sessions = 25, Revenue = 450m, EnergyKwh = 90m }
        };

        _mockAnalyticsRepo
            .Setup(r => r.GetStationAnalyticsAsync(companyId, null, null, null))
            .ReturnsAsync(stations);

        // Act
        var response = await client.GetAsync($"/api/payment/analytics/company/{companyId}/stations");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<List<StationAnalyticsDto>>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        Assert.NotNull(result);
        Assert.Equal(2, result.Count);
        Assert.Equal(40, result[0].Sessions);
    }

    // =========================================================================
    // 5. AI DEMAND FORECAST ENDPOINT (SCRUM-166)
    // =========================================================================

    [Fact]
    public async Task GetCompanyForecast_InvalidHistoricalDays_Returns400BadRequest()
    {
        // Arrange
        var companyId = "company-101";
        var client = _factory.CreateClient();
        var token = GenerateToken("CompanyAdmin", tenantId: companyId);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        // Act: historicalDays = 0 is invalid (must be between 1 and 365)
        var response = await client.GetAsync($"/api/payment/analytics/company/{companyId}/forecast?historicalDays=0");

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetCompanyForecast_ValidHistoricalDays_Returns200With7DayPredictions()
    {
        // Arrange
        var companyId = "company-101";
        var client = _factory.CreateClient();
        var token = GenerateToken("CompanyAdmin", tenantId: companyId);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var trends = new List<RevenueTrendDto>
        {
            new() { Date = "2026-10-01", Revenue = 100m },
            new() { Date = "2026-10-02", Revenue = 150m }
        };

        var forecastOutput = new List<RevenueForecast>
        {
            new() { Date = DateTime.UtcNow.Date.AddDays(1), PredictedRevenue = 120m }
        };

        _mockAnalyticsRepo
            .Setup(r => r.GetCompanyRevenueTrendAsync(companyId, It.IsAny<DateTime?>(), It.IsAny<DateTime?>(), null))
            .ReturnsAsync(trends);

        _mockForecastService
            .Setup(f => f.PredictNext7Days(It.IsAny<IEnumerable<RevenueData>>()))
            .Returns(forecastOutput);

        // Act
        var response = await client.GetAsync($"/api/payment/analytics/company/{companyId}/forecast?historicalDays=30");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<List<RevenueForecast>>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        Assert.NotNull(result);
        Assert.Single(result);
        Assert.Equal(120m, result[0].PredictedRevenue);
    }
}
