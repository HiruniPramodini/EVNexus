using System.Data;

namespace EVNexus.MapService.Data;

public interface IDbConnectionFactory
{
    IDbConnection CreateConnection();
}
