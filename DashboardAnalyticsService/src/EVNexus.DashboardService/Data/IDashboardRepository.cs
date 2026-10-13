using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using EVNexus.DashboardService.DTOs;

namespace EVNexus.DashboardService.Data;

public interface IDashboardRepository
{
    Task<DriverSummaryDto> GetDriverSummaryAsync(string driverId);
    Task<CompanyOverviewDto> GetCompanyOverviewAsync(string companyId);
    Task<IEnumerable<RevenueTrendPointDto>> GetRevenueTrendAsync(string companyId, DateTime startDate, DateTime endDate, string? stationId = null);
    Task<IEnumerable<StationTrafficDto>> GetStationTrafficAsync(string companyId, DateTime? startDate = null, DateTime? endDate = null);
    Task<IEnumerable<StationPricingDto>> GetStationPricingAsync(string companyId);
    Task<IEnumerable<StationLocationDto>> GetStationLocationsAsync(string companyId);
    Task<IEnumerable<DailyUsagePointDto>> GetDailyUsageAsync(string companyId, DateTime startDate, DateTime endDate, string? stationId = null);
    Task<MonthlyReportDto> GetMonthlyReportAsync(string companyId, int year, int month);
    Task<IEnumerable<HourlyTrafficDto>> GetHourlyDistributionAsync(string companyId, string? stationId = null, DateTime? startDate = null, DateTime? endDate = null);
    Task<IEnumerable<StationRankingDto>> GetStationRankingsAsync(string companyId, DateTime? startDate = null, DateTime? endDate = null);
    Task<IEnumerable<DailyRevenueItem>> GetHistoricalDailyRevenueAsync(string companyId, int days, string? stationId = null);
    Task SavePricingRecommendationAsync(PricingRecommendationDto recommendation, string companyId);
    Task<IEnumerable<PricingRecommendationDto>> GetPricingRecommendationsAsync(string companyId);
}

public class DailyRevenueItem
{
    public DateTime Date { get; set; }
    public decimal Revenue { get; set; }
    public int SessionCount { get; set; }
    public decimal EnergyKwh { get; set; }
}
