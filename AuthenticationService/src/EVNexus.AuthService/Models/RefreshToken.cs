namespace EVNexus.AuthService.Models;

public class RefreshToken
{
    public string TokenId { get; set; } = string.Empty;
    public string Token { get; set; } = string.Empty;
    public string? JwtId { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string UserType { get; set; } = string.Empty; // "Tenant", "Staff", or "Driver"
    public string Role { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public bool IsRevoked { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? RevokedAt { get; set; }
    public string? ReplacedByToken { get; set; }

    public bool IsExpired => DateTime.UtcNow >= ExpiresAt;
    public bool IsActive => !IsRevoked && !IsExpired;
}
