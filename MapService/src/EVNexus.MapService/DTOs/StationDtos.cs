using System;
using System.ComponentModel.DataAnnotations;

namespace EVNexus.MapService.DTOs;

public class CreateStationDto
{
    [Required]
    public string Name { get; set; } = string.Empty;
    [Required]
    public string Address { get; set; } = string.Empty;
    [Required]
    public decimal Latitude { get; set; }
    [Required]
    public decimal Longitude { get; set; }
    [Required]
    public string ConnectorType { get; set; } = string.Empty;
    [Required]
    [Range(0.1, 1000)]
    public decimal CapacityKw { get; set; }
    [Required]
    [Range(0, 100)]
    public decimal PricePerKwh { get; set; }

    // Dynamic Pricing fields
    public decimal? PeakPricePerKwh { get; set; }
    public decimal? OffPeakPricePerKwh { get; set; }
    public string? PeakStartTime { get; set; }
    public string? PeakEndTime { get; set; }
}

public class UpdateStationDto
{
    [Required]
    public string Address { get; set; } = string.Empty;
    [Required]
    [Range(0, 100)]
    public decimal PricePerKwh { get; set; }
    [Required]
    [Range(0.1, 1000)]
    public decimal CapacityKw { get; set; }
    [Required]
    public string ConnectorType { get; set; } = string.Empty;
    
    // Dynamic Pricing fields
    public decimal? PeakPricePerKwh { get; set; }
    public decimal? OffPeakPricePerKwh { get; set; }
    public string? PeakStartTime { get; set; }
    public string? PeakEndTime { get; set; }
}
