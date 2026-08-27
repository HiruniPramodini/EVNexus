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
using Xunit;

namespace EVNexus.AuthService.Tests;

public class EmailVerificationTests
{
    private readonly Mock<ITenantRepository> _mockTenantRepo;
    private readonly Mock<IDriverRepository> _mockDriverRepo;
    private readonly Mock<IPasswordHasher> _mockPasswordHasher;
    private readonly Mock<IJwtTokenService> _mockJwtTokenService;
    private readonly Mock<ILogger<CompanyAuthService>> _mockCompanyLogger;
    private readonly Mock<ILogger<DriverAuthService>> _mockDriverLogger;
    private readonly Mock<ILogger<AuthController>> _mockControllerLogger;

    private readonly CompanyAuthService _companyAuthService;
    private readonly DriverAuthService _driverAuthService;
    private readonly AuthController _authController;

    public EmailVerificationTests()
    {
        _mockTenantRepo = new Mock<ITenantRepository>();
        _mockDriverRepo = new Mock<IDriverRepository>();
        _mockPasswordHasher = new Mock<IPasswordHasher>();
        _mockJwtTokenService = new Mock<IJwtTokenService>();
        _mockCompanyLogger = new Mock<ILogger<CompanyAuthService>>();
        _mockDriverLogger = new Mock<ILogger<DriverAuthService>>();
        _mockControllerLogger = new Mock<ILogger<AuthController>>();

        _companyAuthService = new CompanyAuthService(
            _mockTenantRepo.Object,
            _mockPasswordHasher.Object,
            _mockJwtTokenService.Object,
            _mockCompanyLogger.Object);

        _driverAuthService = new DriverAuthService(
            _mockDriverRepo.Object,
            _mockPasswordHasher.Object,
            _mockJwtTokenService.Object,
            _mockDriverLogger.Object);

        _authController = new AuthController(
            _companyAuthService,
            _driverAuthService,
            _mockControllerLogger.Object);
    }

    #region Criterion 1: Verification email/code generated on registration (24-hour expiry)

