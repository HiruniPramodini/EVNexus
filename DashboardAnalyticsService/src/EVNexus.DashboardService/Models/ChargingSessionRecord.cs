namespace EVNexus.DashboardService.Models;

public class ChargingSessionRecord
{
    public string Id { get; set; } = default!;
    public string DriverId { get; set; } = default!;
    public string CompanyId { get; set; } = "";
    public string StationId { get; set; } = "";
    public string StationName { get; set; } = "";
    public string ChargerId { get; set; } = "";
    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }
    public double DurationMinutes { get; set; }
    public double EnergyKwh { get; set; }
    public decimal Cost { get; set; }
}