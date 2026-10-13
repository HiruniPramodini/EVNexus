using System;
using Microsoft.ML.Data;

namespace EVNexus.PaymentService.Forecasting;

/// <summary>
/// Represents a single historical daily revenue observation used to train the ML.NET model.
/// </summary>
public class RevenueData
{
    [LoadColumn(0)]
    public DateTime Date { get; set; }
    
    [LoadColumn(1)]
    public float Amount { get; set; }
}
