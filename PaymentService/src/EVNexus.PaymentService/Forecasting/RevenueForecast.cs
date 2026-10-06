using System;

namespace EVNexus.PaymentService.Forecasting;

/// <summary>
/// Represents a single future revenue prediction.
/// </summary>
public class RevenueForecast
{
    public DateTime Date { get; set; }
    public decimal PredictedRevenue { get; set; }
}

/// <summary>
/// Internal class used to map the raw float array output from the ML.NET SSA engine.
/// </summary>
internal class SsaRevenueForecast
{
    public float[] ForecastedAmounts { get; set; } = Array.Empty<float>();
}
