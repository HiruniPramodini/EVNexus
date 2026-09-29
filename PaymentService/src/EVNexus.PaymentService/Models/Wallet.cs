using System;

namespace EVNexus.PaymentService.Models;

public class Wallet
{
    public string WalletId { get; set; } = Guid.NewGuid().ToString();
    public string DriverId { get; set; } = string.Empty;
    public decimal Balance { get; set; } = 0;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
