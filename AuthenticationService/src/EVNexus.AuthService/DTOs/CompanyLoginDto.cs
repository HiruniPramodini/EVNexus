using System.ComponentModel.DataAnnotations;

namespace EVNexus.AuthService.DTOs;

public class CompanyLoginRequestDto
{
    [Required(ErrorMessage = "Business email is required.")]
    [EmailAddress(ErrorMessage = "Invalid business email format.")]
    public string BusinessEmail { get; set; } = string.Empty;

    [Required(ErrorMessage = "Password is required.")]
    public string Password { get; set; } = string.Empty;
}

public class CompanyLoginResponseDto
{
    public string AccessToken { get; set; } = string.Empty;
    public string TokenType { get; set; } = "Bearer";
    public int ExpiresIn { get; set; }
    public string TenantId { get; set; } = string.Empty;
    public string CompanyName { get; set; } = string.Empty;
    public string BusinessEmail { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public bool IsEmailVerified { get; set; } = false;
    public string RefreshToken { get; set; } = string.Empty;
}

public class CompanyProfileResponseDto
{
    public string TenantId { get; set; } = string.Empty;
    public string CompanyName { get; set; } = string.Empty;
    public string RegistrationNumber { get; set; } = string.Empty;
    public string BusinessEmail { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string? LogoUrl { get; set; }
    public string Role { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public bool IsEmailVerified { get; set; } = false;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class UpdateCompanyProfileRequestDto
{
    [Required(ErrorMessage = "Company name is required.")]
    [StringLength(255, MinimumLength = 2, ErrorMessage = "Company name must be between 2 and 255 characters.")]
    public string CompanyName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Phone number is required.")]
    [StringLength(50, MinimumLength = 5, ErrorMessage = "Phone number must be between 5 and 50 characters.")]
    public string Phone { get; set; } = string.Empty;

    [Required(ErrorMessage = "Address is required.")]
    [StringLength(1000, MinimumLength = 3, ErrorMessage = "Address must be between 3 and 1000 characters.")]
    public string Address { get; set; } = string.Empty;

    public string? LogoUrl { get; set; }

    [EmailAddress(ErrorMessage = "Invalid business email format.")]
    public string? BusinessEmail { get; set; }

    public string? EmailVerificationCode { get; set; }
}

public class InitiateEmailChangeRequestDto
{
    [Required(ErrorMessage = "New business email is required.")]
    [EmailAddress(ErrorMessage = "Invalid business email format.")]
    public string NewBusinessEmail { get; set; } = string.Empty;
}

public class InitiateEmailChangeResponseDto
{
    public string Message { get; set; } = string.Empty;
    public string NewBusinessEmail { get; set; } = string.Empty;
    public string VerificationCode { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
}
