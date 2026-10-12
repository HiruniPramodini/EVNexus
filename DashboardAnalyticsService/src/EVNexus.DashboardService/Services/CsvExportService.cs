using System.Collections.Generic;
using System.Text;
using EVNexus.DashboardService.DTOs;

namespace EVNexus.DashboardService.Services;

public interface ICsvExportService
{
    byte[] ExportUsageReportToCsv(IEnumerable<DailyUsagePointDto> dailyUsage, string? stationName = null);
    byte[] ExportStationTrafficToCsv(IEnumerable<StationTrafficDto> stationTraffic);
}

public class CsvExportService : ICsvExportService
{
    public byte[] ExportUsageReportToCsv(IEnumerable<DailyUsagePointDto> dailyUsage, string? stationName = null)
    {
        var sb = new StringBuilder();
        sb.AppendLine("Date,Station,Sessions,EnergyDeliveredKwh,Revenue");

        var station = string.IsNullOrWhiteSpace(stationName) ? "All Stations" : stationName;

        foreach (var item in dailyUsage)
        {
            sb.AppendLine($"{item.Date},\"{station}\",{item.SessionCount},{item.EnergyDeliveredKwh:F2},{item.Revenue:F2}");
        }

        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    public byte[] ExportStationTrafficToCsv(IEnumerable<StationTrafficDto> stationTraffic)
    {
        var sb = new StringBuilder();
        sb.AppendLine("StationId,StationName,Address,UsageCount,TotalEnergyDeliveredKwh,TotalRevenue");

        foreach (var s in stationTraffic)
        {
            sb.AppendLine($"\"{s.StationId}\",\"{s.StationName}\",\"{s.Address}\",{s.UsageCount},{s.TotalEnergyDeliveredKwh:F2},{s.TotalRevenue:F2}");
        }

        return Encoding.UTF8.GetBytes(sb.ToString());
    }
}
