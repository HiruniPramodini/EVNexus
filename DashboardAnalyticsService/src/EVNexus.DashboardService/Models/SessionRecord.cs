using System.ComponentModel.DataAnnotations;

namespace DashboardService.Models;

public class SessionRecord
{
    [Key] public long Id { get; set; }
    public string SessionId { get; set; } = "";
    public string TenantId { get; set; } = "";
    public string StationId { get; set; } = "";
    public string StationName { get; set; } = "";
    public string ChargerId { get; set; } = "";
    public string DriverId { get; set; } = "";
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public decimal EnergyKwh { get; set; }
    public decimal TotalCost { get; set; }
    public string PaymentStatus { get; set; } = "COMPLETED";
}