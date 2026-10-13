using System;
using System.Data;
using System.Threading.Tasks;
using Dapper;
using EVNexus.PaymentService.Models;
using Microsoft.Extensions.Logging;

namespace EVNexus.PaymentService.Data;

public class WalletRepository : IWalletRepository
{
    private readonly IDbConnectionFactory _connectionFactory;
    private readonly ILogger<WalletRepository> _logger;
    private readonly IOutboxRepository _outboxRepository;

    public WalletRepository(IDbConnectionFactory connectionFactory, ILogger<WalletRepository> logger, IOutboxRepository outboxRepository)
    {
        _connectionFactory = connectionFactory;
        _logger = logger;
        _outboxRepository = outboxRepository;
    }

    public async Task<Wallet?> GetWalletByDriverIdAsync(string driverId)
    {
        var sql = "SELECT * FROM wallets WHERE DriverId = @DriverId;";
        using var connection = _connectionFactory.CreateConnection();
        return await connection.QuerySingleOrDefaultAsync<Wallet>(sql, new { DriverId = driverId });
    }

    public async Task<Wallet> CreateWalletAsync(string driverId)
    {
        var wallet = new Wallet { DriverId = driverId };
        var sql = @"
            INSERT INTO wallets (WalletId, DriverId, Balance, CreatedAt, UpdatedAt)
            VALUES (@WalletId, @DriverId, @Balance, @CreatedAt, @UpdatedAt);
        ";
        using var connection = _connectionFactory.CreateConnection();
        try
        {
            await connection.ExecuteAsync(sql, wallet);
            return wallet;
        }
        catch (Exception)
        {
            // Possible duplicate insertion race condition, fetch existing
            var existing = await GetWalletByDriverIdAsync(driverId);
            if (existing != null) return existing;
            throw;
        }
    }

    public async Task<bool> TopUpAsync(string driverId, decimal amount, string? idempotencyKey = null)
    {
        using var connection = _connectionFactory.CreateConnection();
        connection.Open();
        using var transaction = connection.BeginTransaction();
        try
        {
            // 1. Lock wallet row
            var sqlSelect = "SELECT * FROM wallets WHERE DriverId = @DriverId FOR UPDATE;";
            var wallet = await connection.QuerySingleOrDefaultAsync<Wallet>(sqlSelect, new { DriverId = driverId }, transaction);
            if (wallet == null)
            {
                // Create wallet inside transaction if it doesn't exist
                wallet = new Wallet { DriverId = driverId, Balance = 0 };
                var sqlInsertWallet = @"
                    INSERT INTO wallets (WalletId, DriverId, Balance, CreatedAt, UpdatedAt)
                    VALUES (@WalletId, @DriverId, @Balance, @CreatedAt, @UpdatedAt);
                ";
                await connection.ExecuteAsync(sqlInsertWallet, wallet, transaction);
            }

            // 2. Server-side idempotency check
            if (!string.IsNullOrEmpty(idempotencyKey))
            {
                var sqlCheckIdempotent = "SELECT COUNT(*) FROM wallet_transactions WHERE WalletId = @WalletId AND ReferenceId = @ReferenceId AND Type = 'TOP_UP';";
                var existingCount = await connection.ExecuteScalarAsync<int>(sqlCheckIdempotent, new { WalletId = wallet.WalletId, ReferenceId = idempotencyKey }, transaction);
                if (existingCount > 0)
                {
                    _logger.LogInformation("TopUp request with IdempotencyKey {Key} for driver {DriverId} already processed. Returning success without re-crediting.", idempotencyKey, driverId);
                    transaction.Commit();
                    return true;
                }
            }

            // 3. Update balance
            var sqlUpdate = @"
                UPDATE wallets 
                SET Balance = Balance + @Amount, UpdatedAt = CURRENT_TIMESTAMP 
                WHERE WalletId = @WalletId;
            ";
            await connection.ExecuteAsync(sqlUpdate, new { Amount = amount, WalletId = wallet.WalletId }, transaction);

            // 4. Create wallet transaction
            var wTx = new WalletTransaction
            {
                WalletId = wallet.WalletId,
                Type = WalletTransactionTypes.TopUp,
                Amount = amount,
                ReferenceId = idempotencyKey
            };
            var sqlInsertTx = @"
                INSERT INTO wallet_transactions (TransactionId, WalletId, Type, Amount, ReferenceId, CreatedAt)
                VALUES (@TransactionId, @WalletId, @Type, @Amount, @ReferenceId, @CreatedAt);
            ";
            await connection.ExecuteAsync(sqlInsertTx, wTx, transaction);

            transaction.Commit();
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during TopUp for driver {DriverId}", driverId);
            transaction.Rollback();
            return false;
        }
    }

