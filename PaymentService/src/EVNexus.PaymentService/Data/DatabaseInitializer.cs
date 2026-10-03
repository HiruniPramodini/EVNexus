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
                EnergyConsumedKwh DECIMAL(18, 4) NOT NULL DEFAULT 0,
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

        // Add EnergyConsumedKwh to existing tables
        try 
        {
            await connection.ExecuteAsync("ALTER TABLE payment_transactions ADD COLUMN EnergyConsumedKwh DECIMAL(18, 4) NOT NULL DEFAULT 0;");
        }
        catch 
        {
            // Column likely already exists
        }

        var sql2 = @"
            CREATE TABLE IF NOT EXISTS wallets (
                WalletId VARCHAR(36) PRIMARY KEY,
                DriverId VARCHAR(36) NOT NULL UNIQUE,
                Balance DECIMAL(18, 4) NOT NULL DEFAULT 0,
                CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS wallet_transactions (
                TransactionId VARCHAR(36) PRIMARY KEY,
                WalletId VARCHAR(36) NOT NULL,
                Type VARCHAR(50) NOT NULL,
                Amount DECIMAL(18, 4) NOT NULL,
                ReferenceId VARCHAR(100) NULL,
                CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_wallet_id (WalletId),
                INDEX idx_reference_id (ReferenceId)
            );

            CREATE TABLE IF NOT EXISTS outbox_messages (
                Id BIGINT AUTO_INCREMENT PRIMARY KEY,
                EventType VARCHAR(100) NOT NULL,
                AggregateType VARCHAR(100) NOT NULL,
                AggregateId VARCHAR(100) NOT NULL,
                Payload JSON NOT NULL,
                Status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
                RetryCount INT NOT NULL DEFAULT 0,
                AvailableAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                CreatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                PublishedAt DATETIME(6) NULL,
                LastError TEXT NULL,
                INDEX IX_outbox_messages_status_available (Status, AvailableAt, CreatedAt)
            );
        ";
        await connection.ExecuteAsync(sql2);
    }
}
