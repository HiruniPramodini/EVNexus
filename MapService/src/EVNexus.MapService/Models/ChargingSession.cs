using System;

namespace EVNexus.MapService.Models;

public class ChargingSession
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string StationId { get; set; } = string.Empty;
    public string DriverId { get; set; } = string.Empty;
    public DateTime StartTime { get; set; } = DateTime.UtcNow;
    public DateTime? EndTime { get; set; }
    public string Status { get; set; } = "Active";
    public decimal EnergyConsumedKwh { get; set; } = 0;
    public decimal TotalCost { get; set; } = 0;
}
