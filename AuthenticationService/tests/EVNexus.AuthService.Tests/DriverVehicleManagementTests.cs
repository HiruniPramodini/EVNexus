using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using EVNexus.AuthService.Controllers;
using EVNexus.AuthService.Data;
using EVNexus.AuthService.DTOs;
using EVNexus.AuthService.Models;
using EVNexus.AuthService.Services;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace EVNexus.AuthService.Tests;

public class DriverVehicleManagementTests
{
    private readonly Mock<IDriverRepository> _mockDriverRepo;
    private readonly Mock<IPasswordHasher> _mockPasswordHasher;
    private readonly Mock<IJwtTokenService> _mockJwtTokenService;
    private readonly Mock<ILogger<DriverAuthService>> _mockDriverAuthLogger;
    private readonly Mock<ILogger<DriverDataController>> _mockControllerLogger;
    private readonly DriverAuthService _driverAuthService;

    public DriverVehicleManagementTests()
    {
        _mockDriverRepo = new Mock<IDriverRepository>();
        _mockPasswordHasher = new Mock<IPasswordHasher>();
        _mockJwtTokenService = new Mock<IJwtTokenService>();
        _mockDriverAuthLogger = new Mock<ILogger<DriverAuthService>>();
        _mockControllerLogger = new Mock<ILogger<DriverDataController>>();

        _driverAuthService = new DriverAuthService(
            _mockDriverRepo.Object,
            _mockPasswordHasher.Object,
            _mockJwtTokenService.Object,
            _mockDriverAuthLogger.Object);
    }

    private static Driver CreateSampleDriver(string driverId = "DRV-11111", string email = "driver1@evnexus.com")
    {
        return new Driver
        {
            DriverId = driverId,
            Name = "John Driver",
            Email = email,
            Phone = "+1-555-111-2222",
            Role = "Driver",
            Status = "Active",
            IsEmailVerified = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }

    private DriverDataController CreateControllerWithDriver(string? driverId, string role = "Driver")
    {
        var controller = new DriverDataController(
            _mockDriverRepo.Object,
            _mockControllerLogger.Object,
            _driverAuthService);

        var claims = new List<Claim>();
        if (!string.IsNullOrWhiteSpace(driverId))
        {
            claims.Add(new Claim("driver_id", driverId));
            claims.Add(new Claim(ClaimTypes.NameIdentifier, driverId));
            claims.Add(new Claim(ClaimTypes.Role, role));
        }

        var identity = new ClaimsIdentity(claims, "TestAuth");
        var claimsPrincipal = new ClaimsPrincipal(identity);

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = claimsPrincipal }
        };

