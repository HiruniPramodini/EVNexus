using System.ComponentModel.DataAnnotations;
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

namespace EVNexus.AuthService.Tests;

public class DriverRegistrationTests
{
    private readonly Mock<IDriverRepository> _driverRepoMock;
    private readonly Mock<IPasswordHasher> _passwordHasherMock;
    private readonly Mock<IJwtTokenService> _jwtTokenServiceMock;
    private readonly DriverAuthService _sut; // System Under Test

    public DriverRegistrationTests()
    {
        _driverRepoMock = new Mock<IDriverRepository>();
        _passwordHasherMock = new Mock<IPasswordHasher>();
        _jwtTokenServiceMock = new Mock<IJwtTokenService>();
        var loggerMock = new Mock<ILogger<DriverAuthService>>();

        _sut = new DriverAuthService(
            _driverRepoMock.Object,
            _passwordHasherMock.Object,
            _jwtTokenServiceMock.Object,
            loggerMock.Object
        );
    }

    [Fact]
    public async Task RegisterDriver_WithValidDetails_GeneratesUniqueDriverIdWalletIdAndZeroBalance()
    {
        // Arrange
        var request = new DriverRegisterRequestDto
        {
            Name = "Johnathan Doe",
            Email = "john.doe@example.com",
            Phone = "+1-555-8899",
            Password = "SecurePassword1"
        };

        const string expectedHash = "$2a$12$hashedPasswordExample123";
        _driverRepoMock
            .Setup(r => r.IsEmailRegisteredAsync("john.doe@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        _passwordHasherMock
            .Setup(h => h.HashPassword(request.Password))
            .Returns(expectedHash);

        Driver? capturedDriver = null;
        Wallet? capturedWallet = null;

        _driverRepoMock
            .Setup(r => r.CreateDriverWithWalletAsync(It.IsAny<Driver>(), It.IsAny<Wallet>(), It.IsAny<CancellationToken>()))
            .Callback<Driver, Wallet, CancellationToken>((d, w, _) =>
            {
                capturedDriver = d;
                capturedWallet = w;
            })
            .ReturnsAsync((Driver d, Wallet w, CancellationToken _) => (d, w));

        // Act
        var result = await _sut.RegisterDriverAsync(request);

        // Assert
        result.Should().NotBeNull();
        result.DriverId.Should().StartWith("DRV-");
        result.DriverId.Length.Should().BeGreaterThan(10);
        result.WalletId.Should().StartWith("WLT-");
        result.WalletId.Length.Should().BeGreaterThan(10);
        result.Name.Should().Be("Johnathan Doe");
        result.Email.Should().Be("john.doe@example.com");
        result.Phone.Should().Be("+1-555-8899");
        result.WalletBalance.Should().Be(0.00m);
        result.Currency.Should().Be("USD");

        capturedDriver.Should().NotBeNull();
        capturedDriver!.PasswordHash.Should().Be(expectedHash);
        capturedDriver.Role.Should().Be("Driver");
        capturedDriver.Status.Should().Be("Active");

        capturedWallet.Should().NotBeNull();
        capturedWallet!.DriverId.Should().Be(capturedDriver.DriverId);
        capturedWallet.Balance.Should().Be(0.00m);
        capturedWallet.Status.Should().Be("Active");

        _driverRepoMock.Verify(r => r.CreateDriverWithWalletAsync(It.IsAny<Driver>(), It.IsAny<Wallet>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RegisterDriver_WithDuplicateEmail_ThrowsDuplicateEmailException()
    {
        // Arrange
        var request = new DriverRegisterRequestDto
        {
            Name = "Alice Smith",
            Email = "alice@example.com",
            Phone = "+1-555-4321",
            Password = "Password123"
        };

        _driverRepoMock
            .Setup(r => r.IsEmailRegisteredAsync("alice@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        // Act
        Func<Task> act = async () => await _sut.RegisterDriverAsync(request);

        // Assert
        await act.Should().ThrowAsync<DuplicateEmailException>();

        _driverRepoMock.Verify(r => r.CreateDriverWithWalletAsync(
            It.IsAny<Driver>(),
            It.IsAny<Wallet>(),
            It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public void DriverRegisterRequestDto_Validation_SucceedsForValidInput()
    {
        // Arrange
        var dto = new DriverRegisterRequestDto
        {
            Name = "Sam Wilson",
            Email = "sam.wilson@evdrive.com",
            Phone = "+1-555-9012",
            Password = "ValidPassword1"
        };

        // Act
        var validationResults = ValidateModel(dto);

        // Assert
        validationResults.Should().BeEmpty();
    }

    [Theory]
    [InlineData("Pass1", "Password must be at least 8 characters long.")] // Less than 8 chars
    [InlineData("NoDigitPassword!", "Password must be at least 8 characters long and contain at least one numeric digit.")] // 8+ chars but no number
    [InlineData("", "Password is required.")] // Empty
    public void DriverRegisterRequestDto_Validation_FailsOnWeakPassword(string password, string expectedErrorSubstr)
    {
        // Arrange
        var dto = new DriverRegisterRequestDto
        {
            Name = "Sam Wilson",
            Email = "sam@example.com",
            Phone = "+1-555-9012",
            Password = password
        };

        // Act
        var validationResults = ValidateModel(dto);

        // Assert
        validationResults.Should().Contain(v => v.ErrorMessage!.Contains(expectedErrorSubstr) || v.MemberNames.Contains(nameof(DriverRegisterRequestDto.Password)));
    }

    [Theory]
    [InlineData("invalid-email")]
    [InlineData("plainaddress")]
    [InlineData("@missingusername.com")]
    public void DriverRegisterRequestDto_Validation_FailsOnInvalidEmail(string invalidEmail)
    {
        // Arrange
        var dto = new DriverRegisterRequestDto
        {
            Name = "Sam Wilson",
            Email = invalidEmail,
            Phone = "+1-555-9012",
            Password = "ValidPassword1"
        };

        // Act
        var validationResults = ValidateModel(dto);

        // Assert
        validationResults.Should().Contain(v => v.MemberNames.Contains(nameof(DriverRegisterRequestDto.Email)));
    }

    [Theory]
    [InlineData("", "valid@example.com", "+1-555-0000", "Password123", nameof(DriverRegisterRequestDto.Name))]
    [InlineData("Sam", "", "+1-555-0000", "Password123", nameof(DriverRegisterRequestDto.Email))]
    [InlineData("Sam", "valid@example.com", "", "Password123", nameof(DriverRegisterRequestDto.Phone))]
    [InlineData("Sam", "valid@example.com", "+1-555-0000", "", nameof(DriverRegisterRequestDto.Password))]
    public void DriverRegisterRequestDto_Validation_FailsWhenRequiredFieldIsMissing(
        string name, string email, string phone, string password, string expectedMember)
    {
        // Arrange
        var dto = new DriverRegisterRequestDto
        {
            Name = name,
            Email = email,
            Phone = phone,
            Password = password
        };

        // Act
        var validationResults = ValidateModel(dto);

        // Assert
        validationResults.Should().Contain(v => v.MemberNames.Contains(expectedMember));
    }

    [Fact]
    public async Task AuthController_RegisterDriver_Returns201Created_OnSuccess()
    {
        // Arrange
        var companyAuthMock = new Mock<ICompanyAuthService>();
        var driverAuthMock = new Mock<IDriverAuthService>();
        var loggerMock = new Mock<ILogger<AuthController>>();

        var expectedResponse = new DriverRegisterResponseDto
        {
            DriverId = "DRV-123456",
            Name = "John Doe",
            Email = "john@example.com",
            Phone = "+1-555-0000",
            WalletId = "WLT-999999",
            WalletBalance = 0.00m,
            Currency = "USD",
            CreatedAt = DateTime.UtcNow,
            Message = "Driver registered successfully."
        };

        driverAuthMock
            .Setup(s => s.RegisterDriverAsync(It.IsAny<DriverRegisterRequestDto>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedResponse);

        var controller = new AuthController(companyAuthMock.Object, driverAuthMock.Object, loggerMock.Object);

        var request = new DriverRegisterRequestDto
        {
            Name = "John Doe",
            Email = "john@example.com",
            Phone = "+1-555-0000",
            Password = "Password123"
        };

        // Act
        var result = await controller.RegisterDriver(request, CancellationToken.None);

        // Assert
        var createdResult = result.Should().BeOfType<ObjectResult>().Subject;
        createdResult.StatusCode.Should().Be(StatusCodes.Status201Created);

        var apiResponse = createdResult.Value.Should().BeOfType<ApiResponse<DriverRegisterResponseDto>>().Subject;
        apiResponse.Success.Should().BeTrue();
        apiResponse.Data!.DriverId.Should().Be("DRV-123456");
        apiResponse.Data.WalletId.Should().Be("WLT-999999");
        apiResponse.Data.WalletBalance.Should().Be(0.00m);
    }

    [Fact]
    public async Task AuthController_RegisterDriver_Returns409Conflict_OnDuplicateEmail()
    {
        // Arrange
        var companyAuthMock = new Mock<ICompanyAuthService>();
        var driverAuthMock = new Mock<IDriverAuthService>();
        var loggerMock = new Mock<ILogger<AuthController>>();

        driverAuthMock
            .Setup(s => s.RegisterDriverAsync(It.IsAny<DriverRegisterRequestDto>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new DuplicateEmailException("existing@example.com"));

        var controller = new AuthController(companyAuthMock.Object, driverAuthMock.Object, loggerMock.Object);

        var request = new DriverRegisterRequestDto
        {
            Name = "John Doe",
            Email = "existing@example.com",
            Phone = "+1-555-0000",
            Password = "Password123"
        };

        // Act
        var result = await controller.RegisterDriver(request, CancellationToken.None);

        // Assert
        var conflictResult = result.Should().BeOfType<ConflictObjectResult>().Subject;
        conflictResult.StatusCode.Should().Be(StatusCodes.Status409Conflict);
    }

    private static IList<ValidationResult> ValidateModel(object model)
    {
        var validationResults = new List<ValidationResult>();
        var ctx = new ValidationContext(model, null, null);
        Validator.TryValidateObject(model, ctx, validationResults, true);
        return validationResults;
    }
}
