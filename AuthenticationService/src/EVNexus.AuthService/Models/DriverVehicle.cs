namespace EVNexus.AuthService.Models;

/// <summary>
/// Domain model representing an electric vehicle registered to a driver.
/// </summary>
public class DriverVehicle
{
    public string VehicleId { get; set; } = string.Empty;
    public string DriverId { get; set; } = string.Empty;
    public string Make { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public string PlateNumber { get; set; } = string.Empty;
    public string ConnectorType { get; set; } = string.Empty;
    public bool IsDefault { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
