using DashboardService.Models;
using Microsoft.EntityFrameworkCore;

namespace DashboardService.Data;

public class DashboardDbContext : DbContext
{
    public DashboardDbContext(DbContextOptions<DashboardDbContext> options) : base(options) { }

    public DbSet<SessionRecord> Sessions => Set<SessionRecord>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<SessionRecord>(e =>
        {
            e.HasIndex(x => x.SessionId).IsUnique();          // idempotent Kafka consume
            e.HasIndex(x => new { x.TenantId, x.EndTime });   // tenant + date queries
            e.Property(x => x.EnergyKwh).HasPrecision(12, 4);
            e.Property(x => x.TotalCost).HasPrecision(12, 2);
            e.Property(x => x.SessionId).HasMaxLength(64);
            e.Property(x => x.TenantId).HasMaxLength(64);
        });
    }
}