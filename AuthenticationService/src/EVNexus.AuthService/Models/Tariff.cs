namespace EVNexus.AuthService.Models;

public class Tariff
{
    public string TariffId { get; set; } = string.Empty;
    public string TenantId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public decimal PricePerKwh { get; set; }
    public decimal IdleFeePerMinute { get; set; } = 0.00m;
    public string Currency { get; set; } = "USD";
    public string Status { get; set; } = "Active";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
