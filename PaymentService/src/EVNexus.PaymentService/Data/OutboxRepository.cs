using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Dapper;
using EVNexus.PaymentService.Models;

namespace EVNexus.PaymentService.Data;

public class OutboxRepository : IOutboxRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public OutboxRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<long> SaveMessageAsync(OutboxMessage message)
    {
        using var connection = _connectionFactory.CreateConnection();
        return await SaveMessageAsync(message, connection, null);
    }

    public async Task<long> SaveMessageAsync(OutboxMessage message, System.Data.IDbConnection connection, System.Data.IDbTransaction? transaction)
    {
        var sql = @"
            INSERT INTO outbox_messages (EventType, AggregateType, AggregateId, Payload, Status, RetryCount, AvailableAt, CreatedAt, PublishedAt, LastError)
            VALUES (@EventType, @AggregateType, @AggregateId, @Payload, @Status, @RetryCount, @AvailableAt, @CreatedAt, @PublishedAt, @LastError);
            SELECT LAST_INSERT_ID();
        ";

        return await connection.ExecuteScalarAsync<long>(sql, message, transaction);
    }

    public async Task<IEnumerable<OutboxMessage>> GetPendingMessagesAsync(int batchSize = 50)
    {
        var sql = @"
            SELECT * FROM outbox_messages
            WHERE Status = 'PENDING' AND AvailableAt <= UTC_TIMESTAMP(6)
            ORDER BY AvailableAt ASC, CreatedAt ASC
            LIMIT @BatchSize;
        ";

        using var connection = _connectionFactory.CreateConnection();
        return await connection.QueryAsync<OutboxMessage>(sql, new { BatchSize = batchSize });
    }

    public async Task MarkAsPublishedAsync(long id)
    {
        var sql = @"
            UPDATE outbox_messages
            SET Status = 'PUBLISHED', PublishedAt = UTC_TIMESTAMP(6)
            WHERE Id = @Id;
        ";

        using var connection = _connectionFactory.CreateConnection();
        await connection.ExecuteAsync(sql, new { Id = id });
    }

    public async Task RecordFailureAsync(long id, string error, DateTime availableAt)
    {
        var sql = @"
            UPDATE outbox_messages
            SET RetryCount = RetryCount + 1,
                LastError = @Error,
                AvailableAt = @AvailableAt
            WHERE Id = @Id;
        ";

        using var connection = _connectionFactory.CreateConnection();
        await connection.ExecuteAsync(sql, new { Id = id, Error = error, AvailableAt = availableAt });
    }
}
