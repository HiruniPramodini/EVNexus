using System.Data;

namespace EVNexus.DashboardService.Data;

public interface IDbConnectionFactory
{
    IDbConnection CreateConnection();
}
