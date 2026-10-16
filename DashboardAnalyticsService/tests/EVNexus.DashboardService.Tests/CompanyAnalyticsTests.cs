using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using EVNexus.DashboardService.Controllers;
using EVNexus.DashboardService.Data;
using EVNexus.DashboardService.Forecasting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace EVNexus.DashboardService.Tests;

public class CompanyAnalyticsTests
{
    private readonly Mock<ILogger<ForecastService>> _mockForecastLogger;
    private readonly ForecastService _forecastService;

    public CompanyAnalyticsTests()
    {
        _mockForecastLogger = new Mock<ILogger<ForecastService>>();
        _forecastService = new ForecastService(_mockForecastLogger.Object);
    }

    private static ControllerContext CreateControllerContext(string role, string tenantId)
    {
        var claims = new List<Claim>();
        if (!string.IsNullOrEmpty(role))
        {
            claims.Add(new Claim(ClaimTypes.Role, role));
        }
        if (!string.IsNullOrEmpty(tenantId))
        {
            claims.Add(new Claim("tenant_id", tenantId));
        }

        var identity = new ClaimsIdentity(claims, "TestAuth");
        var user = new ClaimsPrincipal(identity);

        return new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user }
        };
    }

    [Fact]
    public async Task GetDashboardAnalytics_ReturnsOk_WithCorrectResponseShape()
    {
        // Arrange
        var companyId = "TNT-CORP-101";
        var mockRepo = new Mock<ICompanyAnalyticsRepository>();
        mockRepo.Setup(r => r.GetDashboardAnalyticsAsync(companyId, null, null, null))
            .ReturnsAsync(new DashboardAnalyticsDto
            {
                TotalRevenue = 15000.50m,
                TotalRevenueToday = 3200.00m,
                TotalEnergyKwh = 450.75m,
                CompletedTransactions = 25
            });

        var controller = new CompanyAnalyticsController(mockRepo.Object, _forecastService)
        {
            ControllerContext = CreateControllerContext("CompanyAdmin", companyId)
        };

        // Act
        var result = await controller.GetDashboardAnalytics(companyId);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        Assert.NotNull(okResult.Value);

        var successProp = okResult.Value.GetType().GetProperty("success");
        var dataProp = okResult.Value.GetType().GetProperty("data");

        Assert.NotNull(successProp);
        Assert.NotNull(dataProp);
        Assert.True((bool)successProp.GetValue(okResult.Value)!);

        var data = dataProp.GetValue(okResult.Value) as DashboardAnalyticsDto;
        Assert.NotNull(data);
        Assert.Equal(15000.50m, data.TotalRevenue);
        Assert.Equal(3200.00m, data.TotalRevenueToday);
        Assert.Equal(450.75m, data.TotalEnergyKwh);
        Assert.Equal(25, data.CompletedTransactions);
    }

    [Fact]
    public async Task GetCompanyTransactions_ReturnsOk_WithTransactionList()
    {
        // Arrange
        var companyId = "TNT-CORP-101";
        var mockRepo = new Mock<ICompanyAnalyticsRepository>();
        mockRepo.Setup(r => r.GetCompanyTransactionsAsync(companyId, 10, null, null, null))
            .ReturnsAsync(new List<TransactionDto>
            {
                new()
                {
                    Id = "TXN-001",
                    Timestamp = "2026-10-16 10:30:00",
                    StationId = "STN-A",
                    Amount = 1200.00m,
                    EnergyConsumedKwh = 30.5m,
                    Status = "COMPLETED",
                    Currency = "LKR"
                }
            });

        var controller = new CompanyAnalyticsController(mockRepo.Object, _forecastService)
        {
            ControllerContext = CreateControllerContext("CompanyAdmin", companyId)
        };

        // Act
        var result = await controller.GetCompanyTransactions(companyId, limit: 10);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var dataProp = okResult.Value!.GetType().GetProperty("data");
        var list = dataProp!.GetValue(okResult.Value) as IEnumerable<TransactionDto>;
        Assert.NotNull(list);
        Assert.Single(list);
        Assert.Equal("TXN-001", list.First().Id);
    }

    [Fact]
    public async Task GetCompanyRevenueTrend_ReturnsOk_WithTrendData()
    {
        // Arrange
        var companyId = "TNT-CORP-101";
        var mockRepo = new Mock<ICompanyAnalyticsRepository>();
        mockRepo.Setup(r => r.GetCompanyRevenueTrendAsync(companyId, null, null, null))
            .ReturnsAsync(new List<RevenueTrendDto>
            {
                new() { Date = "2026-10-15", Revenue = 4000m, EnergyKwh = 100m, Sessions = 10 },
                new() { Date = "2026-10-16", Revenue = 5500m, EnergyKwh = 140m, Sessions = 14 }
            });

        var controller = new CompanyAnalyticsController(mockRepo.Object, _forecastService)
        {
            ControllerContext = CreateControllerContext("Company", companyId)
        };

        // Act
        var result = await controller.GetCompanyRevenueTrend(companyId);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var dataProp = okResult.Value!.GetType().GetProperty("data");
        var trend = dataProp!.GetValue(okResult.Value) as IEnumerable<RevenueTrendDto>;
        Assert.NotNull(trend);
        Assert.Equal(2, trend.Count());
    }

    [Fact]
    public async Task GetStationAnalytics_ReturnsOk_WithPerStationMetrics()
    {
        // Arrange
        var companyId = "TNT-CORP-101";
        var mockRepo = new Mock<ICompanyAnalyticsRepository>();
        mockRepo.Setup(r => r.GetStationAnalyticsAsync(companyId, null, null, null))
            .ReturnsAsync(new List<StationAnalyticsDto>
            {
                new() { StationId = "STN-COLOMBO-1", Date = "2026-10-16", Revenue = 8000m, EnergyKwh = 220m, Sessions = 18 }
            });

        var controller = new CompanyAnalyticsController(mockRepo.Object, _forecastService)
        {
            ControllerContext = CreateControllerContext("Operator", companyId)
        };

        // Act
        var result = await controller.GetStationAnalytics(companyId);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var dataProp = okResult.Value!.GetType().GetProperty("data");
        var list = dataProp!.GetValue(okResult.Value) as IEnumerable<StationAnalyticsDto>;
        Assert.NotNull(list);
        Assert.Single(list);
        Assert.Equal("STN-COLOMBO-1", list.First().StationId);
    }

    [Fact]
    public async Task CrossTenantAccess_Rejection_ReturnsForbid()
    {
        // Arrange
        var mockRepo = new Mock<ICompanyAnalyticsRepository>();
        var controller = new CompanyAnalyticsController(mockRepo.Object, _forecastService)
        {
            // User belongs to TNT-COMPANY-A, but requests TNT-COMPANY-B
            ControllerContext = CreateControllerContext("CompanyAdmin", "TNT-COMPANY-A")
        };

        // Act
        var result = await controller.GetDashboardAnalytics("TNT-COMPANY-B");

        // Assert
        Assert.IsType<ForbidResult>(result);
    }

    [Fact]
    public async Task UnauthorizedRole_Rejection_ReturnsForbid_ForDriverRole()
    {
        // Arrange
        var companyId = "TNT-CORP-101";
        var mockRepo = new Mock<ICompanyAnalyticsRepository>();
        var controller = new CompanyAnalyticsController(mockRepo.Object, _forecastService)
        {
            ControllerContext = CreateControllerContext("Driver", companyId)
        };

        // Act
        var result = await controller.GetDashboardAnalytics(companyId);

        // Assert
        Assert.IsType<ForbidResult>(result);
    }

    [Fact]
    public async Task GetCompanyForecast_Returns7Days_WithValidHistoricalTrend()
    {
        // Arrange
        var companyId = "TNT-CORP-101";
        var mockRepo = new Mock<ICompanyAnalyticsRepository>();
        mockRepo.Setup(r => r.GetCompanyRevenueTrendAsync(companyId, It.IsAny<DateTime?>(), It.IsAny<DateTime?>(), null))
            .ReturnsAsync(new List<RevenueTrendDto>
            {
                new() { Date = "2026-10-10", Revenue = 1000m, EnergyKwh = 25m, Sessions = 2 },
                new() { Date = "2026-10-11", Revenue = 1500m, EnergyKwh = 35m, Sessions = 3 },
                new() { Date = "2026-10-12", Revenue = 2000m, EnergyKwh = 50m, Sessions = 4 }
            });

        var controller = new CompanyAnalyticsController(mockRepo.Object, _forecastService)
        {
            ControllerContext = CreateControllerContext("CompanyAdmin", companyId)
        };

        // Act
        var result = await controller.GetCompanyForecast(companyId);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var dataProp = okResult.Value!.GetType().GetProperty("data");
        var forecast = dataProp!.GetValue(okResult.Value) as IEnumerable<RevenueForecast>;
        Assert.NotNull(forecast);
        Assert.Equal(7, forecast.Count());
    }

    [Fact]
    public async Task GetCompanyForecast_InvalidHistoricalDays_ReturnsBadRequest()
    {
        // Arrange
        var companyId = "TNT-CORP-101";
        var mockRepo = new Mock<ICompanyAnalyticsRepository>();
        var controller = new CompanyAnalyticsController(mockRepo.Object, _forecastService)
        {
            ControllerContext = CreateControllerContext("CompanyAdmin", companyId)
        };

        // Act
        var resultZero = await controller.GetCompanyForecast(companyId, historicalDays: 0);
        var resultExceeded = await controller.GetCompanyForecast(companyId, historicalDays: 366);

        // Assert
        Assert.IsType<BadRequestObjectResult>(resultZero);
        Assert.IsType<BadRequestObjectResult>(resultExceeded);
    }

    [Fact]
    public void PredictNext7Days_WithEmptyData_Returns7DaysZero()
    {
        // Act
        var forecast = _forecastService.PredictNext7Days(new List<RevenueData>()).ToList();

        // Assert
        Assert.Equal(7, forecast.Count);
        Assert.All(forecast, f => Assert.Equal(0m, f.PredictedRevenue));
    }

    [Fact]
    public void PredictNext7Days_WithUnder7Days_ReturnsAverageBaseline()
    {
        // Arrange
        var baseDate = new DateTime(2026, 10, 10, 0, 0, 0, DateTimeKind.Utc);
        var data = new List<RevenueData>
        {
            new() { Date = baseDate, Amount = 100f },
            new() { Date = baseDate.AddDays(1), Amount = 200f },
            new() { Date = baseDate.AddDays(2), Amount = 300f }
        };

        // Act
        var forecast = _forecastService.PredictNext7Days(data).ToList();

        // Assert
        Assert.Equal(7, forecast.Count);
        Assert.All(forecast, f => Assert.Equal(200m, f.PredictedRevenue));
    }
}
