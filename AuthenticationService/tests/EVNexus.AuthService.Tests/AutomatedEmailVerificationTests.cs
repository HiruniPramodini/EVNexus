using EVNexus.AuthService.Configuration;
using EVNexus.AuthService.Data;
using EVNexus.AuthService.DTOs;
using EVNexus.AuthService.Models;
using EVNexus.AuthService.Services;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;

namespace EVNexus.AuthService.Tests;

public class AutomatedEmailVerificationTests
{
    private readonly Mock<ITenantRepository> _mockTenantRepo;
    private readonly Mock<IDriverRepository> _mockDriverRepo;
    private readonly Mock<IPasswordHasher> _mockPasswordHasher;
    private readonly Mock<IJwtTokenService> _mockJwtTokenService;
    private readonly Mock<IEmailService> _mockEmailService;
    private readonly Mock<ILogger<CompanyAuthService>> _mockCompanyLogger;
    private readonly Mock<ILogger<DriverAuthService>> _mockDriverLogger;
    private readonly Mock<ILogger<SmtpEmailService>> _mockSmtpLogger;

    private readonly CompanyAuthService _companyAuthService;
    private readonly DriverAuthService _driverAuthService;

    public AutomatedEmailVerificationTests()
    {
        _mockTenantRepo = new Mock<ITenantRepository>();
        _mockDriverRepo = new Mock<IDriverRepository>();
        _mockPasswordHasher = new Mock<IPasswordHasher>();
        _mockJwtTokenService = new Mock<IJwtTokenService>();
        _mockEmailService = new Mock<IEmailService>();
        _mockCompanyLogger = new Mock<ILogger<CompanyAuthService>>();
        _mockDriverLogger = new Mock<ILogger<DriverAuthService>>();
        _mockSmtpLogger = new Mock<ILogger<SmtpEmailService>>();

        _companyAuthService = new CompanyAuthService(
            _mockTenantRepo.Object,
            _mockPasswordHasher.Object,
            _mockJwtTokenService.Object,
            _mockCompanyLogger.Object,
            null,
            _mockEmailService.Object);

        _driverAuthService = new DriverAuthService(
            _mockDriverRepo.Object,
            _mockPasswordHasher.Object,
            _mockJwtTokenService.Object,
            _mockDriverLogger.Object,
            null,
            _mockEmailService.Object);
    }

    [Fact]
    public async Task RegisterCompany_DispatchesAutomatedVerificationEmailToBusinessInbox()
    {
        // Arrange
        var request = new CompanyRegisterRequestDto
        {
            CompanyName = "EcoVolt Fleet Solutions",
            RegistrationNumber = "REG-ECOVOLT-99",
            BusinessEmail = "contact@ecovolt.com",
            Phone = "+15551234567",
            Address = "700 Green Power Way",
            Password = "SecurePassword@123"
        };

        _mockTenantRepo.Setup(r => r.IsEmailRegisteredAsync(request.BusinessEmail, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        _mockTenantRepo.Setup(r => r.IsRegistrationNumberRegisteredAsync(request.RegistrationNumber, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        _mockPasswordHasher.Setup(p => p.HashPassword(request.Password))
            .Returns("$2a$12$hashedPassword");

        _mockTenantRepo.Setup(r => r.SaveEmailVerificationCodeAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        _mockEmailService.Setup(e => e.SendVerificationEmailAsync(
                request.BusinessEmail, request.CompanyName, It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        // Act
        var result = await _companyAuthService.RegisterCompanyAsync(request);

        // Assert
        result.Should().NotBeNull();
        result.BusinessEmail.Should().Be("contact@ecovolt.com");

        _mockEmailService.Verify(e => e.SendVerificationEmailAsync(
            "contact@ecovolt.com",
            "EcoVolt Fleet Solutions",
            It.Is<string>(code => code.Length == 6),
            It.Is<string>(link => link.Contains("contact%40ecovolt.com") || link.Contains("contact@ecovolt.com")),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ResendCompanyVerification_DispatchesFreshVerificationEmail()
    {
        // Arrange
        var tenant = new Tenant
        {
            TenantId = "TNT-RESEND-01",
            CompanyName = "PowerCharge Corp",
            BusinessEmail = "admin@powercharge.com",
            IsEmailVerified = false
        };

        _mockTenantRepo.Setup(r => r.GetTenantByEmailAsync("admin@powercharge.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(tenant);

        _mockTenantRepo.Setup(r => r.SaveEmailVerificationCodeAsync(
                tenant.TenantId, "admin@powercharge.com", It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        _mockEmailService.Setup(e => e.SendVerificationEmailAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        // Act
        var result = await _companyAuthService.ResendCompanyVerificationCodeAsync("admin@powercharge.com");

        // Assert
        result.Should().NotBeNull();
        result.NewBusinessEmail.Should().Be("admin@powercharge.com");

        _mockEmailService.Verify(e => e.SendVerificationEmailAsync(
            "admin@powercharge.com",
            "PowerCharge Corp",
            It.Is<string>(code => code.Length == 6),
            It.IsAny<string>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RegisterDriver_DispatchesAutomatedVerificationEmailToDriverInbox()
    {
        // Arrange
        var request = new DriverRegisterRequestDto
        {
            Name = "Johnathan EV Driver",
            Email = "johnathan.driver@gmail.com",
            Phone = "+15559876543",
            Password = "StrongDriverPassword@1"
        };

        _mockDriverRepo.Setup(r => r.IsEmailRegisteredAsync("johnathan.driver@gmail.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        _mockPasswordHasher.Setup(p => p.HashPassword(request.Password))
            .Returns("$2a$12$driverHashed");

        _mockDriverRepo.Setup(r => r.SaveDriverVerificationCodeAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        _mockEmailService.Setup(e => e.SendVerificationEmailAsync(
                request.Email, request.Name, It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        // Act
        var result = await _driverAuthService.RegisterDriverAsync(request);

        // Assert
        result.Should().NotBeNull();
        result.Email.Should().Be("johnathan.driver@gmail.com");

        _mockEmailService.Verify(e => e.SendVerificationEmailAsync(
            "johnathan.driver@gmail.com",
            "Johnathan EV Driver",
            It.Is<string>(code => code.Length == 6),
            It.Is<string>(link => link.Contains("johnathan.driver%40gmail.com") || link.Contains("johnathan.driver@gmail.com")),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SmtpEmailService_WhenNoPasswordProvided_LogsGracefullyWithoutThrowing()
    {
        // Arrange
        var options = Options.Create(new EmailSettings
        {
            SmtpHost = "smtp.gmail.com",
            SmtpPort = 587,
            SenderEmail = "no-reply@evnexus.io",
            SenderName = "EVNexus Platform",
            SenderPassword = "", // Empty password triggers dev console fallback
            EnableSsl = true,
            FrontendBaseUrl = "http://localhost:3000"
        });

        var smtpService = new SmtpEmailService(options, _mockSmtpLogger.Object);

        // Act
        var result = await smtpService.SendVerificationEmailAsync(
            "testuser@gmail.com",
            "Test Driver",
            "849201",
            "?email=testuser%40gmail.com&code=849201");

        // Assert
        result.Should().BeTrue();
    }
}
