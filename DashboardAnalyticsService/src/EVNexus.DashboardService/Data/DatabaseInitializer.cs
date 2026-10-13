using System;
using System.Threading.Tasks;
using Dapper;
using Microsoft.Extensions.Logging;

namespace EVNexus.DashboardService.Data;

public interface IDatabaseInitializer
{
    Task InitializeAsync();
}

public class DatabaseInitializer : IDatabaseInitializer
{
    private readonly IDbConnectionFactory _connectionFactory;
    private readonly ILogger<DatabaseInitializer> _logger;

    public DatabaseInitializer(IDbConnectionFactory connectionFactory, ILogger<DatabaseInitializer> logger)
    {
        _connectionFactory = connectionFactory;
        _logger = logger;
    }

    public async Task InitializeAsync()
    {
        try
        {
            using var connection = _connectionFactory.CreateConnection();
            
            var sql = @"
                CREATE TABLE IF NOT EXISTS stations (
                    Id VARCHAR(36) PRIMARY KEY,
                    TenantId VARCHAR(36) NOT NULL,
                    Name VARCHAR(100) NOT NULL,
                    Address VARCHAR(255) NOT NULL,
                    Latitude DECIMAL(10, 8) NOT NULL,
                    Longitude DECIMAL(11, 8) NOT NULL,
                    ConnectorType VARCHAR(50) NOT NULL,
                    CapacityKw DECIMAL(10, 2) NOT NULL,
                    PricePerKwh DECIMAL(10, 2) NOT NULL,
                    IsActive BOOLEAN DEFAULT TRUE,
                    ChargingCode VARCHAR(50) NULL,
                    PeakPricePerKwh DECIMAL(10, 2) NULL,
                    OffPeakPricePerKwh DECIMAL(10, 2) NULL,
                    PeakStartTime TIME NULL,
                    PeakEndTime TIME NULL,
                    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_tenant_id (TenantId)
                );

                CREATE TABLE IF NOT EXISTS charging_sessions (
                    Id VARCHAR(36) PRIMARY KEY,
                    CompanyId VARCHAR(36) NOT NULL,
                    StationId VARCHAR(36) NOT NULL,
                    ChargerId VARCHAR(36) NOT NULL,
                    DriverId VARCHAR(36) NOT NULL,
                    StartTime DATETIME DEFAULT CURRENT_TIMESTAMP,
                    EndTime DATETIME NULL,
                    Status VARCHAR(50) NOT NULL DEFAULT 'Active',
                    EnergyConsumedKwh DECIMAL(10, 4) DEFAULT 0,
                    TotalCost DECIMAL(10, 2) DEFAULT 0,
                    EstimatedCost DECIMAL(10, 2) DEFAULT 0,
                    INDEX idx_cs_company (CompanyId),
                    INDEX idx_cs_driver (DriverId),
                    INDEX idx_cs_station (StationId),
                    INDEX idx_cs_starttime (StartTime)
                );

                CREATE TABLE IF NOT EXISTS dashboard_pricing_recommendations (
                    Id VARCHAR(36) PRIMARY KEY,
                    CompanyId VARCHAR(36) NOT NULL,
                    StationId VARCHAR(36) NOT NULL,
                    RecommendationType VARCHAR(100) NOT NULL,
                    RecommendationText TEXT NOT NULL,
                    CurrentStandardPrice DECIMAL(10, 2) NOT NULL,
                    SuggestedPeakPrice DECIMAL(10, 2) NULL,
                    SuggestedOffPeakPrice DECIMAL(10, 2) NULL,
                    Rationale TEXT NULL,
                    ExpectedImpact VARCHAR(255) NULL,
                    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_dpr_company (CompanyId),
                    INDEX idx_dpr_station (StationId)
                );

                CREATE TABLE IF NOT EXISTS dashboard_predictions_cache (
                    StationId VARCHAR(36) PRIMARY KEY,
                    PredictedPeakHours VARCHAR(100) NOT NULL,
                    ConfidenceScore FLOAT NOT NULL DEFAULT 0,
                    LastCalculatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            ";

            await connection.ExecuteAsync(sql);
            _logger.LogInformation("Dashboard dedicated database tables initialized successfully.");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not initialize Dashboard database on startup. Ensure MySQL server is reachable.");
        }
    }
}
