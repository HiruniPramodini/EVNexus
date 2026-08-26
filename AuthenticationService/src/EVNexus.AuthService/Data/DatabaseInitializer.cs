using MySqlConnector;

namespace EVNexus.AuthService.Data;

public interface IDatabaseInitializer
{
    Task InitializeAsync(CancellationToken cancellationToken = default);
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

    public async Task InitializeAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Initializing Auth database schema...");
            await using var connection = await _connectionFactory.CreateOpenConnectionAsync(cancellationToken);

            const string createTablesSql = @"
                CREATE TABLE IF NOT EXISTS tenants (
                    tenant_id VARCHAR(50) PRIMARY KEY,
                    company_name VARCHAR(255) NOT NULL,
                    registration_number VARCHAR(100) NOT NULL,
                    business_email VARCHAR(255) NOT NULL UNIQUE,
                    phone VARCHAR(50) NOT NULL,
                    address TEXT NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    role VARCHAR(50) NOT NULL DEFAULT 'CompanyAdmin',
                    status VARCHAR(50) NOT NULL DEFAULT 'Active',
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_business_email (business_email),
                    INDEX idx_registration_number (registration_number)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

                CREATE TABLE IF NOT EXISTS drivers (
                    driver_id VARCHAR(50) PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    email VARCHAR(255) NOT NULL UNIQUE,
                    phone VARCHAR(50) NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    role VARCHAR(50) NOT NULL DEFAULT 'Driver',
                    status VARCHAR(50) NOT NULL DEFAULT 'Active',
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_driver_email (email)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

                CREATE TABLE IF NOT EXISTS wallets (
                    wallet_id VARCHAR(50) PRIMARY KEY,
                    driver_id VARCHAR(50) NOT NULL UNIQUE,
                    balance DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
                    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
                    status VARCHAR(50) NOT NULL DEFAULT 'Active',
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_wallet_driver_id (driver_id),
                    CONSTRAINT fk_wallets_driver FOREIGN KEY (driver_id) REFERENCES drivers(driver_id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

                CREATE TABLE IF NOT EXISTS charging_stations (
                    station_id VARCHAR(50) PRIMARY KEY,
                    tenant_id VARCHAR(50) NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    location VARCHAR(255) NOT NULL,
                    latitude DECIMAL(10, 8) NULL,
                    longitude DECIMAL(11, 8) NULL,
                    status VARCHAR(50) NOT NULL DEFAULT 'Active',
                    total_ports INT NOT NULL DEFAULT 1,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_stations_tenant (tenant_id),
                    CONSTRAINT fk_stations_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

                CREATE TABLE IF NOT EXISTS tariffs (
                    tariff_id VARCHAR(50) PRIMARY KEY,
                    tenant_id VARCHAR(50) NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    price_per_kwh DECIMAL(10, 4) NOT NULL,
                    idle_fee_per_minute DECIMAL(10, 4) NOT NULL DEFAULT 0.00,
                    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
                    status VARCHAR(50) NOT NULL DEFAULT 'Active',
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_tariffs_tenant (tenant_id),
                    CONSTRAINT fk_tariffs_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

                CREATE TABLE IF NOT EXISTS company_users (
                    user_id VARCHAR(50) PRIMARY KEY,
                    tenant_id VARCHAR(50) NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    email VARCHAR(255) NOT NULL,
                    role VARCHAR(50) NOT NULL DEFAULT 'Operator',
                    status VARCHAR(50) NOT NULL DEFAULT 'Active',
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_company_users_tenant (tenant_id),
                    CONSTRAINT fk_company_users_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ";

            await using var command = new MySqlCommand(createTablesSql, connection);
            await command.ExecuteNonQueryAsync(cancellationToken);
            _logger.LogInformation("Auth database schema initialized successfully.");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not initialize database on startup. Please ensure MySQL is running.");
        }
    }
}
