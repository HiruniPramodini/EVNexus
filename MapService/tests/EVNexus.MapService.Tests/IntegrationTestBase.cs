using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Net.Http;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.IdentityModel.Tokens;

namespace EVNexus.MapService.Tests;

public class IntegrationTestBase : IClassFixture<WebApplicationFactory<Program>>
{
    protected readonly HttpClient Client;

    private const string JwtSecret = "EVNexus_SuperSecret_JwtAuthentication_Key_2026_Enterprise_Secure!";
    private const string JwtIssuer = "EVNexus.AuthService";
    private const string JwtAudience = "EVNexus.Microservices";

    protected IntegrationTestBase(WebApplicationFactory<Program> factory)
    {
        Client = factory.CreateClient();
    }

    protected static string GenerateToken(string tenantId, string userId, string role)
    {
        var claims = new List<Claim>
        {
            new Claim("TenantId", tenantId),
            new Claim(ClaimTypes.NameIdentifier, userId),
            new Claim(ClaimTypes.Role, role)
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(JwtSecret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: JwtIssuer,
            audience: JwtAudience,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(1),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}