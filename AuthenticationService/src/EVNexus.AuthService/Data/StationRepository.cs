using System.Data;
using EVNexus.AuthService.Exceptions;
using EVNexus.AuthService.Models;
using EVNexus.AuthService.Services;
using MySqlConnector;

namespace EVNexus.AuthService.Data;

public interface IStationRepository
{
    Task<IReadOnlyList<Station>> GetStationsAsync(CancellationToken cancellationToken = default);
    Task<Station?> GetStationByIdAsync(string stationId, CancellationToken cancellationToken = default);
    Task<Station?> GetStationByIdGlobalAsync(string stationId, CancellationToken cancellationToken = default);
    Task<Station> CreateStationAsync(Station station, CancellationToken cancellationToken = default);
    Task<bool> UpdateStationAsync(Station station, CancellationToken cancellationToken = default);
    Task<bool> DeleteStationAsync(string stationId, CancellationToken cancellationToken = default);
}

public class StationRepository : IStationRepository
{
    private const string ParamTenantId = "@tenant_id";
    private const string ParamStationId = "@station_id";

    private readonly IDbConnectionFactory _connectionFactory;
    private readonly ITenantContext _tenantContext;

    public StationRepository(IDbConnectionFactory connectionFactory, ITenantContext tenantContext)
    {
        _connectionFactory = connectionFactory;
        _tenantContext = tenantContext;
    }

    private string EnsureTenantId()
    {
        if (string.IsNullOrWhiteSpace(_tenantContext.TenantId))
        {
            throw new CrossTenantAccessException("Tenant identification is missing. Company data access must be scoped to a valid tenant.");
        }
        return _tenantContext.TenantId;
    }

    public async Task<IReadOnlyList<Station>> GetStationsAsync(CancellationToken cancellationToken = default)
    {
        var tenantId = EnsureTenantId();

        const string sql = @"
            SELECT station_id, tenant_id, name, location, latitude, longitude, status, total_ports, created_at, updated_at
            FROM charging_stations
            WHERE tenant_id = @tenant_id
            ORDER BY created_at DESC;
        ";

        await using var connection = await _connectionFactory.CreateOpenConnectionAsync(cancellationToken);
        await using var command = new MySqlCommand(sql, connection);
        command.Parameters.Add(ParamTenantId, MySqlDbType.VarChar, 50).Value = tenantId;

        var stations = new List<Station>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            stations.Add(MapStation(reader));
        }

