namespace EVNexus.DashboardService.DTOs;

public record RecentSessionDto(string Id, string StationName, DateTime StartUtc, double DurationMinutes, double EnergyKwh, decimal Cost);
public record DriverRangeSummaryDto(int TotalSessions, double TotalEnergyKwh, decimal TotalSpent,
                                    double AvgSessionMinutes, List<RecentSessionDto> Recent);
