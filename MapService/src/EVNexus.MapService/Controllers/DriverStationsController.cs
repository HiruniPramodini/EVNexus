using System;
using System.Linq;
using System.Threading.Tasks;
using EVNexus.MapService.Data;
using EVNexus.MapService.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EVNexus.MapService.Controllers;

[ApiController]
[Route("api/driver/stations")]
public class DriverStationsController : ControllerBase
{
    private readonly IStationRepository _repository;

    public DriverStationsController(IStationRepository repository)
    {
        _repository = repository;
    }

    [HttpGet("nearby")]
    public async Task<IActionResult> GetNearbyStations([FromQuery] double latitude, [FromQuery] double longitude, [FromQuery] double radiusKm = 50.0)
    {
        var allStations = await _repository.GetAllActiveStationsAsync();
        
        var nearbyStations = allStations.Select(s => {
            var distance = CalculateDistance(latitude, longitude, (double)s.Latitude, (double)s.Longitude);
            return new {
                Station = s,
                DistanceKm = distance
            };
        }).Where(x => x.DistanceKm <= radiusKm)
          .OrderBy(x => x.DistanceKm)
          .ToList();

        return Ok(new { success = true, data = nearbyStations });
    }

    private double CalculateDistance(double lat1, double lon1, double lat2, double lon2)
    {
        var d1 = lat1 * (Math.PI / 180.0);
        var num1 = lon1 * (Math.PI / 180.0);
        var d2 = lat2 * (Math.PI / 180.0);
        var num2 = lon2 * (Math.PI / 180.0) - num1;
        var d3 = Math.Pow(Math.Sin((d2 - d1) / 2.0), 2.0) + Math.Cos(d1) * Math.Cos(d2) * Math.Pow(Math.Sin(num2 / 2.0), 2.0);
        
        return 6376500.0 * (2.0 * Math.Atan2(Math.Sqrt(d3), Math.Sqrt(1.0 - d3))) / 1000.0; // Distance in Km
    }

    [HttpPost("qr/validate")]
    [Authorize]
    public async Task<IActionResult> ValidateQrCode([FromBody] QrValidationRequestDto request, [FromServices] IChargerRepository chargerRepo)
    {
        if (request == null || request.System != "EVNEXUS")
            return BadRequest(new { success = false, message = "Invalid QR Code — this QR code does not belong to a valid EVNexus charging port." });

        if (string.IsNullOrEmpty(request.StationId) || string.IsNullOrEmpty(request.CompanyId))
            return BadRequest(new { success = false, message = "Incorrect QR Code format. Missing required identifiers." });

        var allStations = await _repository.GetAllActiveStationsAsync();
        var station = allStations.FirstOrDefault(s => s.Id == request.StationId && s.TenantId == request.CompanyId);

        if (station == null)
            return NotFound(new { success = false, message = "Incorrect QR Code — station or charger not found or inactive." });

        // If chargerId is provided, validate it against the charger table and use its data
        string resolvedChargerId = station.Id; // fallback
        decimal resolvedPowerKw = station.CapacityKw;
        decimal resolvedPricePerKwh = station.PricePerKwh;
        string resolvedConnectorType = station.ConnectorType;

        if (!string.IsNullOrEmpty(request.ChargerId))
        {
            var charger = await chargerRepo.GetChargerByIdAsync(request.ChargerId, station.Id);
            if (charger != null)
            {
                resolvedChargerId = charger.Id;
                resolvedPowerKw = charger.PowerKw;
                resolvedPricePerKwh = charger.PricePerKwh;
                resolvedConnectorType = charger.Type;
            }
            else
            {
                // ChargerId provided but not found — try to get the first available charger for this station
                var chargers = await chargerRepo.GetChargersByStationIdAsync(station.Id);
                var firstCharger = chargers.FirstOrDefault(c => c.Status == "Available");
                if (firstCharger != null)
                {
                    resolvedChargerId = firstCharger.Id;
                    resolvedPowerKw = firstCharger.PowerKw;
                    resolvedPricePerKwh = firstCharger.PricePerKwh;
                    resolvedConnectorType = firstCharger.Type;
                }
                // else fall back to station data with station.Id as chargerId
            }
        }
        else
        {
            // No chargerId in QR — find first available charger for this station
            var chargers = await chargerRepo.GetChargersByStationIdAsync(station.Id);
            var firstCharger = chargers.FirstOrDefault(c => c.Status == "Available");
            if (firstCharger != null)
            {
                resolvedChargerId = firstCharger.Id;
                resolvedPowerKw = firstCharger.PowerKw;
                resolvedPricePerKwh = firstCharger.PricePerKwh;
                resolvedConnectorType = firstCharger.Type;
            }
        }

        return Ok(new {
            success = true,
            data = new {
                stationId = station.Id,
                companyId = station.TenantId,
                chargerId = resolvedChargerId,
                stationName = station.Name,
                address = station.Address,
                connectorType = resolvedConnectorType,
                powerKw = resolvedPowerKw,
                pricePerKwh = resolvedPricePerKwh,
                status = station.IsActive ? "Available" : "Offline",
                chargingCode = station.ChargingCode
            }
        });
    }
}

public class QrValidationRequestDto
{
    public string? System { get; set; }
    public string? CompanyId { get; set; }
    public string? StationId { get; set; }
    public string? ChargerId { get; set; }
}
