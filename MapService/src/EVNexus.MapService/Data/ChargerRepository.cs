using System.Collections.Generic;
using System.Threading.Tasks;
using Dapper;
using EVNexus.MapService.Models;

namespace EVNexus.MapService.Data;

public class ChargerRepository : IChargerRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public ChargerRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<IEnumerable<Charger>> GetChargersByStationIdAsync(string stationId)
    {
        using var connection = _connectionFactory.CreateConnection();
        var sql = "SELECT * FROM chargers WHERE StationId = @StationId ORDER BY CreatedAt ASC";
        return await connection.QueryAsync<Charger>(sql, new { StationId = stationId });
    }

    public async Task<Charger?> GetChargerByIdAsync(string id, string stationId)
    {
        using var connection = _connectionFactory.CreateConnection();
        var sql = "SELECT * FROM chargers WHERE Id = @Id AND StationId = @StationId";
        return await connection.QueryFirstOrDefaultAsync<Charger>(sql, new { Id = id, StationId = stationId });
    }

    public async Task<string> CreateChargerAsync(Charger charger)
    {
        using var connection = _connectionFactory.CreateConnection();
        var sql = @"
            INSERT INTO chargers (Id, StationId, Type, PowerKw, PricePerKwh, Status)
            VALUES (@Id, @StationId, @Type, @PowerKw, @PricePerKwh, @Status);
        ";
        await connection.ExecuteAsync(sql, charger);
        return charger.Id;
    }

    public async Task<bool> UpdateChargerAsync(Charger charger)
    {
        using var connection = _connectionFactory.CreateConnection();
        var sql = @"
            UPDATE chargers 
            SET Type = @Type, 
                PowerKw = @PowerKw, 
                PricePerKwh = @PricePerKwh,
                Status = @Status
            WHERE Id = @Id AND StationId = @StationId;
        ";
        var affected = await connection.ExecuteAsync(sql, charger);
        return affected > 0;
    }

    public async Task<bool> DeleteChargerAsync(string id, string stationId)
    {
        using var connection = _connectionFactory.CreateConnection();
        var sql = "DELETE FROM chargers WHERE Id = @Id AND StationId = @StationId";
        var affected = await connection.ExecuteAsync(sql, new { Id = id, StationId = stationId });
        return affected > 0;
    }
}
