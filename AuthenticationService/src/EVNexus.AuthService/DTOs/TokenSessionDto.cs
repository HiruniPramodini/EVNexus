using System.ComponentModel.DataAnnotations;

namespace EVNexus.AuthService.DTOs;

public class RefreshTokenRequestDto
{
    [Required(ErrorMessage = "Refresh token is required.")]
    public string RefreshToken { get; set; } = string.Empty;
}

public class RefreshTokenResponseDto
{
    public string AccessToken { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public string TokenType { get; set; } = "Bearer";
    public int ExpiresIn { get; set; }
    public string? Role { get; set; }
    public string? UserId { get; set; }
}

public class LogoutRequestDto
{
    public string? RefreshToken { get; set; }
}
