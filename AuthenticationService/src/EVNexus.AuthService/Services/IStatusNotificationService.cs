using EVNexus.AuthService.DTOs;
using EVNexus.AuthService.Models;

namespace EVNexus.AuthService.Services;

public interface IStatusNotificationService
{
    Task<SimulatedNotificationDto> SendApprovalNotificationAsync(
        Tenant tenant,
        string? notes,
        CancellationToken cancellationToken = default);

    Task<SimulatedNotificationDto> SendRejectionNotificationAsync(
        Tenant tenant,
        string? reason,
        CancellationToken cancellationToken = default);

    IReadOnlyList<SimulatedNotificationDto> GetSentNotifications(string? tenantId = null);
}
