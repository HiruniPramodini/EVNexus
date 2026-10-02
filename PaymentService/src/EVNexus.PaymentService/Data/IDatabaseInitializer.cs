using System.Threading.Tasks;

namespace EVNexus.PaymentService.Data;

public interface IDatabaseInitializer
{
    Task InitializeAsync();
}
