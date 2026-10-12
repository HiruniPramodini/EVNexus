using EVNexus.DashboardService.Data;
using EVNexus.DashboardService.Models;
using EVNexus.DashboardService.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

public class DriverSummaryServiceTests
{
    private static DashboardDbContext NewDb()
    {
        var o = new DbContextOptionsBuilder<DashboardDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        return new DashboardDbContext(o);
    }

    private static ChargingSessionRecord S(string id, string driver, DateTime start, double kwh, decimal cost) => new()
    {
        Id = id, DriverId = driver, StationName = "A", StartUtc = start, EndUtc = start.AddMinutes(30),
        DurationMinutes = 30, EnergyKwh = kwh, Cost = cost
    };

    [Fact]
    public async Task Returns_only_the_requested_drivers_sessions()
    {
        var db = NewDb();
        var d = new DateTime(2026, 10, 5, 10, 0, 0, DateTimeKind.Utc);
        db.Sessions.AddRange(S("1", "d1", d, 10, 5m), S("2", "d2", d, 99, 99m));
        await db.SaveChangesAsync();

        var r = await new DriverSummaryService(db).GetAsync("d1", d.Date, d.Date);

        Assert.Equal(1, r.TotalSessions);
        Assert.Equal(10, r.TotalEnergyKwh);
        Assert.Equal(5m, r.TotalSpent);
    }

    [Fact]
    public async Task Filters_by_date_range_inclusive_of_end_day()
    {
        var db = NewDb();
        db.Sessions.AddRange(
            S("1", "d1", new DateTime(2026, 10, 1, 8, 0, 0, DateTimeKind.Utc), 1, 1m),
            S("2", "d1", new DateTime(2026, 10, 7, 23, 0, 0, DateTimeKind.Utc), 2, 2m),
            S("3", "d1", new DateTime(2026, 10, 9, 8, 0, 0, DateTimeKind.Utc), 4, 4m));
        await db.SaveChangesAsync();

        var r = await new DriverSummaryService(db).GetAsync("d1", new DateTime(2026, 10, 1), new DateTime(2026, 10, 7));

        Assert.Equal(2, r.TotalSessions);
        Assert.Equal(3, r.TotalEnergyKwh);
    }

    [Fact]
    public async Task Empty_result_returns_zeros()
    {
        var r = await new DriverSummaryService(NewDb()).GetAsync("nobody", DateTime.UtcNow.AddDays(-6), DateTime.UtcNow);
        Assert.Equal(0, r.TotalSessions);
        Assert.Empty(r.Recent);
    }
}