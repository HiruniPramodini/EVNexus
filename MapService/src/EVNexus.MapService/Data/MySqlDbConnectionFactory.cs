using System.Data;
using Microsoft.Extensions.Configuration;
using MySql.Data.MySqlClient;

namespace EVNexus.MapService.Data;

public class MySqlDbConnectionFactory : IDbConnectionFactory
{
    private readonly IConfiguration _configuration;

    public MySqlDbConnectionFactory(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public IDbConnection CreateConnection()
    {
        var connectionString = _configuration.GetConnectionString("DefaultConnection");
        return new MySqlConnection(connectionString);
    }
}
