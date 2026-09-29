using System.Diagnostics;
using System.Text.Json;
using Microsoft.OpenApi.Models;
using MySqlConnector;

var builder = WebApplication.CreateBuilder(args);

// ---------------------------------------------------------
// 1. Azure Application Insights Telemetry (Acceptance Criteria 2)
// ---------------------------------------------------------
var aiConnectionString = builder.Configuration["APPLICATIONINSIGHTS_CONNECTION_STRING"];
if (!string.IsNullOrEmpty(aiConnectionString))
{
    builder.Services.AddApplicationInsightsTelemetry(options =>
    {
        options.ConnectionString = aiConnectionString;
        options.EnableAdaptiveSampling = true;
        options.EnableQuickPulseMetricStream = true; // Live Metrics
    });
}
else
{
    // Fallback registration so ILogger and telemetry pipeline are active
    builder.Services.AddApplicationInsightsTelemetry();
}

// ---------------------------------------------------------
// 2. Swagger / OpenAPI Configuration
// ---------------------------------------------------------
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "⚡ EVNexus Payment & Wallet Service API",
        Version = "v1",
        Description = "Microservice managing internal EV driver wallets, top-ups, transactions, and session payments with Azure Application Insights telemetry."
    });
});

var app = builder.Build();

// Enable Swagger in all environments (Development & Production) for Azure testing
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "EVNexus Payment Service v1");
    c.RoutePrefix = "swagger";
});

// Root Redirect to Swagger for convenient browser verification
app.MapGet("/", () => Results.Redirect("/swagger"));

// ---------------------------------------------------------
// 3. Health Check Endpoint (Acceptance Criteria 4 & DoD)
// ---------------------------------------------------------
app.MapGet("/health", async (IConfiguration config, ILogger<Program> logger) =>
{
    var sw = Stopwatch.StartNew();
    var connStr = config.GetConnectionString("DefaultConnection") 
               ?? config["ConnectionStrings:DefaultConnection"]
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
        service = "EVNexus.PaymentService",
        version = "1.0.0-sprint3",
        timestamp = DateTime.UtcNow,
        totalDurationMs = sw.ElapsedMilliseconds,
        checks = new
        {
            database = new
            {
                status = dbStatus,
                latencyMs = dbLatencyMs
            },
            telemetry = new
            {
                appInsightsEnabled = !string.IsNullOrEmpty(aiConnectionString)
            }
        }
    };

    return isHealthy ? Results.Ok(response) : Results.Json(response, statusCode: 503);
})
.WithName("HealthCheck")
.WithOpenApi(operation => new(operation)
{
    Summary = "Health Probe Endpoint",
    Description = "Checks the operational status of the Payment Service and its Azure MySQL database connection."
});

// ---------------------------------------------------------
// 4. Wallet & Payment Domain Endpoints (Sprint 3 Core APIs)
// ---------------------------------------------------------

// GET /api/wallets/{driverId}
app.MapGet("/api/wallets/{driverId}", async (string driverId, IConfiguration config, ILogger<Program> logger) =>
{
    var connStr = config.GetConnectionString("DefaultConnection");
    if (string.IsNullOrEmpty(connStr))
    {
        // Return simulated wallet if no DB configured
        return Results.Ok(new
        {
            walletId = $"WAL-{driverId}",
            driverId,
            balance = 5000.00m,
            currency = "LKR",
            status = "Active"
        });
    }

    try
    {
        await using var conn = new MySqlConnection(connStr);
        await conn.OpenAsync();

        var query = "SELECT id, driver_id, driver_name, wallet_balance, currency, status FROM sprint3_payment_test_wallets WHERE driver_id = @driverId LIMIT 1;";
        await using var cmd = new MySqlCommand(query, conn);
        cmd.Parameters.AddWithValue("@driverId", driverId);

        await using var reader = await cmd.ExecuteReaderAsync();
        if (await reader.ReadAsync())
        {
            return Results.Ok(new
            {
                walletId = reader.GetString("id"),
                driverId = reader.GetString("driver_id"),
                driverName = reader.GetString("driver_name"),
                balance = reader.GetDecimal("wallet_balance"),
                currency = reader.GetString("currency"),
                status = reader.GetString("status")
            });
        }

        return Results.NotFound(new { message = $"No wallet found for driver {driverId}" });
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Error fetching wallet for {DriverId}", driverId);
        return Results.Problem(ex.Message);
    }
})
.WithName("GetWalletByDriver")
.WithOpenApi(op => new(op) { Summary = "Get Driver Wallet Balance" });

