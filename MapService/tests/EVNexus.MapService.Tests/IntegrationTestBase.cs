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
using MySql.Data.MySqlClient;

namespace EVNexus.MapService.Tests;

public class IntegrationTestBase : IClassFixture<WebApplicationFactory<Program>>
{
    protected readonly HttpClient Client;

    private const string JwtSecret = "EVNexus_Test_Only_Jwt_Secret_2026_Not_Production";
    private const string JwtIssuer = "EVNexus.AuthService";
    private const string JwtAudience = "EVNexus.Microservices";

    protected IntegrationTestBase(WebApplicationFactory<Program> factory)
    {
        var connectionString = GetTestConnectionString();

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

    private static string GetTestConnectionString()
    {
        // Prefer a test-specific value. Also honor the standard configuration key
        // already supplied by map-ci.yml; never read the application's .env file.
        var configured = Environment.GetEnvironmentVariable("MAP_TEST_CONNECTION_STRING")
            ?? Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");
        MySqlConnectionStringBuilder settings;
        if (!string.IsNullOrWhiteSpace(configured))
        {
            try { settings = new MySqlConnectionStringBuilder(configured); }
            catch (ArgumentException)
            {
                throw new InvalidOperationException("Invalid Map integration-test connection string. Its value is omitted to protect credentials.");
            }
        }
        else
        {
            var password = Environment.GetEnvironmentVariable("MAP_DB_PASSWORD");
            if (string.IsNullOrWhiteSpace(password))
                throw new InvalidOperationException("Configure MAP_TEST_CONNECTION_STRING, ConnectionStrings__DefaultConnection, or explicit MAP_TEST_DB_* settings plus MAP_DB_PASSWORD. Use a dedicated local test database.");
            var portValue = Environment.GetEnvironmentVariable("MAP_TEST_DB_PORT") ?? "3306";
            if (!uint.TryParse(portValue, out var port) || port == 0 || port > 65535)
                throw new InvalidOperationException("MAP_TEST_DB_PORT must be between 1 and 65535.");
            settings = new MySqlConnectionStringBuilder
            {
                Server = Environment.GetEnvironmentVariable("MAP_TEST_DB_HOST") ?? "127.0.0.1",
                Port = port,
                Database = Environment.GetEnvironmentVariable("MAP_TEST_DB_NAME") ?? "map_db_test",
                UserID = Environment.GetEnvironmentVariable("MAP_TEST_DB_USER") ?? "evnexus_ci",
                Password = password
            };
        }
        // This suite writes data and initializes tables: reject shared/remote targets.
        if (settings.Server != "127.0.0.1" && !string.Equals(settings.Server, "localhost", StringComparison.OrdinalIgnoreCase) && settings.Server != "::1")
            throw new InvalidOperationException("Map integration tests require a loopback test database, not a remote/shared service.");
        if (!settings.Database.EndsWith("_test", StringComparison.OrdinalIgnoreCase) && !settings.Database.EndsWith("_e2e", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Map integration tests require an explicitly named *_test or *_e2e database.");
        if (string.IsNullOrWhiteSpace(settings.UserID) || string.IsNullOrWhiteSpace(settings.Password))
            throw new InvalidOperationException("Map integration tests require an explicit database username and nonempty password.");
        return settings.ConnectionString;
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
