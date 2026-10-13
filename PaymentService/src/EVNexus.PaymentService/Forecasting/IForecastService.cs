using System.Collections.Generic;

namespace EVNexus.PaymentService.Forecasting;

public interface IForecastService
{
    /// <summary>
    /// Predicts exactly 7 future daily revenue points based on the provided historical dataset.
    /// This service is independent of HTTP/DB and respects tenant isolation by only receiving pre-filtered historical data.
    /// </summary>
    /// <param name="historicalData">The historical daily revenue data for a specific company.</param>
    /// <returns>A collection of exactly 7 future dates and predicted revenues.</returns>
    IEnumerable<RevenueForecast> PredictNext7Days(IEnumerable<RevenueData> historicalData);
}
