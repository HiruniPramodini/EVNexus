using System.Text;
using EVNexus.AuthService.Configuration;
using EVNexus.AuthService.Data;
using EVNexus.AuthService.Middleware;
using EVNexus.AuthService.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

// Configure JWT Settings & Authentication
var jwtSection = builder.Configuration.GetSection(JwtSettings.SectionName);
builder.Services.Configure<JwtSettings>(jwtSection);
var jwtSettings = jwtSection.Get<JwtSettings>() ?? new JwtSettings();

var jwtKey = string.IsNullOrWhiteSpace(jwtSettings.Key)
    ? "EVNexus_SuperSecret_JwtAuthentication_Key_2026_Enterprise_Secure!"
    : jwtSettings.Key;

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
        ValidateIssuer = true,
        ValidIssuer = string.IsNullOrWhiteSpace(jwtSettings.Issuer) ? "EVNexus.AuthService" : jwtSettings.Issuer,
        ValidateAudience = true,
        ValidAudience = string.IsNullOrWhiteSpace(jwtSettings.Audience) ? "EVNexus.Microservices" : jwtSettings.Audience,
        ValidateLifetime = true,
        ClockSkew = TimeSpan.Zero
    };
});

// Configure Swagger with JWT Bearer support
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "EVNexus Authentication & Profile Service",
        Version = "v1",
        Description = "Microservice managing authentication, JWT token issuing, multi-tenant company onboarding, and protected profiles."
    });

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Enter 'Bearer' [space] and then your token in the text input below.\r\n\r\nExample: \"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...\"",
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

// Register ADO.NET Infrastructure & Services
builder.Services.AddSingleton<IDbConnectionFactory, MySqlDbConnectionFactory>();
builder.Services.AddTransient<IDatabaseInitializer, DatabaseInitializer>();
builder.Services.AddScoped<ITenantRepository, TenantRepository>();
builder.Services.AddScoped<IDriverRepository, DriverRepository>();
builder.Services.AddScoped<ITenantContext, TenantContext>();
builder.Services.AddScoped<IStationRepository, StationRepository>();
builder.Services.AddSingleton<IPasswordHasher, BCryptPasswordHasher>();
builder.Services.AddSingleton<IJwtTokenService, JwtTokenService>();
builder.Services.AddScoped<ICompanyAuthService, CompanyAuthService>();
builder.Services.AddScoped<IDriverAuthService, DriverAuthService>();
builder.Services.AddScoped<IRefreshTokenRepository, RefreshTokenRepository>();
builder.Services.AddScoped<ITokenBlacklistService, TokenBlacklistService>();
builder.Services.AddScoped<ISessionService, SessionService>();
// Configure Email Settings
var emailSection = builder.Configuration.GetSection(EmailSettings.SectionName);
builder.Services.Configure<EmailSettings>(emailSection);
builder.Services.AddScoped<IEmailService, SmtpEmailService>();

builder.Services.AddScoped<IAccountAuditRepository, AccountAuditRepository>();
builder.Services.AddScoped<IAccountManagementService, AccountManagementService>();
builder.Services.AddSingleton<IStatusNotificationService, StatusNotificationService>();

var app = builder.Build();

// Initialize database schema asynchronously on startup
using (var scope = app.Services.CreateScope())
{
    var initializer = scope.ServiceProvider.GetRequiredService<IDatabaseInitializer>();
    await initializer.InitializeAsync();
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "EVNexus Auth API v1");
    });
}

app.UseRouting();

app.UseCors("AllowAll");

app.UseAuthentication();
app.UseMiddleware<TenantResolutionMiddleware>();
app.UseRoleAuthorization();
app.UseAuthorization();

app.MapControllers();

await app.RunAsync();
