using System;

namespace EVNexus.PaymentService.Models;

public class WalletTransaction
{
    public string TransactionId { get; set; } = Guid.NewGuid().ToString();
    public string WalletId { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string? ReferenceId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public static class WalletTransactionTypes
{
    public const string TopUp = "TOP_UP";
    public const string ChargingPayment = "CHARGING_PAYMENT";
    public const string Refund = "REFUND";
}
