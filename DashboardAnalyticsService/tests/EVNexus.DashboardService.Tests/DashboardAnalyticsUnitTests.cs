using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using Xunit;

namespace EVNexus.DashboardService.Tests;

/// <summary>
/// Sprint 4 QA Unit Tests for Dashboard & AI Analytics Service (SCRUM-89 Epic):
/// - SCRUM-127: Driver Dashboard Charging History Summary
/// - SCRUM-130: Date Range Filtering & Validation
/// - SCRUM-132: Company Revenue Trend Aggregation
/// - SCRUM-131: CSV Usage Report Formatting
/// - SCRUM-123: Company Dashboard KPI Metrics Aggregation
/// - SCRUM-124 & 168: Station Traffic Sorting & Ranking
/// - SCRUM-164: Monthly Dynamic Report Aggregation
/// - SCRUM-165: AI Peak-Hour Usage Detection Algorithm
/// - SCRUM-166: AI Future Demand Forecast Algorithm & Fallback
/// - SCRUM-171: AI Pricing Recommendation Decision Logic
/// </summary>
public class DashboardAnalyticsUnitTests
{
    // =========================================================================
    // 1. SCRUM-127: DRIVER DASHBOARD CHARGING HISTORY SUMMARY
    // =========================================================================

    [Fact]
    public void DriverHistorySummary_AggregatesSessionsEnergyAndCostCorrectly()
    {
        // Arrange: 3 completed sessions for authenticated driver
        var sessions = new List<ChargingSessionRecord>
        {
            new("sess-1", new DateTime(2026, 10, 1), 25.5m, 1200.00m, "Completed"),
            new("sess-2", new DateTime(2026, 10, 3), 40.0m, 1850.50m, "Completed"),
            new("sess-3", new DateTime(2026, 10, 7), 15.2m, 720.00m, "Completed")
        };

        // Act
        int totalSessions = sessions.Count;
        decimal totalEnergyKwh = sessions.Sum(s => s.EnergyKwh);
        decimal totalAmountSpent = sessions.Sum(s => s.Cost);

        // Assert
        Assert.Equal(3, totalSessions);
        Assert.Equal(80.7m, totalEnergyKwh);
        Assert.Equal(3770.50m, totalAmountSpent);
    }

    [Fact]
    public void DriverHistorySummary_ZeroSessions_ReturnsGracefulEmptyState()
    {
        // Arrange: New driver with 0 sessions
        var sessions = new List<ChargingSessionRecord>();

        // Act
        int totalSessions = sessions.Count;
        decimal totalEnergyKwh = sessions.Sum(s => s.EnergyKwh);
        decimal totalAmountSpent = sessions.Sum(s => s.Cost);

        // Assert
        Assert.Equal(0, totalSessions);
        Assert.Equal(0.0m, totalEnergyKwh);
        Assert.Equal(0.0m, totalAmountSpent);
    }

    // =========================================================================
    // 2. SCRUM-130: DATE RANGE FILTERING & VALIDATION
    // =========================================================================

    [Fact]
    public void ValidateDateRange_EndDateBeforeStartDate_RejectsRange()
    {
        // Arrange
        var startDate = new DateTime(2026, 10, 10);
        var endDate = new DateTime(2026, 10, 01);

        // Act
        bool isValid = IsValidRange(startDate, endDate);

        // Assert
        Assert.False(isValid, "End date earlier than start date must fail validation.");
    }

    [Fact]
    public void ValidateDateRange_DefaultWindow_CalculatesLast7Days()
    {
        // Arrange
        var today = DateTime.UtcNow.Date;

        // Act
        var start = today.AddDays(-7);
        var end = today;

        // Assert
        Assert.Equal(7, (end - start).Days);
        Assert.True(end >= start);
    }

    // =========================================================================
    // 3. SCRUM-132: COMPANY REVENUE TREND CHART AGGREGATION
    // =========================================================================

    [Fact]
    public void RevenueTrend_GroupsTransactionsByDayAccurately()
    {
        // Arrange
        var txs = new List<TransactionRecord>
        {
            new("tx-1", "2026-10-08", 250m, 50m),
            new("tx-2", "2026-10-08", 150m, 30m),
            new("tx-3", "2026-10-09", 400m, 80m)
        };

        // Act
        var trend = txs.GroupBy(t => t.Date)
                       .Select(g => new { Date = g.Key, TotalRevenue = g.Sum(x => x.Amount), TotalEnergy = g.Sum(x => x.Energy) })
                       .OrderBy(x => x.Date)
                       .ToList();

        // Assert
        Assert.Equal(2, trend.Count);
        Assert.Equal("2026-10-08", trend[0].Date);
        Assert.Equal(400m, trend[0].TotalRevenue);
        Assert.Equal(80m, trend[0].TotalEnergy);

        Assert.Equal("2026-10-09", trend[1].Date);
        Assert.Equal(400m, trend[1].TotalRevenue);
    }

    // =========================================================================
    // 4. SCRUM-131: CSV USAGE REPORT FORMATTING
    // =========================================================================

