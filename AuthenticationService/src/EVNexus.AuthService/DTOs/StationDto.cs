using System.ComponentModel.DataAnnotations;

namespace EVNexus.AuthService.DTOs;

public class CreateStationRequestDto
{
    [Required(ErrorMessage = "Station name is required.")]
    [StringLength(255, MinimumLength = 2, ErrorMessage = "Station name must be between 2 and 255 characters.")]
    public string Name { get; set; } = string.Empty;

    [Required(ErrorMessage = "Location address is required.")]
    [StringLength(255, MinimumLength = 3, ErrorMessage = "Location must be between 3 and 255 characters.")]
    public string Location { get; set; } = string.Empty;

    [Range(-90.0, 90.0, ErrorMessage = "Latitude must be between -90 and 90.")]
    public decimal? Latitude { get; set; }

    [Range(-180.0, 180.0, ErrorMessage = "Longitude must be between -180 and 180.")]
    public decimal? Longitude { get; set; }

    [Range(1, 100, ErrorMessage = "Total ports must be at least 1 and at most 100.")]
    public int TotalPorts { get; set; } = 1;
}

public class UpdateStationRequestDto
{
    [Required(ErrorMessage = "Station name is required.")]
    [StringLength(255, MinimumLength = 2, ErrorMessage = "Station name must be between 2 and 255 characters.")]
    public string Name { get; set; } = string.Empty;

    [Required(ErrorMessage = "Location address is required.")]
    [StringLength(255, MinimumLength = 3, ErrorMessage = "Location must be between 3 and 255 characters.")]
    public string Location { get; set; } = string.Empty;

    [Range(-90.0, 90.0, ErrorMessage = "Latitude must be between -90 and 90.")]
    public decimal? Latitude { get; set; }

    [Range(-180.0, 180.0, ErrorMessage = "Longitude must be between -180 and 180.")]
    public decimal? Longitude { get; set; }

    [RegularExpression("^(Active|Maintenance|Inactive)$", ErrorMessage = "Status must be Active, Maintenance, or Inactive.")]
    public string Status { get; set; } = "Active";

    [Range(1, 100, ErrorMessage = "Total ports must be between 1 and 100.")]
    public int TotalPorts { get; set; } = 1;
}

public class StationResponseDto
{
    public string StationId { get; set; } = string.Empty;
    public string TenantId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public string Status { get; set; } = "Active";
    public int TotalPorts { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
