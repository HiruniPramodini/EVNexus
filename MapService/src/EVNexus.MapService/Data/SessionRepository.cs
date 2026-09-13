using System.Threading.Tasks;
using Dapper;
using EVNexus.MapService.Models;

namespace EVNexus.MapService.Data;

public class SessionRepository : ISessionRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public SessionRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<string> StartSessionAsync(ChargingSession session)
    {
        var sql = @"
            INSERT INTO charging_sessions (Id, StationId, DriverId, StartTime, Status, EnergyConsumedKwh, TotalCost)
            VALUES (@Id, @StationId, @DriverId, @StartTime, @Status, @EnergyConsumedKwh, @TotalCost);
        ";

        using var connection = _connectionFactory.CreateConnection();
        await connection.ExecuteAsync(sql, session);
        return session.Id;
    }

    public async Task<ChargingSession?> GetSessionByIdAsync(string id)
    {
        var sql = "SELECT * FROM charging_sessions WHERE Id = @Id;";
        using var connection = _connectionFactory.CreateConnection();
        return await connection.QuerySingleOrDefaultAsync<ChargingSession>(sql, new { Id = id });
    }

    public async Task<bool> StopSessionAsync(string id, decimal energy, decimal cost)
    {
        var sql = @"
            UPDATE charging_sessions
            SET EndTime = UTC_TIMESTAMP(), Status = 'Completed', EnergyConsumedKwh = @Energy, TotalCost = @Cost
            WHERE Id = @Id;
        ";
        using var connection = _connectionFactory.CreateConnection();
        var rows = await connection.ExecuteAsync(sql, new { Id = id, Energy = energy, Cost = cost });
        return rows > 0;
    }

    public async Task<ChargingSession?> GetActiveSessionForDriverAsync(string driverId)
    {
        var sql = "SELECT * FROM charging_sessions WHERE DriverId = @DriverId AND Status = 'Active' ORDER BY StartTime DESC LIMIT 1;";
        using var connection = _connectionFactory.CreateConnection();
        return await connection.QuerySingleOrDefaultAsync<ChargingSession>(sql, new { DriverId = driverId });
    }

    public async Task<System.Collections.Generic.IEnumerable<ChargingSession>> GetSessionHistoryForDriverAsync(string driverId)
    {
        var sql = "SELECT * FROM charging_sessions WHERE DriverId = @DriverId AND Status = 'Completed' ORDER BY EndTime DESC;";
        using var connection = _connectionFactory.CreateConnection();
        return await connection.QueryAsync<ChargingSession>(sql, new { DriverId = driverId });
    }

    public async Task<System.Collections.Generic.IEnumerable<ChargingSession>> GetActiveSessionsForTenantAsync(string tenantId)
    {
        var sql = @"
            SELECT cs.* 
            FROM charging_sessions cs
            INNER JOIN stations s ON cs.StationId = s.Id
            WHERE s.TenantId = @TenantId AND cs.Status = 'Active'
            ORDER BY cs.StartTime DESC;
        ";
        using var connection = _connectionFactory.CreateConnection();
        return await connection.QueryAsync<ChargingSession>(sql, new { TenantId = tenantId });
    }
}