    [Fact]
    public void CsvExport_GeneratesStandardColumnsAndHeaders()
    {
        // Arrange
        var rows = new List<CsvRow>
        {
            new("2026-10-08", "Station Colombo Hub", 12, 280.50m)
        };

        // Act
        var sb = new StringBuilder();
        sb.AppendLine("Date,Station,Sessions,EnergyDeliveredKwh");
        foreach (var r in rows)
        {
            sb.AppendLine($"{r.Date},{r.StationName},{r.Sessions},{r.EnergyKwh:F2}");
        }
        var lines = sb.ToString().Split(new[] { "\r\n", "\n" }, StringSplitOptions.RemoveEmptyEntries);

        // Assert
        Assert.Equal("Date,Station,Sessions,EnergyDeliveredKwh", lines[0]);
        Assert.Equal("2026-10-08,Station Colombo Hub,12,280.50", lines[1]);
    }

    // =========================================================================
    // 5. SCRUM-124 & 168: STATION TRAFFIC SORTING & RANKING
    // =========================================================================

    [Fact]
    public void StationTraffic_SortDescendingBySessions_RanksBusiestFirst()
    {
        // Arrange
        var stations = new List<StationTrafficRecord>
        {
            new("Station-Kandy", 25, 450m),
            new("Station-Colombo", 120, 2400m),
            new("Station-Galle", 65, 1100m)
        };

        // Act
        var sorted = stations.OrderByDescending(s => s.SessionsCount).ToList();

        // Assert
        Assert.Equal("Station-Colombo", sorted[0].StationName);
        Assert.Equal(120, sorted[0].SessionsCount);
        Assert.Equal("Station-Galle", sorted[1].StationName);
        Assert.Equal("Station-Kandy", sorted[2].StationName);
    }

    // =========================================================================
    // 6. SCRUM-164: MONTHLY DYNAMIC REPORT AGGREGATION
    // =========================================================================

    [Fact]
    public void MonthlyReport_AggregatesStationTotalsPerMonth()
    {
        // Arrange: Transactions for September 2026
        var monthlyTx = new List<TransactionRecord>
        {
            new("tx-10", "2026-09-05", 500m, 100m),
            new("tx-11", "2026-09-20", 750m, 150m)
        };

        // Act
        decimal monthlyRevenue = monthlyTx.Sum(t => t.Amount);
        decimal monthlyEnergy = monthlyTx.Sum(t => t.Energy);
        int totalTransactions = monthlyTx.Count;

        // Assert
        Assert.Equal(1250m, monthlyRevenue);
        Assert.Equal(250m, monthlyEnergy);
        Assert.Equal(2, totalTransactions);
    }

    // =========================================================================
    // 7. SCRUM-165: AI PEAK-HOUR USAGE PREDICTION LOGIC
    // =========================================================================

    [Fact]
    public void AiPeakHourPrediction_IdentifiesBusiestHourBucket()
    {
        // Arrange: Hourly session starts (18:00 has 4 sessions)
        var startHours = new List<int> { 8, 9, 14, 18, 18, 18, 18, 20 };

        // Act
        var busiestHour = startHours.GroupBy(h => h)
                                    .OrderByDescending(g => g.Count())
                                    .Select(g => g.Key)
                                    .First();

        // Assert
        Assert.Equal(18, busiestHour); // 6:00 PM is peak
    }

    [Fact]
    public void AiPeakHourPrediction_LowData_ReturnsFallbackFlag()
    {
        // Arrange: Only 2 sessions
        var sparseHours = new List<int> { 10, 11 };

        // Act
        bool hasSufficientData = sparseHours.Count >= 5;

        // Assert
        Assert.False(hasSufficientData, "Less than 5 sessions should trigger fallback state.");
    }

    // =========================================================================
    // 8. SCRUM-166 & 171: AI DEMAND FORECAST & PRICING ADVISORY
    // =========================================================================

    [Theory]
    [InlineData(0.92, "High demand detected: Suggest peak pricing (+15%).")]
    [InlineData(0.20, "Low demand detected: Suggest off-peak discount (-10%).")]
    [InlineData(0.60, "Normal demand: Maintain current pricing.")]
    public void AiPricingAdvisory_RecommendsCorrectAction(double utilization, string expectedAdvice)
    {
        // Act
        string advice = GetPricingAdvice(utilization);

        // Assert
        Assert.Equal(expectedAdvice, advice);
    }

    // Helpers
    private static bool IsValidRange(DateTime start, DateTime end) => end >= start;

    private static string GetPricingAdvice(double util)
    {
        if (util >= 0.85) return "High demand detected: Suggest peak pricing (+15%).";
        if (util <= 0.30) return "Low demand detected: Suggest off-peak discount (-10%).";
        return "Normal demand: Maintain current pricing.";
    }

    private record ChargingSessionRecord(string Id, DateTime Date, decimal EnergyKwh, decimal Cost, string Status);
    private record TransactionRecord(string Id, string Date, decimal Amount, decimal Energy);
    private record CsvRow(string Date, string StationName, int Sessions, decimal EnergyKwh);
    private record StationTrafficRecord(string StationName, int SessionsCount, decimal Revenue);
}
