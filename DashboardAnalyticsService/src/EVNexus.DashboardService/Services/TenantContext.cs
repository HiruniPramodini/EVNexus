using System.Security.Claims;

namespace DashboardService.Services;

public static class TenantContext
{
    public static string? GetTenantId(ClaimsPrincipal user) =>
        user.FindFirst("tenantId")?.Value
        ?? user.FindFirst("TenantId")?.Value
        ?? user.FindFirst("companyId")?.Value;
}