using EVNexus.PaymentService.Data;
using EVNexus.PaymentService.Kafka;
using EVNexus.PaymentService.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddControllers();

// Add Database
builder.Services.AddSingleton<IDbConnectionFactory, DbConnectionFactory>();
builder.Services.AddScoped<IPaymentRepository, PaymentRepository>();
builder.Services.AddScoped<IDatabaseInitializer, DatabaseInitializer>();

// Add Kafka
builder.Services.AddSingleton<KafkaProducerService>();

// Register WalletDeductService with a typed HttpClient -> auth-service container
var authServiceUrl = builder.Configuration["Services:AuthServiceUrl"] ?? "http://authentication-service:8080";
builder.Services.AddHttpClient<WalletDeductService>(client =>
{
    client.BaseAddress = new Uri(authServiceUrl);
    client.Timeout = TimeSpan.FromSeconds(10);
});

var app = builder.Build();

// Initialize DB
using (var scope = app.Services.CreateScope())
{
    var dbInitializer = scope.ServiceProvider.GetRequiredService<IDatabaseInitializer>();
    await dbInitializer.InitializeAsync();
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.MapControllers();

app.Run();
