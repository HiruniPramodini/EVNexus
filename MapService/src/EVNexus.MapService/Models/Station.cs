using System;

namespace EVNexus.MapService.Models;

public class Station
{
    public string Id { get; set; } = string.Empty;
    public string TenantId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public decimal Latitude { get; set; }
    public decimal Longitude { get; set; }
    public string ConnectorType { get; set; } = string.Empty;
    public decimal CapacityKw { get; set; }
    public decimal PricePerKwh { get; set; }
    public bool IsActive { get; set; } = true;
    public string ChargingCode { get; set; } = string.Empty;
    public decimal? PeakPricePerKwh { get; set; }
    public decimal? OffPeakPricePerKwh { get; set; }
    public TimeSpan? PeakStartTime { get; set; }
    public TimeSpan? PeakEndTime { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
