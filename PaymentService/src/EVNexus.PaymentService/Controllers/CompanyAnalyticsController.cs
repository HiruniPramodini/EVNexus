using System.Threading.Tasks;
using EVNexus.PaymentService.Data;
using System;
using System.Linq;
using System.Threading.Tasks;
using EVNexus.PaymentService.Data;
using EVNexus.PaymentService.Forecasting;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EVNexus.PaymentService.Controllers;

[ApiController]
[Route("api/payment/analytics")]
[Authorize]
public class CompanyAnalyticsController : ControllerBase
{
    private readonly ICompanyAnalyticsRepository _repository;

    public CompanyAnalyticsController(ICompanyAnalyticsRepository repository)
    {
        _repository = repository;
    private readonly IForecastService _forecastService;

    public CompanyAnalyticsController(ICompanyAnalyticsRepository repository, IForecastService forecastService)
    {
        _repository = repository;
        _forecastService = forecastService;
    }

    private string? ValidateCompanyAccess(string companyId)
    {
        var roleClaim = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? User.FindFirst("role")?.Value;
        
        // Only allow CompanyAdmin or Operator to access analytics
        if (roleClaim != "CompanyAdmin" && roleClaim != "Operator")
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
    public async Task<IActionResult> GetDashboardAnalytics(string companyId, [FromQuery] System.DateTime? startDate = null, [FromQuery] System.DateTime? endDate = null, [FromQuery] string stationId = null)
    {
        var error = ValidateCompanyAccess(companyId);
        if (error != null) return Forbid();

        var data = await _repository.GetDashboardAnalyticsAsync(companyId, startDate, endDate, stationId);
        return Ok(data);
    }

    [HttpGet("company/{companyId}/transactions")]
    public async Task<IActionResult> GetCompanyTransactions(string companyId, [FromQuery] int limit = 50, [FromQuery] System.DateTime? startDate = null, [FromQuery] System.DateTime? endDate = null, [FromQuery] string stationId = null)
    {
        var error = ValidateCompanyAccess(companyId);
        if (error != null) return Forbid();

        var data = await _repository.GetCompanyTransactionsAsync(companyId, limit, startDate, endDate, stationId);
        return Ok(data);
    }

    [HttpGet("company/{companyId}/revenue-trend")]
    public async Task<IActionResult> GetCompanyRevenueTrend(string companyId, [FromQuery] System.DateTime? startDate = null, [FromQuery] System.DateTime? endDate = null, [FromQuery] string stationId = null)
    {
        var error = ValidateCompanyAccess(companyId);
        if (error != null) return Forbid();

        var data = await _repository.GetCompanyRevenueTrendAsync(companyId, startDate, endDate, stationId);
        return Ok(data);
    }

    [HttpGet("company/{companyId}/stations")]
    public async Task<IActionResult> GetStationAnalytics(string companyId, [FromQuery] System.DateTime? startDate = null, [FromQuery] System.DateTime? endDate = null, [FromQuery] string stationId = null)
    {
        var error = ValidateCompanyAccess(companyId);
        if (error != null) return Forbid();

        var data = await _repository.GetStationAnalyticsAsync(companyId, startDate, endDate, stationId);
        return Ok(data);
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
        return Ok(forecast);
    }
}
