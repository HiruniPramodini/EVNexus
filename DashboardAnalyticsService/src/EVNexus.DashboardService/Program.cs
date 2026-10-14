using System.Text;
using DashboardService.Data;
using DashboardService.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using EVNexus.DashboardService.Data;
using EVNexus.DashboardService.Services;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

var conn = builder.Configuration.GetConnectionString("DefaultConnection")
           ?? builder.Configuration["ConnectionStrings__DefaultConnection"]
           ?? "Server=localhost;Port=3310;Database=evnexus_dashboard;User=evnexus;Password=evnexus;";
builder.Services.AddDbContext<DashboardDbContext>(o =>
    o.UseMySql(conn, new MySqlServerVersion(new Version(8, 0, 36))));

builder.Services.AddAuthorization();

builder.Services.AddCors(o => o.AddDefaultPolicy(p => p
    .WithOrigins(builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? new[] { "http://localhost:5173" })
    .AllowAnyHeader().AllowAnyMethod()));

builder.Services.AddScoped<IReportService, ReportService>();
builder.Services.AddScoped<IAnalyticsService, AnalyticsService>();
builder.Services.AddHostedService<SessionCompletedConsumer>();

builder.Services.AddControllers();
// Configure CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// Configure Application Insights (Story 3 Requirement)
var appInsightsConnectionString = builder.Configuration["APPLICATIONINSIGHTS_CONNECTION_STRING"] 
    ?? builder.Configuration["ApplicationInsights:ConnectionString"];
if (!string.IsNullOrEmpty(appInsightsConnectionString))
{
    builder.Services.AddApplicationInsightsTelemetry(options =>
    {
        options.ConnectionString = appInsightsConnectionString;
    });
}
else
{
    builder.Services.AddApplicationInsightsTelemetry();
}

// Configure Health Checks (Story 3 Requirement)
builder.Services.AddHealthChecks();

// Configure Controllers
builder.Services.AddControllers();

// Configure Swagger / OpenAPI
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Configure Dependency Injection
builder.Services.AddSingleton<IDbConnectionFactory, DbConnectionFactory>();
builder.Services.AddScoped<IDatabaseInitializer, DatabaseInitializer>();
builder.Services.AddScoped<IDashboardRepository, DashboardRepository>();
builder.Services.AddScoped<IForecastService, ForecastService>();
builder.Services.AddScoped<ICsvExportService, CsvExportService>();

// Configure JWT Authentication
var jwtKey = builder.Configuration["JWT_SECRET"] 
    ?? builder.Configuration["Jwt:Key"] 
    ?? "EVNexus_Default_Dev_Jwt_Secret_Key_At_Least_32_Chars_2026!";

if (!string.IsNullOrEmpty(jwtKey) && jwtKey.Length >= 32)
{
    builder.Services.AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = false;
        options.SaveToken = true;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ValidateIssuer = false,
            ValidateAudience = false,
            ClockSkew = TimeSpan.Zero
        };
    });
}

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    try
    {
        var db = scope.ServiceProvider.GetService<DashboardDbContext>();
        db?.Database.EnsureCreated();
    }
    catch
    {
        // Ignore DB connection errors in test or offline environments
    }

    try
    {
        var initializer = scope.ServiceProvider.GetService<IDatabaseInitializer>();
        if (initializer != null)
        {
            await initializer.InitializeAsync();
        }
    }
    catch
    {
        // Ignore DB connection errors in test or offline environments
    }
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowAll");

app.UseAuthentication();
app.UseAuthorization();

// Health Check Endpoints (Story 3 Acceptance Criteria)
app.MapHealthChecks("/health");
app.MapHealthChecks("/api/health");

app.MapControllers();

app.Run();

// Required for WebApplicationFactory in integration tests
public partial class Program { }
