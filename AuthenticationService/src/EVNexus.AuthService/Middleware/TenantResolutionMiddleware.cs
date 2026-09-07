using System.Security.Claims;
using System.Text.Json;
using EVNexus.AuthService.DTOs;
using EVNexus.AuthService.Services;

namespace EVNexus.AuthService.Middleware;

public class TenantResolutionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<TenantResolutionMiddleware> _logger;

    public TenantResolutionMiddleware(RequestDelegate next, ILogger<TenantResolutionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, ITenantContext tenantContext)
    {
        if (context.User?.Identity?.IsAuthenticated == true)
        {
            var tenantClaim = context.User.FindFirst("tenant_id")?.Value
                           ?? (context.User.IsInRole("CompanyAdmin") ? context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value : null);

            if (!string.IsNullOrWhiteSpace(tenantClaim))
            {
                tenantContext.TenantId = tenantClaim;
            }

            // Check if caller provides an explicit X-Tenant-ID header that conflicts with authenticated token
            if (context.Request.Headers.TryGetValue("X-Tenant-ID", out var headerTenant) && !string.IsNullOrWhiteSpace(headerTenant))
            {
                var requestedTenantId = headerTenant.ToString().Trim();
                if (tenantContext.HasTenant && !string.Equals(tenantContext.TenantId, requestedTenantId, StringComparison.OrdinalIgnoreCase))
                {
                    _logger.LogWarning("Security violation: Tenant {AuthTenant} attempted to spoof Tenant {RequestedTenant}",
                        tenantContext.TenantId, requestedTenantId);

                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    context.Response.ContentType = "application/json";

                    var response = ApiResponse<object>.Fail("Cross-tenant access forbidden. You cannot access data belonging to another tenant.");
                    await context.Response.WriteAsync(JsonSerializer.Serialize(response), context.RequestAborted);
                    return;
                }
            }
        }

        await _next(context);
    }
}
