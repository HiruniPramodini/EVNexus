using System.ComponentModel.DataAnnotations;

namespace EVNexus.AuthService.DTOs;

public class DriverLoginRequestDto
{
    [Required(ErrorMessage = "Email is required.")]
    [EmailAddress(ErrorMessage = "Invalid email address format.")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Password is required.")]
    public string Password { get; set; } = string.Empty;
}

public class DriverLoginResponseDto
{
    public string AccessToken { get; set; } = string.Empty;
    public string TokenType { get; set; } = "Bearer";
    public int ExpiresIn { get; set; }
    public string DriverId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = "Driver";
    public string WalletId { get; set; } = string.Empty;
    public decimal WalletBalance { get; set; }
    public string Currency { get; set; } = "USD";
}

public class DriverProfileResponseDto
{
    public string DriverId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Role { get; set; } = "Driver";
    public string Status { get; set; } = "Active";
    public DateTime CreatedAt { get; set; }
    public string WalletId { get; set; } = string.Empty;
    public decimal WalletBalance { get; set; }
    public string Currency { get; set; } = "USD";
}
