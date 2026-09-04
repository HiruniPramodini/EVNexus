using System.Security.Claims;
using System.Text.Json;
using EVNexus.AuthService.Attributes;
using EVNexus.AuthService.DTOs;
using EVNexus.AuthService.Services;
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

    public async Task InvokeAsync(HttpContext context, ITokenBlacklistService? tokenBlacklistService = null)
    {
        var endpoint = context.GetEndpoint();
        if (endpoint == null || endpoint.Metadata.GetMetadata<IAllowAnonymous>() != null)
        {
            await _next(context);
            return;
        }

        // AC 2: Invalidate current token/session server-side upon logout
        if (tokenBlacklistService != null && context.User?.Identity?.IsAuthenticated == true)
        {
            var authHeader = context.Request.Headers.Authorization.ToString();
            var rawToken = authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
                ? authHeader["Bearer ".Length..].Trim()
                : null;

            var jti = context.User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Jti)
                   ?? context.User.FindFirstValue("jti");

            var isRevoked = await tokenBlacklistService.IsTokenRevokedAsync(rawToken, jti, context.RequestAborted);
            if (isRevoked)
            {
                _logger.LogWarning("Blocked request with revoked/logged-out token for user {User}", context.User.Identity?.Name ?? "Unknown");
                await HandleRevokedTokenAsync(context);
                return;
            }
        }

        var roleRequirements = GetRoleRequirements(endpoint);
        if (roleRequirements.Count == 0)
        {
            await _next(context);
            return;
        }

        var allRequiredRoles = roleRequirements.SelectMany(r => r).Distinct(StringComparer.OrdinalIgnoreCase).ToList();

        if (context.User?.Identity?.IsAuthenticated != true)
        {
            await HandleUnauthenticatedAsync(context, allRequiredRoles);
            return;
        }

        var callerRoles = ExtractCallerRoles(context.User);

        foreach (var req in roleRequirements)
        {
            var isSatisfied = callerRoles.Any(r => req.Contains(r)) ||
                              req.Any(r => context.User.IsInRole(r));
            if (!isSatisfied)
            {
                await HandleForbiddenAsync(context, callerRoles, req);
                return;
            }
        }

        await _next(context);
    }

    private static List<HashSet<string>> GetRoleRequirements(Endpoint endpoint)
    {
        var requirements = new List<HashSet<string>>();

        var requireRoleAttributes = endpoint.Metadata.GetOrderedMetadata<RequireRoleAttribute>();
        foreach (var attr in requireRoleAttributes)
        {
            var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var role in (attr.Roles ?? Array.Empty<string>()).Where(r => !string.IsNullOrWhiteSpace(r)))
            {
                set.Add(role.Trim());
            }
            if (set.Count > 0)
            {
                requirements.Add(set);
            }
        }

        var authorizeAttributes = endpoint.Metadata.GetOrderedMetadata<AuthorizeAttribute>();
        foreach (var attr in authorizeAttributes.Where(a => !string.IsNullOrWhiteSpace(a.Roles)))
        {
            var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var role in attr.Roles!.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                set.Add(role);
            }
            if (set.Count > 0)
            {
                requirements.Add(set);
            }
        }

        return requirements;
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

    private static async Task HandleRevokedTokenAsync(HttpContext context)
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        context.Response.ContentType = "application/json";

        var payload = ApiResponse<object>.Fail("Session has been logged out or token has been revoked. Please log in again.");
        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });

        await context.Response.WriteAsync(json, context.RequestAborted);
    }
}
