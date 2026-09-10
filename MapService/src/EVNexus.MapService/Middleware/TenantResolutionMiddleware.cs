using System.Security.Claims;
using System.Threading.Tasks;
using EVNexus.MapService.Data;
using Microsoft.AspNetCore.Http;

namespace EVNexus.MapService.Middleware;

public class TenantResolutionMiddleware
{
    private readonly RequestDelegate _next;

    public TenantResolutionMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, ITenantContext tenantContext)
    {
        if (context.User.Identity?.IsAuthenticated == true)
        {
            var tenantIdClaim = context.User.FindFirst("TenantId") ?? context.User.FindFirst("tenantId") ?? context.User.FindFirst("tenant_id");
            if (tenantIdClaim != null)
            {
                tenantContext.SetTenantId(tenantIdClaim.Value);
            }

            var userIdClaim = context.User.FindFirst(ClaimTypes.NameIdentifier) ?? context.User.FindFirst("sub");
            if (userIdClaim != null)
            {
                tenantContext.SetUserId(userIdClaim.Value);
            }

            var roleClaim = context.User.FindFirst(ClaimTypes.Role) ?? context.User.FindFirst("role");
            if (roleClaim != null)
            {
                tenantContext.SetRole(roleClaim.Value);
            }
        }

        await _next(context);
    }
}