    public async Task<bool> ChargeWalletAndCompletePaymentAsync(string driverId, string paymentId, decimal finalAmount, string sessionId, decimal energyConsumedKwh)
    {
        using var connection = _connectionFactory.CreateConnection();
        connection.Open();
        using var transaction = connection.BeginTransaction();
        try
        {
            // 1. Check payment status
            var sqlCheckPayment = "SELECT * FROM payment_transactions WHERE PaymentId = @PaymentId FOR UPDATE;";
            var payment = await connection.QuerySingleOrDefaultAsync<PaymentTransaction>(sqlCheckPayment, new { PaymentId = paymentId }, transaction);
            if (payment == null || payment.Status == "COMPLETED")
            {
                // If already completed or missing, act as if success (idempotent, or handled by caller)
                transaction.Commit();
                return payment?.Status == "COMPLETED";
            }

            // 2. Lock wallet
            var sqlSelectWallet = "SELECT * FROM wallets WHERE DriverId = @DriverId FOR UPDATE;";
            var wallet = await connection.QuerySingleOrDefaultAsync<Wallet>(sqlSelectWallet, new { DriverId = driverId }, transaction);
            if (wallet == null || wallet.Balance < finalAmount)
            {
                transaction.Rollback();
                return false; // Insufficient balance or missing wallet
            }

            // 3. Update wallet balance
            var sqlUpdateWallet = @"
                UPDATE wallets 
                SET Balance = Balance - @Amount, UpdatedAt = CURRENT_TIMESTAMP 
                WHERE WalletId = @WalletId;
            ";
            await connection.ExecuteAsync(sqlUpdateWallet, new { Amount = finalAmount, WalletId = wallet.WalletId }, transaction);

            // 4. Insert wallet transaction
            var wTx = new WalletTransaction
            {
                WalletId = wallet.WalletId,
                Type = WalletTransactionTypes.ChargingPayment,
                Amount = -finalAmount, // Stored as negative for charging deduction
                ReferenceId = sessionId
            };
            var sqlInsertTx = @"
                INSERT INTO wallet_transactions (TransactionId, WalletId, Type, Amount, ReferenceId, CreatedAt)
                VALUES (@TransactionId, @WalletId, @Type, @Amount, @ReferenceId, @CreatedAt);
            ";
            await connection.ExecuteAsync(sqlInsertTx, wTx, transaction);

            // 5. Update payment_transactions
            var sqlCompletePayment = @"
                UPDATE payment_transactions
                SET FinalAmount = @FinalAmount, EnergyConsumedKwh = @EnergyConsumedKwh, Status = 'COMPLETED', CompletedAt = UTC_TIMESTAMP()
                WHERE PaymentId = @PaymentId AND Status = 'AUTHORIZED';
            ";
            await connection.ExecuteAsync(sqlCompletePayment, new { FinalAmount = finalAmount, EnergyConsumedKwh = energyConsumedKwh, PaymentId = paymentId }, transaction);

            // 6. Insert Outbox message
            payment.FinalAmount = finalAmount;
            payment.Status = "COMPLETED";
            payment.CompletedAt = DateTime.UtcNow;

            var eventPayload = new
            {
                eventId = "EVT-" + Guid.NewGuid().ToString(),
                eventType = "PaymentCompleted",
                transactionId = payment.TransactionId,
                paymentId = payment.PaymentId,
                sessionId = payment.SessionId,
                driverId = payment.DriverId,
                companyId = payment.CompanyId,
                stationId = payment.StationId,
                chargerId = payment.ChargerId,
                amount = payment.FinalAmount,
                energyConsumedKwh = payment.EnergyConsumedKwh,
                currency = payment.Currency,
                paymentMethod = payment.PaymentMethod,
                status = payment.Status,
                timestamp = payment.CompletedAt
            };

            var outboxMessage = new OutboxMessage
            {
                EventType = "payment-completed",
                AggregateType = "Payment",
                AggregateId = paymentId,
                Payload = System.Text.Json.JsonSerializer.Serialize(eventPayload),
                Status = "PENDING",
                AvailableAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow
            };

            await _outboxRepository.SaveMessageAsync(outboxMessage, connection, transaction);

            transaction.Commit();
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during atomic payment completion for {PaymentId}", paymentId);
            transaction.Rollback();
            return false;
        }
    }

    public async Task<(System.Collections.Generic.IEnumerable<WalletTransaction> Transactions, int TotalCount)> GetWalletTransactionsAsync(string driverId, int page, int pageSize)
    {
        var wallet = await GetWalletByDriverIdAsync(driverId);
        if (wallet == null) return (new System.Collections.Generic.List<WalletTransaction>(), 0);

        var offset = (page - 1) * pageSize;
        var sqlCount = "SELECT COUNT(*) FROM wallet_transactions WHERE WalletId = @WalletId;";
        var sqlData = @"
            SELECT * FROM wallet_transactions 
            WHERE WalletId = @WalletId 
            ORDER BY CreatedAt DESC 
            LIMIT @Limit OFFSET @Offset;
        ";

        using var connection = _connectionFactory.CreateConnection();
        var totalCount = await connection.ExecuteScalarAsync<int>(sqlCount, new { WalletId = wallet.WalletId });
        var transactions = await connection.QueryAsync<WalletTransaction>(sqlData, new { WalletId = wallet.WalletId, Limit = pageSize, Offset = offset });

        return (transactions, totalCount);
    }
}
