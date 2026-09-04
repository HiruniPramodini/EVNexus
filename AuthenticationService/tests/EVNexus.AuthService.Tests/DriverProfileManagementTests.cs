using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using EVNexus.AuthService.Controllers;
using EVNexus.AuthService.Data;
using EVNexus.AuthService.DTOs;
using EVNexus.AuthService.Exceptions;
using EVNexus.AuthService.Models;
using EVNexus.AuthService.Services;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace EVNexus.AuthService.Tests;

public class DriverProfileManagementTests
{
    private readonly Mock<IDriverRepository> _mockDriverRepo;
    private readonly Mock<IPasswordHasher> _mockPasswordHasher;
    private readonly Mock<IJwtTokenService> _mockJwtTokenService;
    private readonly Mock<ILogger<DriverAuthService>> _mockDriverAuthLogger;
    private readonly Mock<ILogger<AuthController>> _mockAuthControllerLogger;
    private readonly Mock<ILogger<DriverDataController>> _mockDriverDataControllerLogger;
    private readonly Mock<ICompanyAuthService> _mockCompanyAuthService;
    private readonly DriverAuthService _driverAuthService;

    public DriverProfileManagementTests()
    {
        _mockDriverRepo = new Mock<IDriverRepository>();
        _mockPasswordHasher = new Mock<IPasswordHasher>();
        _mockJwtTokenService = new Mock<IJwtTokenService>();
        _mockDriverAuthLogger = new Mock<ILogger<DriverAuthService>>();
        _mockAuthControllerLogger = new Mock<ILogger<AuthController>>();
        _mockDriverDataControllerLogger = new Mock<ILogger<DriverDataController>>();
        _mockCompanyAuthService = new Mock<ICompanyAuthService>();

        _driverAuthService = new DriverAuthService(
            _mockDriverRepo.Object,
            _mockPasswordHasher.Object,
            _mockJwtTokenService.Object,
            _mockDriverAuthLogger.Object);
    }

    private static Driver CreateSampleDriver(string driverId = "DRV-12345", string email = "driver@evnexus.com")
    {
        return new Driver
        {
            DriverId = driverId,
            Name = "Alex Rivera",
            Email = email,
            Phone = "+1-555-987-6543",
            PasswordHash = "$2a$12$sampleExistingDriverHash",
            Role = "Driver",
            Status = "Active",
            CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            UpdatedAt = new DateTime(2026, 1, 15, 0, 0, 0, DateTimeKind.Utc)
        };
    }

    private static Wallet CreateSampleWallet(string driverId = "DRV-12345")
    {
        return new Wallet
        {
            WalletId = "WLT-12345",
            DriverId = driverId,
            Balance = 45.50m,
            Currency = "USD",
            Status = "Active",
            CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            UpdatedAt = new DateTime(2026, 1, 15, 0, 0, 0, DateTimeKind.Utc)
        };
    }

