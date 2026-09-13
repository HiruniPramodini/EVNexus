namespace EVNexus.MapService.Data;

public class TenantContext : ITenantContext
{
    public string TenantId { get; private set; } = string.Empty;
    public string UserId { get; private set; } = string.Empty;
    public string Role { get; private set; } = string.Empty;

    public void SetTenantId(string tenantId) => TenantId = tenantId;
    public void SetUserId(string userId) => UserId = userId;
    public void SetRole(string role) => Role = role;
}
