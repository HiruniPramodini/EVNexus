using System.Threading.Tasks;

namespace EVNexus.MapService.Data;

public interface IDatabaseInitializer
{
    Task InitializeAsync();
}
