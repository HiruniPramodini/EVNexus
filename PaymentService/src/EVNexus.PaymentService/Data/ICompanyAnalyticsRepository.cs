using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace EVNexus.PaymentService.Data;

public interface ICompanyAnalyticsRepository
{
    Task<DashboardAnalyticsDto> GetDashboardAnalyticsAsync(string companyId, DateTime? startDate = null, DateTime? endDate = null, string? stationId = null);
    Task<IEnumerable<TransactionDto>> GetCompanyTransactionsAsync(string companyId, int limit = 50, DateTime? startDate = null, DateTime? endDate = null, string? stationId = null);
    Task<IEnumerable<RevenueTrendDto>> GetCompanyRevenueTrendAsync(string companyId, DateTime? startDate = null, DateTime? endDate = null, string? stationId = null);
    Task<IEnumerable<StationAnalyticsDto>> GetStationAnalyticsAsync(string companyId, DateTime? startDate = null, DateTime? endDate = null, string? stationId = null);
}

public class DashboardAnalyticsDto
{
    public decimal TotalRevenue { get; set; }
    public decimal TotalRevenueToday { get; set; }
    public decimal TotalEnergyKwh { get; set; }
    public int CompletedTransactions { get; set; }
}

public class TransactionDto
{
    public string Id { get; set; } = string.Empty;
    public string Timestamp { get; set; } = string.Empty;
    public string StationId { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public decimal EnergyConsumedKwh { get; set; }
    public string Status { get; set; } = string.Empty;
    public string Currency { get; set; } = string.Empty;
}

public class RevenueTrendDto
{
    public string Date { get; set; } = string.Empty;
    public decimal Revenue { get; set; }
    public decimal EnergyKwh { get; set; }
    public int Sessions { get; set; }
}

public class StationAnalyticsDto
{
    public string StationId { get; set; } = string.Empty;
    public string Date { get; set; } = string.Empty;
    public decimal Revenue { get; set; }
    public decimal EnergyKwh { get; set; }
    public int Sessions { get; set; }
}
