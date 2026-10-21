namespace EVNexus.DashboardService.Services;

public record ChargerRow(string StationName, string ChargerId, string Type, double PowerKw, double PricePerKwh);
public record StationRow(string Name, string Address, double Latitude, double Longitude, string Status);
public record SessionRow(string Id, string StationName, string ChargerId, DateTime StartUtc, DateTime EndUtc, double EnergyKwh, double Cost);

public class ReportDataService
{
    public List<StationRow> Stations { get; } = new()
    {
        new("Colombo Fort Hub", "Fort, Colombo 01", 6.9344, 79.8428, "Active"),
        new("Malabe SLIIT Charge", "New Kandy Rd, Malabe", 6.9147, 79.9733, "Active"),
        new("Kandy City Centre", "Dalada Veediya, Kandy", 7.2931, 80.6350, "Active"),
        new("Dambulla Rest Stop", "Kandy Rd, Dambulla", 7.8731, 80.6511, "Inactive"),
    };

    public List<ChargerRow> Chargers { get; } = new()
    {
        new("Colombo Fort Hub", "CH-F01", "CCS2", 50, 0.50),
        new("Colombo Fort Hub", "CH-F02", "Type 2", 22, 0.35),
        new("Malabe SLIIT Charge", "CH-M01", "CCS2", 60, 0.55),
        new("Malabe SLIIT Charge", "CH-M02", "CHAdeMO", 50, 0.50),
        new("Kandy City Centre", "CH-K01", "CCS2", 50, 0.45),
        new("Dambulla Rest Stop", "CH-D01", "Type 2", 22, 0.30),
    };

    public List<SessionRow> Sessions { get; }

    public ReportDataService()
    {
        var rnd = new Random(42);
        Sessions = new List<SessionRow>();
        var today = DateTime.UtcNow.Date;
        for (int d = 0; d < 30; d++)
        {
            int count = rnd.Next(4, 14);
            for (int i = 0; i < count; i++)
            {
                var ch = Chargers[rnd.Next(Chargers.Count)];
                var start = today.AddDays(-d).AddHours(rnd.Next(6, 22)).AddMinutes(rnd.Next(0, 60));
                var minutes = rnd.Next(15, 90);
                var energy = Math.Round(ch.PowerKw * minutes / 60.0 * 0.7, 2);
                Sessions.Add(new SessionRow(Guid.NewGuid().ToString("N")[..8], ch.StationName, ch.ChargerId,
                    start, start.AddMinutes(minutes), energy, Math.Round(energy * ch.PricePerKwh, 2)));
            }
        }
    }

    public IEnumerable<SessionRow> InRange(DateTime? from, DateTime? to)
    {
        var f = from?.Date ?? DateTime.MinValue;
        var t = to?.Date.AddDays(1) ?? DateTime.MaxValue;
        return Sessions.Where(s => s.StartUtc >= f && s.StartUtc < t);
    }
}
