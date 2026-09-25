using System.Data;

namespace EVNexus.PaymentService.Data;

public interface IDbConnectionFactory
{
    IDbConnection CreateConnection();
}
