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

public class StationCrudIntegrationTests : IntegrationTestBase
{
    public StationCrudIntegrationTests(WebApplicationFactory<Program> factory) : base(factory) { }

    private void AuthorizeAsCompanyAdmin(string tenantId)
    {
        var token = GenerateToken(tenantId, userId: Guid.NewGuid().ToString(), role: "CompanyAdmin");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
    }

    [Fact]
    public async Task CreateStation_WithValidData_ReturnsCreated()
    {
        var tenantId = Guid.NewGuid().ToString();
        AuthorizeAsCompanyAdmin(tenantId);

        var newStation = new
        {
            Name = "Integration Test Station",
            Address = "123 Test Street",
            Latitude = 6.9271,
            Longitude = 79.8612,
            ConnectorType = "Type2",
            CapacityKw = 22.0,
            PricePerKwh = 45.0
        };

        var response = await Client.PostAsJsonAsync("/api/map/company/stations", newStation);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.GetProperty("success").GetBoolean());
        Assert.False(string.IsNullOrEmpty(body.GetProperty("id").GetString()));
    }

    [Fact]
    public async Task GetStations_AfterCreating_ReturnsTheStation()
    {
        var tenantId = Guid.NewGuid().ToString();
        AuthorizeAsCompanyAdmin(tenantId);

        var newStation = new
        {
            Name = "List Test Station",
            Address = "456 Test Avenue",
            Latitude = 6.9319,
            Longitude = 79.8478,
            ConnectorType = "CCS",
            CapacityKw = 50.0,
            PricePerKwh = 60.0
        };
        await Client.PostAsJsonAsync("/api/map/company/stations", newStation);

        var response = await Client.GetAsync("/api/map/company/stations");

        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.GetProperty("success").GetBoolean());
        Assert.True(body.GetProperty("data").GetArrayLength() >= 1);
    }

    [Fact]
    public async Task UpdateStation_WithValidData_ReturnsOk()
    {
        var tenantId = Guid.NewGuid().ToString();
        AuthorizeAsCompanyAdmin(tenantId);

        var newStation = new
        {
            Name = "Update Test Station",
            Address = "789 Test Road",
            Latitude = 6.9147,
            Longitude = 79.9725,
            ConnectorType = "Type2",
            CapacityKw = 22.0,
            PricePerKwh = 40.0
        };
        var createResponse = await Client.PostAsJsonAsync("/api/map/company/stations", newStation);
        var created = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
        var stationId = created.GetProperty("id").GetString();

        var updateDto = new
        {
            Address = "789 Updated Road",
            PricePerKwh = 42.5,
            CapacityKw = 22.0,
            ConnectorType = "Type2"
        };

        var response = await Client.PutAsJsonAsync($"/api/map/company/stations/{stationId}", updateDto);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task DeactivateStation_ThatExists_ReturnsOk()
    {
        var tenantId = Guid.NewGuid().ToString();
        AuthorizeAsCompanyAdmin(tenantId);

        var newStation = new
        {
            Name = "Deactivate Test Station",
            Address = "321 Test Blvd",
            Latitude = 6.8500,
            Longitude = 79.9000,
            ConnectorType = "CCS",
            CapacityKw = 50.0,
            PricePerKwh = 55.0
        };
        var createResponse = await Client.PostAsJsonAsync("/api/map/company/stations", newStation);
        var created = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
        var stationId = created.GetProperty("id").GetString();

        var response = await Client.DeleteAsync($"/api/map/company/stations/{stationId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task CreateStation_WithoutAuthToken_ReturnsUnauthorized()
    {
        var newStation = new
        {
            Name = "Should Not Be Created",
            Address = "No Auth Street",
            Latitude = 6.9,
            Longitude = 79.9,
            ConnectorType = "Type2",
            CapacityKw = 22.0,
            PricePerKwh = 40.0
        };

        var response = await Client.PostAsJsonAsync("/api/map/company/stations", newStation);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}