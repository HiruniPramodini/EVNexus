using System.Security.Claims;
using System.Text.Json;
using EVNexus.AuthService.Attributes;
using EVNexus.AuthService.DTOs;
using Microsoft.AspNetCore.Authorization;

namespace EVNexus.AuthService.Middleware;

/// <summary>
/// Reusable pipeline middleware that inspects endpoints across all controllers,
/// extracts role claims from the caller's JWT, restricts access to company-only
/// or driver-only endpoints, and logs unauthorized access attempts.
/// </summary>
public class RoleAuthorizationMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RoleAuthorizationMiddleware> _logger;

    public RoleAuthorizationMiddleware(RequestDelegate next, ILogger<RoleAuthorizationMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var endpoint = context.GetEndpoint();
        if (endpoint == null || endpoint.Metadata.GetMetadata<IAllowAnonymous>() != null)
        {
            await _next(context);
            return;
        }

        var requiredRoles = GetRequiredRoles(endpoint);
        if (requiredRoles.Count == 0)
        {
            await _next(context);
            return;
        }

        if (context.User?.Identity?.IsAuthenticated != true)
        {
            await HandleUnauthenticatedAsync(context, requiredRoles);
            return;
        }

        var callerRoles = ExtractCallerRoles(context.User);
        var isAuthorized = callerRoles.Any(r => requiredRoles.Contains(r)) ||
                           requiredRoles.Any(r => context.User.IsInRole(r));

        if (!isAuthorized)
        {
            await HandleForbiddenAsync(context, callerRoles, requiredRoles);
            return;
        }

        await _next(context);
    }

    private static HashSet<string> GetRequiredRoles(Endpoint endpoint)
    {
        var requiredRoles = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        var requireRoleAttributes = endpoint.Metadata.GetOrderedMetadata<RequireRoleAttribute>();
        foreach (var role in requireRoleAttributes.SelectMany(attr => attr.Roles ?? Array.Empty<string>()).Where(r => !string.IsNullOrWhiteSpace(r)))
        {
            requiredRoles.Add(role.Trim());
        }

        var authorizeAttributes = endpoint.Metadata.GetOrderedMetadata<AuthorizeAttribute>();
        foreach (var role in authorizeAttributes
                     .Where(a => !string.IsNullOrWhiteSpace(a.Roles))
                     .SelectMany(a => a.Roles!.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)))
        {
            requiredRoles.Add(role);
        }

        return requiredRoles;
    }

    private static IReadOnlyList<string> ExtractCallerRoles(ClaimsPrincipal user)
    {
        return user.FindAll(ClaimTypes.Role)
            .Concat(user.FindAll("role"))
            .Select(c => c.Value)
            .Where(r => !string.IsNullOrWhiteSpace(r))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static string ExtractCallerId(ClaimsPrincipal user)
    {
        return user.FindFirst("driver_id")?.Value
            ?? user.FindFirst("tenant_id")?.Value
            ?? user.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? user.FindFirst(ClaimTypes.Email)?.Value
            ?? "Unknown";
    }

    private async Task HandleUnauthenticatedAsync(HttpContext context, IEnumerable<string> requiredRoles)
    {
        _logger.LogWarning("Unauthenticated request attempted to access role-restricted endpoint '{Path}' ({Method}) requiring role(s): '{RequiredRoles}'. Remote IP: {RemoteIp}",
            context.Request.Path,
            context.Request.Method,
            string.Join(", ", requiredRoles),
            context.Connection.RemoteIpAddress?.ToString() ?? "Unknown");

        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        context.Response.ContentType = "application/json";

        var unauthResponse = ApiResponse<object>.Fail("Authentication required. Please provide a valid Bearer token.");
        await context.Response.WriteAsync(JsonSerializer.Serialize(unauthResponse), context.RequestAborted);
    }

    private async Task HandleForbiddenAsync(HttpContext context, IReadOnlyList<string> callerRoles, IEnumerable<string> requiredRoles)
    {
        var callerId = ExtractCallerId(context.User);
        var callerRoleStr = callerRoles.Count > 0 ? string.Join(", ", callerRoles) : "None";
        var requiredRolesStr = string.Join(", ", requiredRoles);
        var remoteIp = context.Connection.RemoteIpAddress?.ToString() ?? "Unknown";

        // Acceptance Criterion 4: Unauthorized access attempts are logged
        _logger.LogWarning(
            "Unauthorized role access attempt: Caller '{CallerId}' with role '{CallerRole}' attempted to access restricted endpoint '{Path}' ({Method}) requiring role(s): '{RequiredRoles}'. Remote IP: {RemoteIp}",
            callerId,
            callerRoleStr,
            context.Request.Path,
            context.Request.Method,
            requiredRolesStr,
            remoteIp);

        // Acceptance Criteria 1 & 2: Reject with 403 Forbidden
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        context.Response.ContentType = "application/json";

        var forbiddenResponse = ApiResponse<object>.Fail(
            $"Access denied: Insufficient permissions for role. Required role(s): {requiredRolesStr}.",
            new List<string> { $"Caller role '{callerRoleStr}' is forbidden from accessing '{context.Request.Path}'." });

        await context.Response.WriteAsync(JsonSerializer.Serialize(forbiddenResponse), context.RequestAborted);
    }
}
