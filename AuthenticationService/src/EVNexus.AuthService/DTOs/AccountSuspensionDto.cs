using System.ComponentModel.DataAnnotations;

namespace EVNexus.AuthService.DTOs;

public class SuspendAccountRequestDto
{
    [MaxLength(500, ErrorMessage = "Reason cannot exceed 500 characters.")]
    public string? Reason { get; set; }
}

public class ReactivateAccountRequestDto
{
    [MaxLength(500, ErrorMessage = "Reason cannot exceed 500 characters.")]
    public string? Reason { get; set; }
}

public class AccountStatusResponseDto
{
    public string AccountId { get; set; } = string.Empty;
    public string AccountType { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string PreviousStatus { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string? Reason { get; set; }
    public string PerformedBy { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public string Message { get; set; } = string.Empty;
}

public class AccountStatusAuditDto
{
    public string AuditId { get; set; } = string.Empty;
    public string AccountId { get; set; } = string.Empty;
    public string AccountType { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string PreviousStatus { get; set; } = string.Empty;
    public string NewStatus { get; set; } = string.Empty;
    public string? Reason { get; set; }
    public string PerformedBy { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
}
