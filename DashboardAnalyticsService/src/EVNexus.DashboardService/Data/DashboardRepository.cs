using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using Dapper;
using EVNexus.DashboardService.DTOs;

namespace EVNexus.DashboardService.Data;

public class DashboardRepository : IDashboardRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public DashboardRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<DriverSummaryDto> GetDriverSummaryAsync(string driverId)
    {
        using var connection = _connectionFactory.CreateConnection();
        const string sql = @"
            SELECT 
                COUNT(*) AS TotalCompletedSessions,
                COALESCE(SUM(EnergyConsumedKwh), 0) AS TotalEnergyConsumedKwh,
                COALESCE(SUM(TotalCost), 0) AS TotalAmountSpent,
                COALESCE(MAX(StartTime), CURRENT_TIMESTAMP) AS LastSessionDate
            FROM charging_sessions
            WHERE DriverId = @DriverId AND Status = 'Completed';
        ";

        var result = await connection.QueryFirstOrDefaultAsync<dynamic>(sql, new { DriverId = driverId });
        return new DriverSummaryDto
        {
            DriverId = driverId,
            TotalCompletedSessions = result != null ? (int)result.TotalCompletedSessions : 0,
            TotalEnergyConsumedKwh = result != null ? (decimal)result.TotalEnergyConsumedKwh : 0m,
            TotalAmountSpent = result != null ? (decimal)result.TotalAmountSpent : 0m,
            Currency = "LKR",
            LastSessionDate = result?.LastSessionDate != null ? (DateTime)result.LastSessionDate : DateTime.UtcNow
        };
    }

    public async Task<CompanyOverviewDto> GetCompanyOverviewAsync(string companyId)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string stationCountSql = "SELECT COUNT(*) FROM stations WHERE TenantId = @CompanyId AND IsActive = 1;";
        var totalStations = await connection.ExecuteScalarAsync<int>(stationCountSql, new { CompanyId = companyId });

        const string sessionSql = @"
            SELECT 
                COUNT(CASE WHEN Status = 'Active' THEN 1 END) AS ActiveSessionsCount,
                COUNT(CASE WHEN Status = 'Completed' THEN 1 END) AS TotalCompletedSessions,
                COALESCE(SUM(CASE WHEN Status = 'Completed' THEN TotalCost ELSE 0 END), 0) AS TotalRevenue,
                COALESCE(SUM(CASE WHEN Status = 'Completed' THEN EnergyConsumedKwh ELSE 0 END), 0) AS TotalEnergyDeliveredKwh,
                COALESCE(SUM(CASE WHEN Status = 'Completed' AND DATE(StartTime) = CURRENT_DATE() THEN TotalCost ELSE 0 END), 0) AS TodayRevenue,
                COALESCE(SUM(CASE WHEN Status = 'Completed' AND MONTH(StartTime) = MONTH(CURRENT_DATE()) AND YEAR(StartTime) = YEAR(CURRENT_DATE()) THEN TotalCost ELSE 0 END), 0) AS MonthlyRevenue
            FROM charging_sessions
            WHERE CompanyId = @CompanyId;
        ";

        var sessionMetrics = await connection.QueryFirstOrDefaultAsync<dynamic>(sessionSql, new { CompanyId = companyId });

        return new CompanyOverviewDto
        {
            CompanyId = companyId,
            TotalStations = totalStations,
            ActiveSessionsCount = sessionMetrics != null ? (int)sessionMetrics.ActiveSessionsCount : 0,
            TotalCompletedSessions = sessionMetrics != null ? (int)sessionMetrics.TotalCompletedSessions : 0,
            TotalRevenue = sessionMetrics != null ? (decimal)sessionMetrics.TotalRevenue : 0m,
            TotalEnergyDeliveredKwh = sessionMetrics != null ? (decimal)sessionMetrics.TotalEnergyDeliveredKwh : 0m,
            TodayRevenue = sessionMetrics != null ? (decimal)sessionMetrics.TodayRevenue : 0m,
            MonthlyRevenue = sessionMetrics != null ? (decimal)sessionMetrics.MonthlyRevenue : 0m,
            Currency = "LKR"
        };
    }

    public async Task<IEnumerable<RevenueTrendPointDto>> GetRevenueTrendAsync(string companyId, DateTime startDate, DateTime endDate, string? stationId = null)
    {
        using var connection = _connectionFactory.CreateConnection();
        var sql = @"
            SELECT 
                DATE_FORMAT(StartTime, '%Y-%m-%d') AS Date,
                COALESCE(SUM(TotalCost), 0) AS Revenue,
                COUNT(*) AS SessionCount
            FROM charging_sessions
            WHERE CompanyId = @CompanyId
              AND Status = 'Completed'
              AND StartTime >= @StartDate 
              AND StartTime <= @EndDate
              " + (string.IsNullOrEmpty(stationId) ? "" : "AND StationId = @StationId") + @"
            GROUP BY DATE_FORMAT(StartTime, '%Y-%m-%d')
            ORDER BY Date ASC;
        ";

        var results = await connection.QueryAsync<RevenueTrendPointDto>(sql, new 
        { 
            CompanyId = companyId, 
            StartDate = startDate, 
            EndDate = endDate,
            StationId = stationId 
        });

        // Ensure days with 0 revenue are filled in continuous range
        var dict = results.ToDictionary(r => r.Date, r => r);
        var filledList = new List<RevenueTrendPointDto>();
        for (var dt = startDate.Date; dt <= endDate.Date; dt = dt.AddDays(1))
        {
            var key = dt.ToString("yyyy-MM-dd");
            if (dict.TryGetValue(key, out var val))
            {
                filledList.Add(val);
            }
            else
            {
                filledList.Add(new RevenueTrendPointDto { Date = key, Revenue = 0m, SessionCount = 0 });
            }
        }

        return filledList;
    }

    public async Task<IEnumerable<StationTrafficDto>> GetStationTrafficAsync(string companyId, DateTime? startDate = null, DateTime? endDate = null)
    {
        using var connection = _connectionFactory.CreateConnection();
        var sql = @"
            SELECT 
                s.Id AS StationId,
                s.Name AS StationName,
                s.Address,
                COUNT(cs.Id) AS UsageCount,
                COALESCE(SUM(cs.EnergyConsumedKwh), 0) AS TotalEnergyDeliveredKwh,
                COALESCE(SUM(cs.TotalCost), 0) AS TotalRevenue
            FROM stations s
            LEFT JOIN charging_sessions cs ON s.Id = cs.StationId 
                AND cs.Status = 'Completed'
                " + (startDate.HasValue ? " AND cs.StartTime >= @StartDate " : "") + @"
                " + (endDate.HasValue ? " AND cs.StartTime <= @EndDate " : "") + @"
            WHERE s.TenantId = @CompanyId
            GROUP BY s.Id, s.Name, s.Address
            ORDER BY UsageCount DESC;
        ";

        return await connection.QueryAsync<StationTrafficDto>(sql, new 
        { 
            CompanyId = companyId, 
            StartDate = startDate, 
            EndDate = endDate 
        });
    }

    public async Task<IEnumerable<StationPricingDto>> GetStationPricingAsync(string companyId)
    {
        using var connection = _connectionFactory.CreateConnection();
        const string sql = @"
            SELECT 
                Id AS StationId,
                Name AS StationName,
                ConnectorType,
                PricePerKwh AS StandardPricePerKwh,
                PeakPricePerKwh,
                OffPeakPricePerKwh,
                PeakStartTime,
                PeakEndTime
            FROM stations
            WHERE TenantId = @CompanyId
            ORDER BY Name ASC;
        ";

        return await connection.QueryAsync<StationPricingDto>(sql, new { CompanyId = companyId });
    }

    public async Task<IEnumerable<StationLocationDto>> GetStationLocationsAsync(string companyId)
    {
        using var connection = _connectionFactory.CreateConnection();
        const string sql = @"
            SELECT 
                Id AS StationId,
                Name AS StationName,
                Address,
                Latitude,
                Longitude,
                ConnectorType,
                CapacityKw,
                CASE WHEN IsActive = 1 THEN 'Active' ELSE 'Inactive' END AS Status
            FROM stations
            WHERE TenantId = @CompanyId
            ORDER BY Name ASC;
        ";

        return await connection.QueryAsync<StationLocationDto>(sql, new { CompanyId = companyId });
    }

    public async Task<IEnumerable<DailyUsagePointDto>> GetDailyUsageAsync(string companyId, DateTime startDate, DateTime endDate, string? stationId = null)
    {
        using var connection = _connectionFactory.CreateConnection();
        var sql = @"
            SELECT 
                DATE_FORMAT(StartTime, '%Y-%m-%d') AS Date,
                COUNT(*) AS SessionCount,
                COALESCE(SUM(EnergyConsumedKwh), 0) AS EnergyDeliveredKwh,
                COALESCE(SUM(TotalCost), 0) AS Revenue
            FROM charging_sessions
            WHERE CompanyId = @CompanyId
              AND Status = 'Completed'
              AND StartTime >= @StartDate
              AND StartTime <= @EndDate
              " + (string.IsNullOrEmpty(stationId) ? "" : "AND StationId = @StationId") + @"
            GROUP BY DATE_FORMAT(StartTime, '%Y-%m-%d')
            ORDER BY Date ASC;
        ";

        var results = await connection.QueryAsync<DailyUsagePointDto>(sql, new 
        { 
            CompanyId = companyId, 
            StartDate = startDate, 
            EndDate = endDate,
            StationId = stationId 
        });

        var dict = results.ToDictionary(r => r.Date, r => r);
        var filledList = new List<DailyUsagePointDto>();
        for (var dt = startDate.Date; dt <= endDate.Date; dt = dt.AddDays(1))
        {
            var key = dt.ToString("yyyy-MM-dd");
            if (dict.TryGetValue(key, out var val))
            {
                filledList.Add(val);
            }
            else
            {
                filledList.Add(new DailyUsagePointDto { Date = key, SessionCount = 0, EnergyDeliveredKwh = 0m, Revenue = 0m });
            }
        }

        return filledList;
    }

    public async Task<MonthlyReportDto> GetMonthlyReportAsync(string companyId, int year, int month)
    {
        using var connection = _connectionFactory.CreateConnection();
        var startDate = new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc);
        var endDate = startDate.AddMonths(1).AddTicks(-1);

        var breakdowns = (await GetStationTrafficAsync(companyId, startDate, endDate)).ToList();

        var totalSessions = breakdowns.Sum(b => b.UsageCount);
        var totalEnergy = breakdowns.Sum(b => b.TotalEnergyDeliveredKwh);
        var totalRevenue = breakdowns.Sum(b => b.TotalRevenue);

        return new MonthlyReportDto
        {
            Month = month,
            Year = year,
            MonthName = CultureInfo.CurrentCulture.DateTimeFormat.GetMonthName(month),
            TotalSessions = totalSessions,
            TotalEnergyDeliveredKwh = totalEnergy,
            TotalRevenue = totalRevenue,
            StationBreakdowns = breakdowns
        };
    }

    public async Task<IEnumerable<HourlyTrafficDto>> GetHourlyDistributionAsync(string companyId, string? stationId = null, DateTime? startDate = null, DateTime? endDate = null)
    {
        using var connection = _connectionFactory.CreateConnection();
        var sql = @"
            SELECT 
                HOUR(StartTime) AS Hour,
                COUNT(*) AS SessionCount,
                COALESCE(SUM(EnergyConsumedKwh), 0) AS EnergyDeliveredKwh
            FROM charging_sessions
            WHERE CompanyId = @CompanyId
              AND Status = 'Completed'
              " + (string.IsNullOrEmpty(stationId) ? "" : "AND StationId = @StationId") + @"
              " + (startDate.HasValue ? "AND StartTime >= @StartDate" : "") + @"
              " + (endDate.HasValue ? "AND StartTime <= @EndDate" : "") + @"
            GROUP BY HOUR(StartTime)
            ORDER BY Hour ASC;
        ";

        var queryResults = (await connection.QueryAsync<dynamic>(sql, new 
        { 
            CompanyId = companyId, 
            StationId = stationId,
            StartDate = startDate,
            EndDate = endDate
        })).ToList();

        var hourlyMap = queryResults.ToDictionary(
            r => (int)r.Hour,
            r => new { Count = (int)r.SessionCount, Energy = (decimal)r.EnergyDeliveredKwh }
        );

        var totalSessions = queryResults.Sum(r => (int)r.SessionCount);
        var maxSessionCount = queryResults.Count > 0 ? queryResults.Max(r => (int)r.SessionCount) : 0;

        var full24Hours = new List<HourlyTrafficDto>();
        for (int h = 0; h < 24; h++)
        {
            int count = 0;
            decimal energy = 0m;
            if (hourlyMap.TryGetValue(h, out var found))
            {
                count = found.Count;
                energy = found.Energy;
            }

            full24Hours.Add(new HourlyTrafficDto
            {
                Hour = h,
                SessionCount = count,
                EnergyDeliveredKwh = energy,
                PercentageOfTotal = totalSessions > 0 ? Math.Round((double)count / totalSessions * 100.0, 1) : 0.0,
                IsBusiestHour = count > 0 && count == maxSessionCount
            });
        }

        return full24Hours;
    }

    public async Task<IEnumerable<StationRankingDto>> GetStationRankingsAsync(string companyId, DateTime? startDate = null, DateTime? endDate = null)
    {
        var traffic = (await GetStationTrafficAsync(companyId, startDate, endDate)).ToList();
        var ranked = new List<StationRankingDto>();
        
        for (int i = 0; i < traffic.Count; i++)
        {
            ranked.Add(new StationRankingDto
            {
                Rank = i + 1,
                StationId = traffic[i].StationId,
                StationName = traffic[i].StationName,
                SessionCount = traffic[i].UsageCount,
                EnergyDeliveredKwh = traffic[i].TotalEnergyDeliveredKwh,
                TotalRevenue = traffic[i].TotalRevenue,
                IsTopStation = i == 0 && traffic[i].UsageCount > 0
            });
        }

        return ranked;
    }

    public async Task<IEnumerable<DailyRevenueItem>> GetHistoricalDailyRevenueAsync(string companyId, int days, string? stationId = null)
    {
        using var connection = _connectionFactory.CreateConnection();
        var startDate = DateTime.UtcNow.Date.AddDays(-days);

        var sql = @"
            SELECT 
                DATE(StartTime) AS Date,
                COALESCE(SUM(TotalCost), 0) AS Revenue,
                COUNT(*) AS SessionCount,
                COALESCE(SUM(EnergyConsumedKwh), 0) AS EnergyKwh
            FROM charging_sessions
            WHERE CompanyId = @CompanyId
              AND Status = 'Completed'
              AND StartTime >= @StartDate
              " + (string.IsNullOrEmpty(stationId) ? "" : "AND StationId = @StationId") + @"
            GROUP BY DATE(StartTime)
            ORDER BY Date ASC;
        ";

        var raw = (await connection.QueryAsync<dynamic>(sql, new 
        { 
            CompanyId = companyId, 
            StartDate = startDate, 
            StationId = stationId 
        })).ToList();

        var dict = raw.ToDictionary(
            r => Convert.ToDateTime(r.Date).Date,
            r => new DailyRevenueItem
            {
                Date = Convert.ToDateTime(r.Date).Date,
                Revenue = Convert.ToDecimal(r.Revenue),
                SessionCount = Convert.ToInt32(r.SessionCount),
                EnergyKwh = Convert.ToDecimal(r.EnergyKwh)
            }
        );

        var filled = new List<DailyRevenueItem>();
        for (int i = days; i >= 0; i--)
        {
            var d = DateTime.UtcNow.Date.AddDays(-i);
            if (dict.TryGetValue(d, out var item))
            {
                filled.Add(item);
            }
            else
            {
                filled.Add(new DailyRevenueItem { Date = d, Revenue = 0m, SessionCount = 0, EnergyKwh = 0m });
            }
        }

        return filled;
    }

    public async Task SavePricingRecommendationAsync(PricingRecommendationDto recommendation, string companyId)
    {
        using var connection = _connectionFactory.CreateConnection();
        const string sql = @"
            INSERT INTO dashboard_pricing_recommendations 
                (Id, CompanyId, StationId, RecommendationType, RecommendationText, CurrentStandardPrice, SuggestedPeakPrice, SuggestedOffPeakPrice, Rationale, ExpectedImpact)
            VALUES 
                (@Id, @CompanyId, @StationId, @RecommendationType, @RecommendationText, @CurrentStandardPrice, @SuggestedPeakPrice, @SuggestedOffPeakPrice, @Rationale, @ExpectedImpact);
        ";

        await connection.ExecuteAsync(sql, new 
        {
            Id = Guid.NewGuid().ToString(),
            CompanyId = companyId,
            recommendation.StationId,
            recommendation.RecommendationType,
            recommendation.RecommendationText,
            recommendation.CurrentStandardPrice,
            recommendation.SuggestedPeakPrice,
            recommendation.SuggestedOffPeakPrice,
            recommendation.Rationale,
            recommendation.ExpectedImpact
        });
    }

    public async Task<IEnumerable<PricingRecommendationDto>> GetPricingRecommendationsAsync(string companyId)
    {
        using var connection = _connectionFactory.CreateConnection();
        const string sql = @"
            SELECT 
                StationId,
                RecommendationType,
                RecommendationText,
                CurrentStandardPrice,
                SuggestedPeakPrice,
                SuggestedOffPeakPrice,
                Rationale,
                ExpectedImpact,
                CreatedAt AS GeneratedAt
            FROM dashboard_pricing_recommendations
            WHERE CompanyId = @CompanyId
            ORDER BY CreatedAt DESC
            LIMIT 50;
        ";

        return await connection.QueryAsync<PricingRecommendationDto>(sql, new { CompanyId = companyId });
    }
}
