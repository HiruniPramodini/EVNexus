using System.Collections.Concurrent;
using EVNexus.AuthService.DTOs;
using EVNexus.AuthService.Models;

namespace EVNexus.AuthService.Services;

public class StatusNotificationService : IStatusNotificationService
{
    private readonly ConcurrentBag<SimulatedNotificationDto> _notifications = new();
    private readonly ILogger<StatusNotificationService> _logger;

    public StatusNotificationService(ILogger<StatusNotificationService> logger)
    {
        _logger = logger;
    }

    public Task<SimulatedNotificationDto> SendApprovalNotificationAsync(
        Tenant tenant,
        string? notes,
        CancellationToken cancellationToken = default)
    {
        var notification = new SimulatedNotificationDto
        {
            NotificationId = "NOTIF-" + Guid.NewGuid().ToString("N")[..12].ToUpperInvariant(),
            TenantId = tenant.TenantId,
            CompanyName = tenant.CompanyName,
            RecipientEmail = tenant.BusinessEmail,
            Status = "Approved",
            Subject = $"EVNexus Account Approved - Welcome, {tenant.CompanyName}!",
            Content = $"Congratulations! Your company registration for '{tenant.CompanyName}' has been approved by the platform administrator. You now have full access to create and manage charging stations." +
                      (string.IsNullOrWhiteSpace(notes) ? string.Empty : $" Note: {notes}"),
            SentAt = DateTime.UtcNow
        };

        _notifications.Add(notification);

        _logger.LogInformation("SIMULATED NOTIFICATION: Sent approval email to {Email} for company {CompanyName} (Tenant ID: {TenantId})",
            tenant.BusinessEmail, tenant.CompanyName, tenant.TenantId);

        return Task.FromResult(notification);
    }

    public Task<SimulatedNotificationDto> SendRejectionNotificationAsync(
        Tenant tenant,
        string? reason,
        CancellationToken cancellationToken = default)
    {
        var effectiveReason = string.IsNullOrWhiteSpace(reason)
            ? "Registration criteria or verification requirements were not met."
            : reason.Trim();

        var notification = new SimulatedNotificationDto
        {
            NotificationId = "NOTIF-" + Guid.NewGuid().ToString("N")[..12].ToUpperInvariant(),
            TenantId = tenant.TenantId,
            CompanyName = tenant.CompanyName,
            RecipientEmail = tenant.BusinessEmail,
            Status = "Rejected",
            Subject = $"EVNexus Account Status Update - {tenant.CompanyName}",
            Content = $"We regret to inform you that your company registration for '{tenant.CompanyName}' was not approved. Reason: {effectiveReason}. If you believe this is an error, please contact platform support.",
            SentAt = DateTime.UtcNow
        };

        _notifications.Add(notification);

        _logger.LogInformation("SIMULATED NOTIFICATION: Sent rejection email to {Email} for company {CompanyName} (Tenant ID: {TenantId}). Reason: {Reason}",
            tenant.BusinessEmail, tenant.CompanyName, tenant.TenantId, effectiveReason);

        return Task.FromResult(notification);
    }

    public IReadOnlyList<SimulatedNotificationDto> GetSentNotifications(string? tenantId = null)
    {
        var list = _notifications.ToList();
        if (string.IsNullOrWhiteSpace(tenantId))
        {
            return list.OrderByDescending(n => n.SentAt).ToList();
        }

        return list.Where(n => string.Equals(n.TenantId, tenantId, StringComparison.OrdinalIgnoreCase))
                   .OrderByDescending(n => n.SentAt)
                   .ToList();
    }
}
