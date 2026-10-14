namespace DashboardService.Dtos;

public record DailyUsageRow(DateOnly Date, int Sessions, decimal EnergyKwh, decimal Revenue, int Transactions);

public record DailyUsageReport(
    DateOnly From, DateOnly To,
    int TotalSessions, decimal TotalEnergyKwh, decimal TotalRevenue, int TotalTransactions,
    List<DailyUsageRow> Days);