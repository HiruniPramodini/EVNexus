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

public class CompanyProfileManagementTests
{
    private readonly Mock<ITenantRepository> _mockTenantRepo;
    private readonly Mock<IPasswordHasher> _mockPasswordHasher;
    private readonly Mock<IJwtTokenService> _mockJwtTokenService;
    private readonly Mock<ILogger<CompanyAuthService>> _mockServiceLogger;
    private readonly Mock<ILogger<AuthController>> _mockAuthControllerLogger;
    private readonly Mock<IDriverAuthService> _mockDriverAuthService;
    private readonly CompanyAuthService _companyAuthService;

    public CompanyProfileManagementTests()
    {
        _mockTenantRepo = new Mock<ITenantRepository>();
        _mockPasswordHasher = new Mock<IPasswordHasher>();
        _mockJwtTokenService = new Mock<IJwtTokenService>();
        _mockServiceLogger = new Mock<ILogger<CompanyAuthService>>();
        _mockAuthControllerLogger = new Mock<ILogger<AuthController>>();
        _mockDriverAuthService = new Mock<IDriverAuthService>();

        _companyAuthService = new CompanyAuthService(
            _mockTenantRepo.Object,
            _mockPasswordHasher.Object,
            _mockJwtTokenService.Object,
            _mockServiceLogger.Object);
    }

    private static Tenant CreateSampleTenant(string tenantId = "TNT-CORP-100", string email = "admin@greendrive.com")
    {
        return new Tenant
        {
            TenantId = tenantId,
            CompanyName = "GreenDrive Networks",
            RegistrationNumber = "REG-GD-2026",
            BusinessEmail = email,
            Phone = "+1-555-456-7890",
            Address = "100 Innovation Way, Suite 400, Austin, TX",
            LogoUrl = "https://images.unsplash.com/photo-1558441719-8b489c652756?w=200",
            PasswordHash = "$2a$12$sampleHashedPassword123",
            Role = "CompanyAdmin",
            Status = "Active",
            CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            UpdatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
        };
    }

