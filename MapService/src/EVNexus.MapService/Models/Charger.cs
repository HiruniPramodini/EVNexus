using System;

namespace EVNexus.MapService.Models;

public class Charger
{
    public string Id { get; set; } = string.Empty;
    public string StationId { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public decimal PowerKw { get; set; }
    public decimal PricePerKwh { get; set; }
    public string Status { get; set; } = "Available";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
