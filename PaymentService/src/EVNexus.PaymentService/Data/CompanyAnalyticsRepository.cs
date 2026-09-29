using System.Collections.Generic;
using System.Threading.Tasks;
using Dapper;

namespace EVNexus.PaymentService.Data;

public class CompanyAnalyticsRepository : ICompanyAnalyticsRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public CompanyAnalyticsRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<DashboardAnalyticsDto> GetDashboardAnalyticsAsync(string companyId, System.DateTime? startDate = null, System.DateTime? endDate = null, string stationId = null)
    {
        var sql = @"
            SELECT 
                COALESCE(SUM(FinalAmount), 0) AS TotalRevenue,
                COALESCE(SUM(CASE WHEN DATE(CompletedAt) = CURDATE() THEN FinalAmount ELSE 0 END), 0) AS TotalRevenueToday,
                COALESCE(SUM(EnergyConsumedKwh), 0) AS TotalEnergyKwh,
                COUNT(PaymentId) AS CompletedTransactions
            FROM payment_transactions 
            WHERE CompanyId = @CompanyId AND Status = 'COMPLETED'
            " + (startDate.HasValue ? " AND CompletedAt >= @StartDate" : "") + @"
            " + (endDate.HasValue ? " AND CompletedAt <= @EndDate" : "") + @"
            " + (!string.IsNullOrEmpty(stationId) ? " AND StationId = @StationId" : "");

        using var connection = _connectionFactory.CreateConnection();
        return await connection.QuerySingleAsync<DashboardAnalyticsDto>(sql, new { CompanyId = companyId, StartDate = startDate, EndDate = endDate, StationId = stationId });
    }

    public async Task<IEnumerable<TransactionDto>> GetCompanyTransactionsAsync(string companyId, int limit = 50, System.DateTime? startDate = null, System.DateTime? endDate = null, string stationId = null)
    {
        var sql = @"
            SELECT 
                PaymentId AS Id,
                CompletedAt AS Timestamp,
                StationId,
                FinalAmount AS Amount,
                EnergyConsumedKwh,
                Status,
                Currency
            FROM payment_transactions 
            WHERE CompanyId = @CompanyId AND Status = 'COMPLETED'
            " + (startDate.HasValue ? " AND CompletedAt >= @StartDate" : "") + @"
            " + (endDate.HasValue ? " AND CompletedAt <= @EndDate" : "") + @"
            " + (!string.IsNullOrEmpty(stationId) ? " AND StationId = @StationId" : "") + @"
            ORDER BY CompletedAt DESC
            LIMIT @Limit";

        using var connection = _connectionFactory.CreateConnection();
        return await connection.QueryAsync<TransactionDto>(sql, new { CompanyId = companyId, Limit = limit, StartDate = startDate, EndDate = endDate, StationId = stationId });
    }

    public async Task<IEnumerable<RevenueTrendDto>> GetCompanyRevenueTrendAsync(string companyId, System.DateTime? startDate = null, System.DateTime? endDate = null, string stationId = null)
    {
        var sql = @"
            SELECT 
                DATE_FORMAT(CompletedAt, '%Y-%m-%d') AS Date,
                SUM(FinalAmount) AS Revenue,
                SUM(EnergyConsumedKwh) AS EnergyKwh,
                COUNT(PaymentId) AS Sessions
            FROM payment_transactions 
            WHERE CompanyId = @CompanyId AND Status = 'COMPLETED'
            " + (startDate.HasValue ? " AND CompletedAt >= @StartDate" : "") + @"
            " + (endDate.HasValue ? " AND CompletedAt <= @EndDate" : "") + @"
            " + (!string.IsNullOrEmpty(stationId) ? " AND StationId = @StationId" : "") + @"
            GROUP BY DATE_FORMAT(CompletedAt, '%Y-%m-%d')
            ORDER BY Date ASC";

        using var connection = _connectionFactory.CreateConnection();
        return await connection.QueryAsync<RevenueTrendDto>(sql, new { CompanyId = companyId, StartDate = startDate, EndDate = endDate, StationId = stationId });
    }

    public async Task<IEnumerable<StationAnalyticsDto>> GetStationAnalyticsAsync(string companyId, System.DateTime? startDate = null, System.DateTime? endDate = null, string stationId = null)
    {
        var sql = @"
            SELECT 
                StationId,
                DATE_FORMAT(CompletedAt, '%Y-%m-%d') AS Date,
                SUM(FinalAmount) AS Revenue,
                SUM(EnergyConsumedKwh) AS EnergyKwh,
                COUNT(PaymentId) AS Sessions
            FROM payment_transactions 
            WHERE CompanyId = @CompanyId AND Status = 'COMPLETED'
            " + (startDate.HasValue ? " AND CompletedAt >= @StartDate" : "") + @"
            " + (endDate.HasValue ? " AND CompletedAt <= @EndDate" : "") + @"
            " + (!string.IsNullOrEmpty(stationId) ? " AND StationId = @StationId" : "") + @"
            GROUP BY StationId, DATE_FORMAT(CompletedAt, '%Y-%m-%d')
            ORDER BY StationId, Date DESC";

        using var connection = _connectionFactory.CreateConnection();
        return await connection.QueryAsync<StationAnalyticsDto>(sql, new { CompanyId = companyId, StartDate = startDate, EndDate = endDate, StationId = stationId });
    }
}
