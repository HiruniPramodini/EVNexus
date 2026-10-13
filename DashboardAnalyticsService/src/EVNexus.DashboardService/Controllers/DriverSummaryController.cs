using System.Security.Claims;
using EVNexus.DashboardService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EVNexus.DashboardService.Controllers;

[ApiController]
[Authorize]
[Route("api/dashboard-reports/driver-summary")]
public class DriverSummaryController : ControllerBase
{
    private readonly DriverSummaryService _svc;
    public DriverSummaryController(DriverSummaryService svc) => _svc = svc;

    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] DateTime? from, [FromQuery] DateTime? to, CancellationToken ct)
    {
        // driver id ALWAYS comes from the token, never from the query string
        var driverId = User.FindFirstValue(ClaimTypes.NameIdentifier)
                    ?? User.FindFirstValue("sub")
                    ?? User.FindFirstValue("driverId");
        if (string.IsNullOrEmpty(driverId)) return Unauthorized();

        var end = to?.Date ?? DateTime.UtcNow.Date;
        var start = from?.Date ?? end.AddDays(-6);          // default: last 7 days
        if (end < start) return BadRequest(new { message = "End date cannot be earlier than start date." });

        return Ok(await _svc.GetAsync(driverId, start, end, ct));
    }
}