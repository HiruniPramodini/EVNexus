using System.ComponentModel.DataAnnotations;
using EVNexus.AuthService.Data;
using EVNexus.AuthService.DTOs;
using EVNexus.AuthService.Exceptions;
using EVNexus.AuthService.Models;
using EVNexus.AuthService.Services;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;

namespace EVNexus.AuthService.Tests;

public class CompanyRegistrationTests
{
    private readonly Mock<ITenantRepository> _tenantRepoMock;
    private readonly Mock<IPasswordHasher> _passwordHasherMock;
    private readonly CompanyAuthService _sut; // System Under Test

    public CompanyRegistrationTests()
    {
        _tenantRepoMock = new Mock<ITenantRepository>();
        _passwordHasherMock = new Mock<IPasswordHasher>();
        var loggerMock = new Mock<ILogger<CompanyAuthService>>();

        _sut = new CompanyAuthService(
            _tenantRepoMock.Object,
            _passwordHasherMock.Object,
            loggerMock.Object
        );
    }

    [Fact]
    public async Task RegisterCompany_WithValidDetails_GeneratesUniqueTenantIdAndHashesPassword()
    {
        // Arrange
        var request = new CompanyRegisterRequestDto
        {
            CompanyName = "EcoCharge Mobility Pvt Ltd",
            RegistrationNumber = "REG-998822",
            BusinessEmail = "admin@ecocharge.com",
            Phone = "+1-555-0199",
            Address = "100 Clean Energy Way, Tech City",
            Password = "SecurePassword123!"
        };

        const string expectedHash = "$2a$12$e8x/abc123hashedPassword";
        _tenantRepoMock
            .Setup(r => r.IsEmailRegisteredAsync(request.BusinessEmail, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        _tenantRepoMock
            .Setup(r => r.IsRegistrationNumberRegisteredAsync(request.RegistrationNumber, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        _passwordHasherMock
            .Setup(h => h.HashPassword(request.Password))
            .Returns(expectedHash);

        Tenant? capturedTenant = null;
        _tenantRepoMock
            .Setup(r => r.CreateTenantAsync(It.IsAny<Tenant>(), It.IsAny<CancellationToken>()))
            .Callback<Tenant, CancellationToken>((t, _) => capturedTenant = t)
            .ReturnsAsync((Tenant t, CancellationToken _) => t);

        // Act
        var result = await _sut.RegisterCompanyAsync(request);

        // Assert
        result.Should().NotBeNull();
        result.TenantId.Should().StartWith("TNT-");
        result.TenantId.Length.Should().BeGreaterThan(10);
        result.CompanyName.Should().Be("EcoCharge Mobility Pvt Ltd");
        result.BusinessEmail.Should().Be("admin@ecocharge.com");
        result.RegistrationNumber.Should().Be("REG-998822");

        Assert.NotNull(capturedTenant);
        capturedTenant.TenantId.Should().Be(result.TenantId);
        capturedTenant.PasswordHash.Should().Be(expectedHash);
        capturedTenant.PasswordHash.Should().NotBe(request.Password); // Never plain text
        capturedTenant.Role.Should().Be("CompanyAdmin");
        capturedTenant.Status.Should().Be("Active");

        _passwordHasherMock.Verify(h => h.HashPassword(request.Password), Times.Once);
        _tenantRepoMock.Verify(r => r.CreateTenantAsync(It.IsAny<Tenant>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RegisterCompany_WithDuplicateEmail_ThrowsDuplicateEmailException()
    {
        // Arrange
        var request = new CompanyRegisterRequestDto
        {
            CompanyName = "VoltPower Ltd",
            RegistrationNumber = "REG-443322",
            BusinessEmail = "contact@voltpower.com",
            Phone = "+1-555-0144",
            Address = "200 Battery Ave",
            Password = "StrongPassword123!"
        };

        _tenantRepoMock
            .Setup(r => r.IsEmailRegisteredAsync(request.BusinessEmail, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true); // Email already exists

        // Act & Assert
        var act = async () => await _sut.RegisterCompanyAsync(request);

        await act.Should().ThrowAsync<DuplicateEmailException>()
            .WithMessage($"A company with the business email '{request.BusinessEmail}' is already registered.");

        _tenantRepoMock.Verify(r => r.CreateTenantAsync(It.IsAny<Tenant>(), It.IsAny<CancellationToken>()), Times.Never);
        _passwordHasherMock.Verify(h => h.HashPassword(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task RegisterCompany_WithDuplicateRegistrationNumber_ThrowsDuplicateRegistrationNumberException()
    {
        // Arrange
        var request = new CompanyRegisterRequestDto
        {
            CompanyName = "VoltPower Ltd",
            RegistrationNumber = "REG-EXISTING-123",
            BusinessEmail = "new@voltpower.com",
            Phone = "+1-555-0144",
            Address = "200 Battery Ave",
            Password = "StrongPassword123!"
        };

        _tenantRepoMock
            .Setup(r => r.IsEmailRegisteredAsync(request.BusinessEmail, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        _tenantRepoMock
            .Setup(r => r.IsRegistrationNumberRegisteredAsync(request.RegistrationNumber, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        // Act & Assert
        var act = async () => await _sut.RegisterCompanyAsync(request);

        await act.Should().ThrowAsync<DuplicateRegistrationNumberException>()
            .WithMessage($"A company with registration number '{request.RegistrationNumber}' is already registered.");

        _tenantRepoMock.Verify(r => r.CreateTenantAsync(It.IsAny<Tenant>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public void BCryptPasswordHasher_HashesAndVerifiesPasswordCorrectly()
    {
        // Arrange
        var hasher = new BCryptPasswordHasher();
        const string plainPassword = "SuperSecretPassword123!";

        // Act
        var hash = hasher.HashPassword(plainPassword);

        // Assert
        hash.Should().NotBeNullOrWhiteSpace();
        hash.Should().NotBe(plainPassword);
        hash.Should().StartWith("$2"); // BCrypt salt prefix

        hasher.VerifyPassword(plainPassword, hash).Should().BeTrue();
        hasher.VerifyPassword("WrongPassword123!", hash).Should().BeFalse();
    }

    [Theory]
    [InlineData("", "REG-123", "test@company.com", "+1-555-1234", "Address 1", "Password123!")] // Missing Company Name
    [InlineData("Company", "", "test@company.com", "+1-555-1234", "Address 1", "Password123!")] // Missing Reg Number
    [InlineData("Company", "REG-123", "not-an-email", "+1-555-1234", "Address 1", "Password123!")] // Invalid Email
    [InlineData("Company", "REG-123", "test@company.com", "", "Address 1", "Password123!")] // Missing Phone
    [InlineData("Company", "REG-123", "test@company.com", "+1-555-1234", "", "Password123!")] // Missing Address
    [InlineData("Company", "REG-123", "test@company.com", "+1-555-1234", "Address 1", "short")] // Weak/Short Password
    public void CompanyRegisterRequestDto_Validation_FailsOnInvalidInput(
        string companyName, string regNum, string email, string phone, string address, string password)
    {
        // Arrange
        var dto = new CompanyRegisterRequestDto
        {
            CompanyName = companyName,
            RegistrationNumber = regNum,
            BusinessEmail = email,
            Phone = phone,
            Address = address,
            Password = password
        };

        var context = new ValidationContext(dto);
        var validationResults = new List<ValidationResult>();

        // Act
        var isValid = Validator.TryValidateObject(dto, context, validationResults, true);

        // Assert
        isValid.Should().BeFalse();
        validationResults.Should().NotBeEmpty();
    }
}
