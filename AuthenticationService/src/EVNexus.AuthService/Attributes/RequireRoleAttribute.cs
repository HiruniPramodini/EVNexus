namespace EVNexus.AuthService.Attributes;

/// <summary>
/// Specifies that access to the decorated controller or action method
/// is restricted to users holding at least one of the specified roles.
/// Reusable across all controllers and evaluated by RoleAuthorizationMiddleware.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true, Inherited = true)]
public class RequireRoleAttribute : Attribute
{
    public string[] Roles { get; }

    public RequireRoleAttribute(params string[] roles)
    {
        Roles = roles ?? Array.Empty<string>();
    }
}
