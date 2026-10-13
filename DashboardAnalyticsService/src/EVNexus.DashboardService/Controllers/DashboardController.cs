using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using EVNexus.DashboardService.Data;
using EVNexus.DashboardService.DTOs;
using EVNexus.DashboardService.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace EVNexus.DashboardService.Controllers;

[ApiController]
[Route("api/dashboard")]
public class DashboardController : ControllerBase
{
    private readonly IDashboardRepository _repository;
    private readonly IForecastService _forecastService;
    private readonly ICsvExportService _csvExportService;
    private readonly ILogger<DashboardController> _logger;

    public DashboardController(
        IDashboardRepository repository,
        IForecastService forecastService,
        ICsvExportService csvExportService,
        ILogger<DashboardController> logger)
    {
        _repository = repository;
        _forecastService = forecastService;
        _csvExportService = csvExportService;
        _logger = logger;
    }

    private string? ValidateTenant(string companyId)
    {
        if (User.Identity == null || !User.Identity.IsAuthenticated) return null;

        var roleClaim = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? User.FindFirst("role")?.Value;
        if (!string.IsNullOrEmpty(roleClaim) && roleClaim == "Driver")
        {
            return "Access denied: Drivers cannot access company analytics.";
        }

        var tenantClaim = User.FindFirst("tenant_id")?.Value ?? User.FindFirst("company_id")?.Value;
        if (!string.IsNullOrEmpty(tenantClaim) && tenantClaim != companyId)
        {
            return "Access denied: Tenant mismatch.";
        }

        return null;
    }

    private static (DateTime Start, DateTime End, string? Error) ParseDateRange(DateTime? startDate, DateTime? endDate)
    {
        if (startDate.HasValue && endDate.HasValue && endDate.Value < startDate.Value)
        {
            return (DateTime.MinValue, DateTime.MinValue, "Invalid date range: End date cannot be earlier than start date.");
        }

        var end = endDate ?? DateTime.UtcNow;
        var start = startDate ?? end.AddDays(-7);
        return (start, end, null);
    }

    /// <summary>
    /// Story 1: Driver Dashboard Charging History Summary
    /// </summary>
    [HttpGet("driver/{driverId}/summary")]
    public async Task<IActionResult> GetDriverSummary(string driverId)
    {
        if (string.IsNullOrWhiteSpace(driverId))
        {
            return BadRequest("Driver ID is required.");
        }

        var summary = await _repository.GetDriverSummaryAsync(driverId);
        return Ok(summary);
    }

    /// <summary>
    /// Stories 2 & 4: Company Dashboard Home Overview
    /// </summary>
    [HttpGet("company/{companyId}")]
    public async Task<IActionResult> GetCompanyOverview(string companyId)
    {
        var tenantError = ValidateTenant(companyId);
        if (tenantError != null) return StatusCode(403, new { message = tenantError });

        var overview = await _repository.GetCompanyOverviewAsync(companyId);
        return Ok(overview);
    }

    /// <summary>
    /// Stories 2 & 3: Company Revenue Trend Chart
    /// </summary>
    [HttpGet("company/{companyId}/revenue-trend")]
    public async Task<IActionResult> GetRevenueTrend(
        string companyId,
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null,
        [FromQuery] string? stationId = null)
    {
        var tenantError = ValidateTenant(companyId);
        if (tenantError != null) return StatusCode(403, new { message = tenantError });

        var (start, end, dateError) = ParseDateRange(startDate, endDate);
        if (dateError != null) return BadRequest(new { message = dateError });

        var trend = await _repository.GetRevenueTrendAsync(companyId, start, end, stationId);
        return Ok(trend);
    }

