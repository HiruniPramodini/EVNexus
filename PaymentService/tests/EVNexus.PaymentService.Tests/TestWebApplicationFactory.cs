using EVNexus.PaymentService.Kafka;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;

namespace EVNexus.PaymentService.Tests;

public class TestWebApplicationFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureServices(services =>
        {
            // Prevent production background workers from starting during
            // controller/integration tests.
            services.RemoveAll<IHostedService>();
            services.RemoveAll<ChargingSessionCompletedConsumer>();
            services.RemoveAll<OutboxPublisherService>();
        });
    }
}