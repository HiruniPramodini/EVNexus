using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using EVNexus.PaymentService.Controllers;
using EVNexus.PaymentService.Data;
using EVNexus.PaymentService.Forecasting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace EVNexus.PaymentService.Tests;

public class ForecastServiceAndAnalyticsTests
{
    private readonly Mock<ILogger<ForecastService>> _mockForecastLogger;
    private readonly ForecastService _forecastService;

    public ForecastServiceAndAnalyticsTests()
    {
        _mockForecastLogger = new Mock<ILogger<ForecastService>>();
        _forecastService = new ForecastService(_mockForecastLogger.Object);
    }

    [Fact]
    public void PredictNext7Days_WithEmptyHistoricalData_Returns7DaysOfZero()
    {
        // Arrange
        var historicalData = new List<RevenueData>();

        // Act
        var results = _forecastService.PredictNext7Days(historicalData).ToList();

        // Assert
        Assert.NotNull(results);
        Assert.Equal(7, results.Count);
        Assert.All(results, r => Assert.Equal(0m, r.PredictedRevenue));
        
        // Ensure dates are sequential starting tomorrow
        for (int i = 0; i < 6; i++)
        {
            Assert.True(results[i].Date < results[i + 1].Date);
        }
    }

    [Fact]
    public void PredictNext7Days_WithInsufficientData_ReturnsAverageBaseline()
    {
        // Arrange: 3 days of historical data (< 7 required for SSA seasonality)
        var startDate = new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc);
        var historicalData = new List<RevenueData>
        {
            new() { Date = startDate, Amount = 100f },
            new() { Date = startDate.AddDays(1), Amount = 200f },
            new() { Date = startDate.AddDays(2), Amount = 300f }
        };

        // Act
        var results = _forecastService.PredictNext7Days(historicalData).ToList();

        // Assert
        Assert.NotNull(results);
        Assert.Equal(7, results.Count);
        // Average of 100, 200, 300 is 200
        Assert.All(results, r => Assert.Equal(200m, r.PredictedRevenue));
        // Verify chronological sequence starting day after the last history date (startDate.AddDays(2))
        Assert.Equal(startDate.AddDays(3), results[0].Date);
        Assert.Equal(startDate.AddDays(9), results[6].Date);
    }

    [Fact]
    public void PredictNext7Days_WithSufficientData_ExecutesSsaForecasting()
    {
        // Arrange: 14 days of realistic daily revenue data
        var startDate = new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc);
        var historicalData = new List<RevenueData>();
        var pattern = new float[] { 120f, 150f, 180f, 220f, 310f, 400f, 290f };

        for (int i = 0; i < 14; i++)
        {
            historicalData.Add(new RevenueData
            {
                Date = startDate.AddDays(i),
                Amount = pattern[i % 7]
            });
        }

        // Act
        var results = _forecastService.PredictNext7Days(historicalData).ToList();

        // Assert
        Assert.NotNull(results);
        Assert.Equal(7, results.Count);
        // Verify non-negative predictions
        Assert.All(results, r => Assert.True(r.PredictedRevenue >= 0m, "Predicted revenue must be >= 0"));
        // First prediction should be day 15
        Assert.Equal(startDate.AddDays(14), results[0].Date);
        Assert.Equal(startDate.AddDays(20), results[6].Date);
    }

    [Fact]
    public async Task CompanyAnalyticsController_GetForecast_DeniedForDriverRole()
    {
        // Arrange
        var mockRepo = new Mock<ICompanyAnalyticsRepository>();
        var controller = new CompanyAnalyticsController(mockRepo.Object, _forecastService);

        var user = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.Role, "Driver"),
            new Claim("tenant_id", "TNT-COMPANY-001")
        }, "mock"));

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user }
        };

        // Act
        var result = await controller.GetCompanyForecast("TNT-COMPANY-001");

        // Assert
        Assert.IsType<ForbidResult>(result);
    }

    [Fact]
    public async Task CompanyAnalyticsController_GetForecast_DeniedWhenTenantMismatch()
    {
        // Arrange
        var mockRepo = new Mock<ICompanyAnalyticsRepository>();
        var controller = new CompanyAnalyticsController(mockRepo.Object, _forecastService);

        var user = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.Role, "CompanyAdmin"),
            new Claim("tenant_id", "TNT-ANOTHER-TENANT")
        }, "mock"));

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user }
        };

        // Act
        var result = await controller.GetCompanyForecast("TNT-COMPANY-001");

        // Assert
        Assert.IsType<ForbidResult>(result);
    }

    [Fact]
    public async Task CompanyAnalyticsController_GetForecast_ReturnsBadRequest_OnInvalidHistoricalDays()
    {
        // Arrange
        var mockRepo = new Mock<ICompanyAnalyticsRepository>();
        var controller = new CompanyAnalyticsController(mockRepo.Object, _forecastService);

        var user = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.Role, "CompanyAdmin"),
            new Claim("tenant_id", "TNT-COMPANY-001")
        }, "mock"));

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user }
        };

        // Act
        var resultBelow = await controller.GetCompanyForecast("TNT-COMPANY-001", historicalDays: 0);
        var resultAbove = await controller.GetCompanyForecast("TNT-COMPANY-001", historicalDays: 366);

        // Assert
        Assert.IsType<BadRequestObjectResult>(resultBelow);
        Assert.IsType<BadRequestObjectResult>(resultAbove);
    }

    [Fact]
    public async Task CompanyAnalyticsController_GetForecast_Success_ForAuthorizedCompanyAdmin()
    {
        // Arrange
        var companyId = "TNT-COMPANY-001";
        var mockRepo = new Mock<ICompanyAnalyticsRepository>();

        mockRepo.Setup(r => r.GetCompanyRevenueTrendAsync(companyId, It.IsAny<DateTime?>(), It.IsAny<DateTime?>(), null))
            .ReturnsAsync(new List<RevenueTrendDto>
            {
                new() { Date = "2026-10-10", Revenue = 150m, EnergyKwh = 50m, Sessions = 5 },
                new() { Date = "2026-10-11", Revenue = 200m, EnergyKwh = 70m, Sessions = 7 }
            });

        var controller = new CompanyAnalyticsController(mockRepo.Object, _forecastService);

        var user = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.Role, "CompanyAdmin"),
            new Claim("tenant_id", companyId)
        }, "mock"));

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user }
        };

        // Act
        var result = await controller.GetCompanyForecast(companyId);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        Assert.NotNull(okResult.Value);

        // Verify response contains forecast items
        var property = okResult.Value.GetType().GetProperty("data");
        Assert.NotNull(property);
        var data = property.GetValue(okResult.Value) as IEnumerable<RevenueForecast>;
        Assert.NotNull(data);
        Assert.Equal(7, data.Count());
    }
}
