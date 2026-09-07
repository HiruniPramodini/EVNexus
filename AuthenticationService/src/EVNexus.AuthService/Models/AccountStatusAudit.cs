namespace EVNexus.AuthService.Models;

public class AccountStatusAudit
{
    public string AuditId { get; set; } = string.Empty;
    public string AccountId { get; set; } = string.Empty;
    public string AccountType { get; set; } = string.Empty; // "Company" or "Driver"
    public string Action { get; set; } = string.Empty; // "Suspend" or "Reactivate"
    public string PreviousStatus { get; set; } = string.Empty;
    public string NewStatus { get; set; } = string.Empty;
    public string? Reason { get; set; }
    public string PerformedBy { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}
