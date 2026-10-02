using System.Collections.Generic;
using System.Threading.Tasks;
using Dapper;
using EVNexus.MapService.Models;

namespace EVNexus.MapService.Data;

public class StationRepository : IStationRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public StationRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<string> CreateStationAsync(Station station)
    {
        var sql = @"
            INSERT INTO stations (Id, TenantId, Name, Address, Latitude, Longitude, ConnectorType, CapacityKw, PricePerKwh, IsActive, ChargingCode, PeakPricePerKwh, OffPeakPricePerKwh, PeakStartTime, PeakEndTime)
            VALUES (@Id, @TenantId, @Name, @Address, @Latitude, @Longitude, @ConnectorType, @CapacityKw, @PricePerKwh, @IsActive, @ChargingCode, @PeakPricePerKwh, @OffPeakPricePerKwh, @PeakStartTime, @PeakEndTime);
        ";

        using var connection = _connectionFactory.CreateConnection();
        await connection.ExecuteAsync(sql, station);
        return station.Id;
    }

    public async Task<bool> UpdateStationAsync(Station station)
    {
        var sql = @"
            UPDATE stations
            SET Address = @Address,
                PricePerKwh = @PricePerKwh,
                CapacityKw = @CapacityKw,
                ConnectorType = @ConnectorType,
                PeakPricePerKwh = @PeakPricePerKwh,
                OffPeakPricePerKwh = @OffPeakPricePerKwh,
                PeakStartTime = @PeakStartTime,
                PeakEndTime = @PeakEndTime
            WHERE Id = @Id AND TenantId = @TenantId AND IsActive = TRUE;
        ";

        using var connection = _connectionFactory.CreateConnection();
        var rows = await connection.ExecuteAsync(sql, station);
        return rows > 0;
    }

    public async Task<bool> DeactivateStationAsync(string id, string tenantId)
    {
        var sql = "UPDATE stations SET IsActive = FALSE WHERE Id = @Id AND TenantId = @TenantId;";
        using var connection = _connectionFactory.CreateConnection();
        var rows = await connection.ExecuteAsync(sql, new { Id = id, TenantId = tenantId });
        return rows > 0;
    }

    public async Task<Station?> GetStationByIdAsync(string id, string tenantId)
    {
        var sql = "SELECT * FROM stations WHERE Id = @Id AND TenantId = @TenantId;";
        using var connection = _connectionFactory.CreateConnection();
        return await connection.QuerySingleOrDefaultAsync<Station>(sql, new { Id = id, TenantId = tenantId });
    }

    public async Task<IEnumerable<Station>> GetAllByTenantIdAsync(string tenantId)
    {
        var sql = "SELECT * FROM stations WHERE TenantId = @TenantId ORDER BY CreatedAt DESC;";
        using var connection = _connectionFactory.CreateConnection();
        return await connection.QueryAsync<Station>(sql, new { TenantId = tenantId });
    }

    public async Task<IEnumerable<Station>> GetAllActiveStationsAsync()
    {
        var sql = "SELECT * FROM stations WHERE IsActive = TRUE;";
        using var connection = _connectionFactory.CreateConnection();
        return await connection.QueryAsync<Station>(sql);
    }
}
