using DashboardService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DashboardService.Controllers;

[ApiController]
[Route("api/company/analytics")]
[Authorize]
public class CompanyAnalyticsController : ControllerBase
{
    private readonly IAnalyticsService _svc;
    public CompanyAnalyticsController(IAnalyticsService svc) => _svc = svc;

    private string? Tenant => TenantContext.GetTenantId(User);

    [HttpGet("station-traffic")]
    public async Task<IActionResult> StationTraffic([FromQuery] DateOnly? from, [FromQuery] DateOnly? to, CancellationToken ct)
    {
        if (Tenant is null) return Forbid();
        if (!DateRangeHelper.TryResolve(from, to, out var f, out var t, out var err)) return BadRequest(new { message = err });
        return Ok(await _svc.GetStationTrafficAsync(Tenant, f, t, ct));
    }

    [HttpGet("hourly")]
    public async Task<IActionResult> Hourly([FromQuery] DateOnly? from, [FromQuery] DateOnly? to,
        [FromQuery] string? stationId, [FromQuery] int tzOffset = 0, CancellationToken ct = default)
    {
        if (Tenant is null) return Forbid();
        if (!DateRangeHelper.TryResolve(from, to, out var f, out var t, out var err)) return BadRequest(new { message = err });
        return Ok(await _svc.GetHourlyAsync(Tenant, f, t, stationId, Math.Clamp(tzOffset, -720, 840), ct));
    }

    [HttpGet("export.csv")]
    public async Task<IActionResult> ExportCsv([FromQuery] DateOnly? from, [FromQuery] DateOnly? to,
        [FromQuery] string? stationId, CancellationToken ct)
    {
        if (Tenant is null) return Forbid();
        if (!DateRangeHelper.TryResolve(from, to, out var f, out var t, out var err)) return BadRequest(new { message = err });
        var bytes = await _svc.ExportUsageCsvAsync(Tenant, f, t, stationId, ct);
        return File(bytes, "text/csv", $"usage-report_{f:yyyyMMdd}_{t:yyyyMMdd}.csv");
    }

    [HttpGet("monthly")]
    public async Task<IActionResult> Monthly([FromQuery] int year, [FromQuery] int month, CancellationToken ct)
    {
        if (Tenant is null) return Forbid();
        if (month < 1 || month > 12 || year < 2000 || year > 2100)
            return BadRequest(new { message = "Invalid year or month." });
        var first = new DateTime(year, month, 1);
        if (first > DateTime.UtcNow)
            return BadRequest(new { message = "Cannot generate a report for a future month." });
        return Ok(await _svc.GetMonthlyAsync(Tenant, year, month, ct));
    }

    [HttpGet("peak-hours")]
    public async Task<IActionResult> PeakHours([FromQuery] string? stationId, [FromQuery] int tzOffset = 0, CancellationToken ct = default)
    {
        if (Tenant is null) return Forbid();
        return Ok(await _svc.PredictPeakHoursAsync(Tenant, stationId, Math.Clamp(tzOffset, -720, 840), ct));
    }

    [HttpGet("forecast")]
    public async Task<IActionResult> Forecast([FromQuery] string? stationId, CancellationToken ct)
    {
        if (Tenant is null) return Forbid();
        return Ok(await _svc.ForecastAsync(Tenant, stationId, ct));
    }
}