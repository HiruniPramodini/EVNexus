using System.Diagnostics;
using System.Text;
using EVNexus.DashboardService.Data;
using EVNexus.DashboardService.Forecasting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using MySqlConnector;

var builder = WebApplication.CreateBuilder(args);

// Swagger / OpenAPI Configuration
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "⚡ EVNexus Dashboard & Analytics Service API",
        Version = "v1",
        Description = "Microservice managing enterprise EV company analytics, revenue metrics, charging telemetry trends, and ML.NET forecasting."
    });

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Enter 'Bearer' [space] and then your token.",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// Controllers
builder.Services.AddControllers();

// JWT Authentication
var jwtKey = builder.Configuration["Jwt:Key"] 
          ?? builder.Configuration["Jwt:SecretKey"] 
          ?? builder.Configuration["JWT_SECRET"];

if (string.IsNullOrEmpty(jwtKey))
{
    jwtKey = "EVNexus_SuperSecret_JwtAuthentication_Key_2026_Enterprise_Secure!";
}

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "EVNexus.AuthService",
            ValidAudience = builder.Configuration["Jwt:Audience"] ?? "EVNexus.Microservices",
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
    });

// Authorization
builder.Services.AddAuthorization();

// Database & Domain services
builder.Services.AddSingleton<IDbConnectionFactory, DbConnectionFactory>();
builder.Services.AddScoped<ICompanyAnalyticsRepository, CompanyAnalyticsRepository>();
builder.Services.AddScoped<IForecastService, ForecastService>();

var app = builder.Build();

// Swagger Middleware
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "EVNexus Dashboard Service v1");
    c.RoutePrefix = "swagger";
});

app.MapGet("/", () => Results.Redirect("/swagger"));

// Health check endpoint
app.MapGet("/health", async (IConfiguration config, ILogger<Program> logger) =>
{
    var sw = Stopwatch.StartNew();
    var connStr = config.GetConnectionString("PaymentConnection")
               ?? config.GetConnectionString("DefaultConnection")
               ?? config["ConnectionStrings__PaymentConnection"]
               ?? config["ConnectionStrings__DefaultConnection"];

    var dbStatus = "Unconfigured";
    var dbLatencyMs = 0L;

    if (!string.IsNullOrEmpty(connStr))
    {
        try
        {
            await using var conn = new MySqlConnection(connStr);
            var dbSw = Stopwatch.StartNew();
            await conn.OpenAsync();
            await using var cmd = new MySqlCommand("SELECT 1;", conn);
            await cmd.ExecuteScalarAsync();
            dbSw.Stop();
            dbLatencyMs = dbSw.ElapsedMilliseconds;
            dbStatus = "Connected";
        }
        catch (Exception ex)
        {
            dbStatus = $"Error: {ex.Message}";
            logger.LogError(ex, "Health check database probe failed");
        }
    }

    sw.Stop();
    var isHealthy = dbStatus == "Connected" || string.IsNullOrEmpty(connStr);

    var response = new
    {
        status = isHealthy ? "Healthy" : "Degraded",
        service = "EVNexus.DashboardService",
        version = "1.0.0",
        timestamp = DateTime.UtcNow,
        totalDurationMs = sw.ElapsedMilliseconds,
        checks = new
        {
            database = new
            {
                status = dbStatus,
                latencyMs = dbLatencyMs
            }
        }
    };

    return isHealthy ? Results.Ok(response) : Results.Json(response, statusCode: 503);
})
.WithName("HealthCheck")
.WithOpenApi(operation => new(operation)
{
    Summary = "Health Probe Endpoint",
    Description = "Checks the operational status of the Dashboard Service and its database connection."
});

// Authentication and Authorization
app.UseAuthentication();
app.UseAuthorization();

// Map controllers
app.MapControllers();

app.Run();

public partial class Program { }