// POST /api/wallets/topup
app.MapPost("/api/wallets/topup", async (TopUpRequest req, IConfiguration config, ILogger<Program> logger) =>
{
    if (req.Amount <= 0) return Results.BadRequest(new { message = "Top-up amount must be positive." });

    logger.LogInformation("Processing top-up of {Amount} LKR for driver {DriverId}", req.Amount, req.DriverId);

    var connStr = config.GetConnectionString("DefaultConnection");
    if (string.IsNullOrEmpty(connStr))
    {
        return Results.Ok(new
        {
            transactionId = $"TX-TOPUP-{Guid.NewGuid():N}",
            driverId = req.DriverId,
            amount = req.Amount,
            newBalance = 5000.00m + req.Amount,
            status = "SUCCESS",
            timestamp = DateTime.UtcNow
        });
    }

    try
    {
        await using var conn = new MySqlConnection(connStr);
        await conn.OpenAsync();

        var updateSql = @"
            UPDATE sprint3_payment_test_wallets 
            SET wallet_balance = wallet_balance + @amount, status = 'ACTIVE' 
            WHERE driver_id = @driverId;
        ";
        await using var cmd = new MySqlCommand(updateSql, conn);
        cmd.Parameters.AddWithValue("@amount", req.Amount);
        cmd.Parameters.AddWithValue("@driverId", req.DriverId);
        var rows = await cmd.ExecuteNonQueryAsync();

        if (rows == 0)
        {
            // Insert if not exists
            var insertSql = @"
                INSERT INTO sprint3_payment_test_wallets (id, driver_id, driver_name, wallet_balance, currency, status)
                VALUES (@id, @driverId, @driverName, @amount, 'LKR', 'ACTIVE');
            ";
            await using var insertCmd = new MySqlCommand(insertSql, conn);
            insertCmd.Parameters.AddWithValue("@id", $"WAL-{req.DriverId}");
            insertCmd.Parameters.AddWithValue("@driverId", req.DriverId);
            insertCmd.Parameters.AddWithValue("@driverName", req.DriverName ?? "EV Driver");
            insertCmd.Parameters.AddWithValue("@amount", req.Amount);
            await insertCmd.ExecuteNonQueryAsync();
        }

        return Results.Ok(new
        {
            transactionId = $"TX-TOPUP-{Guid.NewGuid():N}",
            driverId = req.DriverId,
            amountAdded = req.Amount,
            status = "SUCCESS",
            timestamp = DateTime.UtcNow
        });
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Top-up failed for driver {DriverId}", req.DriverId);
        return Results.Problem(ex.Message);
    }
})
.WithName("TopUpWallet")
.WithOpenApi(op => new(op) { Summary = "Add Funds to Driver Wallet" });

// POST /api/payments/charge
app.MapPost("/api/payments/charge", async (PaymentChargeRequest req, IConfiguration config, ILogger<Program> logger) =>
{
    if (req.Amount <= 0) return Results.BadRequest(new { message = "Payment amount must be positive." });

    logger.LogInformation("Processing charging session payment: Session={SessionId}, Amount={Amount} LKR", req.SessionId, req.Amount);

    var connStr = config.GetConnectionString("DefaultConnection");
    if (string.IsNullOrEmpty(connStr))
    {
        return Results.Ok(new
        {
            paymentId = $"PAY-{Guid.NewGuid():N}",
            sessionId = req.SessionId,
            driverId = req.DriverId,
            amountPaid = req.Amount,
            status = "COMPLETED",
            timestamp = DateTime.UtcNow
        });
    }

    try
    {
        await using var conn = new MySqlConnection(connStr);
        await conn.OpenAsync();

        var deductSql = @"
            UPDATE sprint3_payment_test_wallets 
            SET wallet_balance = wallet_balance - @amount 
            WHERE driver_id = @driverId AND wallet_balance >= @amount;
        ";
        await using var cmd = new MySqlCommand(deductSql, conn);
        cmd.Parameters.AddWithValue("@amount", req.Amount);
        cmd.Parameters.AddWithValue("@driverId", req.DriverId);
        var rows = await cmd.ExecuteNonQueryAsync();

        if (rows == 0)
        {
            return Results.BadRequest(new { message = "Payment failed: Insufficient wallet balance or wallet not found." });
        }

        return Results.Ok(new
        {
            paymentId = $"PAY-{Guid.NewGuid():N}",
            sessionId = req.SessionId,
            driverId = req.DriverId,
            amountPaid = req.Amount,
            status = "COMPLETED",
            timestamp = DateTime.UtcNow
        });
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Payment charge failed for session {SessionId}", req.SessionId);
        return Results.Problem(ex.Message);
    }
})
.WithName("ProcessChargingPayment")
.WithOpenApi(op => new(op) { Summary = "Pay for EV Charging Session" });

app.Run();

// DTO Records
public record TopUpRequest(string DriverId, string? DriverName, decimal Amount);
public record PaymentChargeRequest(string SessionId, string DriverId, string StationId, decimal Amount);
