using System;
using System.Collections.Generic;
using System.Linq;
using EVNexus.DashboardService.Data;
using EVNexus.DashboardService.DTOs;
using Microsoft.Extensions.Logging;
using Microsoft.ML;
using Microsoft.ML.Transforms.TimeSeries;

namespace EVNexus.DashboardService.Services;

public class SsaTimeSeriesInput
{
    public float Amount { get; set; }
}

public class SsaTimeSeriesPrediction
{
    public float[] ForecastedAmounts { get; set; } = Array.Empty<float>();
    public float[] LowerBound { get; set; } = Array.Empty<float>();
    public float[] UpperBound { get; set; } = Array.Empty<float>();
}

public class ForecastService : IForecastService
{
    private readonly ILogger<ForecastService> _logger;

    public ForecastService(ILogger<ForecastService> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Story 12: Predicts expected demand/revenue for the next 7 days using ML.NET Singular Spectrum Analysis (SSA)
    /// with robust moving-average fallback when history is sparse.
    /// </summary>
    public IEnumerable<DemandForecastDto> PredictNext7Days(IEnumerable<DailyRevenueItem> historicalData)
    {
        var dataList = historicalData.OrderBy(d => d.Date).ToList();
        var lastDate = dataList.Count > 0 ? dataList.Last().Date : DateTime.UtcNow.Date;

        // Baseline fallback for empty data
        if (dataList.Count == 0)
        {
            _logger.LogInformation("No historical data available. Returning 0 forecast baseline.");
            return GenerateBaseline(lastDate, 0m, 0, 0m);
        }

        // Baseline fallback for insufficient history (< 7 items)
        if (dataList.Count < 7)
        {
            var avgRevenue = dataList.Average(d => d.Revenue);
            var avgSessions = (int)Math.Round(dataList.Average(d => d.SessionCount));
            var avgEnergy = dataList.Average(d => d.EnergyKwh);
            _logger.LogInformation("Insufficient history for ML.NET SSA. Returning moving average baseline.");
            return GenerateBaseline(lastDate, avgRevenue, avgSessions, avgEnergy);
        }

        try
        {
            var mlContext = new MLContext(seed: 42);
            var inputs = dataList.Select(d => new SsaTimeSeriesInput { Amount = (float)d.Revenue }).ToList();
            var dataView = mlContext.Data.LoadFromEnumerable(inputs);

            var windowSize = Math.Min(dataList.Count / 2, 7);
            if (windowSize < 2) windowSize = 2;
            var seriesLength = dataList.Count;

            var forecastingPipeline = mlContext.Forecasting.ForecastBySsa(
                outputColumnName: nameof(SsaTimeSeriesPrediction.ForecastedAmounts),
                inputColumnName: nameof(SsaTimeSeriesInput.Amount),
                windowSize: windowSize,
                seriesLength: seriesLength,
                trainSize: seriesLength,
                horizon: 7,
                confidenceLevel: 0.95f,
                confidenceLowerBoundColumn: nameof(SsaTimeSeriesPrediction.LowerBound),
                confidenceUpperBoundColumn: nameof(SsaTimeSeriesPrediction.UpperBound));

            var model = forecastingPipeline.Fit(dataView);
            var forecastEngine = model.CreateTimeSeriesEngine<SsaTimeSeriesInput, SsaTimeSeriesPrediction>(mlContext);
            var prediction = forecastEngine.Predict();

            var avgRevenuePerSession = dataList.Where(d => d.SessionCount > 0).Select(d => d.Revenue / d.SessionCount).DefaultIfEmpty(20m).Average();
            var avgEnergyPerSession = dataList.Where(d => d.SessionCount > 0).Select(d => d.EnergyKwh / d.SessionCount).DefaultIfEmpty(15m).Average();

            var results = new List<DemandForecastDto>();
            for (int i = 0; i < 7; i++)
            {
                var forecastedRev = (decimal)prediction.ForecastedAmounts[i];
                var lower = (decimal)prediction.LowerBound[i];
                var upper = (decimal)prediction.UpperBound[i];

                if (forecastedRev < 0) forecastedRev = 0m;
                if (lower < 0) lower = 0m;
                if (upper < forecastedRev) upper = forecastedRev * 1.2m;

                var estSessions = avgRevenuePerSession > 0 ? (int)Math.Round(forecastedRev / avgRevenuePerSession) : 0;
                var estEnergy = estSessions * avgEnergyPerSession;

                results.Add(new DemandForecastDto
                {
                    ForecastDate = lastDate.AddDays(i + 1),
                    PredictedRevenue = Math.Round(forecastedRev, 2),
                    PredictedSessions = estSessions,
                    PredictedEnergyKwh = Math.Round(estEnergy, 2),
                    LowerBound = Math.Round(lower, 2),
                    UpperBound = Math.Round(upper, 2)
                });
            }

            return results;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ML.NET forecasting encountered an error. Falling back to moving average.");
            var avgRevenue = dataList.Average(d => d.Revenue);
            var avgSessions = (int)Math.Round(dataList.Average(d => d.SessionCount));
            var avgEnergy = dataList.Average(d => d.EnergyKwh);
            return GenerateBaseline(lastDate, avgRevenue, avgSessions, avgEnergy);
        }
    }

    /// <summary>
    /// Stories 11 & 13: Analyzes historical hourly charging distributions to predict peak hours for a station.
    /// </summary>
    public PeakHourPredictionDto PredictPeakHours(string stationId, string stationName, IEnumerable<HourlyTrafficDto> hourlyTraffic)
    {
        var list = hourlyTraffic.ToList();
        var totalSessions = list.Sum(h => h.SessionCount);

        if (totalSessions < 5)
        {
            // Sparse history fallback
            return new PeakHourPredictionDto
            {
                StationId = stationId,
                StationName = stationName,
                PredictedPeakHours = new List<int> { 17, 18, 19 }, // Default evening rush hours
                PeakWindowDescription = "Estimated 5:00 PM - 8:00 PM (Default baseline, accumulating more data)",
                ConfidenceScore = 0.40f,
                HourlyDistribution = list,
                HasSufficientHistory = false
            };
        }

        // Rank hours by session count and find top cluster
        var topHours = list.OrderByDescending(h => h.SessionCount).Take(3).Select(h => h.Hour).OrderBy(h => h).ToList();
        
        string windowDesc;
        if (topHours.Count == 1)
        {
            windowDesc = $"{topHours[0]:D2}:00 - {(topHours[0] + 1) % 24:D2}:00";
        }
        else
        {
            windowDesc = string.Join(", ", topHours.Select(h => $"{h:D2}:00-{(h + 1) % 24:D2}:00"));
        }

        var topSessionSum = list.Where(h => topHours.Contains(h.Hour)).Sum(h => h.SessionCount);
        float confidence = Math.Min(0.95f, (float)topSessionSum / totalSessions * 1.5f);

        return new PeakHourPredictionDto
        {
            StationId = stationId,
            StationName = stationName,
            PredictedPeakHours = topHours,
            PeakWindowDescription = $"Predicted peak window: {windowDesc}",
            ConfidenceScore = (float)Math.Round(confidence, 2),
            HourlyDistribution = list,
            HasSufficientHistory = true
        };
    }

    /// <summary>
    /// Story 16: Generates AI-assisted pricing and demand insight recommendations per station.
    /// </summary>
    public IEnumerable<PricingRecommendationDto> GeneratePricingRecommendations(IEnumerable<StationTrafficDto> stationTraffic, IEnumerable<StationPricingDto> pricing)
    {
        var recommendations = new List<PricingRecommendationDto>();
        var priceDict = pricing.ToDictionary(p => p.StationId, p => p);

        foreach (var station in stationTraffic)
        {
            priceDict.TryGetValue(station.StationId, out var priceInfo);
            var stdPrice = priceInfo?.StandardPricePerKwh ?? 45.0m; // Default standard tariff if unconfigured

            if (station.UsageCount >= 20)
            {
                // High utilization station -> Recommend introducing or increasing peak tariff to maximize yield
                recommendations.Add(new PricingRecommendationDto
                {
                    StationId = station.StationId,
                    StationName = station.StationName,
                    RecommendationType = "Peak-Hour Tariff Optimization",
                    RecommendationText = $"High utilization detected ({station.UsageCount} sessions). Consider setting peak tariff at {stdPrice * 1.20m:F2} LKR/kWh between 5:00 PM - 9:00 PM.",
                    CurrentStandardPrice = stdPrice,
                    SuggestedPeakPrice = Math.Round(stdPrice * 1.20m, 2),
                    SuggestedOffPeakPrice = Math.Round(stdPrice * 0.90m, 2),
                    Rationale = "Heavy station demand during evening peaks indicates strong price elasticity tolerance.",
                    ExpectedImpact = "+12% to +18% revenue lift during peak hours without reducing throughput."
                });
            }
            else if (station.UsageCount < 5)
            {
                // Low utilization station -> Recommend off-peak discount to incentivize drivers
                recommendations.Add(new PricingRecommendationDto
                {
                    StationId = station.StationId,
                    StationName = station.StationName,
                    RecommendationType = "Off-Peak Promotional Incentive",
                    RecommendationText = $"Low traffic observed ({station.UsageCount} sessions). Introduce an off-peak discount tariff of {stdPrice * 0.85m:F2} LKR/kWh.",
                    CurrentStandardPrice = stdPrice,
                    SuggestedPeakPrice = stdPrice,
                    SuggestedOffPeakPrice = Math.Round(stdPrice * 0.85m, 2),
                    Rationale = "Underutilized infrastructure can be activated by offering promotional rates during midday hours.",
                    ExpectedImpact = "+25% increase in session volume and higher asset utilization."
                });
            }
            else
            {
                // Balanced utilization
                recommendations.Add(new PricingRecommendationDto
                {
                    StationId = station.StationId,
                    StationName = station.StationName,
                    RecommendationType = "Time-of-Use Rate Stabilization",
                    RecommendationText = "Optimal balanced charging patterns detected. Maintain current standard pricing with slight off-peak night discounts.",
                    CurrentStandardPrice = stdPrice,
                    SuggestedPeakPrice = Math.Round(stdPrice * 1.10m, 2),
                    SuggestedOffPeakPrice = Math.Round(stdPrice * 0.95m, 2),
                    Rationale = "Consistent utilization throughout the week suggests steady driver retention.",
                    ExpectedImpact = "Stable gross margin and consistent network load distribution."
                });
            }
        }

        return recommendations;
    }

    private IEnumerable<DemandForecastDto> GenerateBaseline(DateTime startDate, decimal revenue, int sessions, decimal energy)
    {
        if (revenue < 0) revenue = 0m;
        if (sessions < 0) sessions = 0;
        if (energy < 0) energy = 0m;

        var list = new List<DemandForecastDto>();
        for (int i = 1; i <= 7; i++)
        {
            list.Add(new DemandForecastDto
            {
                ForecastDate = startDate.AddDays(i),
                PredictedRevenue = Math.Round(revenue, 2),
                PredictedSessions = sessions,
                PredictedEnergyKwh = Math.Round(energy, 2),
                LowerBound = Math.Round(revenue * 0.8m, 2),
                UpperBound = Math.Round(revenue * 1.2m, 2)
            });
        }
        return list;
    }
}
