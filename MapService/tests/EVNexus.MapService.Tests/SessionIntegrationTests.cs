using System;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace EVNexus.MapService.Tests;

public class SessionIntegrationTests : IntegrationTestBase
{
    public SessionIntegrationTests(WebApplicationFactory<Program> factory) : base(factory) { }

    private void AuthorizeAs(string tenantId, string userId, string role)
    {
        var token = GenerateToken(tenantId, userId, role);
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
    }

    private async Task<string> CreateActiveStationAndGetChargingCodeAsync()
    {
        var tenantId = Guid.NewGuid().ToString();
        AuthorizeAs(tenantId, userId: Guid.NewGuid().ToString(), role: "CompanyAdmin");

        var newStation = new
        {
            Name = "Session Test Station",
            Address = "1 Session Street",
            Latitude = 6.9271,
            Longitude = 79.8612,
            ConnectorType = "Type2",
            CapacityKw = 22.0,
            PricePerKwh = 45.0
        };

        var createResponse = await Client.PostAsJsonAsync("/api/map/company/stations", newStation);
        var created = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
        return created.GetProperty("code").GetString()!;
    }

    [Fact]
    public async Task StartSession_WithValidChargingCode_ReturnsOk()
    {
        var chargingCode = await CreateActiveStationAndGetChargingCodeAsync();

        AuthorizeAs(tenantId: Guid.NewGuid().ToString(), userId: Guid.NewGuid().ToString(), role: "Driver");

        var response = await Client.PostAsJsonAsync("/api/map/driver/sessions/start", new { ChargingCode = chargingCode });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.GetProperty("success").GetBoolean());
    }

    [Fact]
    public async Task StartSession_WithInvalidChargingCode_ReturnsBadRequest()
    {
        AuthorizeAs(tenantId: Guid.NewGuid().ToString(), userId: Guid.NewGuid().ToString(), role: "Driver");

        var response = await Client.PostAsJsonAsync("/api/map/driver/sessions/start", new { ChargingCode = "NOPE99" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task StartThenStopSession_FullFlow_ReturnsCompletedSession()
    {
        var chargingCode = await CreateActiveStationAndGetChargingCodeAsync();
        AuthorizeAs(tenantId: Guid.NewGuid().ToString(), userId: Guid.NewGuid().ToString(), role: "Driver");

        var startResponse = await Client.PostAsJsonAsync("/api/map/driver/sessions/start", new { ChargingCode = chargingCode });
        var started = await startResponse.Content.ReadFromJsonAsync<JsonElement>();
        var sessionId = started.GetProperty("data").GetProperty("id").GetString();

        var stopResponse = await Client.PostAsync($"/api/map/driver/sessions/{sessionId}/stop", null);

        Assert.Equal(HttpStatusCode.OK, stopResponse.StatusCode);
        var stopped = await stopResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(stopped.GetProperty("success").GetBoolean());
        Assert.Equal("Completed", stopped.GetProperty("data").GetProperty("status").GetString());
    }

    [Fact]
    public async Task StartSession_WhenDriverAlreadyHasActiveSession_ReturnsBadRequest()
    {
        var firstChargingCode = await CreateActiveStationAndGetChargingCodeAsync();
        var secondChargingCode = await CreateActiveStationAndGetChargingCodeAsync();

        var driverUserId = Guid.NewGuid().ToString();
        AuthorizeAs(tenantId: Guid.NewGuid().ToString(), userId: driverUserId, role: "Driver");
        await Client.PostAsJsonAsync("/api/map/driver/sessions/start", new { ChargingCode = firstChargingCode });

        AuthorizeAs(tenantId: Guid.NewGuid().ToString(), userId: driverUserId, role: "Driver");

        var response = await Client.PostAsJsonAsync("/api/map/driver/sessions/start", new { ChargingCode = secondChargingCode });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}