using System.ComponentModel.DataAnnotations;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using EVNexus.AuthService.Configuration;
using EVNexus.AuthService.Data;
using EVNexus.AuthService.DTOs;
using EVNexus.AuthService.Exceptions;
using EVNexus.AuthService.Models;
using EVNexus.AuthService.Services;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;

namespace EVNexus.AuthService.Tests;

public class CompanyLoginTests
{
    private readonly Mock<ITenantRepository> _mockTenantRepo;
    private readonly Mock<IPasswordHasher> _mockPasswordHasher;
    private readonly Mock<IJwtTokenService> _mockJwtTokenService;
    private readonly Mock<ILogger<CompanyAuthService>> _mockLogger;
    private readonly CompanyAuthService _authService;

    public CompanyLoginTests()
    {
        _mockTenantRepo = new Mock<ITenantRepository>();
        _mockPasswordHasher = new Mock<IPasswordHasher>();
        _mockJwtTokenService = new Mock<IJwtTokenService>();
        _mockLogger = new Mock<ILogger<CompanyAuthService>>();

        _authService = new CompanyAuthService(
            _mockTenantRepo.Object,
            _mockPasswordHasher.Object,
            _mockJwtTokenService.Object,
            _mockLogger.Object);
    }

    [Fact]
    public async Task LoginCompanyAsync_WithValidCredentials_ReturnsAccessTokenAndTenantDetails()
    {
        // Arrange
        var request = new CompanyLoginRequestDto
        {
            BusinessEmail = "admin@greenpulse.com",
            Password = "Password@123"
        };

        var tenant = new Tenant
        {
            TenantId = "TNT-12345ABCDE",
            CompanyName = "GreenPulse Energy Ltd",
            RegistrationNumber = "REG-9999",
            BusinessEmail = "admin@greenpulse.com",
            Phone = "+15551234567",
            Address = "100 Clean Energy Blvd",
            PasswordHash = "$2a$12$hashedPasswordValue",
            Role = "CompanyAdmin",
            Status = "Active",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _mockTenantRepo.Setup(r => r.GetTenantByEmailAsync("admin@greenpulse.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(tenant);

        _mockPasswordHasher.Setup(p => p.VerifyPassword("Password@123", tenant.PasswordHash))
            .Returns(true);

        _mockJwtTokenService.Setup(j => j.GenerateToken(tenant))
            .Returns(("mock.jwt.token.here", 3600));

        // Act
        var result = await _authService.LoginCompanyAsync(request);

        // Assert
        result.Should().NotBeNull();
        result.AccessToken.Should().Be("mock.jwt.token.here");
        result.TokenType.Should().Be("Bearer");
        result.ExpiresIn.Should().Be(3600);
        result.TenantId.Should().Be("TNT-12345ABCDE");
        result.CompanyName.Should().Be("GreenPulse Energy Ltd");
        result.BusinessEmail.Should().Be("admin@greenpulse.com");
        result.Role.Should().Be("CompanyAdmin");
    }

    [Fact]
    public async Task LoginCompanyAsync_WithNonExistentEmail_ThrowsInvalidCredentialsException()
    {
        // Arrange
        var request = new CompanyLoginRequestDto
        {
            BusinessEmail = "nonexistent@company.com",
            Password = "Password@123"
        };

        _mockTenantRepo.Setup(r => r.GetTenantByEmailAsync("nonexistent@company.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync((Tenant?)null);

        // Act
        var act = () => _authService.LoginCompanyAsync(request);

        // Assert
        await act.Should().ThrowAsync<InvalidCredentialsException>()
            .WithMessage("Invalid email or password.");
    }

    [Fact]
    public async Task LoginCompanyAsync_WithWrongPassword_ThrowsInvalidCredentialsException()
    {
        // Arrange
        var request = new CompanyLoginRequestDto
        {
            BusinessEmail = "admin@greenpulse.com",
            Password = "WrongPassword!999"
        };

        var tenant = new Tenant
        {
            TenantId = "TNT-12345ABCDE",
            CompanyName = "GreenPulse Energy Ltd",
            BusinessEmail = "admin@greenpulse.com",
            PasswordHash = "$2a$12$correctHash",
            Status = "Active",
            Role = "CompanyAdmin"
        };

        _mockTenantRepo.Setup(r => r.GetTenantByEmailAsync("admin@greenpulse.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(tenant);

        _mockPasswordHasher.Setup(p => p.VerifyPassword("WrongPassword!999", tenant.PasswordHash))
            .Returns(false);

        // Act
        var act = () => _authService.LoginCompanyAsync(request);

        // Assert
        await act.Should().ThrowAsync<InvalidCredentialsException>()
            .WithMessage("Invalid email or password.");
    }

    [Fact]
    public async Task LoginCompanyAsync_WithInactiveAccount_ThrowsInvalidCredentialsException()
    {
        // Arrange
        var request = new CompanyLoginRequestDto
        {
            BusinessEmail = "admin@greenpulse.com",
            Password = "Password@123"
        };

        var tenant = new Tenant
        {
            TenantId = "TNT-12345ABCDE",
            CompanyName = "GreenPulse Energy Ltd",
            BusinessEmail = "admin@greenpulse.com",
            PasswordHash = "$2a$12$correctHash",
            Status = "Suspended",
            Role = "CompanyAdmin"
        };

        _mockTenantRepo.Setup(r => r.GetTenantByEmailAsync("admin@greenpulse.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(tenant);

        _mockPasswordHasher.Setup(p => p.VerifyPassword("Password@123", tenant.PasswordHash))
            .Returns(true);

        // Act
        var act = () => _authService.LoginCompanyAsync(request);

        // Assert
        await act.Should().ThrowAsync<InvalidCredentialsException>()
            .WithMessage("Account is currently inactive or suspended.");
    }

    [Fact]
    public async Task GetCompanyProfileAsync_WithExistingTenant_ReturnsProfile()
    {
        // Arrange
        var tenant = new Tenant
        {
            TenantId = "TNT-98765ZYXWV",
            CompanyName = "VoltStream Mobility",
            RegistrationNumber = "VSM-445566",
            BusinessEmail = "contact@voltstream.com",
            Phone = "+18005550199",
            Address = "50 Silicon Way, Tech Park",
            Role = "CompanyAdmin",
            Status = "Active",
            CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
        };

        _mockTenantRepo.Setup(r => r.GetTenantByIdAsync("TNT-98765ZYXWV", It.IsAny<CancellationToken>()))
            .ReturnsAsync(tenant);

        // Act
        var result = await _authService.GetCompanyProfileAsync("TNT-98765ZYXWV");

        // Assert
        result.Should().NotBeNull();
        result.TenantId.Should().Be("TNT-98765ZYXWV");
        result.CompanyName.Should().Be("VoltStream Mobility");
        result.RegistrationNumber.Should().Be("VSM-445566");
        result.BusinessEmail.Should().Be("contact@voltstream.com");
        result.Role.Should().Be("CompanyAdmin");
        result.Status.Should().Be("Active");
    }

    [Fact]
    public async Task GetCompanyProfileAsync_WithNonExistentTenant_ThrowsTenantNotFoundException()
    {
        // Arrange
        _mockTenantRepo.Setup(r => r.GetTenantByIdAsync("TNT-NONEXISTENT", It.IsAny<CancellationToken>()))
            .ReturnsAsync((Tenant?)null);

        // Act
        var act = () => _authService.GetCompanyProfileAsync("TNT-NONEXISTENT");

        // Assert
        await act.Should().ThrowAsync<TenantNotFoundException>()
            .WithMessage("*TNT-NONEXISTENT*");
    }

    [Fact]
    public void JwtTokenService_GeneratesSignedToken_WithEmbeddedTenantIdAndRoleClaims()
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

        var tenant = new Tenant
        {
            TenantId = "TNT-CLAIMTEST123",
            CompanyName = "EcoCharge Networks",
            RegistrationNumber = "ECN-112233",
            BusinessEmail = "ops@ecocharge.com",
            Role = "CompanyAdmin",
            Status = "Active"
        };

        // Act
        var (token, expiresInSeconds) = tokenService.GenerateToken(tenant);

        // Assert
        token.Should().NotBeNullOrWhiteSpace();
        expiresInSeconds.Should().Be(3600);

        var handler = new JwtSecurityTokenHandler();
        handler.CanReadToken(token).Should().BeTrue();

        var jwtToken = handler.ReadJwtToken(token);
        jwtToken.Issuer.Should().Be("EVNexus.AuthService");
        jwtToken.Audiences.Should().Contain("EVNexus.Microservices");

        jwtToken.Claims.Should().Contain(c => c.Type == "tenant_id" && c.Value == "TNT-CLAIMTEST123");
        jwtToken.Claims.Should().Contain(c => c.Type == "role" && c.Value == "CompanyAdmin");
        jwtToken.Claims.Should().Contain(c => c.Type == "company_name" && c.Value == "EcoCharge Networks");
        jwtToken.Claims.Should().Contain(c => (c.Type == JwtRegisteredClaimNames.Email || c.Type == ClaimTypes.Email) && c.Value == "ops@ecocharge.com");
    }

    [Theory]
    [InlineData("", "Password@123", "Business email is required.")]
    [InlineData("not-an-email", "Password@123", "Invalid business email format.")]
    [InlineData("valid@email.com", "", "Password is required.")]
    public void CompanyLoginRequestDto_Validation_FailsOnInvalidInput(string email, string password, string expectedErrorMessage)
    {
        var dto = new CompanyLoginRequestDto
        {
            BusinessEmail = email,
            Password = password
        };

        var validationContext = new ValidationContext(dto);
        var validationResults = new List<ValidationResult>();
        var isValid = Validator.TryValidateObject(dto, validationContext, validationResults, true);

        isValid.Should().BeFalse();
        validationResults.Should().Contain(r => r.ErrorMessage == expectedErrorMessage);
    }
}
