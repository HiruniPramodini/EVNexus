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
    public bool IsEmailVerified { get; set; } = false;
}

public class DriverProfileResponseDto
{
    public string DriverId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Role { get; set; } = "Driver";
    public string Status { get; set; } = "Active";
    public bool IsEmailVerified { get; set; } = false;
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string WalletId { get; set; } = string.Empty;
    public decimal WalletBalance { get; set; }
    public string Currency { get; set; } = "USD";
    public List<DriverVehicleDto> Vehicles { get; set; } = new();
}

public class UpdateDriverProfileRequestDto
{
    [Required(ErrorMessage = "Driver full name is required.")]
    [StringLength(100, MinimumLength = 2, ErrorMessage = "Driver full name must be between 2 and 100 characters.")]
    public string Name { get; set; } = string.Empty;

    [Required(ErrorMessage = "Phone number is required.")]
    [Phone(ErrorMessage = "Please provide a valid phone number.")]
    public string Phone { get; set; } = string.Empty;
}

public class ChangeDriverPasswordRequestDto
{
    [Required(ErrorMessage = "Current password is required.")]
    public string CurrentPassword { get; set; } = string.Empty;

    [Required(ErrorMessage = "New password is required.")]
    [MinLength(8, ErrorMessage = "Password must be at least 8 characters long.")]
    [RegularExpression(@"^(?=.*[0-9]).{8,}$", ErrorMessage = "Password must be at least 8 characters long and contain at least one numeric digit.")]
    public string NewPassword { get; set; } = string.Empty;

    [Required(ErrorMessage = "Please confirm your new password.")]
    [Compare("NewPassword", ErrorMessage = "New password and confirmation do not match.")]
    public string ConfirmNewPassword { get; set; } = string.Empty;
}
