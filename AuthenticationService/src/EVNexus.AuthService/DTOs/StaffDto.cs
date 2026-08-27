using System.ComponentModel.DataAnnotations;

namespace EVNexus.AuthService.DTOs;

public class CreateStaffRequestDto
{
    [Required(ErrorMessage = "Staff member name is required.")]
    [StringLength(100, MinimumLength = 2, ErrorMessage = "Name must be between 2 and 100 characters.")]
    public string Name { get; set; } = string.Empty;

    [Required(ErrorMessage = "Staff email address is required.")]
    [EmailAddress(ErrorMessage = "Invalid email address format.")]
    [StringLength(255, ErrorMessage = "Email cannot exceed 255 characters.")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Password is required.")]
    [StringLength(100, MinimumLength = 6, ErrorMessage = "Password must be at least 6 characters long.")]
    public string Password { get; set; } = string.Empty;

    [StringLength(50, ErrorMessage = "Phone number cannot exceed 50 characters.")]
    public string? Phone { get; set; }

    [StringLength(50, ErrorMessage = "Role cannot exceed 50 characters.")]
    public string Role { get; set; } = "Operator";
}

public class StaffResponseDto
{
    public string UserId { get; set; } = string.Empty;
    public string TenantId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string Role { get; set; } = "Operator";
    public string Status { get; set; } = "Active";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class UpdateStaffStatusRequestDto
{
    [Required(ErrorMessage = "Status is required.")]
    [RegularExpression("^(Active|Inactive)$", ErrorMessage = "Status must be either 'Active' or 'Inactive'.")]
    public string Status { get; set; } = "Active";
}

public class BillingInfoDto
{
    public string TenantId { get; set; } = string.Empty;
    public string Plan { get; set; } = "Enterprise Scale";
    public string BillingEmail { get; set; } = string.Empty;
    public string PaymentMethod { get; set; } = "Corporate Visa **** 4242";
    public decimal MonthlyAmount { get; set; } = 499.00m;
    public string Currency { get; set; } = "USD";
    public string Status { get; set; } = "Active";
    public DateTime NextBillingDate { get; set; } = DateTime.UtcNow.AddDays(30);
}

public class UpdateBillingRequestDto
{
    [Required(ErrorMessage = "Plan is required.")]
    [StringLength(100, ErrorMessage = "Plan cannot exceed 100 characters.")]
    public string Plan { get; set; } = "Enterprise Scale";

    [Required(ErrorMessage = "Billing email is required.")]
    [EmailAddress(ErrorMessage = "Invalid email address format.")]
    public string BillingEmail { get; set; } = string.Empty;

    [Required(ErrorMessage = "Payment method is required.")]
    [StringLength(100, ErrorMessage = "Payment method cannot exceed 100 characters.")]
    public string PaymentMethod { get; set; } = string.Empty;
}
