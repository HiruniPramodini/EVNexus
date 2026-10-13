using DashboardService.Data;
using EVNexus.DashboardService.DTOs;
using Microsoft.EntityFrameworkCore;

namespace EVNexus.DashboardService.Services;

public class DriverSummaryService
{
    private readonly DashboardDbContext _db;
    public DriverSummaryService(DashboardDbContext db) => _db = db;

    public async Task<DriverRangeSummaryDto> GetAsync(string driverId, DateTime from, DateTime to, CancellationToken ct = default)
    {
        var start = from.Date;
        var end = to.Date.AddDays(1);

        var sessions = await _db.Sessions.AsNoTracking()
            .Where(s => s.DriverId == driverId && s.StartTime >= start && s.StartTime < end)
            .OrderByDescending(s => s.StartTime)
            .ToListAsync(ct);

        var count = sessions.Count;
        var energy = (double)sessions.Sum(s => s.EnergyKwh);
        var spent = sessions.Sum(s => s.TotalCost);
        var avg = count == 0 ? 0 : sessions.Average(s => (s.EndTime - s.StartTime).TotalMinutes);

        var recent = sessions.Take(10)
            .Select(s => new RecentSessionDto(
                s.SessionId,
                s.StationName,
                s.StartTime,
                (s.EndTime - s.StartTime).TotalMinutes,
                (double)s.EnergyKwh,
                s.TotalCost))
            .ToList();

        return new DriverRangeSummaryDto(count, Math.Round(energy, 2), spent, Math.Round(avg, 1), recent);
    }
}
