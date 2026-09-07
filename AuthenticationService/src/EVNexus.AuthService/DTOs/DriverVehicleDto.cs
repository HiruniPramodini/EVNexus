using System.ComponentModel.DataAnnotations;

namespace EVNexus.AuthService.DTOs;

/// <summary>
/// Response DTO representing an electric vehicle registered to a driver.
/// </summary>
public class DriverVehicleDto
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

/// <summary>
/// Request DTO for registering a new vehicle to the authenticated driver.
/// </summary>
public class CreateDriverVehicleRequestDto
{
    [Required(ErrorMessage = "Vehicle make is required.")]
    [StringLength(100, MinimumLength = 1, ErrorMessage = "Vehicle make must be between 1 and 100 characters.")]
    public string Make { get; set; } = string.Empty;

    [Required(ErrorMessage = "Vehicle model is required.")]
    [StringLength(100, MinimumLength = 1, ErrorMessage = "Vehicle model must be between 1 and 100 characters.")]
    public string Model { get; set; } = string.Empty;

    [Required(ErrorMessage = "Plate number is required.")]
    [StringLength(50, MinimumLength = 1, ErrorMessage = "Plate number must be between 1 and 50 characters.")]
    public string PlateNumber { get; set; } = string.Empty;

    [Required(ErrorMessage = "Connector type is required.")]
    [StringLength(50, MinimumLength = 1, ErrorMessage = "Connector type must be between 1 and 50 characters.")]
    public string ConnectorType { get; set; } = string.Empty;

    public bool IsDefault { get; set; } = false;
}

/// <summary>
/// Request DTO for editing an existing vehicle belonging to the authenticated driver.
/// </summary>
public class UpdateDriverVehicleRequestDto
{
    [Required(ErrorMessage = "Vehicle make is required.")]
    [StringLength(100, MinimumLength = 1, ErrorMessage = "Vehicle make must be between 1 and 100 characters.")]
    public string Make { get; set; } = string.Empty;

    [Required(ErrorMessage = "Vehicle model is required.")]
    [StringLength(100, MinimumLength = 1, ErrorMessage = "Vehicle model must be between 1 and 100 characters.")]
    public string Model { get; set; } = string.Empty;

    [Required(ErrorMessage = "Plate number is required.")]
    [StringLength(50, MinimumLength = 1, ErrorMessage = "Plate number must be between 1 and 50 characters.")]
    public string PlateNumber { get; set; } = string.Empty;

    [Required(ErrorMessage = "Connector type is required.")]
    [StringLength(50, MinimumLength = 1, ErrorMessage = "Connector type must be between 1 and 50 characters.")]
    public string ConnectorType { get; set; } = string.Empty;

    public bool? IsDefault { get; set; }
}
