using System;
using System.Collections.Generic;
using EVNexus.DashboardService.Data;
using EVNexus.DashboardService.DTOs;

namespace EVNexus.DashboardService.Services;

public interface IForecastService
{
    IEnumerable<DemandForecastDto> PredictNext7Days(IEnumerable<DailyRevenueItem> historicalData);
    PeakHourPredictionDto PredictPeakHours(string stationId, string stationName, IEnumerable<HourlyTrafficDto> hourlyTraffic);
    IEnumerable<PricingRecommendationDto> GeneratePricingRecommendations(IEnumerable<StationTrafficDto> stationTraffic, IEnumerable<StationPricingDto> pricing);
}
