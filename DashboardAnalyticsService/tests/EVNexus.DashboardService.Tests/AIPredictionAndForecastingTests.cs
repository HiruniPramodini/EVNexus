using System;
using System.Collections.Generic;
using System.Linq;
using EVNexus.DashboardService.Data;
using EVNexus.DashboardService.DTOs;
using EVNexus.DashboardService.Services;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace EVNexus.DashboardService.Tests;

public class AIPredictionAndForecastingTests
{
    private readonly ForecastService _forecastService;

    public AIPredictionAndForecastingTests()
    {
        var mockLogger = new Mock<ILogger<ForecastService>>();
        _forecastService = new ForecastService(mockLogger.Object);
    }

    [Fact]
    public void Story12_DemandForecast_ReturnsExactly7DaysAhead()
    {
        // Arrange: Provide 14 days of realistic daily revenue data
        var historical = new List<DailyRevenueItem>();
        var baseDate = new DateTime(2026, 10, 1);
        for (int i = 0; i < 14; i++)
        {
            historical.Add(new DailyRevenueItem
            {
                Date = baseDate.AddDays(i),
                Revenue = 2000m + (i * 100m) + (i % 2 == 0 ? 50m : -50m),
                SessionCount = 10 + i,
                EnergyKwh = 150m + (i * 10m)
            });
        }

        // Act
        var predictions = _forecastService.PredictNext7Days(historical).ToList();

        // Assert
        Assert.Equal(7, predictions.Count);
        for (int i = 0; i < 7; i++)
        {
            var expectedDate = historical.Last().Date.AddDays(i + 1);
            Assert.Equal(expectedDate, predictions[i].ForecastDate);
            Assert.True(predictions[i].PredictedRevenue >= 0, "Predicted revenue should not be negative");
            Assert.True(predictions[i].PredictedSessions >= 0, "Predicted sessions should not be negative");
            Assert.True(predictions[i].PredictedEnergyKwh >= 0, "Predicted energy should not be negative");
        }
    }

    [Fact]
    public void Story12_DemandForecast_HandlesEmptyHistory_WithoutCrashing()
    {
        // Arrange: Empty historical dataset
        var emptyHistory = new List<DailyRevenueItem>();

        // Act
        var predictions = _forecastService.PredictNext7Days(emptyHistory).ToList();

        // Assert
        Assert.Equal(7, predictions.Count);
        Assert.All(predictions, p =>
        {
            Assert.Equal(0m, p.PredictedRevenue);
            Assert.Equal(0, p.PredictedSessions);
            Assert.Equal(0m, p.PredictedEnergyKwh);
        });
    }

    [Fact]
    public void Story12_DemandForecast_HandlesSparseHistory_WithMovingAverageFallback()
    {
        // Arrange: Only 3 days of historical data (< 7 required by SSA)
        var sparseHistory = new List<DailyRevenueItem>
        {
            new DailyRevenueItem { Date = new DateTime(2026, 10, 1), Revenue = 3000m, SessionCount = 10, EnergyKwh = 200m },
            new DailyRevenueItem { Date = new DateTime(2026, 10, 2), Revenue = 4000m, SessionCount = 12, EnergyKwh = 250m },
            new DailyRevenueItem { Date = new DateTime(2026, 10, 3), Revenue = 5000m, SessionCount = 14, EnergyKwh = 300m }
        };

        // Act
        var predictions = _forecastService.PredictNext7Days(sparseHistory).ToList();

        // Assert
        Assert.Equal(7, predictions.Count);
        // Average revenue = (3000 + 4000 + 5000) / 3 = 4000
        Assert.All(predictions, p =>
        {
            Assert.Equal(4000m, p.PredictedRevenue);
            Assert.Equal(12, p.PredictedSessions);
            Assert.Equal(250m, p.PredictedEnergyKwh);
        });
    }

