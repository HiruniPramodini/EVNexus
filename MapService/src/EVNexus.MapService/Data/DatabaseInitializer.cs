using System.Threading.Tasks;
using Dapper;

namespace EVNexus.MapService.Data;

public class DatabaseInitializer : IDatabaseInitializer
{
    private readonly IDbConnectionFactory _connectionFactory;

    public DatabaseInitializer(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task InitializeAsync()
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
                ChargingCode VARCHAR(50) UNIQUE NOT NULL,
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
                StationId VARCHAR(36) NOT NULL,
                DriverId VARCHAR(36) NOT NULL,
                StartTime DATETIME DEFAULT CURRENT_TIMESTAMP,
                EndTime DATETIME NULL,
                Status VARCHAR(50) NOT NULL DEFAULT 'Active',
                EnergyConsumedKwh DECIMAL(10, 4) DEFAULT 0,
                TotalCost DECIMAL(10, 2) DEFAULT 0,
                FOREIGN KEY (StationId) REFERENCES stations(Id)
            );
        ";
        await connection.ExecuteAsync(sql);
    }
}
