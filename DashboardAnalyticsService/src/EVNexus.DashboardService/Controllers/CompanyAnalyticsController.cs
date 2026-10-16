using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using EVNexus.DashboardService.Data;
using EVNexus.DashboardService.Forecasting;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EVNexus.DashboardService.Controllers;

[ApiController]
[Route("api/dashboard")]
[Route("api/payment/analytics")]
[Authorize]
public class CompanyAnalyticsController : ControllerBase
{
    private readonly ICompanyAnalyticsRepository _repository;
    private readonly IForecastService _forecastService;

    public CompanyAnalyticsController(ICompanyAnalyticsRepository repository, IForecastService forecastService)
    {
        _repository = repository;
        _forecastService = forecastService;
    }

    private string? ValidateCompanyAccess(string companyId)
    {
        var roleClaim = User.FindFirst(ClaimTypes.Role)?.Value ?? User.FindFirst("role")?.Value;
        
        // Allow CompanyAdmin, Operator, or Company role to access analytics
        if (roleClaim != "CompanyAdmin" && roleClaim != "Operator" && roleClaim != "Company")
        {
            return "Access denied: Requires Company Role.";
        }

        var tenantIdClaim = User.FindFirst("tenant_id")?.Value;
        if (string.IsNullOrEmpty(tenantIdClaim) || tenantIdClaim != companyId)
        {
            return "Access denied: Tenant mismatch.";
        }
        
        return null;
    }

    [HttpGet("company/{companyId}")]
    public async Task<IActionResult> GetDashboardAnalytics(string companyId, [FromQuery] DateTime? startDate = null, [FromQuery] DateTime? endDate = null, [FromQuery] string? stationId = null)
    {
        var error = ValidateCompanyAccess(companyId);
        if (error != null) return Forbid();

        var data = await _repository.GetDashboardAnalyticsAsync(companyId, startDate, endDate, stationId);
        return Ok(new { success = true, data });
    }

    [HttpGet("company/{companyId}/transactions")]
    public async Task<IActionResult> GetCompanyTransactions(string companyId, [FromQuery] int limit = 50, [FromQuery] DateTime? startDate = null, [FromQuery] DateTime? endDate = null, [FromQuery] string? stationId = null)
    {
        var error = ValidateCompanyAccess(companyId);
        if (error != null) return Forbid();

        var data = await _repository.GetCompanyTransactionsAsync(companyId, limit, startDate, endDate, stationId);
        return Ok(new { success = true, data });
    }

    [HttpGet("company/{companyId}/revenue-trend")]
    public async Task<IActionResult> GetCompanyRevenueTrend(string companyId, [FromQuery] DateTime? startDate = null, [FromQuery] DateTime? endDate = null, [FromQuery] string? stationId = null)
    {
        var error = ValidateCompanyAccess(companyId);
        if (error != null) return Forbid();

        var data = await _repository.GetCompanyRevenueTrendAsync(companyId, startDate, endDate, stationId);
        return Ok(new { success = true, data });
    }

    [HttpGet("company/{companyId}/stations")]
    public async Task<IActionResult> GetStationAnalytics(string companyId, [FromQuery] DateTime? startDate = null, [FromQuery] DateTime? endDate = null, [FromQuery] string? stationId = null)
    {
        var error = ValidateCompanyAccess(companyId);
        if (error != null) return Forbid();

        var data = await _repository.GetStationAnalyticsAsync(companyId, startDate, endDate, stationId);
        return Ok(new { success = true, data });
    }

    [HttpGet("company/{companyId}/forecast")]
    public async Task<IActionResult> GetCompanyForecast(string companyId, [FromQuery] int historicalDays = 30)
    {
        var error = ValidateCompanyAccess(companyId);
        if (error != null) return Forbid();

        if (historicalDays < 1 || historicalDays > 365)
        {
            return BadRequest("historicalDays must be between 1 and 365.");
        }

        var endDate = DateTime.UtcNow;
        var startDate = endDate.AddDays(-historicalDays);

        var trendData = await _repository.GetCompanyRevenueTrendAsync(companyId, startDate, endDate, null);
        
        var revenueData = trendData.Select(t => new RevenueData
        {
            Date = DateTime.TryParse(t.Date, out var parsed) ? parsed : DateTime.MinValue,
            Amount = (float)t.Revenue
        }).Where(r => r.Date != DateTime.MinValue).OrderBy(r => r.Date).ToList();

        var forecast = _forecastService.PredictNext7Days(revenueData);
        var hasHistory = revenueData.Count > 0 && revenueData.Any(r => r.Amount > 0);
        return Ok(new
        {
            success = true,
            data = forecast,
            historicalCount = revenueData.Count,
            isBaseline = revenueData.Count < 7,
            hasHistory
        });
    }
}