    private AuthController CreateAuthControllerWithUser(string tenantId, string role = "CompanyAdmin")
    {
        var controller = new AuthController(
            _companyAuthService,
            _mockDriverAuthService.Object,
            _mockAuthControllerLogger.Object);

        var claims = new List<Claim>
        {
            new("tenant_id", tenantId),
            new(ClaimTypes.NameIdentifier, tenantId),
            new(ClaimTypes.Role, role),
            new("role", role)
        };

        var identity = new ClaimsIdentity(claims, "TestAuth");
        var claimsPrincipal = new ClaimsPrincipal(identity);

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = claimsPrincipal }
        };

        return controller;
    }

    [Fact]
    public async Task GetCompanyProfile_ReturnsFullProfileDetails_IncludingLogoAndTimestamps()
    {
        // Arrange
        var tenant = CreateSampleTenant();
        _mockTenantRepo.Setup(r => r.GetTenantByIdAsync(tenant.TenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(tenant);

        // Act
        var result = await _companyAuthService.GetCompanyProfileAsync(tenant.TenantId);

        // Assert
        result.Should().NotBeNull();
        result.TenantId.Should().Be(tenant.TenantId);
        result.CompanyName.Should().Be("GreenDrive Networks");
        result.BusinessEmail.Should().Be("admin@greendrive.com");
        result.Phone.Should().Be("+1-555-456-7890");
        result.Address.Should().Be("100 Innovation Way, Suite 400, Austin, TX");
        result.LogoUrl.Should().Be(tenant.LogoUrl);
        result.Role.Should().Be("CompanyAdmin");
        result.Status.Should().Be("Active");
    }

    [Fact]
    public async Task UpdateCompanyProfile_ValidRequest_UpdatesNamePhoneAddressLogo()
    {
        // Arrange
        var tenant = CreateSampleTenant();
        _mockTenantRepo.Setup(r => r.GetTenantByIdAsync(tenant.TenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(tenant);

        var updatedTenant = CreateSampleTenant();
        updatedTenant.CompanyName = "GreenDrive Global Inc.";
        updatedTenant.Phone = "+1-555-999-0000";
        updatedTenant.Address = "200 Global Parkway, Silicon Valley, CA";
        updatedTenant.LogoUrl = "https://images.unsplash.com/photo-ev-logo-updated";
        updatedTenant.UpdatedAt = DateTime.UtcNow;

        _mockTenantRepo.Setup(r => r.UpdateTenantProfileAsync(
                tenant.TenantId,
                "GreenDrive Global Inc.",
                "+1-555-999-0000",
                "200 Global Parkway, Silicon Valley, CA",
                "https://images.unsplash.com/photo-ev-logo-updated",
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(updatedTenant);

        var request = new UpdateCompanyProfileRequestDto
        {
            CompanyName = "GreenDrive Global Inc.",
            Phone = "+1-555-999-0000",
            Address = "200 Global Parkway, Silicon Valley, CA",
            LogoUrl = "https://images.unsplash.com/photo-ev-logo-updated"
        };

        // Act
        var result = await _companyAuthService.UpdateCompanyProfileAsync(tenant.TenantId, request);

        // Assert
        result.Should().NotBeNull();
        result.CompanyName.Should().Be("GreenDrive Global Inc.");
        result.Phone.Should().Be("+1-555-999-0000");
        result.Address.Should().Be("200 Global Parkway, Silicon Valley, CA");
        result.LogoUrl.Should().Be("https://images.unsplash.com/photo-ev-logo-updated");
        result.BusinessEmail.Should().Be(tenant.BusinessEmail);

        _mockTenantRepo.Verify(r => r.UpdateTenantProfileAsync(
            tenant.TenantId,
            request.CompanyName,
            request.Phone,
            request.Address,
            request.LogoUrl,
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task UpdateCompanyProfile_AttemptingEmailChangeWithoutVerificationCode_ThrowsBusinessEmailChangeRequiresVerificationException()
    {
        // Arrange
        var tenant = CreateSampleTenant();
        _mockTenantRepo.Setup(r => r.GetTenantByIdAsync(tenant.TenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(tenant);

        var request = new UpdateCompanyProfileRequestDto
        {
            CompanyName = "GreenDrive Networks",
            Phone = "+1-555-456-7890",
            Address = "100 Innovation Way, Suite 400, Austin, TX",
            BusinessEmail = "new-unverified-email@greendrive.com", // Changed email without code
            EmailVerificationCode = null
        };

        // Act
        var act = () => _companyAuthService.UpdateCompanyProfileAsync(tenant.TenantId, request);

        // Assert
        await act.Should().ThrowAsync<BusinessEmailChangeRequiresVerificationException>()
            .WithMessage("*Business email cannot be changed without re-verification*");

        _mockTenantRepo.Verify(r => r.UpdateTenantEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task UpdateCompanyProfile_AttemptingEmailChangeWithInvalidCode_ThrowsEmailVerificationException()
    {
        // Arrange
        var tenant = CreateSampleTenant();
        _mockTenantRepo.Setup(r => r.GetTenantByIdAsync(tenant.TenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(tenant);

        _mockTenantRepo.Setup(r => r.ValidateAndConsumeVerificationCodeAsync(
                tenant.TenantId, "new-email@greendrive.com", "WRONG_CODE", It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var request = new UpdateCompanyProfileRequestDto
        {
            CompanyName = "GreenDrive Networks",
            Phone = "+1-555-456-7890",
            Address = "100 Innovation Way, Suite 400, Austin, TX",
            BusinessEmail = "new-email@greendrive.com",
            EmailVerificationCode = "WRONG_CODE"
        };

        // Act
        var act = () => _companyAuthService.UpdateCompanyProfileAsync(tenant.TenantId, request);

        // Assert
        await act.Should().ThrowAsync<EmailVerificationException>()
            .WithMessage("*Invalid or expired email verification code*");
    }

    [Fact]
    public async Task UpdateCompanyProfile_ValidEmailChangeWithVerificationCode_SuccessfullyUpdatesEmail()
    {
        // Arrange
        var tenant = CreateSampleTenant();
        _mockTenantRepo.Setup(r => r.GetTenantByIdAsync(tenant.TenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(tenant);

        _mockTenantRepo.Setup(r => r.ValidateAndConsumeVerificationCodeAsync(
                tenant.TenantId, "verified-admin@greendrive.com", "123456", It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        _mockTenantRepo.Setup(r => r.IsEmailRegisteredAsync("verified-admin@greendrive.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        _mockTenantRepo.Setup(r => r.UpdateTenantEmailAsync(tenant.TenantId, "verified-admin@greendrive.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var updatedTenant = CreateSampleTenant();
        updatedTenant.BusinessEmail = "verified-admin@greendrive.com";
        _mockTenantRepo.Setup(r => r.UpdateTenantProfileAsync(
                tenant.TenantId, It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(updatedTenant);

        var request = new UpdateCompanyProfileRequestDto
        {
            CompanyName = "GreenDrive Networks",
            Phone = "+1-555-456-7890",
            Address = "100 Innovation Way, Suite 400, Austin, TX",
            BusinessEmail = "verified-admin@greendrive.com",
            EmailVerificationCode = "123456"
        };

        // Act
        var result = await _companyAuthService.UpdateCompanyProfileAsync(tenant.TenantId, request);

        // Assert
        result.Should().NotBeNull();
        result.BusinessEmail.Should().Be("verified-admin@greendrive.com");

        _mockTenantRepo.Verify(r => r.UpdateTenantEmailAsync(tenant.TenantId, "verified-admin@greendrive.com", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task InitiateEmailChange_GeneratesVerificationCodeAndStoresToken()
    {
        // Arrange
        var tenant = CreateSampleTenant();
        _mockTenantRepo.Setup(r => r.GetTenantByIdAsync(tenant.TenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(tenant);

        _mockTenantRepo.Setup(r => r.IsEmailRegisteredAsync("brandnew@greendrive.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        _mockTenantRepo.Setup(r => r.SaveEmailVerificationCodeAsync(
                tenant.TenantId, "brandnew@greendrive.com", It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var request = new InitiateEmailChangeRequestDto
        {
            NewBusinessEmail = "brandnew@greendrive.com"
        };

        // Act
        var response = await _companyAuthService.InitiateEmailChangeAsync(tenant.TenantId, request);

        // Assert
        response.Should().NotBeNull();
        response.NewBusinessEmail.Should().Be("brandnew@greendrive.com");
        response.VerificationCode.Should().NotBeNullOrWhiteSpace().And.HaveLength(6);
        response.ExpiresAt.Should().BeAfter(DateTime.UtcNow);

        _mockTenantRepo.Verify(r => r.SaveEmailVerificationCodeAsync(
            tenant.TenantId, "brandnew@greendrive.com", response.VerificationCode, It.IsAny<DateTime>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task AuthController_UpdateCompanyProfile_ReturnsOk200()
    {
        // Arrange
        var tenant = CreateSampleTenant();
        _mockTenantRepo.Setup(r => r.GetTenantByIdAsync(tenant.TenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(tenant);

        var updatedTenant = CreateSampleTenant();
        updatedTenant.CompanyName = "Updated Company Name";
        _mockTenantRepo.Setup(r => r.UpdateTenantProfileAsync(
                tenant.TenantId, "Updated Company Name", tenant.Phone, tenant.Address, tenant.LogoUrl, It.IsAny<CancellationToken>()))
            .ReturnsAsync(updatedTenant);

        var controller = CreateAuthControllerWithUser(tenant.TenantId);

        var request = new UpdateCompanyProfileRequestDto
        {
            CompanyName = "Updated Company Name",
            Phone = tenant.Phone,
            Address = tenant.Address,
            LogoUrl = tenant.LogoUrl
        };

        // Act
        var response = await controller.UpdateCompanyProfile(request, CancellationToken.None);

        // Assert
        var okResult = response.Should().BeOfType<OkObjectResult>().Subject;
        okResult.StatusCode.Should().Be(StatusCodes.Status200OK);

        var apiResponse = okResult.Value.Should().BeOfType<ApiResponse<CompanyProfileResponseDto>>().Subject;
        apiResponse.Success.Should().BeTrue();
        apiResponse.Data?.CompanyName.Should().Be("Updated Company Name");
    }

    [Fact]
    public async Task AuthController_UpdateCompanyProfile_EmailWithoutVerification_ReturnsBadRequest400()
    {
        // Arrange
        var tenant = CreateSampleTenant();
        _mockTenantRepo.Setup(r => r.GetTenantByIdAsync(tenant.TenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(tenant);

        var controller = CreateAuthControllerWithUser(tenant.TenantId);

        var request = new UpdateCompanyProfileRequestDto
        {
            CompanyName = tenant.CompanyName,
            Phone = tenant.Phone,
            Address = tenant.Address,
            BusinessEmail = "different-email@test.com" // without code
        };

        // Act
        var response = await controller.UpdateCompanyProfile(request, CancellationToken.None);

        // Assert
        var badRequestResult = response.Should().BeOfType<BadRequestObjectResult>().Subject;
        badRequestResult.StatusCode.Should().Be(StatusCodes.Status400BadRequest);

        var apiResponse = badRequestResult.Value.Should().BeOfType<ApiResponse<object>>().Subject;
        apiResponse.Success.Should().BeFalse();
        apiResponse.Message.Should().Contain("Business email cannot be changed without re-verification");
    }

    [Fact]
    public void UpdateCompanyProfileRequestDto_Validation_FailsWhenRequiredFieldsMissing()
    {
        // Arrange
        var invalidDto = new UpdateCompanyProfileRequestDto
        {
            CompanyName = "",
            Phone = "",
            Address = ""
        };

        var validationContext = new ValidationContext(invalidDto);
        var validationResults = new List<ValidationResult>();

        // Act
        var isValid = Validator.TryValidateObject(invalidDto, validationContext, validationResults, true);

        // Assert
        isValid.Should().BeFalse();
        validationResults.Should().Contain(r => r.MemberNames.Contains(nameof(UpdateCompanyProfileRequestDto.CompanyName)));
        validationResults.Should().Contain(r => r.MemberNames.Contains(nameof(UpdateCompanyProfileRequestDto.Phone)));
        validationResults.Should().Contain(r => r.MemberNames.Contains(nameof(UpdateCompanyProfileRequestDto.Address)));
    }
}
