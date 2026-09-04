namespace EVNexus.AuthService.Security;

public static class AppRoles
{
    public const string PlatformAdmin = "PlatformAdmin";
    public const string CompanyAdmin = "CompanyAdmin";
    public const string Driver = "Driver";
    public const string Operator = "Operator";

    public static readonly IReadOnlyList<string> AllRoles = new[]
    {
        PlatformAdmin,
        CompanyAdmin,
        Driver,
        Operator
    };
}
