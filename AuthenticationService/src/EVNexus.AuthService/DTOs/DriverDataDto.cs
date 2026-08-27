namespace EVNexus.AuthService.DTOs;

public class DriverWalletDto
{
    public string WalletId { get; set; } = string.Empty;
    public string DriverId { get; set; } = string.Empty;
    public decimal Balance { get; set; }
    public string Currency { get; set; } = "USD";
    public string Status { get; set; } = "Active";
    public DateTime UpdatedAt { get; set; }
}

public class DriverActivitySummaryDto
{
    public string DriverId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public int TotalSessions { get; set; }
    public decimal TotalEnergyKwh { get; set; }
    public decimal WalletBalance { get; set; }
    public string Currency { get; set; } = "USD";
    public string AccountStatus { get; set; } = "Active";
    public DateTime MemberSince { get; set; }
}
