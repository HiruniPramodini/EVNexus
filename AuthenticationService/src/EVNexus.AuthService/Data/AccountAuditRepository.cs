using System.Data;
using EVNexus.AuthService.Models;
using MySqlConnector;

namespace EVNexus.AuthService.Data;

public class AccountAuditRepository : IAccountAuditRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public AccountAuditRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task RecordStatusAuditAsync(AccountStatusAudit audit, CancellationToken cancellationToken = default)
    {
        const string sql = @"
            INSERT INTO account_status_audits (
                audit_id, account_id, account_type, action, previous_status, new_status, reason, performed_by, timestamp
            ) VALUES (
                @audit_id, @account_id, @account_type, @action, @previous_status, @new_status, @reason, @performed_by, @timestamp
            );
        ";

        await using var connection = await _connectionFactory.CreateOpenConnectionAsync(cancellationToken);
        await using var command = new MySqlCommand(sql, connection);
        command.Parameters.Add("@audit_id", MySqlDbType.VarChar, 50).Value = audit.AuditId;
        command.Parameters.Add("@account_id", MySqlDbType.VarChar, 50).Value = audit.AccountId;
        command.Parameters.Add("@account_type", MySqlDbType.VarChar, 50).Value = audit.AccountType;
        command.Parameters.Add("@action", MySqlDbType.VarChar, 50).Value = audit.Action;
        command.Parameters.Add("@previous_status", MySqlDbType.VarChar, 50).Value = audit.PreviousStatus;
        command.Parameters.Add("@new_status", MySqlDbType.VarChar, 50).Value = audit.NewStatus;
        command.Parameters.Add("@reason", MySqlDbType.VarChar, 500).Value = (object?)audit.Reason ?? DBNull.Value;
        command.Parameters.Add("@performed_by", MySqlDbType.VarChar, 100).Value = audit.PerformedBy;
        command.Parameters.Add("@timestamp", MySqlDbType.DateTime).Value = audit.Timestamp;

        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<AccountStatusAudit>> GetAuditHistoryByAccountIdAsync(string accountId, CancellationToken cancellationToken = default)
    {
        const string sql = @"
            SELECT audit_id, account_id, account_type, action, previous_status, new_status, reason, performed_by, timestamp
            FROM account_status_audits
            WHERE account_id = @account_id
            ORDER BY timestamp DESC;
        ";

        await using var connection = await _connectionFactory.CreateOpenConnectionAsync(cancellationToken);
        await using var command = new MySqlCommand(sql, connection);
        command.Parameters.Add("@account_id", MySqlDbType.VarChar, 50).Value = accountId.Trim();

        var audits = new List<AccountStatusAudit>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            var reasonOrdinal = reader.GetOrdinal("reason");
            audits.Add(new AccountStatusAudit
            {
                AuditId = reader.GetString("audit_id"),
                AccountId = reader.GetString("account_id"),
                AccountType = reader.GetString("account_type"),
                Action = reader.GetString("action"),
                PreviousStatus = reader.GetString("previous_status"),
                NewStatus = reader.GetString("new_status"),
                Reason = !reader.IsDBNull(reasonOrdinal) ? reader.GetString(reasonOrdinal) : null,
                PerformedBy = reader.GetString("performed_by"),
                Timestamp = reader.GetDateTime("timestamp")
            });
        }

        return audits;
    }
}
