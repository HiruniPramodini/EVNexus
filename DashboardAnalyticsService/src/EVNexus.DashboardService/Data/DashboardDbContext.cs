using EVNexus.DashboardService.Models;
using Microsoft.EntityFrameworkCore;

namespace EVNexus.DashboardService.Data;

public class DashboardDbContext : DbContext
{
    public DashboardDbContext(DbContextOptions<DashboardDbContext> options) : base(options) { }
    public DbSet<ChargingSessionRecord> Sessions => Set<ChargingSessionRecord>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<ChargingSessionRecord>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.DriverId).HasMaxLength(64);
            e.Property(x => x.Cost).HasPrecision(12, 2);
            e.HasIndex(x => new { x.DriverId, x.StartUtc });
        });
    }
}