    [Fact]
    public void Stories11And13_PeakHourPrediction_IdentifiesBusiestHours_WithConfidence()
    {
        // Arrange: 24 hours with prominent evening peak (hours 17, 18, 19)
        var hourly = new List<HourlyTrafficDto>();
        for (int h = 0; h < 24; h++)
        {
            int sessions = (h >= 17 && h <= 19) ? 35 : 5;
            hourly.Add(new HourlyTrafficDto
            {
                Hour = h,
                SessionCount = sessions,
                EnergyDeliveredKwh = sessions * 20m
            });
        }

        // Act
        var result = _forecastService.PredictPeakHours("st-1", "Lotus Tower Supercharger", hourly);

        // Assert
        Assert.True(result.HasSufficientHistory);
        Assert.True(result.ConfidenceScore > 0.5f, "Confidence should reflect prominent peak");
        Assert.Contains(17, result.PredictedPeakHours);
        Assert.Contains(18, result.PredictedPeakHours);
        Assert.Contains(19, result.PredictedPeakHours);
        Assert.Contains("Predicted peak window", result.PeakWindowDescription);
    }

    [Fact]
    public void Stories11And13_PeakHourPrediction_SparseHistory_FallsBackToBaseline()
    {
        // Arrange: Very low session volume (< 5 total sessions)
        var hourly = new List<HourlyTrafficDto>
        {
            new HourlyTrafficDto { Hour = 10, SessionCount = 1, EnergyDeliveredKwh = 15m },
            new HourlyTrafficDto { Hour = 14, SessionCount = 1, EnergyDeliveredKwh = 20m }
        };

        // Act
        var result = _forecastService.PredictPeakHours("st-sparse", "Rural Station", hourly);

        // Assert
        Assert.False(result.HasSufficientHistory);
        Assert.NotEmpty(result.PredictedPeakHours);
        Assert.Contains("accumulating more data", result.PeakWindowDescription);
        Assert.Equal(0.40f, result.ConfidenceScore);
    }

    [Fact]
    public void Story16_PricingRecommendations_GeneratesOptimization_ForHighUtilization()
    {
        // Arrange: High traffic station (usage >= 20)
        var traffic = new List<StationTrafficDto>
        {
            new StationTrafficDto { StationId = "st-busy", StationName = "Express Station", UsageCount = 45 }
        };
        var pricing = new List<StationPricingDto>
        {
            new StationPricingDto { StationId = "st-busy", StationName = "Express Station", StandardPricePerKwh = 50m }
        };

        // Act
        var recs = _forecastService.GeneratePricingRecommendations(traffic, pricing).ToList();

        // Assert
        Assert.Single(recs);
        var rec = recs.First();
        Assert.Equal("Peak-Hour Tariff Optimization", rec.RecommendationType);
        Assert.NotNull(rec.SuggestedPeakPrice);
        Assert.True(rec.SuggestedPeakPrice > rec.CurrentStandardPrice, "Suggested peak price should exceed standard price");
        Assert.Contains("+12% to +18%", rec.ExpectedImpact);
    }

    [Fact]
    public void Story16_PricingRecommendations_GeneratesPromotion_ForLowUtilization()
    {
        // Arrange: Low traffic station (usage < 5)
        var traffic = new List<StationTrafficDto>
        {
            new StationTrafficDto { StationId = "st-quiet", StationName = "Suburban Station", UsageCount = 2 }
        };
        var pricing = new List<StationPricingDto>
        {
            new StationPricingDto { StationId = "st-quiet", StationName = "Suburban Station", StandardPricePerKwh = 50m }
        };

        // Act
        var recs = _forecastService.GeneratePricingRecommendations(traffic, pricing).ToList();

        // Assert
        Assert.Single(recs);
        var rec = recs.First();
        Assert.Equal("Off-Peak Promotional Incentive", rec.RecommendationType);
        Assert.NotNull(rec.SuggestedOffPeakPrice);
        Assert.True(rec.SuggestedOffPeakPrice < rec.CurrentStandardPrice, "Off-peak price should offer a discount");
    }
}
