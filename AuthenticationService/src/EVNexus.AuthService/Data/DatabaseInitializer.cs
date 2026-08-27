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
                    logo_url LONGTEXT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    role VARCHAR(50) NOT NULL DEFAULT 'CompanyAdmin',
                    status VARCHAR(50) NOT NULL DEFAULT 'Active',
                    is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_business_email (business_email),
                    INDEX idx_registration_number (registration_number)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

                CREATE TABLE IF NOT EXISTS email_verification_tokens (
                    token_id VARCHAR(50) PRIMARY KEY,
                    tenant_id VARCHAR(50) NOT NULL,
                    new_email VARCHAR(255) NOT NULL,
                    verification_code VARCHAR(50) NOT NULL,
                    expires_at DATETIME NOT NULL,
                    is_used BOOLEAN NOT NULL DEFAULT FALSE,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_evt_tenant (tenant_id),
                    CONSTRAINT fk_evt_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

                CREATE TABLE IF NOT EXISTS drivers (
                    driver_id VARCHAR(50) PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    email VARCHAR(255) NOT NULL UNIQUE,
                    phone VARCHAR(50) NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    role VARCHAR(50) NOT NULL DEFAULT 'Driver',
                    status VARCHAR(50) NOT NULL DEFAULT 'Active',
                    is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_driver_email (email)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

                CREATE TABLE IF NOT EXISTS driver_email_verification_tokens (
                    token_id VARCHAR(50) PRIMARY KEY,
                    driver_id VARCHAR(50) NOT NULL,
                    email VARCHAR(255) NOT NULL,
                    verification_code VARCHAR(50) NOT NULL,
                    expires_at DATETIME NOT NULL,
                    is_used BOOLEAN NOT NULL DEFAULT FALSE,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_devt_driver (driver_id),
                    CONSTRAINT fk_devt_driver FOREIGN KEY (driver_id) REFERENCES drivers(driver_id) ON DELETE CASCADE
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

                CREATE TABLE IF NOT EXISTS driver_vehicles (
                    vehicle_id VARCHAR(50) PRIMARY KEY,
                    driver_id VARCHAR(50) NOT NULL,
                    make VARCHAR(100) NOT NULL,
                    model VARCHAR(100) NOT NULL,
                    plate_number VARCHAR(50) NOT NULL,
                    connector_type VARCHAR(50) NOT NULL,
                    is_default BOOLEAN NOT NULL DEFAULT FALSE,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_dv_driver_id (driver_id),
                    CONSTRAINT fk_dv_driver FOREIGN KEY (driver_id) REFERENCES drivers(driver_id) ON DELETE CASCADE
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
                    email VARCHAR(255) NOT NULL UNIQUE,
                    phone VARCHAR(50) NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    role VARCHAR(50) NOT NULL DEFAULT 'Operator',
                    status VARCHAR(50) NOT NULL DEFAULT 'Active',
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_company_users_tenant (tenant_id),
                    INDEX idx_company_users_email (email),
                    CONSTRAINT fk_company_users_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

                CREATE TABLE IF NOT EXISTS refresh_tokens (
                    token_id VARCHAR(50) PRIMARY KEY,
                    token VARCHAR(255) NOT NULL UNIQUE,
                    jwt_id VARCHAR(100) NULL,
                    user_id VARCHAR(50) NOT NULL,
                    user_type VARCHAR(50) NOT NULL,
                    role VARCHAR(50) NOT NULL,
                    expires_at DATETIME NOT NULL,
                    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    revoked_at DATETIME NULL,
                    replaced_by_token VARCHAR(255) NULL,
                    INDEX idx_rt_token (token),
                    INDEX idx_rt_user (user_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

                CREATE TABLE IF NOT EXISTS revoked_tokens (
                    token_hash VARCHAR(64) PRIMARY KEY,
                    jwt_id VARCHAR(100) NULL,
                    user_id VARCHAR(50) NULL,
                    expires_at DATETIME NOT NULL,
                    revoked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_revoked_jwt_id (jwt_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

                CREATE TABLE IF NOT EXISTS account_status_audits (
                    audit_id VARCHAR(50) PRIMARY KEY,
                    account_id VARCHAR(50) NOT NULL,
                    account_type VARCHAR(50) NOT NULL,
                    action VARCHAR(50) NOT NULL,
                    previous_status VARCHAR(50) NOT NULL,
                    new_status VARCHAR(50) NOT NULL,
                    reason VARCHAR(500) NULL,
                    performed_by VARCHAR(100) NOT NULL,
                    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_audit_account (account_id),
                    INDEX idx_audit_timestamp (timestamp)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ";

            await using var command = new MySqlCommand(createTablesSql, connection);
            await command.ExecuteNonQueryAsync(cancellationToken);

            // Migration: Ensure logo_url exists on existing tenants table if it was created in a previous story
            try
            {
                const string checkColSql = @"
                    SELECT COUNT(1) 
                    FROM information_schema.COLUMNS 
                    WHERE TABLE_SCHEMA = DATABASE() 
                      AND TABLE_NAME = 'tenants' 
                      AND COLUMN_NAME = 'logo_url';
                ";
                await using var checkCmd = new MySqlCommand(checkColSql, connection);
                var colExists = Convert.ToInt64(await checkCmd.ExecuteScalarAsync(cancellationToken)) > 0;
                if (!colExists)
                {
                    const string alterSql = "ALTER TABLE tenants ADD COLUMN logo_url LONGTEXT NULL AFTER address;";
                    await using var alterCmd = new MySqlCommand(alterSql, connection);
                    await alterCmd.ExecuteNonQueryAsync(cancellationToken);
                    _logger.LogInformation("Migrated 'tenants' table: added 'logo_url' column.");
                }
            }
            catch (Exception migrationEx)
            {
                _logger.LogDebug(migrationEx, "Column check or migration on 'tenants.logo_url' completed.");
            }

            // Migration: Ensure is_email_verified exists on existing tenants table
            try
            {
                const string checkColSql = @"
                    SELECT COUNT(1) 
                    FROM information_schema.COLUMNS 
                    WHERE TABLE_SCHEMA = DATABASE() 
                      AND TABLE_NAME = 'tenants' 
                      AND COLUMN_NAME = 'is_email_verified';
                ";
                await using var checkCmd = new MySqlCommand(checkColSql, connection);
                var colExists = Convert.ToInt64(await checkCmd.ExecuteScalarAsync(cancellationToken)) > 0;
                if (!colExists)
                {
                    const string alterSql = "ALTER TABLE tenants ADD COLUMN is_email_verified BOOLEAN NOT NULL DEFAULT FALSE AFTER status;";
                    await using var alterCmd = new MySqlCommand(alterSql, connection);
                    await alterCmd.ExecuteNonQueryAsync(cancellationToken);
                    _logger.LogInformation("Migrated 'tenants' table: added 'is_email_verified' column.");
                }
            }
            catch (Exception migrationEx)
            {
                _logger.LogDebug(migrationEx, "Column check or migration on 'tenants.is_email_verified' completed.");
            }

            // Migration: Ensure is_email_verified exists on existing drivers table
            try
            {
                const string checkColSql = @"
                    SELECT COUNT(1) 
                    FROM information_schema.COLUMNS 
                    WHERE TABLE_SCHEMA = DATABASE() 
                      AND TABLE_NAME = 'drivers' 
                      AND COLUMN_NAME = 'is_email_verified';
                ";
                await using var checkCmd = new MySqlCommand(checkColSql, connection);
                var colExists = Convert.ToInt64(await checkCmd.ExecuteScalarAsync(cancellationToken)) > 0;
                if (!colExists)
                {
                    const string alterSql = "ALTER TABLE drivers ADD COLUMN is_email_verified BOOLEAN NOT NULL DEFAULT FALSE AFTER status;";
                    await using var alterCmd = new MySqlCommand(alterSql, connection);
                    await alterCmd.ExecuteNonQueryAsync(cancellationToken);
                    _logger.LogInformation("Migrated 'drivers' table: added 'is_email_verified' column.");
                }
            }
            catch (Exception migrationEx)
            {
                _logger.LogDebug(migrationEx, "Column check or migration on 'drivers.is_email_verified' completed.");
            }

            // Migration: Ensure driver_vehicles table exists
            try
            {
                const string checkVehiclesTableSql = @"
                    SELECT COUNT(1) 
                    FROM information_schema.TABLES 
                    WHERE TABLE_SCHEMA = DATABASE() 
                      AND TABLE_NAME = 'driver_vehicles';
                ";
                await using var checkVehiclesCmd = new MySqlCommand(checkVehiclesTableSql, connection);
                var tableExists = Convert.ToInt64(await checkVehiclesCmd.ExecuteScalarAsync(cancellationToken)) > 0;
                if (!tableExists)
                {
                    const string createVehiclesSql = @"
                        CREATE TABLE IF NOT EXISTS driver_vehicles (
                            vehicle_id VARCHAR(50) PRIMARY KEY,
                            driver_id VARCHAR(50) NOT NULL,
                            make VARCHAR(100) NOT NULL,
                            model VARCHAR(100) NOT NULL,
                            plate_number VARCHAR(50) NOT NULL,
                            connector_type VARCHAR(50) NOT NULL,
                            is_default BOOLEAN NOT NULL DEFAULT FALSE,
                            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                            INDEX idx_dv_driver_id (driver_id),
                            CONSTRAINT fk_dv_driver FOREIGN KEY (driver_id) REFERENCES drivers(driver_id) ON DELETE CASCADE
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
                    ";
                    await using var createVehiclesCmd = new MySqlCommand(createVehiclesSql, connection);
                    await createVehiclesCmd.ExecuteNonQueryAsync(cancellationToken);
                    _logger.LogInformation("Migrated database: created 'driver_vehicles' table.");
                }
            }
            catch (Exception migrationEx)
            {
                _logger.LogDebug(migrationEx, "Table check or migration on 'driver_vehicles' completed.");
            }

            // Migration: Ensure password_hash and phone columns exist on company_users table
            try
            {
                const string checkPasswordHashColSql = @"
                    SELECT COUNT(1) 
                    FROM information_schema.COLUMNS 
                    WHERE TABLE_SCHEMA = DATABASE() 
                      AND TABLE_NAME = 'company_users' 
                      AND COLUMN_NAME = 'password_hash';
                ";
                await using var checkPwCmd = new MySqlCommand(checkPasswordHashColSql, connection);
                var pwColExists = Convert.ToInt64(await checkPwCmd.ExecuteScalarAsync(cancellationToken)) > 0;
                if (!pwColExists)
                {
                    const string addPwColSql = "ALTER TABLE company_users ADD COLUMN password_hash VARCHAR(255) NOT NULL DEFAULT '';";
                    await using var addPwCmd = new MySqlCommand(addPwColSql, connection);
                    await addPwCmd.ExecuteNonQueryAsync(cancellationToken);
                    _logger.LogInformation("Migrated database: added 'password_hash' column to 'company_users'.");
                }

                const string checkPhoneColSql = @"
                    SELECT COUNT(1) 
                    FROM information_schema.COLUMNS 
                    WHERE TABLE_SCHEMA = DATABASE() 
                      AND TABLE_NAME = 'company_users' 
                      AND COLUMN_NAME = 'phone';
                ";
                await using var checkPhoneCmd = new MySqlCommand(checkPhoneColSql, connection);
                var phoneColExists = Convert.ToInt64(await checkPhoneCmd.ExecuteScalarAsync(cancellationToken)) > 0;
                if (!phoneColExists)
                {
                    const string addPhoneColSql = "ALTER TABLE company_users ADD COLUMN phone VARCHAR(50) NULL;";
                    await using var addPhoneCmd = new MySqlCommand(addPhoneColSql, connection);
                    await addPhoneCmd.ExecuteNonQueryAsync(cancellationToken);
                    _logger.LogInformation("Migrated database: added 'phone' column to 'company_users'.");
                }
            }
            catch (Exception cuMigrationEx)
            {
                _logger.LogDebug(cuMigrationEx, "Column check or migration on 'company_users' completed.");
            }

            // Migration: Ensure refresh_tokens and revoked_tokens tables exist
            try
            {
                const string checkRtTableSql = @"
                    SELECT COUNT(1) 
                    FROM information_schema.TABLES 
                    WHERE TABLE_SCHEMA = DATABASE() 
                      AND TABLE_NAME = 'refresh_tokens';
                ";
                await using var checkRtCmd = new MySqlCommand(checkRtTableSql, connection);
                var rtExists = Convert.ToInt64(await checkRtCmd.ExecuteScalarAsync(cancellationToken)) > 0;
                if (!rtExists)
                {
                    const string createRtSql = @"
                        CREATE TABLE IF NOT EXISTS refresh_tokens (
                            token_id VARCHAR(50) PRIMARY KEY,
                            token VARCHAR(255) NOT NULL UNIQUE,
                            jwt_id VARCHAR(100) NULL,
                            user_id VARCHAR(50) NOT NULL,
                            user_type VARCHAR(50) NOT NULL,
                            role VARCHAR(50) NOT NULL,
                            expires_at DATETIME NOT NULL,
                            is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
                            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            revoked_at DATETIME NULL,
                            replaced_by_token VARCHAR(255) NULL,
                            INDEX idx_rt_token (token),
                            INDEX idx_rt_user (user_id)
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
                    ";
                    await using var createRtCmd = new MySqlCommand(createRtSql, connection);
                    await createRtCmd.ExecuteNonQueryAsync(cancellationToken);
                    _logger.LogInformation("Migrated database: created 'refresh_tokens' table.");
                }

                const string checkRevokedTableSql = @"
                    SELECT COUNT(1) 
                    FROM information_schema.TABLES 
                    WHERE TABLE_SCHEMA = DATABASE() 
                      AND TABLE_NAME = 'revoked_tokens';
                ";
                await using var checkRevCmd = new MySqlCommand(checkRevokedTableSql, connection);
                var revExists = Convert.ToInt64(await checkRevCmd.ExecuteScalarAsync(cancellationToken)) > 0;
                if (!revExists)
                {
                    const string createRevSql = @"
                        CREATE TABLE IF NOT EXISTS revoked_tokens (
                            token_hash VARCHAR(64) PRIMARY KEY,
                            jwt_id VARCHAR(100) NULL,
                            user_id VARCHAR(50) NULL,
                            expires_at DATETIME NOT NULL,
                            revoked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            INDEX idx_revoked_jwt_id (jwt_id)
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
                    ";
                    await using var createRevCmd = new MySqlCommand(createRevSql, connection);
                    await createRevCmd.ExecuteNonQueryAsync(cancellationToken);
                    _logger.LogInformation("Migrated database: created 'revoked_tokens' table.");
                }
            }
            catch (Exception rtMigrationEx)
            {
                _logger.LogDebug(rtMigrationEx, "Table check or migration on 'refresh_tokens' completed.");
            }

            // Migration: Ensure account_status_audits table exists
            try
            {
                const string checkAuditTableSql = @"
                    SELECT COUNT(1) 
                    FROM information_schema.TABLES 
                    WHERE TABLE_SCHEMA = DATABASE() 
                      AND TABLE_NAME = 'account_status_audits';
                ";
                await using var checkAuditCmd = new MySqlCommand(checkAuditTableSql, connection);
                var auditExists = Convert.ToInt64(await checkAuditCmd.ExecuteScalarAsync(cancellationToken)) > 0;
                if (!auditExists)
                {
                    const string createAuditSql = @"
                        CREATE TABLE IF NOT EXISTS account_status_audits (
                            audit_id VARCHAR(50) PRIMARY KEY,
                            account_id VARCHAR(50) NOT NULL,
                            account_type VARCHAR(50) NOT NULL,
                            action VARCHAR(50) NOT NULL,
                            previous_status VARCHAR(50) NOT NULL,
                            new_status VARCHAR(50) NOT NULL,
                            reason VARCHAR(500) NULL,
                            performed_by VARCHAR(100) NOT NULL,
                            timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            INDEX idx_audit_account (account_id),
                            INDEX idx_audit_timestamp (timestamp)
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
                    ";
                    await using var createAuditCmd = new MySqlCommand(createAuditSql, connection);
                    await createAuditCmd.ExecuteNonQueryAsync(cancellationToken);
                    _logger.LogInformation("Migrated database: created 'account_status_audits' table.");
                }
            }
            catch (Exception auditMigrationEx)
            {
                _logger.LogDebug(auditMigrationEx, "Table check or migration on 'account_status_audits' completed.");
            }

            _logger.LogInformation("Auth database schema initialized successfully.");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not initialize database on startup. Please ensure MySQL is running.");
        }
    }
}
