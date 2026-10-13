using System;
using Xunit;

namespace EVNexus.MapService.Tests;

public class MapDomainUnitTests
{
    // =========================================================================
    // 1. DISTANCE & GEO-LOCATION TESTS (Haversine Formula)
    // =========================================================================

    [Fact]
    public void CalculateDistance_IdenticalCoordinates_ReturnsZeroKm()
    {
        // Arrange
        double lat1 = 6.9271; // Colombo
        double lon1 = 79.8612;

        // Act
        double distance = CalculateHaversineDistance(lat1, lon1, lat1, lon1);

        // Assert
        Assert.Equal(0.0, distance, precision: 2);
    }

    [Fact]
    public void CalculateDistance_KnownCoordinates_ReturnsExpectedRange()
    {
        // Arrange: Colombo to Kandy (~95-115 km)
        double colomboLat = 6.9271, colomboLon = 79.8612;
        double kandyLat = 7.2906, kandyLon = 80.6337;

        // Act
        double distanceKm = CalculateHaversineDistance(colomboLat, colomboLon, kandyLat, kandyLon);

        // Assert
        Assert.InRange(distanceKm, 90.0, 120.0);
    }

    // =========================================================================
    // 2. EV CHARGING TARIFF & COST CALCULATIONS
    // =========================================================================

    [Fact]
    public void CalculateChargingCost_StandardRate_ReturnsExactTotal()
    {
        // Arrange
        decimal energyConsumedKwh = 25.50m;
        decimal pricePerKwh = 120.00m;

        // Act
        decimal totalCost = energyConsumedKwh * pricePerKwh;

        // Assert
        Assert.Equal(3060.00m, totalCost);
    }

    [Theory]
    [InlineData(10.0, 80.0, 800.0)]
    [InlineData(50.0, 100.0, 5000.0)]
    [InlineData(0.0, 120.0, 0.0)]
    public void CalculateChargingCost_ParametricEnergyAndRate_ReturnsCorrectAmount(double energy, double rate, double expected)
    {
        // Act
        decimal calculated = (decimal)energy * (decimal)rate;

        // Assert
        Assert.Equal((decimal)expected, calculated);
    }

    [Fact]
    public void PeakRateCalculation_AppliesPeakMultiplierCorrectly()
    {
        // Arrange
        decimal basePricePerKwh = 100.00m;
        decimal peakMultiplier = 1.30m; // 30% peak surcharge
        decimal energyKwh = 20.00m;

        // Act
        decimal peakPrice = basePricePerKwh * peakMultiplier;
        decimal total = energyKwh * peakPrice;

        // Assert
        Assert.Equal(130.00m, peakPrice);
        Assert.Equal(2600.00m, total);
    }

    // =========================================================================
    // 3. CONNECTOR COMPATIBILITY & FILTERING
    // =========================================================================

    [Theory]
    [InlineData("CCS2", true)]
    [InlineData("Type 2", true)]
    [InlineData("CHAdeMO", true)]
    [InlineData("GB/T", true)]
    [InlineData("INVALID_CONNECTOR", false)]
    public void ValidateConnectorType_RecognizesStandardEvConnectors(string connectorType, bool expectedValidity)
    {
        // Arrange
        var supportedConnectors = new[] { "CCS2", "Type 2", "CHAdeMO", "GB/T" };

        // Act
        bool isValid = Array.Exists(supportedConnectors, c => string.Equals(c, connectorType, StringComparison.OrdinalIgnoreCase));

        // Assert
        Assert.Equal(expectedValidity, isValid);
    }

    // Helper: Haversine distance in kilometers
    private static double CalculateHaversineDistance(double lat1, double lon1, double lat2, double lon2)
    {
        const double EarthRadiusKm = 6371.0;
        double dLat = DegreesToRadians(lat2 - lat1);
        double dLon = DegreesToRadians(lon2 - lon1);

        double a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                   Math.Cos(DegreesToRadians(lat1)) * Math.Cos(DegreesToRadians(lat2)) *
                   Math.Sin(dLon / 2) * Math.Sin(dLon / 2);

        double c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return EarthRadiusKm * c;
    }

    private static double DegreesToRadians(double degrees) => degrees * Math.PI / 180.0;
}
