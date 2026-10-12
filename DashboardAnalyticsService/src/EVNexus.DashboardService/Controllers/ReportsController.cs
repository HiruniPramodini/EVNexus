using EVNexus.DashboardService.Services;
using Microsoft.AspNetCore.Mvc;

namespace EVNexus.DashboardService.Controllers;

[ApiController]
[Route("api/dashboard-reports")]
public class ReportsController : ControllerBase
{
    private readonly ReportDataService _data;
    public ReportsController(ReportDataService data) => _data = data;

    private static bool InvalidRange(DateTime? from, DateTime? to) =>
        from.HasValue && to.HasValue && to.Value.Date < from.Value.Date;

    private const string InvalidRangeMessage = "End date cannot be earlier than start date.";

    // SCRUM-124 charging point traffic table (+ SCRUM-130 date filter)
    [HttpGet("traffic")]
    public IActionResult Traffic([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        if (InvalidRange(from, to)) return BadRequest(new { message = InvalidRangeMessage });

        var sessions = _data.InRange(from, to).ToList();
        var rows = _data.Chargers.Select(c =>
        {
            var s = sessions.Where(x => x.ChargerId == c.ChargerId).ToList();
            return new
            {
                c.StationName, c.ChargerId, c.Type,
                sessions = s.Count,
                energyKwh = Math.Round(s.Sum(x => x.EnergyKwh), 2),
                revenue = Math.Round(s.Sum(x => x.Cost), 2)
            };
        }).OrderByDescending(r => r.sessions);
        return Ok(rows);
    }

    // SCRUM-125 price list table
    [HttpGet("prices")]
    public IActionResult Prices() =>
        Ok(_data.Chargers.Select(c => new { c.StationName, c.ChargerId, c.Type, c.PowerKw, c.PricePerKwh }));

    // SCRUM-126 location table
    [HttpGet("locations")]
    public IActionResult Locations() =>
        Ok(_data.Stations.Select(s => new { s.Name, s.Address, s.Latitude, s.Longitude, s.Status }));

    // SCRUM-128 daily usage report (+ SCRUM-130 date filter, source for SCRUM-131 CSV)
    [HttpGet("daily-usage")]
    public IActionResult DailyUsage([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        if (InvalidRange(from, to)) return BadRequest(new { message = InvalidRangeMessage });

        var rows = _data.InRange(from, to)
            .GroupBy(s => s.StartUtc.Date)
            .OrderBy(g => g.Key)
            .Select(g => new
            {
                date = g.Key.ToString("yyyy-MM-dd"),
                sessions = g.Count(),
                energyKwh = Math.Round(g.Sum(x => x.EnergyKwh), 2),
                revenue = Math.Round(g.Sum(x => x.Cost), 2)
            });
        return Ok(rows);
    }
}