    [Fact]
    public async Task RegisterCompany_Generates24HourVerificationCodeAndLink()
    {
        // Arrange
        var request = new CompanyRegisterRequestDto
        {
            CompanyName = "SolarDrive Networks",
            RegistrationNumber = "REG-SOLAR-01",
            BusinessEmail = "admin@solardrive.com",
            Phone = "+15551234567",
            Address = "100 Solar Way, Clean City",
            Password = "SecurePassword@123"
        };

        _mockTenantRepo.Setup(r => r.IsEmailRegisteredAsync(request.BusinessEmail, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        _mockTenantRepo.Setup(r => r.IsRegistrationNumberRegisteredAsync(request.RegistrationNumber, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        _mockPasswordHasher.Setup(p => p.HashPassword(request.Password))
            .Returns("$2a$12$hashedPasswordVal");

        _mockTenantRepo.Setup(r => r.SaveEmailVerificationCodeAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        // Act
        var result = await _companyAuthService.RegisterCompanyAsync(request);

        // Assert
        result.Should().NotBeNull();
        result.IsEmailVerified.Should().BeFalse();
        result.VerificationCode.Should().NotBeNullOrWhiteSpace().And.HaveLength(6);
        result.VerificationLink.Should().Contain("code=").And.Contain(Uri.EscapeDataString(request.BusinessEmail));
        result.ExpiresAt.Should().NotBeNull();
        result.ExpiresAt!.Value.Should().BeAfter(DateTime.UtcNow.AddHours(23));
        result.ExpiresAt!.Value.Should().BeBefore(DateTime.UtcNow.AddHours(25)); // ~24 hours

        _mockTenantRepo.Verify(r => r.SaveEmailVerificationCodeAsync(
            result.TenantId, "admin@solardrive.com", result.VerificationCode, It.IsAny<DateTime>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RegisterDriver_Generates24HourVerificationCodeAndLink()
    {
        // Arrange
        var request = new DriverRegisterRequestDto
        {
            Name = "Alice Driver",
            Email = "alice.driver@example.com",
            Phone = "+15559876543",
            Password = "Password123"
        };

        _mockDriverRepo.Setup(r => r.IsEmailRegisteredAsync("alice.driver@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        _mockPasswordHasher.Setup(p => p.HashPassword(request.Password))
            .Returns("$2a$12$driverHashVal");

        _mockDriverRepo.Setup(r => r.SaveDriverVerificationCodeAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        // Act
        var result = await _driverAuthService.RegisterDriverAsync(request);

        // Assert
        result.Should().NotBeNull();
        result.IsEmailVerified.Should().BeFalse();
        result.VerificationCode.Should().NotBeNullOrWhiteSpace().And.HaveLength(6);
        result.VerificationLink.Should().Contain("code=").And.Contain(Uri.EscapeDataString("alice.driver@example.com"));
        result.ExpiresAt.Should().NotBeNull();
        result.ExpiresAt!.Value.Should().BeAfter(DateTime.UtcNow.AddHours(23)); // 24-hour expiration

        _mockDriverRepo.Verify(r => r.SaveDriverVerificationCodeAsync(
            result.DriverId, "alice.driver@example.com", result.VerificationCode, It.IsAny<DateTime>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    #endregion

    #region Criterion 2: Unverified accounts can log in but see unverified status

    [Fact]
    public async Task LoginCompany_UnverifiedAccount_SucceedsWithIsEmailVerifiedFalse()
    {
        // Arrange
        var request = new CompanyLoginRequestDto
        {
            BusinessEmail = "unverified@company.com",
            Password = "Password@123"
        };

        var tenant = new Tenant
        {
            TenantId = "TNT-UNVERIFIED-01",
            CompanyName = "Unverified Logistics",
            BusinessEmail = "unverified@company.com",
            PasswordHash = "$2a$12$hashedVal",
            Role = "CompanyAdmin",
            Status = "Active",
            IsEmailVerified = false // Unverified
        };

        _mockTenantRepo.Setup(r => r.GetTenantByEmailAsync("unverified@company.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(tenant);
        _mockPasswordHasher.Setup(p => p.VerifyPassword("Password@123", tenant.PasswordHash))
            .Returns(true);
        _mockJwtTokenService.Setup(j => j.GenerateToken(tenant))
            .Returns(("valid.jwt.token", 3600));

        // Act
        var result = await _companyAuthService.LoginCompanyAsync(request);

        // Assert
        result.Should().NotBeNull();
        result.AccessToken.Should().Be("valid.jwt.token");
        result.IsEmailVerified.Should().BeFalse(); // Can log in, but unverified
        result.TenantId.Should().Be("TNT-UNVERIFIED-01");
    }

    [Fact]
    public async Task LoginDriver_UnverifiedAccount_SucceedsWithIsEmailVerifiedFalse()
    {
        // Arrange
        var request = new DriverLoginRequestDto
        {
            Email = "driver.unverified@example.com",
            Password = "Password123"
        };

        var driver = new Driver
        {
            DriverId = "DRV-UNVERIFIED-01",
            Name = "Bob Driver",
            Email = "driver.unverified@example.com",
            PasswordHash = "$2a$12$driverHash",
            Role = "Driver",
            Status = "Active",
            IsEmailVerified = false // Unverified
        };

        _mockDriverRepo.Setup(r => r.GetDriverByEmailAsync("driver.unverified@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(driver);
        _mockPasswordHasher.Setup(p => p.VerifyPassword("Password123", driver.PasswordHash))
            .Returns(true);
        _mockJwtTokenService.Setup(j => j.GenerateDriverToken(driver))
            .Returns(("driver.jwt.token", 3600));

        // Act
        var result = await _driverAuthService.LoginDriverAsync(request);

        // Assert
        result.Should().NotBeNull();
        result.AccessToken.Should().Be("driver.jwt.token");
        result.IsEmailVerified.Should().BeFalse(); // Can log in, but unverified
        result.DriverId.Should().Be("DRV-UNVERIFIED-01");
    }

    #endregion

    #region Criterion 3 & 4: Verifying code marks account verified in DB & 24-hour expiry check

    [Fact]
    public async Task VerifyCompanyEmail_ValidCodeWithin24Hours_MarksAccountAsVerifiedInDatabase()
    {
        // Arrange
        var tenant = new Tenant
        {
            TenantId = "TNT-VERIFY-99",
            BusinessEmail = "verify.me@company.com",
            IsEmailVerified = false
        };

        _mockTenantRepo.Setup(r => r.GetTenantByEmailAsync("verify.me@company.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(tenant);
        _mockTenantRepo.Setup(r => r.ValidateAndConsumeTenantRegistrationCodeAsync("verify.me@company.com", "654321", It.IsAny<CancellationToken>()))
            .ReturnsAsync((true, "Valid"));
        _mockTenantRepo.Setup(r => r.MarkEmailAsVerifiedAsync(tenant.TenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        // Act
        var result = await _companyAuthService.VerifyCompanyEmailAsync("verify.me@company.com", "654321");

        // Assert
        result.Should().NotBeNull();
        result.IsVerified.Should().BeTrue();
        result.AccountType.Should().Be("Company");
        result.Message.Should().Contain("Email verified successfully");

        _mockTenantRepo.Verify(r => r.MarkEmailAsVerifiedAsync(tenant.TenantId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task VerifyDriverEmail_ValidCodeWithin24Hours_MarksAccountAsVerifiedInDatabase()
    {
        // Arrange
        var driver = new Driver
        {
            DriverId = "DRV-VERIFY-88",
            Email = "driver.verify@example.com",
            IsEmailVerified = false
        };

        _mockDriverRepo.Setup(r => r.GetDriverByEmailAsync("driver.verify@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(driver);
        _mockDriverRepo.Setup(r => r.ValidateAndConsumeDriverVerificationCodeAsync("driver.verify@example.com", "123789", It.IsAny<CancellationToken>()))
            .ReturnsAsync((true, "Valid"));
        _mockDriverRepo.Setup(r => r.MarkDriverEmailAsVerifiedAsync(driver.DriverId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        // Act
        var result = await _driverAuthService.VerifyDriverEmailAsync("driver.verify@example.com", "123789");

        // Assert
        result.Should().NotBeNull();
        result.IsVerified.Should().BeTrue();
        result.AccountType.Should().Be("Driver");
        result.Message.Should().Contain("Email verified successfully");

        _mockDriverRepo.Verify(r => r.MarkDriverEmailAsVerifiedAsync(driver.DriverId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task VerifyCompanyEmail_ExpiredCodeAfter24Hours_ThrowsVerificationCodeExpiredException()
    {
        // Arrange
        var tenant = new Tenant
        {
            TenantId = "TNT-EXPIRED-01",
            BusinessEmail = "expired@company.com",
            IsEmailVerified = false
        };

        _mockTenantRepo.Setup(r => r.GetTenantByEmailAsync("expired@company.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(tenant);
        _mockTenantRepo.Setup(r => r.ValidateAndConsumeTenantRegistrationCodeAsync("expired@company.com", "999888", It.IsAny<CancellationToken>()))
            .ReturnsAsync((false, "Expired")); // 24-hour expiration fired

        // Act
        Func<Task> act = async () => await _companyAuthService.VerifyCompanyEmailAsync("expired@company.com", "999888");

        // Assert
        await act.Should().ThrowAsync<VerificationCodeExpiredException>()
            .WithMessage("*Verification code has expired*");

        _mockTenantRepo.Verify(r => r.MarkEmailAsVerifiedAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task VerifyCompanyEmail_AlreadyUsedCode_ThrowsVerificationCodeAlreadyUsedException()
    {
        // Arrange
        var tenant = new Tenant
        {
            TenantId = "TNT-USED-01",
            BusinessEmail = "used@company.com",
            IsEmailVerified = false
        };

        _mockTenantRepo.Setup(r => r.GetTenantByEmailAsync("used@company.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(tenant);
        _mockTenantRepo.Setup(r => r.ValidateAndConsumeTenantRegistrationCodeAsync("used@company.com", "555666", It.IsAny<CancellationToken>()))
            .ReturnsAsync((false, "AlreadyUsed"));

        // Act
        Func<Task> act = async () => await _companyAuthService.VerifyCompanyEmailAsync("used@company.com", "555666");

        // Assert
        await act.Should().ThrowAsync<VerificationCodeAlreadyUsedException>()
            .WithMessage("*Verification code has already been used*");
    }

    [Fact]
    public async Task VerifyCompanyEmail_InvalidCode_ThrowsEmailVerificationException()
    {
        // Arrange
        var tenant = new Tenant
        {
            TenantId = "TNT-INV-01",
            BusinessEmail = "invalid@company.com",
            IsEmailVerified = false
        };

        _mockTenantRepo.Setup(r => r.GetTenantByEmailAsync("invalid@company.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(tenant);
        _mockTenantRepo.Setup(r => r.ValidateAndConsumeTenantRegistrationCodeAsync("invalid@company.com", "000000", It.IsAny<CancellationToken>()))
            .ReturnsAsync((false, "NotFound"));

        // Act
        Func<Task> act = async () => await _companyAuthService.VerifyCompanyEmailAsync("invalid@company.com", "000000");

        // Assert
        await act.Should().ThrowAsync<EmailVerificationException>()
            .WithMessage("*Invalid verification code or email*");
    }

    [Fact]
    public async Task ResendVerificationCode_UnverifiedAccount_GeneratesFresh24HourCode()
    {
        // Arrange
        var tenant = new Tenant
        {
            TenantId = "TNT-RESEND-01",
            BusinessEmail = "resend@company.com",
            IsEmailVerified = false
        };

        _mockTenantRepo.Setup(r => r.GetTenantByEmailAsync("resend@company.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(tenant);
        _mockTenantRepo.Setup(r => r.SaveEmailVerificationCodeAsync(
                tenant.TenantId, "resend@company.com", It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        // Act
        var result = await _companyAuthService.ResendCompanyVerificationCodeAsync("resend@company.com");

        // Assert
        result.Should().NotBeNull();
        result.VerificationCode.Should().NotBeNullOrWhiteSpace().And.HaveLength(6);
        result.ExpiresAt.Should().BeAfter(DateTime.UtcNow.AddHours(23));

        _mockTenantRepo.Verify(r => r.SaveEmailVerificationCodeAsync(
            tenant.TenantId, "resend@company.com", result.VerificationCode, It.IsAny<DateTime>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ResendVerificationCode_AlreadyVerifiedAccount_ThrowsAccountAlreadyVerifiedException()
    {
        // Arrange
        var tenant = new Tenant
        {
            TenantId = "TNT-ALREADY-01",
            BusinessEmail = "verified@company.com",
            IsEmailVerified = true // Already verified
        };

        _mockTenantRepo.Setup(r => r.GetTenantByEmailAsync("verified@company.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(tenant);

        // Act
        Func<Task> act = async () => await _companyAuthService.ResendCompanyVerificationCodeAsync("verified@company.com");

        // Assert
        await act.Should().ThrowAsync<AccountAlreadyVerifiedException>()
            .WithMessage("*Account email is already verified*");
    }

    #endregion

    #region AuthController Endpoints

    [Fact]
    public async Task AuthController_VerifyEmail_ValidCode_ReturnsOk200()
    {
        // Arrange
        var request = new VerifyEmailRequestDto
        {
            Email = "portal@cleanmobility.com",
            VerificationCode = "123456"
        };

        var tenant = new Tenant
        {
            TenantId = "TNT-PORTAL-01",
            BusinessEmail = "portal@cleanmobility.com",
            IsEmailVerified = false
        };

        _mockTenantRepo.Setup(r => r.GetTenantByEmailAsync("portal@cleanmobility.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(tenant);
        _mockTenantRepo.Setup(r => r.ValidateAndConsumeTenantRegistrationCodeAsync("portal@cleanmobility.com", "123456", It.IsAny<CancellationToken>()))
            .ReturnsAsync((true, "Valid"));
        _mockTenantRepo.Setup(r => r.MarkEmailAsVerifiedAsync(tenant.TenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        // Act
        var response = await _authController.VerifyEmail(request, CancellationToken.None);

        // Assert
        var okResult = response.Should().BeOfType<OkObjectResult>().Subject;
        okResult.StatusCode.Should().Be(StatusCodes.Status200OK);
        var body = okResult.Value as ApiResponse<VerifyEmailResponseDto>;
        body.Should().NotBeNull();
        body!.Success.Should().BeTrue();
        body.Data!.IsVerified.Should().BeTrue();
    }

    [Fact]
    public async Task AuthController_VerifyEmail_ExpiredCode_ReturnsBadRequest400()
    {
        // Arrange
        var request = new VerifyEmailRequestDto
        {
            Email = "expired.driver@example.com",
            VerificationCode = "998877"
        };

        _mockTenantRepo.Setup(r => r.GetTenantByEmailAsync("expired.driver@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync((Tenant?)null);

        var driver = new Driver
        {
            DriverId = "DRV-EXP-01",
            Email = "expired.driver@example.com",
            IsEmailVerified = false
        };

        _mockDriverRepo.Setup(r => r.GetDriverByEmailAsync("expired.driver@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(driver);
        _mockDriverRepo.Setup(r => r.ValidateAndConsumeDriverVerificationCodeAsync("expired.driver@example.com", "998877", It.IsAny<CancellationToken>()))
            .ReturnsAsync((false, "Expired"));

        // Act
        var response = await _authController.VerifyEmail(request, CancellationToken.None);

        // Assert
        var badRequestResult = response.Should().BeOfType<BadRequestObjectResult>().Subject;
        badRequestResult.StatusCode.Should().Be(StatusCodes.Status400BadRequest);
        var body = badRequestResult.Value as ApiResponse<object>;
        body.Should().NotBeNull();
        body!.Success.Should().BeFalse();
        body.Message.Should().Contain("Verification code has expired");
    }

    [Fact]
    public async Task AuthController_VerifyEmailFromLink_ValidQueryParameters_ReturnsOk200()
    {
        // Arrange
        var tenant = new Tenant
        {
            TenantId = "TNT-LINK-01",
            BusinessEmail = "link.user@company.com",
            IsEmailVerified = false
        };

        _mockTenantRepo.Setup(r => r.GetTenantByEmailAsync("link.user@company.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(tenant);
        _mockTenantRepo.Setup(r => r.ValidateAndConsumeTenantRegistrationCodeAsync("link.user@company.com", "445566", It.IsAny<CancellationToken>()))
            .ReturnsAsync((true, "Valid"));
        _mockTenantRepo.Setup(r => r.MarkEmailAsVerifiedAsync(tenant.TenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        // Act
        var response = await _authController.VerifyEmailFromLink("link.user@company.com", "445566", CancellationToken.None);

        // Assert
        var okResult = response.Should().BeOfType<OkObjectResult>().Subject;
        okResult.StatusCode.Should().Be(StatusCodes.Status200OK);
    }

    [Fact]
    public async Task AuthController_ResendVerification_ValidEmail_ReturnsOk200()
    {
        // Arrange
        var request = new ResendVerificationRequestDto
        {
            Email = "neednewcode@company.com"
        };

        var tenant = new Tenant
        {
            TenantId = "TNT-RESEND-99",
            BusinessEmail = "neednewcode@company.com",
            IsEmailVerified = false
        };

        _mockTenantRepo.Setup(r => r.GetTenantByEmailAsync("neednewcode@company.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(tenant);
        _mockTenantRepo.Setup(r => r.SaveEmailVerificationCodeAsync(
                tenant.TenantId, "neednewcode@company.com", It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        // Act
        var response = await _authController.ResendVerification(request, CancellationToken.None);

        // Assert
        var okResult = response.Should().BeOfType<OkObjectResult>().Subject;
        okResult.StatusCode.Should().Be(StatusCodes.Status200OK);
    }

    #endregion
}
