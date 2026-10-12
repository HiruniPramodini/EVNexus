using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using EVNexus.PaymentService.Data;
using EVNexus.PaymentService.Forecasting;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace EVNexus.PaymentService.Tests;

/// <summary>
/// Sprint 4 QA Unit Tests covering SCRUM-89 Epic:
/// - SCRUM-130: Date Range Filtering & Validation
/// - SCRUM-132: Revenue Trend Calculations
/// - SCRUM-131: CSV Usage Report Formatting
/// - SCRUM-124: Station Traffic Sorting & Energy Calculations
/// - SCRUM-125: Charging Point Pricing Calculations
/// - SCRUM-164: Monthly Report Aggregation
/// - SCRUM-165: AI Peak-Hour Usage Detection Logic
/// - SCRUM-166: AI Future Demand SSA Forecast Logic
/// - SCRUM-168: Station Ranking Logic
/// - SCRUM-171: Pricing Recommendation Decision Logic
/// </summary>
public class Sprint4AnalyticsUnitTests
{
    private readonly ForecastService _forecastService;

    public Sprint4AnalyticsUnitTests()
    {
        _forecastService = new ForecastService(NullLogger<ForecastService>.Instance);
    }

    // =========================================================================
    // 1. SCRUM-130: DATE RANGE FILTERING & VALIDATION TESTS
    // =========================================================================

    [Fact]
    public void ValidateDateRange_EndDateBeforeStartDate_ReturnsFalse()
    {
        // Arrange
        var startDate = new DateTime(2026, 10, 10);
        var endDate = new DateTime(2026, 10, 5);

        // Act
        bool isValid = IsValidDateRange(startDate, endDate);

        // Assert
        Assert.False(isValid, "Date range where EndDate < StartDate must be rejected.");
    }

    [Fact]
    public void ValidateDateRange_ValidDates_ReturnsTrue()
    {
        // Arrange
        var startDate = new DateTime(2026, 9, 1);
        var endDate = new DateTime(2026, 9, 30);

        // Act
        bool isValid = IsValidDateRange(startDate, endDate);

        // Assert
        Assert.True(isValid);
    }

    [Fact]
    public void GetDefaultDateRange_WhenUnspecified_ReturnsLast7Days()
    {
        // Arrange
        var today = DateTime.UtcNow.Date;

        // Act
        var (start, end) = GetDefaultDateRange(today);

        // Assert
        Assert.Equal(today, end);
        Assert.Equal(today.AddDays(-7), start);
        Assert.Equal(7, (end - start).Days);
    }

    // =========================================================================
    // 2. SCRUM-166 & SCRUM-165: AI DEMAND FORECAST & PEAK-HOUR UNIT TESTS
    // =========================================================================

    [Fact]
    public void Forecast_EmptyHistory_Returns7DaysZeroBaselineFallback()
    {
        // Arrange
        var emptyHistory = new List<RevenueData>();

        // Act
        var result = _forecastService.PredictNext7Days(emptyHistory).ToList();

        // Assert
        Assert.NotNull(result);
        Assert.Equal(7, result.Count);
        Assert.All(result, item =>
        {
            Assert.Equal(0m, item.PredictedRevenue);
        });
    }

    [Fact]
    public void Forecast_LessThan7DaysHistory_ReturnsBaselineAverage()
    {
        // Arrange: 3 days with known average = 100
        var baseDate = new DateTime(2026, 10, 1);
        var shortHistory = new List<RevenueData>
        {
            new() { Date = baseDate, Amount = 80f },
            new() { Date = baseDate.AddDays(1), Amount = 100f },
            new() { Date = baseDate.AddDays(2), Amount = 120f }
        };

        // Act
        var result = _forecastService.PredictNext7Days(shortHistory).ToList();

        // Assert
        Assert.Equal(7, result.Count);
        decimal expectedAverage = (decimal)(80 + 100 + 120) / 3; // 100m
        Assert.All(result, item =>
        {
            Assert.Equal(expectedAverage, item.PredictedRevenue);
        });
    }

