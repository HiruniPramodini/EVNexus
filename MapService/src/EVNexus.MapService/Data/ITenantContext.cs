namespace EVNexus.MapService.Data;

public interface ITenantContext
{
    string TenantId { get; }
    string UserId { get; }
    string Role { get; }
    void SetTenantId(string tenantId);
    void SetUserId(string userId);
    void SetRole(string role);
}
