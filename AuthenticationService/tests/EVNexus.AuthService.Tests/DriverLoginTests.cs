using System.ComponentModel.DataAnnotations;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using EVNexus.AuthService.Configuration;
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
using Microsoft.Extensions.Options;
using Moq;
using Xunit;

namespace EVNexus.AuthService.Tests;

public class DriverLoginTests
{
    private readonly Mock<IDriverRepository> _mockDriverRepo;
    private readonly Mock<IPasswordHasher> _mockPasswordHasher;
    private readonly Mock<IJwtTokenService> _mockJwtTokenService;
    private readonly Mock<ILogger<DriverAuthService>> _mockLogger;
    private readonly DriverAuthService _authService;

    public DriverLoginTests()
    {
        _mockDriverRepo = new Mock<IDriverRepository>();
        _mockPasswordHasher = new Mock<IPasswordHasher>();
        _mockJwtTokenService = new Mock<IJwtTokenService>();
        _mockLogger = new Mock<ILogger<DriverAuthService>>();

        _authService = new DriverAuthService(
            _mockDriverRepo.Object,
            _mockPasswordHasher.Object,
            _mockJwtTokenService.Object,
            _mockLogger.Object);
    }

    [Fact]
    public async Task LoginDriverAsync_WithValidCredentials_ReturnsAccessTokenAndDriverDetails()
    {
        // Arrange
        var request = new DriverLoginRequestDto
        {
            Email = "driver.alex@example.com",
            Password = "ValidPassword123"
        };

        var driver = new Driver
        {
            DriverId = "DRV-112233AABB",
            Name = "Alex Mercer",
            Email = "driver.alex@example.com",
            Phone = "+15554321098",
            PasswordHash = "$2a$12$secureDriverHash12345",
            Role = "Driver",
            Status = "Active",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var wallet = new Wallet
        {
            WalletId = "WLT-778899CCDD",
            DriverId = "DRV-112233AABB",
            Balance = 25.50m,
            Currency = "USD",
            Status = "Active"
        };

        _mockDriverRepo.Setup(r => r.GetDriverByEmailAsync("driver.alex@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(driver);

        _mockPasswordHasher.Setup(p => p.VerifyPassword("ValidPassword123", driver.PasswordHash))
            .Returns(true);

        _mockJwtTokenService.Setup(j => j.GenerateDriverToken(driver))
            .Returns(("mock.driver.jwt.token", 3600));

        _mockDriverRepo.Setup(r => r.GetWalletByDriverIdAsync(driver.DriverId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(wallet);

        // Act
        var result = await _authService.LoginDriverAsync(request);

        // Assert
        result.Should().NotBeNull();
        result.AccessToken.Should().Be("mock.driver.jwt.token");
        result.TokenType.Should().Be("Bearer");
        result.ExpiresIn.Should().Be(3600);
        result.DriverId.Should().Be("DRV-112233AABB");
        result.Name.Should().Be("Alex Mercer");
        result.Email.Should().Be("driver.alex@example.com");
        result.Role.Should().Be("Driver");
        result.WalletId.Should().Be("WLT-778899CCDD");
        result.WalletBalance.Should().Be(25.50m);
        result.Currency.Should().Be("USD");
    }

    [Fact]
    public async Task LoginDriverAsync_WithNonExistentEmail_ThrowsInvalidCredentialsException()
    {
        // Arrange
        var request = new DriverLoginRequestDto
        {
            Email = "unknown.driver@example.com",
            Password = "SomePassword1"
        };

        _mockDriverRepo.Setup(r => r.GetDriverByEmailAsync("unknown.driver@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync((Driver?)null);

        // Act
        var act = () => _authService.LoginDriverAsync(request);

        // Assert - Generic error message without revealing field
        await act.Should().ThrowAsync<InvalidCredentialsException>()
            .WithMessage("Invalid email or password.");
    }

    [Fact]
    public async Task LoginDriverAsync_WithWrongPassword_ThrowsInvalidCredentialsException()
    {
        // Arrange
        var request = new DriverLoginRequestDto
        {
            Email = "driver.alex@example.com",
            Password = "IncorrectPassword99"
        };

        var driver = new Driver
        {
            DriverId = "DRV-112233AABB",
            Name = "Alex Mercer",
            Email = "driver.alex@example.com",
            PasswordHash = "$2a$12$actualPasswordHash",
            Role = "Driver",
            Status = "Active"
        };

        _mockDriverRepo.Setup(r => r.GetDriverByEmailAsync("driver.alex@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(driver);

        _mockPasswordHasher.Setup(p => p.VerifyPassword("IncorrectPassword99", driver.PasswordHash))
            .Returns(false);

        // Act
        var act = () => _authService.LoginDriverAsync(request);

        // Assert - Generic error message without revealing field
        await act.Should().ThrowAsync<InvalidCredentialsException>()
            .WithMessage("Invalid email or password.");
    }

    [Fact]
    public async Task LoginDriverAsync_WithInactiveAccount_ThrowsInvalidCredentialsException()
    {
        // Arrange
        var request = new DriverLoginRequestDto
        {
            Email = "driver.suspended@example.com",
            Password = "ValidPassword123"
        };

        var driver = new Driver
        {
            DriverId = "DRV-SUSPENDED99",
            Name = "Suspended Driver",
            Email = "driver.suspended@example.com",
            PasswordHash = "$2a$12$someValidHash",
            Role = "Driver",
            Status = "Suspended"
        };

        _mockDriverRepo.Setup(r => r.GetDriverByEmailAsync("driver.suspended@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(driver);

        _mockPasswordHasher.Setup(p => p.VerifyPassword("ValidPassword123", driver.PasswordHash))
            .Returns(true);

        // Act
        var act = () => _authService.LoginDriverAsync(request);

        // Assert
        await act.Should().ThrowAsync<InvalidCredentialsException>()
            .WithMessage("Account is currently inactive or suspended.");
    }

    [Fact]
    public async Task GetDriverProfileAsync_WithExistingDriver_ReturnsProfileWithWallet()
    {
        // Arrange
        var driver = new Driver
        {
            DriverId = "DRV-PROFILETEST1",
            Name = "Sarah Connor",
            Email = "sarah.connor@example.com",
            Phone = "+15559876543",
            Role = "Driver",
            Status = "Active",
            CreatedAt = new DateTime(2026, 1, 1, 12, 0, 0, DateTimeKind.Utc)
        };

        var wallet = new Wallet
        {
            WalletId = "WLT-PROFILETEST1",
            DriverId = "DRV-PROFILETEST1",
            Balance = 100.00m,
            Currency = "USD"
        };

        _mockDriverRepo.Setup(r => r.GetDriverByIdAsync("DRV-PROFILETEST1", It.IsAny<CancellationToken>()))
            .ReturnsAsync(driver);

        _mockDriverRepo.Setup(r => r.GetWalletByDriverIdAsync("DRV-PROFILETEST1", It.IsAny<CancellationToken>()))
            .ReturnsAsync(wallet);

        // Act
        var result = await _authService.GetDriverProfileAsync("DRV-PROFILETEST1");

        // Assert
        result.Should().NotBeNull();
        result.DriverId.Should().Be("DRV-PROFILETEST1");
        result.Name.Should().Be("Sarah Connor");
        result.Email.Should().Be("sarah.connor@example.com");
        result.Phone.Should().Be("+15559876543");
        result.Role.Should().Be("Driver");
        result.Status.Should().Be("Active");
        result.WalletId.Should().Be("WLT-PROFILETEST1");
        result.WalletBalance.Should().Be(100.00m);
    }

    [Fact]
    public async Task GetDriverProfileAsync_WithNonExistentDriver_ThrowsDriverNotFoundException()
    {
        // Arrange
        _mockDriverRepo.Setup(r => r.GetDriverByIdAsync("DRV-NONEXISTENT", It.IsAny<CancellationToken>()))
            .ReturnsAsync((Driver?)null);

        // Act
        var act = () => _authService.GetDriverProfileAsync("DRV-NONEXISTENT");

        // Assert
        await act.Should().ThrowAsync<DriverNotFoundException>()
            .WithMessage("*DRV-NONEXISTENT*");
    }

    [Fact]
    public void JwtTokenService_GeneratesSignedDriverToken_WithEmbeddedDriverIdAndRoleClaims()
    {
        // Arrange
        var jwtSettings = new JwtSettings
        {
            Key = "SuperSecretSecureKeyForTestingEVNexusJwt1234567890!",
            Issuer = "EVNexus.AuthService",
            Audience = "EVNexus.Microservices",
            ExpiryMinutes = 60
        };

        var jwtOptions = Options.Create(jwtSettings);
        var tokenService = new JwtTokenService(jwtOptions);

        var driver = new Driver
        {
            DriverId = "DRV-CLAIMTEST99",
            Name = "Johnathan EV",
            Email = "john.ev@driver.com",
            Phone = "+15551122334",
            Role = "Driver",
            Status = "Active"
        };

        // Act
        var (token, expiresInSeconds) = tokenService.GenerateDriverToken(driver);

        // Assert
        token.Should().NotBeNullOrWhiteSpace();
        expiresInSeconds.Should().Be(3600);

        var handler = new JwtSecurityTokenHandler();
        handler.CanReadToken(token).Should().BeTrue();

        var jwtToken = handler.ReadJwtToken(token);
        jwtToken.Issuer.Should().Be("EVNexus.AuthService");
        jwtToken.Audiences.Should().Contain("EVNexus.Microservices");

        jwtToken.Claims.Should().Contain(c => c.Type == "driver_id" && c.Value == "DRV-CLAIMTEST99");
        jwtToken.Claims.Should().Contain(c => c.Type == "role" && c.Value == "Driver");
        jwtToken.Claims.Should().Contain(c => (c.Type == JwtRegisteredClaimNames.Email || c.Type == ClaimTypes.Email) && c.Value == "john.ev@driver.com");
        jwtToken.Claims.Should().Contain(c => (c.Type == JwtRegisteredClaimNames.Name || c.Type == ClaimTypes.Name) && c.Value == "Johnathan EV");
    }

    [Theory]
    [InlineData("", "Password@123", "Email is required.")]
    [InlineData("not-an-email", "Password@123", "Invalid email address format.")]
    [InlineData("valid@email.com", "", "Password is required.")]
    public void DriverLoginRequestDto_Validation_FailsOnInvalidInput(string email, string password, string expectedErrorMessage)
    {
        var dto = new DriverLoginRequestDto
        {
            Email = email,
            Password = password
        };

        var validationContext = new ValidationContext(dto);
        var validationResults = new List<ValidationResult>();
        var isValid = Validator.TryValidateObject(dto, validationContext, validationResults, true);

        isValid.Should().BeFalse();
        validationResults.Should().Contain(r => r.ErrorMessage == expectedErrorMessage);
    }

    [Fact]
    public async Task AuthController_LoginDriver_Returns200Ok_OnSuccess()
    {
        // Arrange
        var mockCompanyAuthService = new Mock<ICompanyAuthService>();
        var mockDriverAuthService = new Mock<IDriverAuthService>();
        var mockLogger = new Mock<ILogger<AuthController>>();

        var expectedResponse = new DriverLoginResponseDto
        {
            AccessToken = "valid.driver.jwt.token",
            DriverId = "DRV-12345",
            Name = "John Doe",
            Email = "john@example.com",
            Role = "Driver",
            WalletId = "WLT-12345",
            WalletBalance = 0.00m,
            ExpiresIn = 3600
        };

        mockDriverAuthService.Setup(s => s.LoginDriverAsync(It.IsAny<DriverLoginRequestDto>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedResponse);

        var controller = new AuthController(mockCompanyAuthService.Object, mockDriverAuthService.Object, mockLogger.Object);
        var request = new DriverLoginRequestDto { Email = "john@example.com", Password = "ValidPassword1" };

        // Act
        var result = await controller.LoginDriver(request, CancellationToken.None);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.StatusCode.Should().Be(StatusCodes.Status200OK);
        var apiResponse = okResult.Value.Should().BeOfType<ApiResponse<DriverLoginResponseDto>>().Subject;
        apiResponse.Success.Should().BeTrue();
        apiResponse.Data!.AccessToken.Should().Be("valid.driver.jwt.token");
        apiResponse.Data.DriverId.Should().Be("DRV-12345");
    }

    [Fact]
    public async Task AuthController_LoginDriver_Returns401Unauthorized_OnInvalidCredentials()
    {
        // Arrange
        var mockCompanyAuthService = new Mock<ICompanyAuthService>();
        var mockDriverAuthService = new Mock<IDriverAuthService>();
        var mockLogger = new Mock<ILogger<AuthController>>();

        mockDriverAuthService.Setup(s => s.LoginDriverAsync(It.IsAny<DriverLoginRequestDto>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidCredentialsException("Invalid email or password."));

        var controller = new AuthController(mockCompanyAuthService.Object, mockDriverAuthService.Object, mockLogger.Object);
        var request = new DriverLoginRequestDto { Email = "wrong@example.com", Password = "WrongPassword" };

        // Act
        var result = await controller.LoginDriver(request, CancellationToken.None);

        // Assert
        var unauthorizedResult = result.Should().BeOfType<UnauthorizedObjectResult>().Subject;
        unauthorizedResult.StatusCode.Should().Be(StatusCodes.Status401Unauthorized);
        var apiResponse = unauthorizedResult.Value.Should().BeOfType<ApiResponse<object>>().Subject;
        apiResponse.Success.Should().BeFalse();
        apiResponse.Message.Should().Be("Invalid email or password.");
    }
}
