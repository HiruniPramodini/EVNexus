using System.Data;
using MySqlConnector;

namespace EVNexus.DashboardService.Data;

public interface IDbConnectionFactory
{
    IDbConnection CreateConnection();
}

public class DbConnectionFactory : IDbConnectionFactory
{
    private readonly string _connectionString;

    public DbConnectionFactory(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection") 
            ?? configuration["ConnectionStrings__DefaultConnection"]
            ?? "Server=localhost;Port=3310;Database=evnexus_dashboard;User=evnexus;Password=evnexus;";
    }

    public IDbConnection CreateConnection()
    {
        return new MySqlConnection(_connectionString);
    }
}
