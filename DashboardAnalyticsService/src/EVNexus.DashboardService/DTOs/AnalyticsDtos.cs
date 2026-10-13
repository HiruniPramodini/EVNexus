namespace DashboardService.Dtos;

public record StationTrafficRow(int Rank, string StationId, string StationName, int Sessions, decimal EnergyKwh, decimal Revenue);
public record HourBucket(int Hour, int Sessions);
public record HourlyReport(DateOnly From, DateOnly To, string? StationId, int TotalSessions, List<HourBucket> Hours, List<int> BusiestHours);

public record MonthlyStationRow(string StationId, string StationName, int Sessions, decimal EnergyKwh, decimal Revenue);
public record MonthlyReport(int Year, int Month, bool IsComplete, int TotalSessions, decimal TotalEnergyKwh, decimal TotalRevenue, List<MonthlyStationRow> Stations);

public record PeakHourItem(int Hour, double ExpectedSessionsPerDay, bool IsPeak);
public record PeakHourPrediction(string? StationId, bool InsufficientData, bool UsedCompanyFallback,
    int SessionsAnalysed, List<PeakHourItem> Hours, List<int> PeakHours, string Message);

public record ForecastDay(DateOnly Date, double Sessions, double EnergyKwh);
public record DemandForecast(string? StationId, bool InsufficientData, string Method,
    List<ForecastDay> History, List<ForecastDay> Forecast, List<string> Assumptions, string Message);