    /// <summary>
    /// Story 5: Export Usage Report as CSV
    /// </summary>
    [HttpGet("company/{companyId}/export-csv")]
    public async Task<IActionResult> ExportUsageReportCsv(
        string companyId,
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null,
        [FromQuery] string? stationId = null)
    {
        var tenantError = ValidateTenant(companyId);
        if (tenantError != null) return StatusCode(403, new { message = tenantError });

        var (start, end, dateError) = ParseDateRange(startDate, endDate);
        if (dateError != null) return BadRequest(new { message = dateError });

        var dailyUsage = await _repository.GetDailyUsageAsync(companyId, start, end, stationId);
        var csvBytes = _csvExportService.ExportUsageReportToCsv(dailyUsage, stationId);

        var filename = $"usage_report_{companyId}_{start:yyyyMMdd}_{end:yyyyMMdd}.csv";
        return File(csvBytes, "text/csv", filename);
    }

    /// <summary>
    /// Story 6: Charging Point Traffic Table
    /// </summary>
    [HttpGet("company/{companyId}/traffic-table")]
    public async Task<IActionResult> GetTrafficTable(
        string companyId,
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null)
    {
        var tenantError = ValidateTenant(companyId);
        if (tenantError != null) return StatusCode(403, new { message = tenantError });

        if (startDate.HasValue && endDate.HasValue && endDate.Value < startDate.Value)
        {
            return BadRequest(new { message = "Invalid date range: End date cannot be earlier than start date." });
        }

        var traffic = await _repository.GetStationTrafficAsync(companyId, startDate, endDate);
        return Ok(traffic);
    }

    /// <summary>
    /// Story 7: Charging Point Price List Table
    /// </summary>
    [HttpGet("company/{companyId}/pricing-table")]
    public async Task<IActionResult> GetPricingTable(string companyId)
    {
        var tenantError = ValidateTenant(companyId);
        if (tenantError != null) return StatusCode(403, new { message = tenantError });

        var pricing = await _repository.GetStationPricingAsync(companyId);
        return Ok(pricing);
    }

    /// <summary>
    /// Story 8: Charging Point Location Table
    /// </summary>
    [HttpGet("company/{companyId}/locations")]
    public async Task<IActionResult> GetLocationsTable(string companyId)
    {
        var tenantError = ValidateTenant(companyId);
        if (tenantError != null) return StatusCode(403, new { message = tenantError });

        var locations = await _repository.GetStationLocationsAsync(companyId);
        return Ok(locations);
    }

    /// <summary>
    /// Story 9: Basic Daily Usage Report
    /// </summary>
    [HttpGet("company/{companyId}/daily-usage")]
    public async Task<IActionResult> GetDailyUsage(
        string companyId,
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null,
        [FromQuery] string? stationId = null)
    {
        var tenantError = ValidateTenant(companyId);
        if (tenantError != null) return StatusCode(403, new { message = tenantError });

        var (start, end, dateError) = ParseDateRange(startDate, endDate);
        if (dateError != null) return BadRequest(new { message = dateError });

        var dailyUsage = await _repository.GetDailyUsageAsync(companyId, start, end, stationId);
        return Ok(dailyUsage);
    }

    /// <summary>
    /// Story 10: Monthly Dynamic Report Generation
    /// </summary>
    [HttpGet("company/{companyId}/monthly-report")]
    public async Task<IActionResult> GetMonthlyReport(
        string companyId,
        [FromQuery] int? year = null,
        [FromQuery] int? month = null)
    {
        var tenantError = ValidateTenant(companyId);
        if (tenantError != null) return StatusCode(403, new { message = tenantError });

        var targetYear = year ?? DateTime.UtcNow.Year;
        var targetMonth = month ?? DateTime.UtcNow.Month;

        if (targetMonth < 1 || targetMonth > 12)
        {
            return BadRequest(new { message = "Month must be between 1 and 12." });
        }

        var report = await _repository.GetMonthlyReportAsync(companyId, targetYear, targetMonth);
        return Ok(report);
    }

    /// <summary>
    /// Stories 11 & 13: AI Peak-Hour Usage Prediction per Station
    /// </summary>
    [HttpGet("company/{companyId}/stations/{stationId}/peak-hours")]
    public async Task<IActionResult> GetStationPeakHours(
        string companyId,
        string stationId,
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null)
    {
        var tenantError = ValidateTenant(companyId);
        if (tenantError != null) return StatusCode(403, new { message = tenantError });

        var (start, end, dateError) = ParseDateRange(startDate, endDate);
        if (dateError != null) return BadRequest(new { message = dateError });

        var hourly = await _repository.GetHourlyDistributionAsync(companyId, stationId, start, end);
        var stations = await _repository.GetStationLocationsAsync(companyId);
        var stationName = stations.FirstOrDefault(s => s.StationId == stationId)?.StationName ?? "Station " + stationId;

        var prediction = _forecastService.PredictPeakHours(stationId, stationName, hourly);
        return Ok(prediction);
    }

