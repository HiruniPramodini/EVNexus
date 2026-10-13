using System.Text;
using DashboardService.Data;
using DashboardService.Dtos;
using DashboardService.Models;
using Microsoft.EntityFrameworkCore;

namespace DashboardService.Services;

public interface IAnalyticsService
{
    Task<List<StationTrafficRow>> GetStationTrafficAsync(string tenantId, DateOnly from, DateOnly to, CancellationToken ct);
    Task<HourlyReport> GetHourlyAsync(string tenantId, DateOnly from, DateOnly to, string? stationId, int tzOffsetMin, CancellationToken ct);
    Task<byte[]> ExportUsageCsvAsync(string tenantId, DateOnly from, DateOnly to, string? stationId, CancellationToken ct);
    Task<MonthlyReport> GetMonthlyAsync(string tenantId, int year, int month, CancellationToken ct);
    Task<PeakHourPrediction> PredictPeakHoursAsync(string tenantId, string? stationId, int tzOffsetMin, CancellationToken ct);
    Task<DemandForecast> ForecastAsync(string tenantId, string? stationId, CancellationToken ct);
}

public class AnalyticsService : IAnalyticsService
{
    private const int LookbackDays = 56;     // 8 weeks of history for AI
    private const int MinSessionsForPeak = 20;
    private readonly DashboardDbContext _db;
    public AnalyticsService(DashboardDbContext db) => _db = db;

    private IQueryable<SessionRecord> Q(string tenantId, DateTime start, DateTime endExclusive, string? stationId)
    {
        var q = _db.Sessions.AsNoTracking()
            .Where(s => s.TenantId == tenantId && s.EndTime >= start && s.EndTime < endExclusive);
        if (!string.IsNullOrEmpty(stationId)) q = q.Where(s => s.StationId == stationId);
        return q;
    }
    private static DateTime Start(DateOnly d) => d.ToDateTime(TimeOnly.MinValue);
    private static DateTime EndEx(DateOnly d) => d.AddDays(1).ToDateTime(TimeOnly.MinValue);

    public async Task<List<StationTrafficRow>> GetStationTrafficAsync(string tenantId, DateOnly from, DateOnly to, CancellationToken ct)
    {
        var rows = await Q(tenantId, Start(from), EndEx(to), null)
            .GroupBy(s => new { s.StationId, s.StationName })
            .Select(g => new
            {
                g.Key.StationId, g.Key.StationName,
                Sessions = g.Count(),
                Energy = g.Sum(x => x.EnergyKwh),
                Revenue = g.Sum(x => x.TotalCost)
            })
            .OrderByDescending(x => x.Sessions).ThenByDescending(x => x.Energy)
            .ToListAsync(ct);

        return rows.Select((r, i) => new StationTrafficRow(i + 1, r.StationId, r.StationName, r.Sessions, r.Energy, r.Revenue)).ToList();
    }

    public async Task<HourlyReport> GetHourlyAsync(string tenantId, DateOnly from, DateOnly to, string? stationId, int tz, CancellationToken ct)
    {
        var times = await Q(tenantId, Start(from), EndEx(to), stationId).Select(s => s.StartTime).ToListAsync(ct);
        var counts = new int[24];
        foreach (var t in times) counts[t.AddMinutes(tz).Hour]++;

        var hours = Enumerable.Range(0, 24).Select(h => new HourBucket(h, counts[h])).ToList();
        var max = counts.Max();
        var busiest = max == 0 ? new List<int>() : hours.Where(h => h.Sessions == max).Select(h => h.Hour).ToList();
        return new HourlyReport(from, to, stationId, times.Count, hours, busiest);
    }

