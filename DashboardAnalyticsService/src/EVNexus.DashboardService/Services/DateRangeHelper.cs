namespace DashboardService.Services;

public static class DateRangeHelper
{
    // Default = last 7 days. Invalid ranges return an error message.
    public static bool TryResolve(DateOnly? from, DateOnly? to,
        out DateOnly f, out DateOnly t, out string? error)
    {
        t = to ?? DateOnly.FromDateTime(DateTime.UtcNow);
        f = from ?? t.AddDays(-6);
        error = null;
        if (t < f) error = "End date cannot be earlier than start date.";
        else if (t.DayNumber - f.DayNumber > 366) error = "Date range cannot exceed 366 days.";
        return error is null;
    }
}