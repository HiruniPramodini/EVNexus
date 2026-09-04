namespace EVNexus.AuthService.Models;

public class Wallet
{
    public string WalletId { get; set; } = string.Empty;
    public string DriverId { get; set; } = string.Empty;
    public decimal Balance { get; set; } = 0.00m;
    public string Currency { get; set; } = "USD";
    public string Status { get; set; } = "Active";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