    public async Task<byte[]> ExportUsageCsvAsync(string tenantId, DateOnly from, DateOnly to, string? stationId, CancellationToken ct)
    {
        var rows = await Q(tenantId, Start(from), EndEx(to), stationId)
            .GroupBy(s => new { Day = s.EndTime.Date, s.StationName })
            .Select(g => new { g.Key.Day, g.Key.StationName, Sessions = g.Count(), Energy = g.Sum(x => x.EnergyKwh), Revenue = g.Sum(x => x.TotalCost) })
            .OrderBy(x => x.Day).ThenBy(x => x.StationName)
            .ToListAsync(ct);

        var sb = new StringBuilder("Date,Station,Sessions,EnergyDeliveredKwh,Revenue\r\n");   // zero rows -> header only
        foreach (var r in rows)
            sb.Append($"{r.Day:yyyy-MM-dd},{Csv(r.StationName)},{r.Sessions},{r.Energy:0.00},{r.Revenue:0.00}\r\n");

        return Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(sb.ToString())).ToArray(); // BOM = Excel friendly
    }
    private static string Csv(string v) => v.Contains(',') || v.Contains('"') || v.Contains('\n') ? $"\"{v.Replace("\"", "\"\"")}\"" : v;

    public async Task<MonthlyReport> GetMonthlyAsync(string tenantId, int year, int month, CancellationToken ct)
    {
        var start = new DateTime(year, month, 1);
        var end = start.AddMonths(1);
        var rows = await Q(tenantId, start, end, null)
            .GroupBy(s => new { s.StationId, s.StationName })
            .Select(g => new MonthlyStationRow(g.Key.StationId, g.Key.StationName, g.Count(), g.Sum(x => x.EnergyKwh), g.Sum(x => x.TotalCost)))
            .OrderByDescending(x => x.Revenue)
            .ToListAsync(ct);

        return new MonthlyReport(year, month, end <= DateTime.UtcNow,
            rows.Sum(r => r.Sessions), rows.Sum(r => r.EnergyKwh), rows.Sum(r => r.Revenue), rows);
    }

    public async Task<PeakHourPrediction> PredictPeakHoursAsync(string tenantId, string? stationId, int tz, CancellationToken ct)
    {
        var endEx = DateTime.UtcNow.Date.AddDays(1);
        var start = endEx.AddDays(-LookbackDays);

        var times = await Q(tenantId, start, endEx, stationId).Select(s => s.StartTime).ToListAsync(ct);
        var usedFallback = false;

        if (times.Count < MinSessionsForPeak && !string.IsNullOrEmpty(stationId))
        {
            times = await Q(tenantId, start, endEx, null).Select(s => s.StartTime).ToListAsync(ct);
            usedFallback = true;
        }

        if (times.Count < MinSessionsForPeak)
            return new PeakHourPrediction(stationId, true, usedFallback, times.Count, new(), new(),
                $"Not enough charging history yet (need at least {MinSessionsForPeak} sessions).");

        var days = Math.Clamp((endEx - times.Min().Date).Days, 7, LookbackDays);
        var counts = new int[24];
        foreach (var t in times) counts[t.AddMinutes(tz).Hour]++;

        var hours = Enumerable.Range(0, 24)
            .Select(h => new PeakHourItem(h, Math.Round((double)counts[h] / days, 3), false)).ToList();
        var max = hours.Max(h => h.ExpectedSessionsPerDay);

        var peak = hours.Where(h => h.ExpectedSessionsPerDay > 0 && h.ExpectedSessionsPerDay >= max * 0.8)
            .OrderByDescending(h => h.ExpectedSessionsPerDay).Take(3).Select(h => h.Hour).OrderBy(h => h).ToList();

        hours = hours.Select(h => h with { IsPeak = peak.Contains(h.Hour) }).ToList();
        var msg = usedFallback
            ? "This station has limited history, so the company-wide pattern is shown."
            : "Based on the last 8 weeks of session start times.";
        return new PeakHourPrediction(stationId, false, usedFallback, times.Count, hours, peak, msg);
    }

    public async Task<DemandForecast> ForecastAsync(string tenantId, string? stationId, CancellationToken ct)
    {
        const string method = "Same-weekday average x recent 7-day trend";
        var assumptions = new List<string>
        {
            "Uses the last 56 days of completed sessions (today excluded from history).",
            "Each forecast day = average of the same weekday in history.",
            "Multiplied by trend = last 7 days / previous 7 days (limited to 0.5x - 1.5x).",
            "Needs at least 5 sessions on 3 different days, otherwise no forecast is produced.",
            "Estimates only; holidays, outages and price changes are not modelled."
        };

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var startDay = today.AddDays(-LookbackDays);
        var rows = await Q(tenantId, Start(startDay), Start(today), stationId)
            .GroupBy(s => s.EndTime.Date)
            .Select(g => new { Day = g.Key, N = g.Count(), E = g.Sum(x => x.EnergyKwh) })
            .ToListAsync(ct);

        var map = rows.ToDictionary(r => DateOnly.FromDateTime(r.Day));
        var hist = Enumerable.Range(0, LookbackDays).Select(i =>
        {
            var d = startDay.AddDays(i);
            return map.TryGetValue(d, out var r) ? new ForecastDay(d, r.N, (double)r.E) : new ForecastDay(d, 0, 0);
        }).ToList();

        if (rows.Sum(r => r.N) < 5 || rows.Count < 3)
            return new DemandForecast(stationId, true, method, hist, new(), assumptions,
                "Not enough history to forecast demand yet.");

        static double Avg(List<ForecastDay> l, Func<ForecastDay, double> f) => l.Count == 0 ? 0 : l.Average(f);
        var last7 = hist.TakeLast(7).ToList();
        var prev7 = hist.SkipLast(7).TakeLast(7).ToList();
        double Trend(Func<ForecastDay, double> f)
        {
            var p = Avg(prev7, f);
            return p <= 0 ? 1 : Math.Clamp(Avg(last7, f) / p, 0.5, 1.5);
        }
        var tS = Trend(x => x.Sessions);
        var tE = Trend(x => x.EnergyKwh);

        var forecast = Enumerable.Range(0, 7).Select(i =>
        {
            var d = today.AddDays(i);
            var same = hist.Where(h => h.Date.DayOfWeek == d.DayOfWeek).ToList();
            return new ForecastDay(d,
                Math.Round(Avg(same, x => x.Sessions) * tS, 2),
                Math.Round(Avg(same, x => x.EnergyKwh) * tE, 2));
        }).ToList();

        return new DemandForecast(stationId, false, method, hist.TakeLast(28).ToList(), forecast, assumptions,
            "Forecast for the next 7 days.");
    }
}