        return controller;
    }

    #region Acceptance Criteria 1: Add Vehicle

    [Fact]
    public async Task AddDriverVehicle_ValidRequest_CreatesVehicleAndReturnsDto()
    {
        // Arrange
        const string driverId = "DRV-11111";
        var request = new CreateDriverVehicleRequestDto
        {
            Make = "Tesla",
            Model = "Model 3",
            PlateNumber = "CA-8XYZ12",
            ConnectorType = "Tesla NACS",
            IsDefault = true
        };

        _mockDriverRepo
            .Setup(r => r.CreateVehicleAsync(It.IsAny<DriverVehicle>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((DriverVehicle v, CancellationToken _) => v);

        // Act
        var result = await _driverAuthService.AddDriverVehicleAsync(driverId, request);

        // Assert
        result.Should().NotBeNull();
        result.DriverId.Should().Be(driverId);
        result.Make.Should().Be("Tesla");
        result.Model.Should().Be("Model 3");
        result.PlateNumber.Should().Be("CA-8XYZ12");
        result.ConnectorType.Should().Be("Tesla NACS");
        result.IsDefault.Should().BeTrue();
        result.VehicleId.Should().StartWith("VEH-");

        _mockDriverRepo.Verify(r => r.CreateVehicleAsync(
            It.Is<DriverVehicle>(v => v.DriverId == driverId && v.Make == "Tesla" && v.Model == "Model 3"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Theory]
    [InlineData("", "Model 3", "CA-123", "CCS2")]
    [InlineData("Tesla", "", "CA-123", "CCS2")]
    [InlineData("Tesla", "Model 3", "", "CCS2")]
    [InlineData("Tesla", "Model 3", "CA-123", "")]
    public void CreateDriverVehicleRequestDto_MissingRequiredFields_FailsValidation(
        string make, string model, string plateNumber, string connectorType)
    {
        // Arrange
        var dto = new CreateDriverVehicleRequestDto
        {
            Make = make,
            Model = model,
            PlateNumber = plateNumber,
            ConnectorType = connectorType
        };

        var context = new ValidationContext(dto);
        var results = new List<ValidationResult>();

        // Act
        var isValid = Validator.TryValidateObject(dto, context, results, true);

        // Assert
        isValid.Should().BeFalse();
        results.Should().NotBeEmpty();
    }

    [Fact]
    public async Task AddVehicleController_MissingDriverId_Returns403Forbidden()
    {
        // Arrange
        var controller = CreateControllerWithDriver(null);
        var request = new CreateDriverVehicleRequestDto
        {
            Make = "Hyundai",
            Model = "Ioniq 5",
            PlateNumber = "NY-12345",
            ConnectorType = "CCS2"
        };

        // Act
        var response = await controller.AddVehicle(request, CancellationToken.None);

        // Assert
        var objectResult = response.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
    }

    [Fact]
    public async Task AddVehicleController_ValidRequest_Returns201Created()
    {
        // Arrange
        const string driverId = "DRV-11111";
        var controller = CreateControllerWithDriver(driverId);
        var request = new CreateDriverVehicleRequestDto
        {
            Make = "Nissan",
            Model = "Leaf",
            PlateNumber = "TX-999",
            ConnectorType = "CHAdeMO",
            IsDefault = false
        };

        _mockDriverRepo
            .Setup(r => r.CreateVehicleAsync(It.IsAny<DriverVehicle>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((DriverVehicle v, CancellationToken _) => v);

        // Act
        var response = await controller.AddVehicle(request, CancellationToken.None);

        // Assert
        var createdResult = response.Should().BeOfType<ObjectResult>().Subject;
        createdResult.StatusCode.Should().Be(StatusCodes.Status201Created);
        var apiResponse = createdResult.Value.Should().BeOfType<ApiResponse<DriverVehicleDto>>().Subject;
        apiResponse.Success.Should().BeTrue();
        apiResponse.Data!.Make.Should().Be("Nissan");
        apiResponse.Data.Model.Should().Be("Leaf");
        apiResponse.Data.ConnectorType.Should().Be("CHAdeMO");
    }

    #endregion

    #region Acceptance Criteria 2: Edit & Delete Vehicle

    [Fact]
    public async Task UpdateDriverVehicle_ExistingVehicle_UpdatesAndReturnsUpdatedDto()
    {
        // Arrange
        const string driverId = "DRV-11111";
        const string vehicleId = "VEH-ABC123";
        var request = new UpdateDriverVehicleRequestDto
        {
            Make = "BMW",
            Model = "i4 M50",
            PlateNumber = "CA-FAST-EV",
            ConnectorType = "CCS2",
            IsDefault = true
        };

        var updatedVehicle = new DriverVehicle
        {
            VehicleId = vehicleId,
            DriverId = driverId,
            Make = request.Make,
            Model = request.Model,
            PlateNumber = request.PlateNumber,
            ConnectorType = request.ConnectorType,
            IsDefault = true,
            CreatedAt = DateTime.UtcNow.AddDays(-5),
            UpdatedAt = DateTime.UtcNow
        };

        _mockDriverRepo
            .Setup(r => r.UpdateVehicleAsync(vehicleId, driverId, "BMW", "i4 M50", "CA-FAST-EV", "CCS2", true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(updatedVehicle);

        // Act
        var result = await _driverAuthService.UpdateDriverVehicleAsync(driverId, vehicleId, request);

        // Assert
        result.Should().NotBeNull();
        result.VehicleId.Should().Be(vehicleId);
        result.Make.Should().Be("BMW");
        result.Model.Should().Be("i4 M50");
        result.PlateNumber.Should().Be("CA-FAST-EV");
        result.IsDefault.Should().BeTrue();
    }

    [Fact]
    public async Task UpdateDriverVehicle_NonExistentVehicle_ThrowsKeyNotFoundException()
    {
        // Arrange
        const string driverId = "DRV-11111";
        const string vehicleId = "VEH-UNKNOWN";
        var request = new UpdateDriverVehicleRequestDto
        {
            Make = "Kia",
            Model = "EV6",
            PlateNumber = "PLATE-1",
            ConnectorType = "CCS2"
        };

        _mockDriverRepo
            .Setup(r => r.UpdateVehicleAsync(vehicleId, driverId, It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<bool?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((DriverVehicle?)null);

        // Act
        Func<Task> act = async () => await _driverAuthService.UpdateDriverVehicleAsync(driverId, vehicleId, request);

        // Assert
        await act.Should().ThrowAsync<KeyNotFoundException>()
            .WithMessage($"*{vehicleId}*");
    }

    [Fact]
    public async Task UpdateVehicleController_VehicleNotFound_Returns404NotFound()
    {
        // Arrange
        const string driverId = "DRV-11111";
        const string vehicleId = "VEH-NOT-FOUND";
        var controller = CreateControllerWithDriver(driverId);
        var request = new UpdateDriverVehicleRequestDto
        {
            Make = "Ford",
            Model = "Mustang Mach-E",
            PlateNumber = "MACH-E",
            ConnectorType = "CCS1"
        };

        _mockDriverRepo
            .Setup(r => r.UpdateVehicleAsync(vehicleId, driverId, It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<bool?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((DriverVehicle?)null);

        // Act
        var response = await controller.UpdateVehicle(vehicleId, request, CancellationToken.None);

        // Assert
        var notFoundResult = response.Should().BeOfType<NotFoundObjectResult>().Subject;
        notFoundResult.StatusCode.Should().Be(StatusCodes.Status404NotFound);
    }

    [Fact]
    public async Task DeleteDriverVehicle_ExistingVehicle_ReturnsTrue()
    {
        // Arrange
        const string driverId = "DRV-11111";
        const string vehicleId = "VEH-TO-DELETE";

        _mockDriverRepo
            .Setup(r => r.DeleteVehicleAsync(vehicleId, driverId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        // Act
        var success = await _driverAuthService.DeleteDriverVehicleAsync(driverId, vehicleId);

        // Assert
        success.Should().BeTrue();
        _mockDriverRepo.Verify(r => r.DeleteVehicleAsync(vehicleId, driverId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task DeleteDriverVehicle_NonExistentVehicle_ThrowsKeyNotFoundException()
    {
        // Arrange
        const string driverId = "DRV-11111";
        const string vehicleId = "VEH-NON-EXISTENT";

        _mockDriverRepo
            .Setup(r => r.DeleteVehicleAsync(vehicleId, driverId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        // Act
        Func<Task> act = async () => await _driverAuthService.DeleteDriverVehicleAsync(driverId, vehicleId);

        // Assert
        await act.Should().ThrowAsync<KeyNotFoundException>()
            .WithMessage($"*{vehicleId}*");
    }

    [Fact]
    public async Task DeleteVehicleController_Success_Returns200Ok()
    {
        // Arrange
        const string driverId = "DRV-11111";
        const string vehicleId = "VEH-123";
        var controller = CreateControllerWithDriver(driverId);

        _mockDriverRepo
            .Setup(r => r.DeleteVehicleAsync(vehicleId, driverId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        // Act
        var response = await controller.DeleteVehicle(vehicleId, CancellationToken.None);

        // Assert
        var okResult = response.Should().BeOfType<OkObjectResult>().Subject;
        okResult.StatusCode.Should().Be(StatusCodes.Status200OK);
    }

    #endregion

    #region Acceptance Criteria 3: At least one vehicle can be marked as default

    [Fact]
    public async Task SetDefaultDriverVehicle_ExistingVehicle_MarksAsDefaultAndReturnsDto()
    {
        // Arrange
        const string driverId = "DRV-11111";
        const string vehicleId = "VEH-DEFAULT-CANDIDATE";

        var vehicle = new DriverVehicle
        {
            VehicleId = vehicleId,
            DriverId = driverId,
            Make = "Porsche",
            Model = "Taycan",
            PlateNumber = "FAST-01",
            ConnectorType = "CCS2",
            IsDefault = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _mockDriverRepo
            .Setup(r => r.SetDefaultVehicleAsync(vehicleId, driverId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        _mockDriverRepo
            .Setup(r => r.GetVehicleByIdAsync(vehicleId, driverId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(vehicle);

        // Act
        var result = await _driverAuthService.SetDefaultDriverVehicleAsync(driverId, vehicleId);

        // Assert
        result.Should().NotBeNull();
        result.VehicleId.Should().Be(vehicleId);
        result.IsDefault.Should().BeTrue();

        _mockDriverRepo.Verify(r => r.SetDefaultVehicleAsync(vehicleId, driverId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SetDefaultVehicleController_ValidVehicle_Returns200OkWithDefaultStatus()
    {
        // Arrange
        const string driverId = "DRV-11111";
        const string vehicleId = "VEH-MAKE-DEFAULT";
        var controller = CreateControllerWithDriver(driverId);

        var vehicle = new DriverVehicle
        {
            VehicleId = vehicleId,
            DriverId = driverId,
            Make = "Rivian",
            Model = "R1T",
            PlateNumber = "ADVENTURE",
            ConnectorType = "CCS1",
            IsDefault = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _mockDriverRepo
            .Setup(r => r.SetDefaultVehicleAsync(vehicleId, driverId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        _mockDriverRepo
            .Setup(r => r.GetVehicleByIdAsync(vehicleId, driverId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(vehicle);

        // Act
        var response = await controller.SetDefaultVehicle(vehicleId, CancellationToken.None);

        // Assert
        var okResult = response.Should().BeOfType<OkObjectResult>().Subject;
        okResult.StatusCode.Should().Be(StatusCodes.Status200OK);
        var apiResponse = okResult.Value.Should().BeOfType<ApiResponse<DriverVehicleDto>>().Subject;
        apiResponse.Success.Should().BeTrue();
        apiResponse.Data!.IsDefault.Should().BeTrue();
    }

    #endregion

    #region Acceptance Criteria 4: Vehicle list is scoped only to the logged-in driver

    [Fact]
    public async Task GetDriverVehicles_ReturnsOnlyVehiclesBelongingToCallingDriver()
    {
        // Arrange
        const string driverA = "DRV-AAAAA";
        const string driverB = "DRV-BBBBB";

        var driverAVehicles = new List<DriverVehicle>
        {
            new() { VehicleId = "VEH-1", DriverId = driverA, Make = "Tesla", Model = "Model 3", PlateNumber = "A1", ConnectorType = "Tesla NACS", IsDefault = true },
            new() { VehicleId = "VEH-2", DriverId = driverA, Make = "Hyundai", Model = "Kona", PlateNumber = "A2", ConnectorType = "CCS2", IsDefault = false }
        };

        _mockDriverRepo
            .Setup(r => r.GetVehiclesByDriverIdAsync(driverA, It.IsAny<CancellationToken>()))
            .ReturnsAsync(driverAVehicles);

        _mockDriverRepo
            .Setup(r => r.GetVehiclesByDriverIdAsync(driverB, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<DriverVehicle>
            {
                new() { VehicleId = "VEH-3", DriverId = driverB, Make = "Audi", Model = "e-tron", PlateNumber = "B1", ConnectorType = "CCS2", IsDefault = true }
            });

        // Act
        var resultA = await _driverAuthService.GetDriverVehiclesAsync(driverA);

        // Assert
        resultA.Should().HaveCount(2);
        resultA.Should().AllSatisfy(v => v.DriverId.Should().Be(driverA));
        resultA.Select(v => v.VehicleId).Should().Contain(new[] { "VEH-1", "VEH-2" });
        resultA.Select(v => v.VehicleId).Should().NotContain("VEH-3");
    }

    [Fact]
    public async Task GetDriverProfile_IncludesVehiclesCollectionScopedToCallingDriver()
    {
        // Arrange
        const string driverId = "DRV-11111";
        var driver = CreateSampleDriver(driverId);
        var vehicles = new List<DriverVehicle>
        {
            new() { VehicleId = "VEH-10", DriverId = driverId, Make = "Tesla", Model = "Model Y", PlateNumber = "ELON-1", ConnectorType = "Tesla NACS", IsDefault = true }
        };

        _mockDriverRepo
            .Setup(r => r.GetDriverByIdAsync(driverId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(driver);

        _mockDriverRepo
            .Setup(r => r.GetWalletByDriverIdAsync(driverId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Wallet?)null);

        _mockDriverRepo
            .Setup(r => r.GetVehiclesByDriverIdAsync(driverId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(vehicles);

        // Act
        var profile = await _driverAuthService.GetDriverProfileAsync(driverId);

        // Assert
        profile.Should().NotBeNull();
        profile.Vehicles.Should().NotBeNull();
        profile.Vehicles.Should().HaveCount(1);
        profile.Vehicles[0].VehicleId.Should().Be("VEH-10");
        profile.Vehicles[0].Make.Should().Be("Tesla");
        profile.Vehicles[0].Model.Should().Be("Model Y");
    }

    [Fact]
    public async Task CrossDriverAccess_AttemptingToModifyAnotherDriversVehicle_ReturnsNotFound()
    {
        // Arrange: Driver A attempts to update Driver B's vehicle
        const string driverA = "DRV-AAAAA";
        const string vehicleB = "VEH-DRIVER-B-CAR";

        var controllerA = CreateControllerWithDriver(driverA);
        var request = new UpdateDriverVehicleRequestDto
        {
            Make = "Malicious",
            Model = "Edit",
            PlateNumber = "HACKED",
            ConnectorType = "Type 2"
        };

        // Repository verifies both vehicleId AND driverId, so driverA cannot find driverB's vehicle
        _mockDriverRepo
            .Setup(r => r.UpdateVehicleAsync(vehicleB, driverA, It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<bool?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((DriverVehicle?)null);

        // Act
        var updateResponse = await controllerA.UpdateVehicle(vehicleB, request, CancellationToken.None);

        // Assert: Scoping prevents cross-driver modifications
        var notFoundResult = updateResponse.Should().BeOfType<NotFoundObjectResult>().Subject;
        notFoundResult.StatusCode.Should().Be(StatusCodes.Status404NotFound);
    }

    [Fact]
    public async Task CrossDriverAccess_AttemptingToDeleteAnotherDriversVehicle_ReturnsNotFound()
    {
        // Arrange: Driver A attempts to delete Driver B's vehicle
        const string driverA = "DRV-AAAAA";
        const string vehicleB = "VEH-DRIVER-B-CAR";

        var controllerA = CreateControllerWithDriver(driverA);

        _mockDriverRepo
            .Setup(r => r.DeleteVehicleAsync(vehicleB, driverA, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        // Act
        var deleteResponse = await controllerA.DeleteVehicle(vehicleB, CancellationToken.None);

        // Assert: Scoping prevents cross-driver deletion
        var notFoundResult = deleteResponse.Should().BeOfType<NotFoundObjectResult>().Subject;
        notFoundResult.StatusCode.Should().Be(StatusCodes.Status404NotFound);
    }

    #endregion
}
