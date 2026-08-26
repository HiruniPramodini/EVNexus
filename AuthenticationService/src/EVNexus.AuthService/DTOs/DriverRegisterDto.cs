using System.ComponentModel.DataAnnotations;

namespace EVNexus.AuthService.DTOs;

public class DriverRegisterRequestDto
{
    [Required(ErrorMessage = "Driver full name is required.")]
    [StringLength(100, MinimumLength = 2, ErrorMessage = "Driver full name must be between 2 and 100 characters.")]
    public string Name { get; set; } = string.Empty;

    [Required(ErrorMessage = "Email address is required.")]
    [EmailAddress(ErrorMessage = "Please provide a valid email address.")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Phone number is required.")]
    [Phone(ErrorMessage = "Please provide a valid phone number.")]
    public string Phone { get; set; } = string.Empty;

    [Required(ErrorMessage = "Password is required.")]
    [MinLength(8, ErrorMessage = "Password must be at least 8 characters long.")]
    [RegularExpression(@"^(?=.*[0-9]).{8,}$", ErrorMessage = "Password must be at least 8 characters long and contain at least one numeric digit.")]
    public string Password { get; set; } = string.Empty;
}

public class DriverRegisterResponseDto
{
    public string DriverId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string WalletId { get; set; } = string.Empty;
    public decimal WalletBalance { get; set; } = 0.00m;
    public string Currency { get; set; } = "USD";
    public DateTime CreatedAt { get; set; }
    public string Message { get; set; } = string.Empty;
}
