namespace EVNexus.AuthService.Middleware;

public static class RoleAuthorizationMiddlewareExtensions
{
    /// <summary>
    /// Adds the RoleAuthorizationMiddleware to the application's request pipeline.
    /// Ensures that requests to role-restricted endpoints are verified against the caller's JWT role claim.
    /// </summary>
    public static IApplicationBuilder UseRoleAuthorization(this IApplicationBuilder builder)
    {
        return builder.UseMiddleware<RoleAuthorizationMiddleware>();
    }
}
