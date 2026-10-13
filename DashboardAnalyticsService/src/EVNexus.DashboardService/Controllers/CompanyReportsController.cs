using DashboardService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DashboardService.Controllers;

[ApiController]
[Route("api/company/reports")]
[Authorize]
public class CompanyReportsController : ControllerBase
{
    private readonly IReportService _reports;
    public CompanyReportsController(IReportService reports) => _reports = reports;

    [HttpGet("daily-usage")]
    public async Task<IActionResult> DailyUsage([FromQuery] DateOnly? from, [FromQuery] DateOnly? to, CancellationToken ct)
    {
        var tenantId = TenantContext.GetTenantId(User);
        if (string.IsNullOrEmpty(tenantId))
            return Forbid();

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var toDate = to ?? today;
        var fromDate = from ?? toDate.AddDays(-6);

        if (toDate < fromDate)
            return BadRequest(new { message = "End date cannot be earlier than start date." });
        if (toDate.DayNumber - fromDate.DayNumber > 366)
            return BadRequest(new { message = "Date range cannot exceed 366 days." });

        var report = await _reports.GetDailyUsageAsync(tenantId, fromDate, toDate, ct);
        return Ok(report);
    }
}