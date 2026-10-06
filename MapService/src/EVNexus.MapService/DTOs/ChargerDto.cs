namespace EVNexus.MapService.DTOs;

public class ChargerDto
{
    public string Type { get; set; } = string.Empty;
    public decimal PowerKw { get; set; }
    public decimal PricePerKwh { get; set; }
}
