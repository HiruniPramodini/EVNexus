namespace EVNexus.AuthService.Services;

public interface ITenantContext
{
    string? TenantId { get; set; }
    bool HasTenant => !string.IsNullOrWhiteSpace(TenantId);
}

public class TenantContext : ITenantContext
{
    public string? TenantId { get; set; }
}
