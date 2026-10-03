using System;

namespace EVNexus.PaymentService.Models;

public class ChargingSessionCompletedEvent
{
    public string EventId { get; set; } = Guid.NewGuid().ToString();
    public string SessionId { get; set; } = string.Empty;
    public string DriverId { get; set; } = string.Empty;
    public string CompanyId { get; set; } = string.Empty;
    public string StationId { get; set; } = string.Empty;
    public string ChargerId { get; set; } = string.Empty;
    public decimal EnergyConsumedKwh { get; set; }
    public decimal FinalAmount { get; set; }
    public decimal PricePerKwh { get; set; }
    public string Currency { get; set; } = "USD";
    public DateTime CompletedAt { get; set; }
}
