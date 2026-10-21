using System;
using System.Collections.Generic;

namespace EVNexus.DashboardService.DTOs;

/// Story 1: Driver Dashboard Charging History Summary
public class DriverSummaryDto
{
    public string DriverId { get; set; } = string.Empty;
    public int TotalCompletedSessions { get; set; }
    public decimal TotalEnergyConsumedKwh { get; set; }
    public decimal TotalAmountSpent { get; set; }
    public string Currency { get; set; } = "LKR";
    public DateTime LastSessionDate { get; set; }
}

/// Story 3: Revenue Trend Chart Point
public class RevenueTrendPointDto
{
    public string Date { get; set; } = string.Empty;
    public decimal Revenue { get; set; }
    public int SessionCount { get; set; }
}

/// Story 4: Company Dashboard Home Overview
public class CompanyOverviewDto
{
    public string CompanyId { get; set; } = string.Empty;
    public int TotalStations { get; set; }
    public int ActiveSessionsCount { get; set; }
    public int TotalCompletedSessions { get; set; }
    public decimal TotalRevenue { get; set; }
    public decimal TotalEnergyDeliveredKwh { get; set; }
    public decimal TodayRevenue { get; set; }
    public decimal MonthlyRevenue { get; set; }
    public string Currency { get; set; } = "LKR";
}

/// Story 6: Charging Point Traffic Table
public class StationTrafficDto
{
    public string StationId { get; set; } = string.Empty;
    public string StationName { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public int UsageCount { get; set; }
    public decimal TotalEnergyDeliveredKwh { get; set; }
    public decimal TotalRevenue { get; set; }
}

/// Story 7: Charging Point Price List Table
public class StationPricingDto
{
    public string StationId { get; set; } = string.Empty;
    public string StationName { get; set; } = string.Empty;
    public string ConnectorType { get; set; } = string.Empty;
    public decimal StandardPricePerKwh { get; set; }
    public decimal? PeakPricePerKwh { get; set; }
    public decimal? OffPeakPricePerKwh { get; set; }
    public TimeSpan? PeakStartTime { get; set; }
    public TimeSpan? PeakEndTime { get; set; }
    public bool HasTimeOfUsePricing => PeakPricePerKwh.HasValue && OffPeakPricePerKwh.HasValue;
}

/// Story 8: Charging Point Location Table
public class StationLocationDto
{
    public string StationId { get; set; } = string.Empty;
    public string StationName { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public decimal Latitude { get; set; }
    public decimal Longitude { get; set; }
    public string ConnectorType { get; set; } = string.Empty;
    public decimal CapacityKw { get; set; }
    public string Status { get; set; } = "Active";
    public string DetailUrl => $"/company/stations/{StationId}";
}

/// Story 9: Basic Daily Usage Report
public class DailyUsagePointDto
{
    public string Date { get; set; } = string.Empty;
    public int SessionCount { get; set; }
    public decimal EnergyDeliveredKwh { get; set; }
    public decimal Revenue { get; set; }
}

/// Story 10: Monthly Dynamic Report Generation
public class MonthlyReportDto
{
    public int Month { get; set; }
    public int Year { get; set; }
    public string MonthName { get; set; } = string.Empty;
    public int TotalSessions { get; set; }
    public decimal TotalEnergyDeliveredKwh { get; set; }
    public decimal TotalRevenue { get; set; }
    public List<StationTrafficDto> StationBreakdowns { get; set; } = new();
}

/// Story 11 & 13: AI Peak-Hour Prediction per Station
public class PeakHourPredictionDto
{
    public string StationId { get; set; } = string.Empty;
    public string StationName { get; set; } = string.Empty;
    public List<int> PredictedPeakHours { get; set; } = new(); // e.g. [17, 18, 19] (5 PM - 8 PM)
    public string PeakWindowDescription { get; set; } = string.Empty;
    public float ConfidenceScore { get; set; }
    public List<HourlyTrafficDto> HourlyDistribution { get; set; } = new();
    public bool HasSufficientHistory { get; set; }
}

/// Story 12: AI Future Demand Forecast Analytics
public class DemandForecastDto
{
    public DateTime ForecastDate { get; set; }
    public decimal PredictedRevenue { get; set; }
    public int PredictedSessions { get; set; }
    public decimal PredictedEnergyKwh { get; set; }
    public decimal LowerBound { get; set; }
    public decimal UpperBound { get; set; }
}

/// Story 14: Highest Traffic Station Ranking
public class StationRankingDto
{
    public int Rank { get; set; }
    public string StationId { get; set; } = string.Empty;
    public string StationName { get; set; } = string.Empty;
    public int SessionCount { get; set; }
    public decimal EnergyDeliveredKwh { get; set; }
    public decimal TotalRevenue { get; set; }
    public bool IsTopStation { get; set; }
}

/// Story 15: Busiest Time-of-Day Analytics (0-23 hours)
public class HourlyTrafficDto
{
    public int Hour { get; set; } // 0 to 23
    public string HourLabel => $"{Hour:D2}:00";
    public int SessionCount { get; set; }
    public decimal EnergyDeliveredKwh { get; set; }
    public double PercentageOfTotal { get; set; }
    public bool IsBusiestHour { get; set; }
}

/// Story 16: AI Pricing Recommendation Insight
public class PricingRecommendationDto
{
    public string StationId { get; set; } = string.Empty;
    public string StationName { get; set; } = string.Empty;
    public string RecommendationType { get; set; } = string.Empty; // e.g., "Peak Tariff Increase", "Off-Peak Discount"
    public string RecommendationText { get; set; } = string.Empty;
    public decimal CurrentStandardPrice { get; set; }
    public decimal? SuggestedPeakPrice { get; set; }
    public decimal? SuggestedOffPeakPrice { get; set; }
    public string Rationale { get; set; } = string.Empty;
    public string ExpectedImpact { get; set; } = string.Empty;
    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;
}
