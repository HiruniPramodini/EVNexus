using System;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace EVNexus.MapService.Tests;

public class CompanySessionsIntegrationTests : IntegrationTestBase
{
    public CompanySessionsIntegrationTests(WebApplicationFactory<Program> factory) : base(factory) { }

    private void AuthorizeAs(string tenantId, string userId, string role)
    {
        var token = GenerateToken(tenantId, userId, role);
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
    }

    private async Task<(string chargingCode, string companyId, string stationId, string chargerId)> CreateStationAndChargerAsync(string tenantId)
    {
        AuthorizeAs(tenantId, userId: Guid.NewGuid().ToString(), role: "CompanyAdmin");

        var newStation = new
        {
            Name = "Company Live Test Station",
            Address = "100 Active Way",
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
    public async Task GetActiveSessions_CompanyAdmin_ReturnsSessionsWithEnrichedFields()
    {
        var companyId = Guid.NewGuid().ToString();
        var data = await CreateStationAndChargerAsync(companyId);

        // Driver starts a session
        var driverId = Guid.NewGuid().ToString();
        AuthorizeAs(tenantId: Guid.NewGuid().ToString(), userId: driverId, role: "Driver");

        var startPayload = new
        {
            ChargingCode = data.chargingCode,
            CompanyId = data.companyId,
            StationId = data.stationId,
            ChargerId = data.chargerId,
            EstimatedCost = 25.00m
        };
        var startRes = await Client.PostAsJsonAsync("/api/map/driver/sessions/start", startPayload);
        Assert.Equal(HttpStatusCode.OK, startRes.StatusCode);
        var startBody = await startRes.Content.ReadFromJsonAsync<JsonElement>();
        var sessionId = startBody.GetProperty("data").GetProperty("id").GetString();

        // CompanyAdmin retrieves active sessions
        AuthorizeAs(tenantId: companyId, userId: Guid.NewGuid().ToString(), role: "CompanyAdmin");

        var response = await Client.GetAsync("/api/company/sessions/active");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.GetProperty("success").GetBoolean());
        var sessions = body.GetProperty("data").EnumerateArray().ToList();

        var matched = sessions.FirstOrDefault(s => s.GetProperty("sessionId").GetString() == sessionId);
        Assert.True(matched.ValueKind != JsonValueKind.Undefined, "Created active session was not found in company active sessions");

        // Verify required rich fields
        Assert.Equal(sessionId, matched.GetProperty("sessionId").GetString());
        Assert.Equal(driverId, matched.GetProperty("driver").GetString());
        Assert.Equal("Company Live Test Station", matched.GetProperty("station").GetString());
        Assert.False(string.IsNullOrEmpty(matched.GetProperty("charger").GetString()));
        Assert.False(string.IsNullOrEmpty(matched.GetProperty("port").GetString()));
        Assert.Equal("Active", matched.GetProperty("currentStatus").GetString());
        Assert.True(matched.TryGetProperty("startTime", out _));
        Assert.True(matched.TryGetProperty("energyConsumed", out _));
        Assert.True(matched.TryGetProperty("estimatedCost", out _));
    }

    [Fact]
    public async Task GetActiveSessions_TenantIsolation_DoesNotReturnOtherCompanySessions()
    {
        // Company A setup
        var companyA = Guid.NewGuid().ToString();
        var dataA = await CreateStationAndChargerAsync(companyA);

        var driverA = Guid.NewGuid().ToString();
        AuthorizeAs(tenantId: Guid.NewGuid().ToString(), userId: driverA, role: "Driver");
        await Client.PostAsJsonAsync("/api/map/driver/sessions/start", new
        {
            ChargingCode = dataA.chargingCode,
            CompanyId = dataA.companyId,
            StationId = dataA.stationId,
            ChargerId = dataA.chargerId,
            EstimatedCost = 15.00m
        });

        // Company B setup
        var companyB = Guid.NewGuid().ToString();
        var dataB = await CreateStationAndChargerAsync(companyB);

        var driverB = Guid.NewGuid().ToString();
        AuthorizeAs(tenantId: Guid.NewGuid().ToString(), userId: driverB, role: "Driver");
        await Client.PostAsJsonAsync("/api/map/driver/sessions/start", new
        {
            ChargingCode = dataB.chargingCode,
            CompanyId = dataB.companyId,
            StationId = dataB.stationId,
            ChargerId = dataB.chargerId,
            EstimatedCost = 20.00m
        });

        // Company A requests active sessions
        AuthorizeAs(tenantId: companyA, userId: Guid.NewGuid().ToString(), role: "CompanyAdmin");
        var resA = await Client.GetAsync("/api/company/sessions/active");
        Assert.Equal(HttpStatusCode.OK, resA.StatusCode);

        var bodyA = await resA.Content.ReadFromJsonAsync<JsonElement>();
        var sessionsA = bodyA.GetProperty("data").EnumerateArray().ToList();

        // Company A must NOT see driverB or stationB
        Assert.All(sessionsA, s =>
        {
            Assert.NotEqual(dataB.stationId, s.GetProperty("stationId").GetString());
            Assert.NotEqual(driverB, s.GetProperty("driver").GetString());
        });
    }

    [Fact]
    public async Task GetActiveSessions_Empty_ReturnsEmptyList()
    {
        var emptyCompany = Guid.NewGuid().ToString();
        AuthorizeAs(tenantId: emptyCompany, userId: Guid.NewGuid().ToString(), role: "CompanyAdmin");

        var response = await Client.GetAsync("/api/company/sessions/active");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.GetProperty("success").GetBoolean());
        Assert.Empty(body.GetProperty("data").EnumerateArray());
    }
}
