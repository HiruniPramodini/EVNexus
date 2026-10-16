using System.Data;
using Microsoft.Extensions.Configuration;
using MySqlConnector;

namespace EVNexus.DashboardService.Data;

public class DbConnectionFactory : IDbConnectionFactory
{
    private readonly IConfiguration _configuration;

    public DbConnectionFactory(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public IDbConnection CreateConnection()
    {
        // Check for specific PaymentConnection or fall back to DefaultConnection
        var connectionString = _configuration.GetConnectionString("PaymentConnection") 
                            ?? _configuration.GetConnectionString("DefaultConnection")
                            ?? _configuration["ConnectionStrings__PaymentConnection"]
                            ?? _configuration["ConnectionStrings__DefaultConnection"];

        return new MySqlConnection(connectionString);
    }
}
