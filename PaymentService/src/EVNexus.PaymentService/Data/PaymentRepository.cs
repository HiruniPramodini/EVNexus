using System;
using System.Threading.Tasks;
using Dapper;
using EVNexus.PaymentService.Models;

namespace EVNexus.PaymentService.Data;

public class PaymentRepository : IPaymentRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public PaymentRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<string> AuthorizePaymentAsync(PaymentTransaction transaction)
    {
        transaction.TransactionId = "TXN-" + DateTime.UtcNow.ToString("yyyyMMddHHmmss") + "-" + Guid.NewGuid().ToString().Substring(0, 4);
        transaction.Status = "AUTHORIZED";
        
        var sql = @"
            INSERT INTO payment_transactions (PaymentId, TransactionId, SessionId, DriverId, CompanyId, StationId, ChargerId, EstimatedAmount, FinalAmount, Currency, PaymentMethod, Status, CreatedAt)
            VALUES (@PaymentId, @TransactionId, @SessionId, @DriverId, @CompanyId, @StationId, @ChargerId, @EstimatedAmount, @FinalAmount, @Currency, @PaymentMethod, @Status, @CreatedAt);
        ";

        using var connection = _connectionFactory.CreateConnection();
        await connection.ExecuteAsync(sql, transaction);
        return transaction.PaymentId;
    }

    public async Task<bool> CompletePaymentAsync(string paymentId, decimal finalAmount)
    {
        var sql = @"
            UPDATE payment_transactions
            SET FinalAmount = @FinalAmount, Status = 'COMPLETED', CompletedAt = UTC_TIMESTAMP()
            WHERE PaymentId = @PaymentId AND Status = 'AUTHORIZED';
        ";

        using var connection = _connectionFactory.CreateConnection();
        var rows = await connection.ExecuteAsync(sql, new { PaymentId = paymentId, FinalAmount = finalAmount });
        return rows > 0;
    }

    public async Task<PaymentTransaction?> GetPaymentByIdAsync(string paymentId)
    {
        var sql = "SELECT * FROM payment_transactions WHERE PaymentId = @PaymentId;";
        using var connection = _connectionFactory.CreateConnection();
        return await connection.QuerySingleOrDefaultAsync<PaymentTransaction>(sql, new { PaymentId = paymentId });
    }

    public async Task<PaymentTransaction?> GetPaymentBySessionIdAsync(string sessionId)
    {
        var sql = "SELECT * FROM payment_transactions WHERE SessionId = @SessionId LIMIT 1;";
        using var connection = _connectionFactory.CreateConnection();
        return await connection.QuerySingleOrDefaultAsync<PaymentTransaction>(sql, new { SessionId = sessionId });
    }
}
