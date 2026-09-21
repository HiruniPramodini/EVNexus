using System.Threading.Tasks;
using Dapper;

namespace EVNexus.PaymentService.Data;

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
            CREATE TABLE IF NOT EXISTS payment_transactions (
                PaymentId VARCHAR(36) PRIMARY KEY,
                TransactionId VARCHAR(50) NOT NULL UNIQUE,
                SessionId VARCHAR(36) NOT NULL UNIQUE,
                DriverId VARCHAR(36) NOT NULL,
                CompanyId VARCHAR(36) NOT NULL,
                StationId VARCHAR(36) NOT NULL,
                ChargerId VARCHAR(36) NOT NULL,
                EstimatedAmount DECIMAL(10, 2) NOT NULL,
                FinalAmount DECIMAL(10, 2) NOT NULL DEFAULT 0,
                Currency VARCHAR(10) NOT NULL DEFAULT 'LKR',
                PaymentMethod VARCHAR(50) NOT NULL DEFAULT 'DEMO_PAYMENT',
                Status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
                CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                CompletedAt DATETIME NULL,
                INDEX idx_company_id (CompanyId),
                INDEX idx_driver_id (DriverId)
            );
        ";
        await connection.ExecuteAsync(sql);
    }
}
