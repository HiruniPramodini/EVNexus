using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Net.Http;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace EVNexus.MapService.Tests;

public class IntegrationTestBase : IClassFixture<WebApplicationFactory<Program>>
{
    protected readonly HttpClient Client;

    private const string JwtSecret = "EVNexus_Test_Only_Jwt_Secret_2026_Not_Production";
    private const string JwtIssuer = "EVNexus.AuthService";
    private const string JwtAudience = "EVNexus.Microservices";

    protected IntegrationTestBase(WebApplicationFactory<Program> factory)
    {
        var dbPassword = Environment.GetEnvironmentVariable("MAP_DB_PASSWORD");
        if (string.IsNullOrWhiteSpace(dbPassword))
        {
            throw new InvalidOperationException(
                "Integration test configuration error: 'MAP_DB_PASSWORD' environment variable is not set. " +
                "Please configure 'MAP_DB_PASSWORD' to run integration tests against the local database.");
        }

        var connectionString = $"Server=localhost;Port=3308;Database=map_db;User=evnexus;Password={dbPassword};";

        Client = factory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Jwt:Key", JwtSecret);
            builder.UseSetting("ConnectionStrings:DefaultConnection", connectionString);
            builder.ConfigureAppConfiguration((context, config) =>
            {
                config.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["Jwt:Key"] = JwtSecret,
                    ["ConnectionStrings:DefaultConnection"] = connectionString
                });
            });
        }).CreateClient();
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