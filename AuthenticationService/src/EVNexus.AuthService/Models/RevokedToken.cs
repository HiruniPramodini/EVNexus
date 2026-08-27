namespace EVNexus.AuthService.Models;

public class RevokedToken
{
    public string TokenHash { get; set; } = string.Empty;
    public string? JwtId { get; set; }
    public string? UserId { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime RevokedAt { get; set; } = DateTime.UtcNow;
}
