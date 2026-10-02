using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.Extensions.Logging;
using Microsoft.ML;
using Microsoft.ML.Transforms.TimeSeries;

namespace EVNexus.PaymentService.Forecasting;

/// <summary>
/// Implements 7-day revenue forecasting using ML.NET Singular Spectrum Analysis (SSA).
/// This service is independent of the database and web controllers. Tenant isolation must be enforced 
/// by the caller before passing historicalData.
/// </summary>
public class ForecastService : IForecastService
{
    private readonly ILogger<ForecastService> _logger;

    public ForecastService(ILogger<ForecastService> logger)
    {
        _logger = logger;
    }

    public IEnumerable<RevenueForecast> PredictNext7Days(IEnumerable<RevenueData> historicalData)
    {
        var dataList = historicalData.OrderBy(d => d.Date).ToList();

        // Fallback: If no history exists, we cannot forecast. Return 0 for the next 7 days.
        if (dataList.Count == 0)
        {
            _logger.LogWarning("Insufficient historical data (0 items) for forecasting. Returning 0 revenue forecast.");
            return GenerateBaseline(DateTime.UtcNow.Date, 0);
        }

        // Fallback: SSA requires a reasonable window size. If we have less than 7 days, 
        // we cannot perform meaningful seasonality detection. Use a simple average baseline.
        if (dataList.Count < 7)
        {
            var average = dataList.Average(d => d.Amount);
            _logger.LogWarning($"Insufficient historical data ({dataList.Count} items) for SSA. Returning baseline average: {average}.");
            return GenerateBaseline(dataList.Last().Date, (decimal)average);
        }

        try
        {
            var mlContext = new MLContext();
            var dataView = mlContext.Data.LoadFromEnumerable(dataList);

            var windowSize = Math.Min(dataList.Count / 2, 7); // SSA requires windowSize <= seriesLength / 2 typically
            if (windowSize < 2) windowSize = 2; // Hard requirement for SSA
            var seriesLength = dataList.Count;

            var forecastingPipeline = mlContext.Forecasting.ForecastBySsa(
                outputColumnName: nameof(SsaRevenueForecast.ForecastedAmounts),
                inputColumnName: nameof(RevenueData.Amount),
                windowSize: windowSize,
                seriesLength: seriesLength,
                trainSize: seriesLength,
                horizon: 7,
                confidenceLevel: 0.95f,
                confidenceLowerBoundColumn: "LowerBound",
                confidenceUpperBoundColumn: "UpperBound");

            var model = forecastingPipeline.Fit(dataView);
            var forecastEngine = model.CreateTimeSeriesEngine<RevenueData, SsaRevenueForecast>(mlContext);
            var prediction = forecastEngine.Predict();

            var results = new List<RevenueForecast>();
            var lastDate = dataList.Last().Date;

            for (int i = 0; i < 7; i++)
            {
                var predAmount = (decimal)prediction.ForecastedAmounts[i];
                
                // Requirement: Prevent negative revenue predictions
                if (predAmount < 0) predAmount = 0;

                results.Add(new RevenueForecast
                {
                    Date = lastDate.AddDays(i + 1),
                    PredictedRevenue = Math.Round(predAmount, 2)
                });
            }

            return results;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ML.NET SSA Forecasting failed. Falling back to simple average.");
            var average = dataList.Average(d => d.Amount);
            return GenerateBaseline(dataList.Last().Date, (decimal)average);
        }
    }

    private IEnumerable<RevenueForecast> GenerateBaseline(DateTime startDate, decimal baselineAmount)
    {
        if (baselineAmount < 0) baselineAmount = 0;
        var results = new List<RevenueForecast>();
        for (int i = 1; i <= 7; i++)
        {
            results.Add(new RevenueForecast
            {
                Date = startDate.AddDays(i),
                PredictedRevenue = Math.Round(baselineAmount, 2)
            });
        }
        return results;
    }
}
