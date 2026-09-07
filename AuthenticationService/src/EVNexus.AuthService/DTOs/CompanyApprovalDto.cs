using System.ComponentModel.DataAnnotations;

namespace EVNexus.AuthService.DTOs;

public class ApproveCompanyRequestDto
{
    [MaxLength(500, ErrorMessage = "Notes cannot exceed 500 characters.")]
    public string? Notes { get; set; }
}

public class RejectCompanyRequestDto
{
    [MaxLength(500, ErrorMessage = "Reason cannot exceed 500 characters.")]
    public string? Reason { get; set; }
}

public class CompanyApprovalResponseDto
{
    public string TenantId { get; set; } = string.Empty;
    public string CompanyName { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty; // "Active" or "Rejected"
    public string PreviousStatus { get; set; } = string.Empty; // "Pending"
    public string Action { get; set; } = string.Empty; // "Approve" or "Reject"
    public string? Reason { get; set; }
    public string PerformedBy { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public bool NotificationSent { get; set; } = true;
    public string NotificationSummary { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
}

public class SimulatedNotificationDto
{
    public string NotificationId { get; set; } = string.Empty;
    public string TenantId { get; set; } = string.Empty;
    public string CompanyName { get; set; } = string.Empty;
    public string RecipientEmail { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public DateTime SentAt { get; set; }
}