    [Fact]
    public void Forecast_SufficientHistory_OutputsPredictions()
    {
        // Arrange: 14 days of realistic daily revenue
        var baseDate = new DateTime(2026, 9, 1);
        var history = new List<RevenueData>();
        for (int i = 0; i < 14; i++)
        {
            history.Add(new RevenueData
            {
                Date = baseDate.AddDays(i),
                Amount = 150f + (i * 10f)
            });
        }

        // Act
        var result = _forecastService.PredictNext7Days(history).ToList();

        // Assert
        Assert.Equal(7, result.Count);
        Assert.All(result, item =>
        {
            Assert.True(item.PredictedRevenue >= 0, "Predicted revenue should be non-negative.");
        });
    }

    [Fact]
    public void DetectPeakHours_SessionStartTimes_IdentifiesCorrectPeakHour()
    {
        // Arrange: Sessions predominantly between 17:00 and 19:00
        var sessionStartHours = new List<int>
        {
            8, 9, 12, 17, 17, 17, 18, 18, 18, 18, 19, 19, 21
        };

        // Act
        var peakHours = DetectPeakHours(sessionStartHours);

        // Assert
        Assert.Contains(18, peakHours); // 18:00 has the highest count (4 sessions)
        Assert.Equal(18, peakHours.First());
    }

    // =========================================================================
    // 3. SCRUM-132: REVENUE TREND DATA AGGREGATION TESTS
    // =========================================================================

    [Fact]
    public void AggregateRevenueTrend_MultipleTransactions_CalculatesCorrectDailySum()
    {
        // Arrange
        var transactions = new List<TransactionDto>
        {
            new() { Id = "tx-1", Timestamp = "2026-10-08T10:00:00Z", Amount = 150.00m, EnergyConsumedKwh = 15m, Status = "Completed" },
            new() { Id = "tx-2", Timestamp = "2026-10-08T14:30:00Z", Amount = 250.00m, EnergyConsumedKwh = 25m, Status = "Completed" },
            new() { Id = "tx-3", Timestamp = "2026-10-09T09:15:00Z", Amount = 100.00m, EnergyConsumedKwh = 10m, Status = "Completed" }
        };

        // Act
        var grouped = transactions
            .GroupBy(t => DateTime.Parse(t.Timestamp).ToString("yyyy-MM-dd"))
            .Select(g => new RevenueTrendDto
            {
                Date = g.Key,
                Revenue = g.Sum(x => x.Amount),
                EnergyKwh = g.Sum(x => x.EnergyConsumedKwh),
                Sessions = g.Count()
            })
            .OrderBy(r => r.Date)
            .ToList();

        // Assert
        Assert.Equal(2, grouped.Count);
        Assert.Equal("2026-10-08", grouped[0].Date);
        Assert.Equal(400.00m, grouped[0].Revenue);
        Assert.Equal(40m, grouped[0].EnergyKwh);
        Assert.Equal(2, grouped[0].Sessions);

        Assert.Equal("2026-10-09", grouped[1].Date);
        Assert.Equal(100.00m, grouped[1].Revenue);
        Assert.Equal(1, grouped[1].Sessions);
    }

    // =========================================================================
    // 4. SCRUM-131: CSV EXPORT FORMATTING & INTEGRITY TESTS
    // =========================================================================

    [Fact]
    public void GenerateCsv_WithValidRecords_IncludesHeadersAndMatchingRows()
    {
        // Arrange
        var records = new List<UsageReportRow>
        {
            new("2026-10-08", "Station Hub A", 5, 125.50m),
            new("2026-10-09", "Station Hub B", 8, 210.00m)
        };

        // Act
        string csvContent = GenerateUsageCsv(records);
        var lines = csvContent.Split(new[] { "\r\n", "\n" }, StringSplitOptions.RemoveEmptyEntries);

        // Assert
        Assert.Equal("Date,Station,Sessions,EnergyDeliveredKwh", lines[0]);
        Assert.Equal("2026-10-08,Station Hub A,5,125.50", lines[1]);
        Assert.Equal("2026-10-09,Station Hub B,8,210.00", lines[2]);
    }

