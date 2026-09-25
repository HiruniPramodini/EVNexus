using System;

namespace EVNexus.PaymentService.Models;

public class PaymentTransaction
{
    public string PaymentId { get; set; } = Guid.NewGuid().ToString();
    public string TransactionId { get; set; } = string.Empty;
    public string SessionId { get; set; } = string.Empty;
    public string DriverId { get; set; } = string.Empty;
    public string CompanyId { get; set; } = string.Empty;
    public string StationId { get; set; } = string.Empty;
    public string ChargerId { get; set; } = string.Empty;
    public decimal EstimatedAmount { get; set; }
    public decimal FinalAmount { get; set; }
    public string Currency { get; set; } = "LKR";
    public string PaymentMethod { get; set; } = "DEMO_PAYMENT";
    public string Status { get; set; } = "PENDING";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAt { get; set; }
}
