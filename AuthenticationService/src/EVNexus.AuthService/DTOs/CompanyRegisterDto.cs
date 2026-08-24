using System.ComponentModel.DataAnnotations;

namespace EVNexus.AuthService.DTOs;

public class CompanyRegisterRequestDto
{
    [Required(ErrorMessage = "Company name is required.")]
    [StringLength(255, MinimumLength = 2, ErrorMessage = "Company name must be between 2 and 255 characters.")]
    public string CompanyName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Business registration number is required.")]
    [StringLength(100, MinimumLength = 2, ErrorMessage = "Registration number must be between 2 and 100 characters.")]
    public string RegistrationNumber { get; set; } = string.Empty;

    [Required(ErrorMessage = "Business email is required.")]
    [EmailAddress(ErrorMessage = "Invalid business email format.")]
    [StringLength(255, ErrorMessage = "Business email cannot exceed 255 characters.")]
    public string BusinessEmail { get; set; } = string.Empty;

    [Required(ErrorMessage = "Phone number is required.")]
    [Phone(ErrorMessage = "Invalid phone number format.")]
    [StringLength(50, MinimumLength = 7, ErrorMessage = "Phone number must be between 7 and 50 characters.")]
    public string Phone { get; set; } = string.Empty;

    [Required(ErrorMessage = "Business address is required.")]
    [StringLength(500, MinimumLength = 5, ErrorMessage = "Address must be between 5 and 500 characters.")]
    public string Address { get; set; } = string.Empty;

    [Required(ErrorMessage = "Password is required.")]
    [MinLength(8, ErrorMessage = "Password must be at least 8 characters long.")]
    [RegularExpression(@"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d\s]).{8,}$",
        ErrorMessage = "Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character (e.g., @, #, $, !, %, *, ?).")]
    public string Password { get; set; } = string.Empty;
}

public class CompanyRegisterResponseDto
{
    public string TenantId { get; set; } = string.Empty;
    public string CompanyName { get; set; } = string.Empty;
    public string RegistrationNumber { get; set; } = string.Empty;
    public string BusinessEmail { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public string Message { get; set; } = string.Empty;
}

public class ApiResponse<T>
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public T? Data { get; set; }
    public List<string>? Errors { get; set; }

    public static ApiResponse<T> Ok(T data, string message = "Success") =>
        new() { Success = true, Message = message, Data = data };

    public static ApiResponse<T> Fail(string message, List<string>? errors = null) =>
        new() { Success = false, Message = message, Errors = errors ?? new List<string>() };
}