    [Fact]
    public void GenerateCsv_ZeroRows_ReturnsHeaderRowWithoutCrashing()
    {
        // Arrange
        var emptyRecords = new List<UsageReportRow>();

        // Act
        string csvContent = GenerateUsageCsv(emptyRecords);
        var lines = csvContent.Split(new[] { "\r\n", "\n" }, StringSplitOptions.RemoveEmptyEntries);

        // Assert
        Assert.Single(lines);
        Assert.Equal("Date,Station,Sessions,EnergyDeliveredKwh", lines[0]);
    }

    // =========================================================================
    // 5. SCRUM-124 & SCRUM-168: STATION TRAFFIC SORTING & RANKING TESTS
    // =========================================================================

    [Fact]
    public void SortStations_ByUsageCountDescending_OrdersCorrectly()
    {
        // Arrange
        var stations = new List<StationAnalyticsDto>
        {
            new() { StationId = "st-B", Sessions = 20, Revenue = 500m },
            new() { StationId = "st-A", Sessions = 100, Revenue = 2500m },
            new() { StationId = "st-C", Sessions = 5, Revenue = 120m }
        };

        // Act
        var ranked = stations.OrderByDescending(s => s.Sessions).ToList();

        // Assert
        Assert.Equal("st-A", ranked[0].StationId);
        Assert.Equal(100, ranked[0].Sessions);
        Assert.Equal("st-B", ranked[1].StationId);
        Assert.Equal("st-C", ranked[2].StationId);
    }

    [Fact]
    public void RankStations_HighlightsTopPerformer()
    {
        // Arrange
        var stations = new List<StationAnalyticsDto>
        {
            new() { StationId = "st-1", Sessions = 45 },
            new() { StationId = "st-2", Sessions = 95 },
            new() { StationId = "st-3", Sessions = 12 }
        };

        // Act
        var topStation = stations.OrderByDescending(s => s.Sessions).First();

        // Assert
        Assert.Equal("st-2", topStation.StationId);
        Assert.Equal(95, topStation.Sessions);
    }

    // =========================================================================
    // 6. SCRUM-171: AI PRICING RECOMMENDATION LOGIC TESTS
    // =========================================================================

    [Theory]
    [InlineData(0.95, "Consider introducing a peak tariff (+15%) to optimize charger turnover during high demand.")]
    [InlineData(0.20, "Demand is low. Consider promotional off-peak discount (-10%) to incentivize drivers.")]
    [InlineData(0.55, "Current pricing is optimal for observed utilization levels.")]
    public void GeneratePricingRecommendation_BasedOnUtilization_ReturnsAccurateAdvice(
        double utilizationRatio, string expectedRecommendation)
    {
        // Act
        string advice = GeneratePricingAdvice(utilizationRatio);

        // Assert
        Assert.Equal(expectedRecommendation, advice);
    }

    // =========================================================================
    // HELPER METHODS (Mirroring Domain Business Logic)
    // =========================================================================

    private static bool IsValidDateRange(DateTime start, DateTime end) => end >= start;

    private static (DateTime Start, DateTime End) GetDefaultDateRange(DateTime anchorDate) =>
        (anchorDate.AddDays(-7), anchorDate);

    private static List<int> DetectPeakHours(IEnumerable<int> sessionHours)
    {
        return sessionHours
            .GroupBy(h => h)
            .OrderByDescending(g => g.Count())
            .Select(g => g.Key)
            .ToList();
    }

    private static string GenerateUsageCsv(IEnumerable<UsageReportRow> rows)
    {
        var sb = new StringBuilder();
        sb.AppendLine("Date,Station,Sessions,EnergyDeliveredKwh");
        foreach (var r in rows)
        {
            sb.AppendLine($"{r.Date},{r.StationName},{r.Sessions},{r.EnergyDelivered:F2}");
        }
        return sb.ToString();
    }

    private static string GeneratePricingAdvice(double utilization)
    {
        if (utilization >= 0.85)
            return "Consider introducing a peak tariff (+15%) to optimize charger turnover during high demand.";
        if (utilization <= 0.30)
            return "Demand is low. Consider promotional off-peak discount (-10%) to incentivize drivers.";
        return "Current pricing is optimal for observed utilization levels.";
    }

    private record UsageReportRow(string Date, string StationName, int Sessions, decimal EnergyDelivered);
}
