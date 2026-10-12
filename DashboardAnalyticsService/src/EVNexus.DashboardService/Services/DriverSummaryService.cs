using EVNexus.DashboardService.Data;
using EVNexus.DashboardService.DTOs;
using Microsoft.EntityFrameworkCore;

namespace EVNexus.DashboardService.Services;

public class DriverSummaryService
{
    private readonly DashboardDbContext _db;
    public DriverSummaryService(DashboardDbContext db) => _db = db;

    public async Task<DriverSummaryDto> GetAsync(string driverId, DateTime from, DateTime to, CancellationToken ct = default)
    {
        var start = from.Date;
        var end = to.Date.AddDays(1);
        var q = _db.Sessions.AsNoTracking()
            .Where(s => s.DriverId == driverId && s.StartUtc >= start && s.StartUtc < end);

        var count = await q.CountAsync(ct);
        var energy = await q.SumAsync(s => (double?)s.EnergyKwh, ct) ?? 0;
        var spent = await q.SumAsync(s => (decimal?)s.Cost, ct) ?? 0m;
        var avg = await q.AverageAsync(s => (double?)s.DurationMinutes, ct) ?? 0;

        var recent = await q.OrderByDescending(s => s.StartUtc).Take(10)
            .Select(s => new RecentSessionDto(s.Id, s.StationName, s.StartUtc, s.DurationMinutes, s.EnergyKwh, s.Cost))
            .ToListAsync(ct);

        return new DriverSummaryDto(count, Math.Round(energy, 2), spent, Math.Round(avg, 1), recent);
    }
}