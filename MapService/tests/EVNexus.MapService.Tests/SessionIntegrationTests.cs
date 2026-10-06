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

    private async Task<(string chargingCode, string companyId, string stationId, string chargerId)> CreateActiveStationAndGetChargingCodeAsync()
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
        var stationId = created.GetProperty("id").GetString()!;
        var chargingCode = created.GetProperty("code").GetString()!;

        var newCharger = new { Type = "CCS2", PowerKw = 50m, PricePerKwh = 0.45m };
        var chargerCreateResponse = await Client.PostAsJsonAsync($"/api/map/company/stations/{stationId}/chargers", newCharger);
        var chargerCreated = await chargerCreateResponse.Content.ReadFromJsonAsync<JsonElement>();
        var chargerId = chargerCreated.GetProperty("id").GetString()!;

        return (chargingCode, tenantId, stationId, chargerId);
    }

    [Fact]
    public async Task StartSession_WithValidChargingCode_ReturnsOk()
    {
        var data = await CreateActiveStationAndGetChargingCodeAsync();

        AuthorizeAs(tenantId: Guid.NewGuid().ToString(), userId: Guid.NewGuid().ToString(), role: "Driver");

        var response = await Client.PostAsJsonAsync("/api/map/driver/sessions/start", new { ChargingCode = data.chargingCode, CompanyId = data.companyId, StationId = data.stationId, ChargerId = data.chargerId });

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
        var data = await CreateActiveStationAndGetChargingCodeAsync();
        AuthorizeAs(tenantId: Guid.NewGuid().ToString(), userId: Guid.NewGuid().ToString(), role: "Driver");

        var startResponse = await Client.PostAsJsonAsync("/api/map/driver/sessions/start", new { ChargingCode = data.chargingCode, CompanyId = data.companyId, StationId = data.stationId, ChargerId = data.chargerId });
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
        var data1 = await CreateActiveStationAndGetChargingCodeAsync();
        var data2 = await CreateActiveStationAndGetChargingCodeAsync();

        var driverUserId = Guid.NewGuid().ToString();
        AuthorizeAs(tenantId: Guid.NewGuid().ToString(), userId: driverUserId, role: "Driver");
        await Client.PostAsJsonAsync("/api/map/driver/sessions/start", new { ChargingCode = data1.chargingCode, CompanyId = data1.companyId, StationId = data1.stationId, ChargerId = data1.chargerId });

        AuthorizeAs(tenantId: Guid.NewGuid().ToString(), userId: driverUserId, role: "Driver");

        var response = await Client.PostAsJsonAsync("/api/map/driver/sessions/start", new { ChargingCode = data2.chargingCode, CompanyId = data2.companyId, StationId = data2.stationId, ChargerId = data2.chargerId });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task StartSession_WithNonexistentCharger_ReturnsNotFound()
    {
        var data = await CreateActiveStationAndGetChargingCodeAsync();
        AuthorizeAs(tenantId: Guid.NewGuid().ToString(), userId: Guid.NewGuid().ToString(), role: "Driver");

        var response = await Client.PostAsJsonAsync("/api/map/driver/sessions/start", new { 
            ChargingCode = data.chargingCode, 
            CompanyId = data.companyId, 
            StationId = data.stationId, 
            ChargerId = Guid.NewGuid().ToString() 
        });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task StartSession_WithChargerFromAnotherStation_ReturnsNotFound()
    {
        var data1 = await CreateActiveStationAndGetChargingCodeAsync();
        var data2 = await CreateActiveStationAndGetChargingCodeAsync();
        AuthorizeAs(tenantId: Guid.NewGuid().ToString(), userId: Guid.NewGuid().ToString(), role: "Driver");

        var response = await Client.PostAsJsonAsync("/api/map/driver/sessions/start", new { 
            ChargingCode = data1.chargingCode, 
            CompanyId = data1.companyId, 
            StationId = data1.stationId, 
            ChargerId = data2.chargerId 
        });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task StartSession_WithAnotherCompany_ReturnsBadRequest()
    {
        var data = await CreateActiveStationAndGetChargingCodeAsync();
        AuthorizeAs(tenantId: Guid.NewGuid().ToString(), userId: Guid.NewGuid().ToString(), role: "Driver");

        var response = await Client.PostAsJsonAsync("/api/map/driver/sessions/start", new { 
            ChargingCode = data.chargingCode, 
            CompanyId = "WrongCompanyId", 
            StationId = data.stationId, 
            ChargerId = data.chargerId 
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}