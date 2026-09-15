using System;
using System.Linq;
using System.Threading.Tasks;
using EVNexus.MapService.Data;
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
}
