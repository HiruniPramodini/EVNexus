using System.Net;
using System.Net.Http.Json;
using System.Threading.Tasks;
using EVNexus.MapService.Models;
using Xunit;

using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace EVNexus.MapService.Tests;

public class QrValidationTests : IntegrationTestBase
{
    private readonly IServiceProvider _serviceProvider;

    public QrValidationTests(WebApplicationFactory<Program> factory) : base(factory)
    {
        _serviceProvider = factory.Services;
    }

    [Fact]
    public async Task ValidateQrCode_WithValidIdentifiers_ReturnsOk()
    {
        // Arrange
        using var scope = _serviceProvider.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<EVNexus.MapService.Data.IStationRepository>();

        var station = new Station
        {
            Id = System.Guid.NewGuid().ToString(),
            TenantId = "company-1",
            Name = "Valid Station",
            Address = "123 Test St",
            IsActive = true,
            ChargingCode = System.Guid.NewGuid().ToString().Substring(0, 6)
        };
        await repository.CreateStationAsync(station);

        var request = new
        {
            system = "EVNEXUS",
            companyId = "company-1",
            stationId = station.Id
        };

        var token = GenerateToken("driver-1", "user-1", "Driver");
        Client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        // Act
        var response = await Client.PostAsJsonAsync("/api/driver/stations/qr/validate", request);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task ValidateQrCode_WithInvalidSystem_ReturnsBadRequest()
    {
        // Arrange
        var request = new { system = "OTHER", companyId = "company-1", stationId = "station-1" };
        var token = GenerateToken("driver-1", "user-1", "Driver");
        Client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        // Act
        var response = await Client.PostAsJsonAsync("/api/driver/stations/qr/validate", request);

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ValidateQrCode_WithNonexistentStation_ReturnsNotFound()
    {
        // Arrange
        var request = new { system = "EVNEXUS", companyId = "company-1", stationId = "station-1" };
        var token = GenerateToken("driver-1", "user-1", "Driver");
        Client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        // Act
        var response = await Client.PostAsJsonAsync("/api/driver/stations/qr/validate", request);

        // Assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
