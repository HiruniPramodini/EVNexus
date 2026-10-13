using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;
using EVNexus.DashboardService.Controllers;
using EVNexus.DashboardService.Data;
using EVNexus.DashboardService.DTOs;
using EVNexus.DashboardService.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace EVNexus.DashboardService.Tests;

public class DashboardReportingTests
{
    private readonly Mock<IDashboardRepository> _mockRepo;
    private readonly Mock<IForecastService> _mockForecast;
    private readonly Mock<ICsvExportService> _mockCsv;
    private readonly Mock<ILogger<DashboardController>> _mockLogger;
    private readonly DashboardController _controller;

    public DashboardReportingTests()
    {
        _mockRepo = new Mock<IDashboardRepository>();
        _mockForecast = new Mock<IForecastService>();
        _mockCsv = new Mock<ICsvExportService>();
        _mockLogger = new Mock<ILogger<DashboardController>>();

        _controller = new DashboardController(
            _mockRepo.Object,
            _mockForecast.Object,
            _mockCsv.Object,
            _mockLogger.Object
        );
    }

    private void SetUserContext(string tenantId, string role = "CompanyAdmin")
    {
        var claims = new List<Claim>
        {
            new Claim("tenant_id", tenantId),
            new Claim(ClaimTypes.Role, role)
        };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        var principal = new ClaimsPrincipal(identity);
        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = principal }
        };
    }

    [Fact]
    public async Task Story1_DriverSummary_ReturnsCompletedSessions_Energy_And_Amount()
    {
        // Arrange
        const string driverId = "driver-123";
        _mockRepo.Setup(r => r.GetDriverSummaryAsync(driverId))
            .ReturnsAsync(new DriverSummaryDto
            {
                DriverId = driverId,
                TotalCompletedSessions = 15,
                TotalEnergyConsumedKwh = 350.5m,
                TotalAmountSpent = 14500.0m,
                Currency = "LKR"
            });

        // Act
        var result = await _controller.GetDriverSummary(driverId);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var dto = Assert.IsType<DriverSummaryDto>(okResult.Value);
        Assert.Equal(15, dto.TotalCompletedSessions);
        Assert.Equal(350.5m, dto.TotalEnergyConsumedKwh);
        Assert.Equal(14500.0m, dto.TotalAmountSpent);
    }

    [Fact]
    public async Task Story1_DriverSummary_EmptyDriverId_ReturnsBadRequest()
    {
        var result = await _controller.GetDriverSummary("");
        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task Story2_DateRangeFilter_RejectsInvalidRange_WhenEndBeforeStart()
    {
        // Arrange
        const string companyId = "company-1";
        SetUserContext(companyId);
        var start = DateTime.UtcNow;
        var end = start.AddDays(-2); // Invalid: End before start

        // Act
        var result = await _controller.GetRevenueTrend(companyId, start, end);

        // Assert
        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        Assert.NotNull(badRequest.Value);
    }

    [Fact]
    public async Task Story2_DateRangeFilter_DefaultsToLast7Days_WhenUnspecified()
    {
        // Arrange
        const string companyId = "company-1";
        SetUserContext(companyId);
        _mockRepo.Setup(r => r.GetRevenueTrendAsync(companyId, It.IsAny<DateTime>(), It.IsAny<DateTime>(), null))
            .ReturnsAsync(new List<RevenueTrendPointDto>());

        // Act
        var result = await _controller.GetRevenueTrend(companyId);

        // Assert
        Assert.IsType<OkObjectResult>(result);
        _mockRepo.Verify(r => r.GetRevenueTrendAsync(
            companyId,
            It.Is<DateTime>(d => d <= DateTime.UtcNow.AddDays(-6)),
            It.Is<DateTime>(d => d <= DateTime.UtcNow),
            null
        ), Times.Once);
    }

    [Fact]
    public async Task Story3_RevenueTrend_HandlesZeroRevenueGracefully()
    {
        // Arrange
        const string companyId = "company-1";
        SetUserContext(companyId);
        _mockRepo.Setup(r => r.GetRevenueTrendAsync(companyId, It.IsAny<DateTime>(), It.IsAny<DateTime>(), null))
            .ReturnsAsync(new List<RevenueTrendPointDto>
            {
                new RevenueTrendPointDto { Date = "2026-10-01", Revenue = 0m, SessionCount = 0 },
                new RevenueTrendPointDto { Date = "2026-10-02", Revenue = 500m, SessionCount = 2 }
            });

        // Act
        var result = await _controller.GetRevenueTrend(companyId);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var list = Assert.IsAssignableFrom<IEnumerable<RevenueTrendPointDto>>(okResult.Value);
        Assert.Equal(2, list.Count());
        Assert.Equal(0m, list.First().Revenue);
    }

    [Fact]
    public async Task Story4_CompanyOverview_LoadsCorrectly_EvenWithZeroStations()
    {
        // Arrange
        const string companyId = "brand-new-company";
        SetUserContext(companyId);
        _mockRepo.Setup(r => r.GetCompanyOverviewAsync(companyId))
            .ReturnsAsync(new CompanyOverviewDto
            {
                CompanyId = companyId,
                TotalStations = 0,
                ActiveSessionsCount = 0,
                TotalCompletedSessions = 0,
                TotalRevenue = 0m,
                TotalEnergyDeliveredKwh = 0m
            });

        // Act
        var result = await _controller.GetCompanyOverview(companyId);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var overview = Assert.IsType<CompanyOverviewDto>(okResult.Value);
        Assert.Equal(0, overview.TotalStations);
        Assert.Equal(0, overview.ActiveSessionsCount);
        Assert.Equal(0m, overview.TotalRevenue);
    }

    [Fact]
    public async Task Story5_ExportUsageReportCsv_ReturnsFileResult_WithHeadersAndData()
    {
        // Arrange
        const string companyId = "company-1";
        SetUserContext(companyId);
        var mockCsvBytes = Encoding.UTF8.GetBytes("Date,Station,Sessions,EnergyDeliveredKwh,Revenue\n2026-10-01,\"Station A\",5,120.0,4500.0");
        
        _mockRepo.Setup(r => r.GetDailyUsageAsync(companyId, It.IsAny<DateTime>(), It.IsAny<DateTime>(), null))
            .ReturnsAsync(new List<DailyUsagePointDto>());
        _mockCsv.Setup(c => c.ExportUsageReportToCsv(It.IsAny<IEnumerable<DailyUsagePointDto>>(), null))
            .Returns(mockCsvBytes);

        // Act
        var result = await _controller.ExportUsageReportCsv(companyId);

        // Assert
        var fileResult = Assert.IsType<FileContentResult>(result);
        Assert.Equal("text/csv", fileResult.ContentType);
        Assert.Contains(".csv", fileResult.FileDownloadName);
        Assert.NotEmpty(fileResult.FileContents);
    }

    [Fact]
    public async Task Story6_TrafficTable_ReturnsStationUsageAndEnergy()
    {
        // Arrange
        const string companyId = "company-1";
        SetUserContext(companyId);
        _mockRepo.Setup(r => r.GetStationTrafficAsync(companyId, null, null))
            .ReturnsAsync(new List<StationTrafficDto>
            {
                new StationTrafficDto { StationId = "s1", StationName = "Lotus Tower", UsageCount = 25, TotalEnergyDeliveredKwh = 450m },
                new StationTrafficDto { StationId = "s2", StationName = "Kandy City", UsageCount = 10, TotalEnergyDeliveredKwh = 180m }
            });

        // Act
        var result = await _controller.GetTrafficTable(companyId);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var stations = Assert.IsAssignableFrom<IEnumerable<StationTrafficDto>>(okResult.Value);
        Assert.Equal(2, stations.Count());
        Assert.Equal(25, stations.First().UsageCount);
    }

    [Fact]
    public async Task Story7_PricingTable_DistinguishesPeakVsOffPeak()
    {
        // Arrange
        const string companyId = "company-1";
        SetUserContext(companyId);
        _mockRepo.Setup(r => r.GetStationPricingAsync(companyId))
            .ReturnsAsync(new List<StationPricingDto>
            {
                new StationPricingDto 
                { 
                    StationId = "s1", 
                    StationName = "Station 1", 
                    StandardPricePerKwh = 50m, 
                    PeakPricePerKwh = 65m, 
                    OffPeakPricePerKwh = 40m,
                    PeakStartTime = TimeSpan.FromHours(17),
                    PeakEndTime = TimeSpan.FromHours(21)
                }
            });

        // Act
        var result = await _controller.GetPricingTable(companyId);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var pricing = Assert.IsAssignableFrom<IEnumerable<StationPricingDto>>(okResult.Value);
        var item = pricing.First();
        Assert.True(item.HasTimeOfUsePricing);
        Assert.Equal(65m, item.PeakPricePerKwh);
        Assert.Equal(40m, item.OffPeakPricePerKwh);
    }

    [Fact]
    public async Task Story8_LocationsTable_ReturnsNameAddressCoordinatesAndDetailUrl()
    {
        // Arrange
        const string companyId = "company-1";
        SetUserContext(companyId);
        _mockRepo.Setup(r => r.GetStationLocationsAsync(companyId))
            .ReturnsAsync(new List<StationLocationDto>
            {
                new StationLocationDto { StationId = "st-99", StationName = "Galle Port", Address = "Galle, Sri Lanka", Latitude = 6.03m, Longitude = 80.21m }
            });

        // Act
        var result = await _controller.GetLocationsTable(companyId);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var locations = Assert.IsAssignableFrom<IEnumerable<StationLocationDto>>(okResult.Value);
        var loc = locations.First();
        Assert.Equal("Galle Port", loc.StationName);
        Assert.Equal("/company/stations/st-99", loc.DetailUrl);
    }

    [Fact]
    public async Task Story9_DailyUsage_ReturnsDailyCountsAndEnergy()
    {
        // Arrange
        const string companyId = "company-1";
        SetUserContext(companyId);
        _mockRepo.Setup(r => r.GetDailyUsageAsync(companyId, It.IsAny<DateTime>(), It.IsAny<DateTime>(), null))
            .ReturnsAsync(new List<DailyUsagePointDto>
            {
                new DailyUsagePointDto { Date = "2026-10-01", SessionCount = 10, EnergyDeliveredKwh = 240m, Revenue = 9600m }
            });

        // Act
        var result = await _controller.GetDailyUsage(companyId);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var list = Assert.IsAssignableFrom<IEnumerable<DailyUsagePointDto>>(okResult.Value);
        Assert.Single(list);
        Assert.Equal(10, list.First().SessionCount);
    }

    [Fact]
    public async Task Story10_MonthlyReport_RejectsInvalidMonth()
    {
        // Arrange
        const string companyId = "company-1";
        SetUserContext(companyId);

        // Act
        var result = await _controller.GetMonthlyReport(companyId, 2026, 13); // Month 13 is invalid

        // Assert
        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task Story10_MonthlyReport_ReturnsAggregatedTotalsAndBreakdowns()
    {
        // Arrange
        const string companyId = "company-1";
        SetUserContext(companyId);
        _mockRepo.Setup(r => r.GetMonthlyReportAsync(companyId, 2026, 10))
            .ReturnsAsync(new MonthlyReportDto
            {
                Year = 2026,
                Month = 10,
                MonthName = "October",
                TotalSessions = 120,
                TotalEnergyDeliveredKwh = 2800m,
                TotalRevenue = 112000m
            });

        // Act
        var result = await _controller.GetMonthlyReport(companyId, 2026, 10);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var report = Assert.IsType<MonthlyReportDto>(okResult.Value);
        Assert.Equal("October", report.MonthName);
        Assert.Equal(120, report.TotalSessions);
    }

    [Fact]
    public async Task Story14_StationRankings_MarksTopStation()
    {
        // Arrange
        const string companyId = "company-1";
        SetUserContext(companyId);
        _mockRepo.Setup(r => r.GetStationRankingsAsync(companyId, null, null))
            .ReturnsAsync(new List<StationRankingDto>
            {
                new StationRankingDto { Rank = 1, StationId = "s1", StationName = "Fast Charger A", SessionCount = 50, IsTopStation = true },
                new StationRankingDto { Rank = 2, StationId = "s2", StationName = "Fast Charger B", SessionCount = 30, IsTopStation = false }
            });

        // Act
        var result = await _controller.GetStationRankings(companyId);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var rankings = Assert.IsAssignableFrom<IEnumerable<StationRankingDto>>(okResult.Value);
        Assert.True(rankings.First().IsTopStation);
        Assert.False(rankings.Last().IsTopStation);
    }

    [Fact]
    public async Task Story15_BusiestHours_Returns24HourDistribution()
    {
        // Arrange
        const string companyId = "company-1";
        SetUserContext(companyId);
        _mockRepo.Setup(r => r.GetHourlyDistributionAsync(companyId, null, It.IsAny<DateTime>(), It.IsAny<DateTime>()))
            .ReturnsAsync(Enumerable.Range(0, 24).Select(h => new HourlyTrafficDto
            {
                Hour = h,
                SessionCount = h == 18 ? 40 : 5,
                IsBusiestHour = h == 18
            }).ToList());

        // Act
        var result = await _controller.GetBusiestHours(companyId);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var hours = Assert.IsAssignableFrom<IEnumerable<HourlyTrafficDto>>(okResult.Value);
        Assert.Equal(24, hours.Count());
        var busiest = hours.Single(h => h.IsBusiestHour);
        Assert.Equal(18, busiest.Hour);
    }

    [Fact]
    public async Task MultiTenantIsolation_ReturnsForbidden_WhenTenantIdMismatches()
    {
        // Arrange
        SetUserContext("company-ABC"); // Logged in as company-ABC

        // Act
        var result = await _controller.GetCompanyOverview("company-XYZ"); // Attempting to access company-XYZ

        // Assert
        var forbiddenResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(403, forbiddenResult.StatusCode);
    }

    [Fact]
    public async Task MultiTenantIsolation_ReturnsForbidden_WhenDriverAttemptsCompanyAccess()
    {
        // Arrange
        SetUserContext("company-1", role: "Driver"); // Driver role

        // Act
        var result = await _controller.GetCompanyOverview("company-1");

        // Assert
        var forbiddenResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(403, forbiddenResult.StatusCode);
    }
}
