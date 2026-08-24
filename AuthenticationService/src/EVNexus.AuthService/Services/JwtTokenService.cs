using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using EVNexus.AuthService.Configuration;
using EVNexus.AuthService.Models;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace EVNexus.AuthService.Services;

public interface IJwtTokenService
{
    (string Token, int ExpiresInSeconds) GenerateToken(Tenant tenant);
}

public class JwtTokenService : IJwtTokenService
{
    private readonly JwtSettings _jwtSettings;

    public JwtTokenService(IOptions<JwtSettings> jwtOptions)
    {
        _jwtSettings = jwtOptions.Value;

        if (string.IsNullOrWhiteSpace(_jwtSettings.Key) || _jwtSettings.Key.Length < 32)
        {
            throw new InvalidOperationException("JWT Key must be at least 256 bits (32 characters) long.");
        }
    }

    public (string Token, int ExpiresInSeconds) GenerateToken(Tenant tenant)
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.UTF8.GetBytes(_jwtSettings.Key);
        var expiryDuration = TimeSpan.FromMinutes(_jwtSettings.ExpiryMinutes > 0 ? _jwtSettings.ExpiryMinutes : 60);
        var expiresAt = DateTime.UtcNow.Add(expiryDuration);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, tenant.TenantId),
            new(ClaimTypes.NameIdentifier, tenant.TenantId),
            new("tenant_id", tenant.TenantId),
            new(JwtRegisteredClaimNames.Email, tenant.BusinessEmail),
            new(ClaimTypes.Email, tenant.BusinessEmail),
            new(ClaimTypes.Role, tenant.Role),
            new("role", tenant.Role),
            new("company_name", tenant.CompanyName),
            new("registration_number", tenant.RegistrationNumber),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = expiresAt,
            Issuer = _jwtSettings.Issuer,
            Audience = _jwtSettings.Audience,
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        var tokenString = tokenHandler.WriteToken(token);

        return (tokenString, (int)expiryDuration.TotalSeconds);
    }
}