    /// <summary>
    /// Story 12: AI Future Demand Forecast Analytics (7-Day horizon)
    /// </summary>
    [HttpGet("company/{companyId}/forecast")]
    public async Task<IActionResult> GetCompanyForecast(
        string companyId,
        [FromQuery] int historicalDays = 30,
        [FromQuery] string? stationId = null)
    {
        var tenantError = ValidateTenant(companyId);
        if (tenantError != null) return StatusCode(403, new { message = tenantError });

        if (historicalDays < 1 || historicalDays > 365)
        {
            return BadRequest(new { message = "historicalDays must be between 1 and 365." });
        }

        var historical = await _repository.GetHistoricalDailyRevenueAsync(companyId, historicalDays, stationId);
        var forecast = _forecastService.PredictNext7Days(historical);
        return Ok(forecast);
    }

    /// <summary>
    /// Story 14: Highest Traffic Station Ranking
    /// </summary>
    [HttpGet("company/{companyId}/station-rankings")]
    public async Task<IActionResult> GetStationRankings(
        string companyId,
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null)
    {
        var tenantError = ValidateTenant(companyId);
        if (tenantError != null) return StatusCode(403, new { message = tenantError });

        if (startDate.HasValue && endDate.HasValue && endDate.Value < startDate.Value)
        {
            return BadRequest(new { message = "Invalid date range: End date cannot be earlier than start date." });
        }

        var rankings = await _repository.GetStationRankingsAsync(companyId, startDate, endDate);
        return Ok(rankings);
    }

    /// <summary>
    /// Story 15: Busiest Time-of-Day Analytics (0-23 hours)
    /// </summary>
    [HttpGet("company/{companyId}/busiest-hours")]
    public async Task<IActionResult> GetBusiestHours(
        string companyId,
        [FromQuery] string? stationId = null,
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null)
    {
        var tenantError = ValidateTenant(companyId);
        if (tenantError != null) return StatusCode(403, new { message = tenantError });

        var (start, end, dateError) = ParseDateRange(startDate, endDate);
        if (dateError != null) return BadRequest(new { message = dateError });

        var distribution = await _repository.GetHourlyDistributionAsync(companyId, stationId, start, end);
        return Ok(distribution);
    }

    /// <summary>
    /// Story 16: AI Pricing Recommendation Insight
    /// </summary>
    [HttpGet("company/{companyId}/pricing-recommendations")]
    public async Task<IActionResult> GetPricingRecommendations(string companyId)
    {
        var tenantError = ValidateTenant(companyId);
        if (tenantError != null) return StatusCode(403, new { message = tenantError });

        var traffic = await _repository.GetStationTrafficAsync(companyId);
        var pricing = await _repository.GetStationPricingAsync(companyId);

        var recommendations = _forecastService.GeneratePricingRecommendations(traffic, pricing);
        return Ok(recommendations);
    }

    /// <summary>
    /// Frontend compatibility endpoint matching api.js getCompanyTransactions
    /// </summary>
    [HttpGet("company/{companyId}/transactions")]
    public async Task<IActionResult> GetCompanyTransactions(
        string companyId,
        [FromQuery] int limit = 50,
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null,
        [FromQuery] string? stationId = null)
    {
        var tenantError = ValidateTenant(companyId);
        if (tenantError != null) return StatusCode(403, new { message = tenantError });

        var (start, end, dateError) = ParseDateRange(startDate, endDate);
        if (dateError != null) return BadRequest(new { message = dateError });

        var trend = await _repository.GetRevenueTrendAsync(companyId, start, end, stationId);
        return Ok(trend.Take(limit));
    }
}