        return stations;
    }

    public async Task<Station?> GetStationByIdAsync(string stationId, CancellationToken cancellationToken = default)
    {
        var tenantId = EnsureTenantId();

        const string sql = @"
            SELECT station_id, tenant_id, name, location, latitude, longitude, status, total_ports, created_at, updated_at
            FROM charging_stations
            WHERE station_id = @station_id AND tenant_id = @tenant_id
            LIMIT 1;
        ";

        await using var connection = await _connectionFactory.CreateOpenConnectionAsync(cancellationToken);
        await using var command = new MySqlCommand(sql, connection);
        command.Parameters.Add(ParamStationId, MySqlDbType.VarChar, 50).Value = stationId;
        command.Parameters.Add(ParamTenantId, MySqlDbType.VarChar, 50).Value = tenantId;

        await using var reader = await command.ExecuteReaderAsync(CommandBehavior.SingleRow, cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }

        return MapStation(reader);
    }

    public async Task<Station?> GetStationByIdGlobalAsync(string stationId, CancellationToken cancellationToken = default)
    {
        const string sql = @"
            SELECT station_id, tenant_id, name, location, latitude, longitude, status, total_ports, created_at, updated_at
            FROM charging_stations
            WHERE station_id = @station_id
            LIMIT 1;
        ";

        await using var connection = await _connectionFactory.CreateOpenConnectionAsync(cancellationToken);
        await using var command = new MySqlCommand(sql, connection);
        command.Parameters.Add(ParamStationId, MySqlDbType.VarChar, 50).Value = stationId;

        await using var reader = await command.ExecuteReaderAsync(CommandBehavior.SingleRow, cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }

        return MapStation(reader);
    }

    public async Task<Station> CreateStationAsync(Station station, CancellationToken cancellationToken = default)
    {
        var tenantId = EnsureTenantId();
        station.TenantId = tenantId; // Enforce stamping from active ITenantContext

        const string sql = @"
            INSERT INTO charging_stations (
                station_id,
                tenant_id,
                name,
                location,
                latitude,
                longitude,
                status,
                total_ports,
                created_at,
                updated_at
            ) VALUES (
                @station_id,
                @tenant_id,
                @name,
                @location,
                @latitude,
                @longitude,
                @status,
                @total_ports,
                @created_at,
                @updated_at
            );
        ";

        await using var connection = await _connectionFactory.CreateOpenConnectionAsync(cancellationToken);
        await using var command = new MySqlCommand(sql, connection);

        command.Parameters.Add(ParamStationId, MySqlDbType.VarChar, 50).Value = station.StationId;
        command.Parameters.Add(ParamTenantId, MySqlDbType.VarChar, 50).Value = tenantId;
        command.Parameters.Add("@name", MySqlDbType.VarChar, 255).Value = station.Name;
        command.Parameters.Add("@location", MySqlDbType.VarChar, 255).Value = station.Location;
        command.Parameters.Add("@latitude", MySqlDbType.Decimal).Value = (object?)station.Latitude ?? DBNull.Value;
        command.Parameters.Add("@longitude", MySqlDbType.Decimal).Value = (object?)station.Longitude ?? DBNull.Value;
        command.Parameters.Add("@status", MySqlDbType.VarChar, 50).Value = station.Status;
        command.Parameters.Add("@total_ports", MySqlDbType.Int32).Value = station.TotalPorts;
        command.Parameters.Add("@created_at", MySqlDbType.DateTime).Value = station.CreatedAt;
        command.Parameters.Add("@updated_at", MySqlDbType.DateTime).Value = station.UpdatedAt;

        await command.ExecuteNonQueryAsync(cancellationToken);
        return station;
    }

    public async Task<bool> UpdateStationAsync(Station station, CancellationToken cancellationToken = default)
    {
        var tenantId = EnsureTenantId();

        const string sql = @"
            UPDATE charging_stations
            SET name = @name,
                location = @location,
                latitude = @latitude,
                longitude = @longitude,
                status = @status,
                total_ports = @total_ports,
                updated_at = @updated_at
            WHERE station_id = @station_id AND tenant_id = @tenant_id;
        ";

        await using var connection = await _connectionFactory.CreateOpenConnectionAsync(cancellationToken);
        await using var command = new MySqlCommand(sql, connection);

        command.Parameters.Add(ParamStationId, MySqlDbType.VarChar, 50).Value = station.StationId;
        command.Parameters.Add(ParamTenantId, MySqlDbType.VarChar, 50).Value = tenantId;
        command.Parameters.Add("@name", MySqlDbType.VarChar, 255).Value = station.Name;
        command.Parameters.Add("@location", MySqlDbType.VarChar, 255).Value = station.Location;
        command.Parameters.Add("@latitude", MySqlDbType.Decimal).Value = (object?)station.Latitude ?? DBNull.Value;
        command.Parameters.Add("@longitude", MySqlDbType.Decimal).Value = (object?)station.Longitude ?? DBNull.Value;
        command.Parameters.Add("@status", MySqlDbType.VarChar, 50).Value = station.Status;
        command.Parameters.Add("@total_ports", MySqlDbType.Int32).Value = station.TotalPorts;
        command.Parameters.Add("@updated_at", MySqlDbType.DateTime).Value = DateTime.UtcNow;

        var rowsAffected = await command.ExecuteNonQueryAsync(cancellationToken);
        return rowsAffected > 0;
    }

    public async Task<bool> DeleteStationAsync(string stationId, CancellationToken cancellationToken = default)
    {
        var tenantId = EnsureTenantId();

        const string sql = @"
            DELETE FROM charging_stations
            WHERE station_id = @station_id AND tenant_id = @tenant_id;
        ";

        await using var connection = await _connectionFactory.CreateOpenConnectionAsync(cancellationToken);
        await using var command = new MySqlCommand(sql, connection);
        command.Parameters.Add(ParamStationId, MySqlDbType.VarChar, 50).Value = stationId;
        command.Parameters.Add(ParamTenantId, MySqlDbType.VarChar, 50).Value = tenantId;

        var rowsAffected = await command.ExecuteNonQueryAsync(cancellationToken);
        return rowsAffected > 0;
    }

    private static Station MapStation(MySqlDataReader reader)
    {
        return new Station
        {
            StationId = reader.GetString("station_id"),
            TenantId = reader.GetString("tenant_id"),
            Name = reader.GetString("name"),
            Location = reader.GetString("location"),
            Latitude = reader.IsDBNull(reader.GetOrdinal("latitude")) ? null : reader.GetDecimal("latitude"),
            Longitude = reader.IsDBNull(reader.GetOrdinal("longitude")) ? null : reader.GetDecimal("longitude"),
            Status = reader.GetString("status"),
            TotalPorts = reader.GetInt32("total_ports"),
            CreatedAt = reader.GetDateTime("created_at"),
            UpdatedAt = reader.GetDateTime("updated_at")
        };
    }
}
