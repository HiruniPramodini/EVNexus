using DashboardService.Data;
using DashboardService.Dtos;
using Microsoft.EntityFrameworkCore;

namespace DashboardService.Services;

public interface IReportService
{
    Task<DailyUsageReport> GetDailyUsageAsync(string tenantId, DateOnly from, DateOnly to, CancellationToken ct);
}

public class ReportService : IReportService
{
    private readonly DashboardDbContext _db;
    public ReportService(DashboardDbContext db) => _db = db;

    public async Task<DailyUsageReport> GetDailyUsageAsync(string tenantId, DateOnly from, DateOnly to, CancellationToken ct)
    {
        var start = from.ToDateTime(TimeOnly.MinValue);
        var endExclusive = to.AddDays(1).ToDateTime(TimeOnly.MinValue);

        // Tenant filter is ALWAYS applied
        var grouped = await _db.Sessions
            .Where(s => s.TenantId == tenantId && s.EndTime >= start && s.EndTime < endExclusive)
            .GroupBy(s => s.EndTime.Date)
            .Select(g => new
            {
                Day = g.Key,
                Sessions = g.Count(),
                Energy = g.Sum(x => x.EnergyKwh),
                Revenue = g.Sum(x => x.TotalCost),
                Transactions = g.Count(x => x.PaymentStatus == "COMPLETED")
            })
            .ToListAsync(ct);

        var lookup = grouped.ToDictionary(x => DateOnly.FromDateTime(x.Day));

        // Zero-session days-um row ekak widiyata penawanawa
        var days = new List<DailyUsageRow>();
        for (var d = from; d <= to; d = d.AddDays(1))
        {
            days.Add(lookup.TryGetValue(d, out var r)
                ? new DailyUsageRow(d, r.Sessions, r.Energy, r.Revenue, r.Transactions)
                : new DailyUsageRow(d, 0, 0m, 0m, 0));
        }

        return new DailyUsageReport(from, to,
            days.Sum(x => x.Sessions), days.Sum(x => x.EnergyKwh),
            days.Sum(x => x.Revenue), days.Sum(x => x.Transactions), days);
    }
}