using System.Net;
using System.Net.Http.Json;
using System.Threading.Tasks;
using Xunit;

namespace EVNexus.MapService.Tests;

public class ChargerCrudIntegrationTests : IntegrationTestBase
{
    public ChargerCrudIntegrationTests(Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory<Program> factory) : base(factory) { }

    private void AuthorizeAsCompanyAdmin(string tenantId)
    {
        var token = GenerateToken(tenantId, userId: System.Guid.NewGuid().ToString(), role: "CompanyAdmin");
        Client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
    }

    private async Task<string> CreateTestStationAsync(string tenantId)
    {
        AuthorizeAsCompanyAdmin(tenantId);
        var stationPayload = new
        {
            name = "Test Station",
            address = "123 Test St",
            latitude = 40.7128m,
            longitude = -74.0060m,
            connectorType = "CCS2",
            capacityKw = 150m,
            pricePerKwh = 0.50m
        };
        var response = await Client.PostAsJsonAsync("/api/map/company/stations", stationPayload);
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        return json.GetProperty("id").GetString()!;
    }

    [Fact]
    public async Task GetChargers_OwnStation_ReturnsSuccess()
    {
        var tenantId = "company1";
        var stationId = await CreateTestStationAsync(tenantId);

        var response = await Client.GetAsync($"/api/map/company/stations/{stationId}/chargers");
        response.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task GetChargers_AnotherCompanyStation_ReturnsNotFound()
    {
        var stationId = await CreateTestStationAsync("company1");

        AuthorizeAsCompanyAdmin("company2");
        var response = await Client.GetAsync($"/api/map/company/stations/{stationId}/chargers");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task CreateCharger_OwnStation_ReturnsSuccess()
    {
        var tenantId = "company1";
        var stationId = await CreateTestStationAsync(tenantId);

        var payload = new { Type = "CCS2", PowerKw = 50m, PricePerKwh = 0.45m };
        var response = await Client.PostAsJsonAsync($"/api/map/company/stations/{stationId}/chargers", payload);
        response.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task CreateCharger_AnotherCompanyStation_ReturnsNotFound()
    {
        var stationId = await CreateTestStationAsync("company1");

        AuthorizeAsCompanyAdmin("company2");
        var payload = new { Type = "CCS2", PowerKw = 50m, PricePerKwh = 0.45m };
        var response = await Client.PostAsJsonAsync($"/api/map/company/stations/{stationId}/chargers", payload);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task UpdateCharger_OwnCharger_ReturnsSuccess()
    {
        var tenantId = "company1";
        var stationId = await CreateTestStationAsync(tenantId);

        var payload = new { Type = "CCS2", PowerKw = 50m, PricePerKwh = 0.45m };
        var createResponse = await Client.PostAsJsonAsync($"/api/map/company/stations/{stationId}/chargers", payload);
        var json = await createResponse.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        var chargerId = json.GetProperty("id").GetString()!;

        var updatePayload = new { Type = "CHAdeMO", PowerKw = 100m, PricePerKwh = 0.60m };
        var updateResponse = await Client.PutAsJsonAsync($"/api/map/company/stations/{stationId}/chargers/{chargerId}", updatePayload);
        updateResponse.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task UpdateCharger_AnotherCompanyCharger_ReturnsNotFound()
    {
        var stationId = await CreateTestStationAsync("company1");
        var payload = new { Type = "CCS2", PowerKw = 50m, PricePerKwh = 0.45m };
        var createResponse = await Client.PostAsJsonAsync($"/api/map/company/stations/{stationId}/chargers", payload);
        var json = await createResponse.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        var chargerId = json.GetProperty("id").GetString()!;

        AuthorizeAsCompanyAdmin("company2");
        var updatePayload = new { Type = "CHAdeMO", PowerKw = 100m, PricePerKwh = 0.60m };
        var updateResponse = await Client.PutAsJsonAsync($"/api/map/company/stations/{stationId}/chargers/{chargerId}", updatePayload);
        Assert.Equal(HttpStatusCode.NotFound, updateResponse.StatusCode);
    }

    [Fact]
    public async Task DeleteCharger_OwnCharger_ReturnsSuccess()
    {
        var tenantId = "company1";
        var stationId = await CreateTestStationAsync(tenantId);

        var payload = new { Type = "CCS2", PowerKw = 50m, PricePerKwh = 0.45m };
        var createResponse = await Client.PostAsJsonAsync($"/api/map/company/stations/{stationId}/chargers", payload);
        var json = await createResponse.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        var chargerId = json.GetProperty("id").GetString()!;

        var deleteResponse = await Client.DeleteAsync($"/api/map/company/stations/{stationId}/chargers/{chargerId}");
        deleteResponse.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task GetChargerQr_OwnCharger_ReturnsSuccess()
    {
        var tenantId = "company1";
        var stationId = await CreateTestStationAsync(tenantId);

        var payload = new { Type = "CCS2", PowerKw = 50m, PricePerKwh = 0.45m };
        var createResponse = await Client.PostAsJsonAsync($"/api/map/company/stations/{stationId}/chargers", payload);
        var json = await createResponse.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        var chargerId = json.GetProperty("id").GetString()!;

        var response = await Client.GetAsync($"/api/map/company/stations/{stationId}/chargers/{chargerId}/qr");
        response.EnsureSuccessStatusCode();
        var qrJson = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        var data = qrJson.GetProperty("data");
        Assert.Equal("EVNEXUS", data.GetProperty("system").GetString());
        Assert.Equal(stationId, data.GetProperty("stationId").GetString());
        Assert.Equal(chargerId, data.GetProperty("chargerId").GetString());
    }

    [Fact]
    public async Task GetChargerQr_AnotherCompanyCharger_ReturnsNotFound()
    {
        var stationId = await CreateTestStationAsync("company1");
        var payload = new { Type = "CCS2", PowerKw = 50m, PricePerKwh = 0.45m };
        var createResponse = await Client.PostAsJsonAsync($"/api/map/company/stations/{stationId}/chargers", payload);
        var json = await createResponse.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        var chargerId = json.GetProperty("id").GetString()!;

        AuthorizeAsCompanyAdmin("company2");
        var response = await Client.GetAsync($"/api/map/company/stations/{stationId}/chargers/{chargerId}/qr");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
