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
}

public class CompanyProfileResponseDto
{
    public string TenantId { get; set; } = string.Empty;
    public string CompanyName { get; set; } = string.Empty;
    public string RegistrationNumber { get; set; } = string.Empty;
    public string BusinessEmail { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}
