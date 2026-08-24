using EVNexus.AuthService.Data;
using EVNexus.AuthService.Services;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "EVNexus Authentication & Profile Service",
        Version = "v1",
        Description = "Microservice managing authentication, user/company profiles, and multi-tenant onboarding."
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
builder.Services.AddSingleton<IPasswordHasher, BCryptPasswordHasher>();
builder.Services.AddScoped<ICompanyAuthService, CompanyAuthService>();

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

app.UseCors("AllowAll");

app.UseAuthorization();

app.MapControllers();

app.Run();