    private AuthController CreateAuthControllerWithUser(string? driverId, string role = "Driver")
    {
        var controller = new AuthController(
            _mockCompanyAuthService.Object,
            _driverAuthService,
            _mockAuthControllerLogger.Object);

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

    private DriverDataController CreateDriverDataControllerWithUser(string? driverId, string role = "Driver")
    {
        var controller = new DriverDataController(
            _mockDriverRepo.Object,
            _mockDriverDataControllerLogger.Object,
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

    // =========================================================================
    // Service Layer Tests: Driver Profile & Password Management
    // =========================================================================

    [Fact]
    public async Task GetDriverProfile_ReturnsProfileAndWalletDetails_Successfully()
    {
        var driver = CreateSampleDriver();
        var wallet = CreateSampleWallet();

        _mockDriverRepo.Setup(r => r.GetDriverByIdAsync(driver.DriverId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(driver);
        _mockDriverRepo.Setup(r => r.GetWalletByDriverIdAsync(driver.DriverId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(wallet);

        var result = await _driverAuthService.GetDriverProfileAsync(driver.DriverId);

        result.Should().NotBeNull();
        result.DriverId.Should().Be(driver.DriverId);
        result.Name.Should().Be("Alex Rivera");
        result.Email.Should().Be("driver@evnexus.com");
        result.Phone.Should().Be("+1-555-987-6543");
        result.WalletId.Should().Be("WLT-12345");
        result.WalletBalance.Should().Be(45.50m);
        result.Currency.Should().Be("USD");
        result.UpdatedAt.Should().Be(driver.UpdatedAt);
    }

    [Fact]
    public async Task GetDriverProfile_DriverNotFound_ThrowsDriverNotFoundException()
    {
        _mockDriverRepo.Setup(r => r.GetDriverByIdAsync("DRV-NONEXISTENT", It.IsAny<CancellationToken>()))
            .ReturnsAsync((Driver?)null);

        var act = async () => await _driverAuthService.GetDriverProfileAsync("DRV-NONEXISTENT");

        await act.Should().ThrowAsync<DriverNotFoundException>();
    }

    [Fact]
    public async Task UpdateDriverProfile_ValidRequest_UpdatesNameAndPhone_AndReturnsUpdatedDto()
    {
        var driver = CreateSampleDriver();
        var wallet = CreateSampleWallet();

        var updatedDriver = CreateSampleDriver();
        updatedDriver.Name = "Alexander Rivera";
        updatedDriver.Phone = "+1-555-111-2233";
        updatedDriver.UpdatedAt = DateTime.UtcNow;

        _mockDriverRepo.SetupSequence(r => r.GetDriverByIdAsync(driver.DriverId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(driver)
            .ReturnsAsync(updatedDriver);

        _mockDriverRepo.Setup(r => r.GetWalletByDriverIdAsync(driver.DriverId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(wallet);

        _mockDriverRepo.Setup(r => r.UpdateDriverProfileAsync(driver.DriverId, "Alexander Rivera", "+1-555-111-2233", It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var request = new UpdateDriverProfileRequestDto
        {
            Name = "  Alexander Rivera  ",
            Phone = "  +1-555-111-2233  "
        };

        var result = await _driverAuthService.UpdateDriverProfileAsync(driver.DriverId, request);

        result.Should().NotBeNull();
        result.Name.Should().Be("Alexander Rivera");
        result.Phone.Should().Be("+1-555-111-2233");
        result.Email.Should().Be(driver.Email);

        _mockDriverRepo.Verify(r => r.UpdateDriverProfileAsync(driver.DriverId, "Alexander Rivera", "+1-555-111-2233", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task UpdateDriverProfile_DriverNotFound_ThrowsDriverNotFoundException()
    {
        _mockDriverRepo.Setup(r => r.GetDriverByIdAsync("DRV-UNKNOWN", It.IsAny<CancellationToken>()))
            .ReturnsAsync((Driver?)null);

        var request = new UpdateDriverProfileRequestDto
        {
            Name = "New Name",
            Phone = "+1-555-000-1111"
        };

        var act = async () => await _driverAuthService.UpdateDriverProfileAsync("DRV-UNKNOWN", request);

        await act.Should().ThrowAsync<DriverNotFoundException>();
    }

    [Fact]
    public async Task ChangeDriverPassword_ValidCurrentAndNewPassword_HashesAndSavesNewPassword()
    {
        var driver = CreateSampleDriver();

        _mockDriverRepo.Setup(r => r.GetDriverByIdAsync(driver.DriverId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(driver);

        _mockPasswordHasher.Setup(h => h.VerifyPassword("CurrentSecret123", driver.PasswordHash))
            .Returns(true);

        _mockPasswordHasher.Setup(h => h.HashPassword("BrandNewSecret999"))
            .Returns("$2a$12$hashedNewPasswordString");

        _mockDriverRepo.Setup(r => r.UpdateDriverPasswordAsync(driver.DriverId, "$2a$12$hashedNewPasswordString", It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var request = new ChangeDriverPasswordRequestDto
        {
            CurrentPassword = "CurrentSecret123",
            NewPassword = "BrandNewSecret999",
            ConfirmNewPassword = "BrandNewSecret999"
        };

        await _driverAuthService.ChangeDriverPasswordAsync(driver.DriverId, request);

        _mockDriverRepo.Verify(r => r.UpdateDriverPasswordAsync(driver.DriverId, "$2a$12$hashedNewPasswordString", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ChangeDriverPassword_IncorrectCurrentPassword_ThrowsInvalidCurrentPasswordException()
    {
        var driver = CreateSampleDriver();

        _mockDriverRepo.Setup(r => r.GetDriverByIdAsync(driver.DriverId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(driver);

        _mockPasswordHasher.Setup(h => h.VerifyPassword("WrongCurrentPassword", driver.PasswordHash))
            .Returns(false);

        var request = new ChangeDriverPasswordRequestDto
        {
            CurrentPassword = "WrongCurrentPassword",
            NewPassword = "BrandNewSecret999",
            ConfirmNewPassword = "BrandNewSecret999"
        };

        var act = async () => await _driverAuthService.ChangeDriverPasswordAsync(driver.DriverId, request);

        await act.Should().ThrowAsync<InvalidCurrentPasswordException>()
            .WithMessage("Current password is incorrect.");

        _mockDriverRepo.Verify(r => r.UpdateDriverPasswordAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ChangeDriverPassword_SamePasswordAsCurrent_ThrowsInvalidOperationException()
    {
        var driver = CreateSampleDriver();

        _mockDriverRepo.Setup(r => r.GetDriverByIdAsync(driver.DriverId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(driver);

        _mockPasswordHasher.Setup(h => h.VerifyPassword("SamePassword123", driver.PasswordHash))
            .Returns(true);

        var request = new ChangeDriverPasswordRequestDto
        {
            CurrentPassword = "SamePassword123",
            NewPassword = "SamePassword123",
            ConfirmNewPassword = "SamePassword123"
        };

        var act = async () => await _driverAuthService.ChangeDriverPasswordAsync(driver.DriverId, request);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("New password cannot be the same as your current password.");
    }

    [Fact]
    public async Task ChangeDriverPassword_DriverNotFound_ThrowsDriverNotFoundException()
    {
        _mockDriverRepo.Setup(r => r.GetDriverByIdAsync("DRV-MISSING", It.IsAny<CancellationToken>()))
            .ReturnsAsync((Driver?)null);

        var request = new ChangeDriverPasswordRequestDto
        {
            CurrentPassword = "CurrentPassword123",
            NewPassword = "BrandNewPassword123",
            ConfirmNewPassword = "BrandNewPassword123"
        };

        var act = async () => await _driverAuthService.ChangeDriverPasswordAsync("DRV-MISSING", request);

        await act.Should().ThrowAsync<DriverNotFoundException>();
    }

    // =========================================================================
    // DTO Validation Tests
    // =========================================================================

    [Fact]
    public void UpdateDriverProfileRequestDto_Validation_FailsWhenRequiredFieldsMissingOrInvalid()
    {
        var dto = new UpdateDriverProfileRequestDto
        {
            Name = "A", // too short (minimum 2 chars)
            Phone = "not-a-phone" // invalid phone
        };

        var context = new ValidationContext(dto);
        var results = new List<ValidationResult>();
        var isValid = Validator.TryValidateObject(dto, context, results, true);

        isValid.Should().BeFalse();
        results.Should().Contain(r => r.ErrorMessage!.Contains("Driver full name must be between 2 and 100 characters"));
    }

    [Fact]
    public void ChangeDriverPasswordRequestDto_Validation_FailsWhenPasswordTooShortOrLacksDigit()
    {
        var dto = new ChangeDriverPasswordRequestDto
        {
            CurrentPassword = "ValidCurrentPassword1",
            NewPassword = "short", // less than 8 chars
            ConfirmNewPassword = "short"
        };

        var context = new ValidationContext(dto);
        var results = new List<ValidationResult>();
        var isValid = Validator.TryValidateObject(dto, context, results, true);

        isValid.Should().BeFalse();
        results.Should().Contain(r => r.ErrorMessage!.Contains("at least 8 characters"));
    }

    [Fact]
    public void ChangeDriverPasswordRequestDto_Validation_FailsWhenPasswordsDoNotMatch()
    {
        var dto = new ChangeDriverPasswordRequestDto
        {
            CurrentPassword = "ValidCurrentPassword1",
            NewPassword = "ValidNewPassword123",
            ConfirmNewPassword = "DifferentPassword456"
        };

        var context = new ValidationContext(dto);
        var results = new List<ValidationResult>();
        var isValid = Validator.TryValidateObject(dto, context, results, true);

        isValid.Should().BeFalse();
        results.Should().Contain(r => r.ErrorMessage!.Contains("New password and confirmation do not match"));
    }

    // =========================================================================
    // Controller Layer Tests: AuthController
    // =========================================================================

    [Fact]
    public async Task AuthController_UpdateDriverProfile_ReturnsOk200()
    {
        var driver = CreateSampleDriver();
        var wallet = CreateSampleWallet();

        var updatedDriver = CreateSampleDriver();
        updatedDriver.Name = "Alex R. Updated";
        updatedDriver.Phone = "+1-555-333-4444";

        _mockDriverRepo.SetupSequence(r => r.GetDriverByIdAsync(driver.DriverId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(driver)
            .ReturnsAsync(updatedDriver);

        _mockDriverRepo.Setup(r => r.GetWalletByDriverIdAsync(driver.DriverId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(wallet);

        _mockDriverRepo.Setup(r => r.UpdateDriverProfileAsync(driver.DriverId, It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var controller = CreateAuthControllerWithUser(driver.DriverId);

        var request = new UpdateDriverProfileRequestDto
        {
            Name = "Alex R. Updated",
            Phone = "+1-555-333-4444"
        };

        var response = await controller.UpdateDriverProfile(request, CancellationToken.None);

        var okResult = response.Should().BeOfType<OkObjectResult>().Subject;
        var apiResponse = okResult.Value.Should().BeOfType<ApiResponse<DriverProfileResponseDto>>().Subject;
        apiResponse.Success.Should().BeTrue();
        apiResponse.Data!.Name.Should().Be("Alex R. Updated");
        apiResponse.Data.Phone.Should().Be("+1-555-333-4444");
    }

    [Fact]
    public async Task AuthController_ChangeDriverPassword_ReturnsOk200()
    {
        var driver = CreateSampleDriver();

        _mockDriverRepo.Setup(r => r.GetDriverByIdAsync(driver.DriverId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(driver);

        _mockPasswordHasher.Setup(h => h.VerifyPassword("CurrentPwd123", driver.PasswordHash))
            .Returns(true);

        _mockPasswordHasher.Setup(h => h.HashPassword("NewSecretPwd456"))
            .Returns("$2a$12$newlyHashedValue");

        _mockDriverRepo.Setup(r => r.UpdateDriverPasswordAsync(driver.DriverId, "$2a$12$newlyHashedValue", It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var controller = CreateAuthControllerWithUser(driver.DriverId);

        var request = new ChangeDriverPasswordRequestDto
        {
            CurrentPassword = "CurrentPwd123",
            NewPassword = "NewSecretPwd456",
            ConfirmNewPassword = "NewSecretPwd456"
        };

        var response = await controller.ChangeDriverPassword(request, CancellationToken.None);

        var okResult = response.Should().BeOfType<OkObjectResult>().Subject;
        var apiResponse = okResult.Value.Should().BeOfType<ApiResponse<object>>().Subject;
        apiResponse.Success.Should().BeTrue();
        apiResponse.Message.Should().Be("Password changed successfully.");
    }

    [Fact]
    public async Task AuthController_ChangeDriverPassword_InvalidCurrentPassword_ReturnsBadRequest400()
    {
        var driver = CreateSampleDriver();

        _mockDriverRepo.Setup(r => r.GetDriverByIdAsync(driver.DriverId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(driver);

        _mockPasswordHasher.Setup(h => h.VerifyPassword("WrongPwd", driver.PasswordHash))
            .Returns(false);

        var controller = CreateAuthControllerWithUser(driver.DriverId);

        var request = new ChangeDriverPasswordRequestDto
        {
            CurrentPassword = "WrongPwd",
            NewPassword = "NewSecretPwd456",
            ConfirmNewPassword = "NewSecretPwd456"
        };

        var response = await controller.ChangeDriverPassword(request, CancellationToken.None);

        var badRequest = response.Should().BeOfType<BadRequestObjectResult>().Subject;
        var apiResponse = badRequest.Value.Should().BeOfType<ApiResponse<object>>().Subject;
        apiResponse.Success.Should().BeFalse();
        apiResponse.Message.Should().Be("Current password is incorrect.");
    }

    [Fact]
    public async Task AuthController_UpdateDriverProfile_MissingDriverIdClaim_ReturnsUnauthorized401()
    {
        var controller = CreateAuthControllerWithUser(null); // No driver_id claim

        var request = new UpdateDriverProfileRequestDto
        {
            Name = "Valid Name",
            Phone = "+1-555-111-2222"
        };

        var response = await controller.UpdateDriverProfile(request, CancellationToken.None);

        var unauthorized = response.Should().BeOfType<UnauthorizedObjectResult>().Subject;
        var apiResponse = unauthorized.Value.Should().BeOfType<ApiResponse<object>>().Subject;
        apiResponse.Success.Should().BeFalse();
    }

    // =========================================================================
    // Controller Layer Tests: DriverDataController
    // =========================================================================

    [Fact]
    public async Task DriverDataController_GetProfile_ReturnsOk200()
    {
        var driver = CreateSampleDriver();
        var wallet = CreateSampleWallet();

        _mockDriverRepo.Setup(r => r.GetDriverByIdAsync(driver.DriverId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(driver);
        _mockDriverRepo.Setup(r => r.GetWalletByDriverIdAsync(driver.DriverId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(wallet);

        var controller = CreateDriverDataControllerWithUser(driver.DriverId);

        var response = await controller.GetProfile(CancellationToken.None);

        var okResult = response.Should().BeOfType<OkObjectResult>().Subject;
        var apiResponse = okResult.Value.Should().BeOfType<ApiResponse<DriverProfileResponseDto>>().Subject;
        apiResponse.Success.Should().BeTrue();
        apiResponse.Data!.DriverId.Should().Be(driver.DriverId);
    }

    [Fact]
    public async Task DriverDataController_UpdateProfile_ReturnsOk200()
    {
        var driver = CreateSampleDriver();
        var wallet = CreateSampleWallet();

        var updatedDriver = CreateSampleDriver();
        updatedDriver.Name = "Alex Driver Pro";
        updatedDriver.Phone = "+1-555-888-9999";

        _mockDriverRepo.SetupSequence(r => r.GetDriverByIdAsync(driver.DriverId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(driver)
            .ReturnsAsync(updatedDriver);

        _mockDriverRepo.Setup(r => r.GetWalletByDriverIdAsync(driver.DriverId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(wallet);

        _mockDriverRepo.Setup(r => r.UpdateDriverProfileAsync(driver.DriverId, It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var controller = CreateDriverDataControllerWithUser(driver.DriverId);

        var request = new UpdateDriverProfileRequestDto
        {
            Name = "Alex Driver Pro",
            Phone = "+1-555-888-9999"
        };

        var response = await controller.UpdateProfile(request, CancellationToken.None);

        var okResult = response.Should().BeOfType<OkObjectResult>().Subject;
        var apiResponse = okResult.Value.Should().BeOfType<ApiResponse<DriverProfileResponseDto>>().Subject;
        apiResponse.Success.Should().BeTrue();
        apiResponse.Data!.Name.Should().Be("Alex Driver Pro");
    }

    [Fact]
    public async Task DriverDataController_ChangePassword_ReturnsOk200()
    {
        var driver = CreateSampleDriver();

        _mockDriverRepo.Setup(r => r.GetDriverByIdAsync(driver.DriverId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(driver);

        _mockPasswordHasher.Setup(h => h.VerifyPassword("Current123", driver.PasswordHash))
            .Returns(true);

        _mockPasswordHasher.Setup(h => h.HashPassword("NewSecret456"))
            .Returns("$2a$12$hashedVal");

        _mockDriverRepo.Setup(r => r.UpdateDriverPasswordAsync(driver.DriverId, "$2a$12$hashedVal", It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var controller = CreateDriverDataControllerWithUser(driver.DriverId);

        var request = new ChangeDriverPasswordRequestDto
        {
            CurrentPassword = "Current123",
            NewPassword = "NewSecret456",
            ConfirmNewPassword = "NewSecret456"
        };

        var response = await controller.ChangePassword(request, CancellationToken.None);

        var okResult = response.Should().BeOfType<OkObjectResult>().Subject;
        var apiResponse = okResult.Value.Should().BeOfType<ApiResponse<object>>().Subject;
        apiResponse.Success.Should().BeTrue();
    }

    [Fact]
    public async Task DriverDataController_MissingDriverIdClaim_ReturnsForbidden403()
    {
        var controller = CreateDriverDataControllerWithUser(null);

        var response = await controller.GetProfile(CancellationToken.None);

        var forbidden = response.Should().BeOfType<ObjectResult>().Subject;
        forbidden.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
    }
}
