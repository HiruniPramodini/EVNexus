using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using EVNexus.AuthService.Attributes;
using EVNexus.AuthService.Controllers;
using EVNexus.AuthService.Data;
using EVNexus.AuthService.DTOs;
using EVNexus.AuthService.Exceptions;
using EVNexus.AuthService.Middleware;
using EVNexus.AuthService.Models;
using EVNexus.AuthService.Security;
using EVNexus.AuthService.Services;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using Moq;
using Xunit;

namespace EVNexus.AuthService.Tests;

public class AccountSuspensionTests
{
    private readonly Mock<ITenantRepository> _mockTenantRepo;
    private readonly Mock<IDriverRepository> _mockDriverRepo;
    private readonly Mock<IAccountAuditRepository> _mockAuditRepo;
    private readonly Mock<IRefreshTokenRepository> _mockRefreshTokenRepo;
    private readonly Mock<IPasswordHasher> _mockPasswordHasher;
    private readonly Mock<IJwtTokenService> _mockJwtTokenService;
    private readonly Mock<ITokenBlacklistService> _mockBlacklistService;
    private readonly Mock<ILogger<AccountManagementService>> _mockAccountMgmtLogger;
    private readonly Mock<ILogger<PlatformAdminController>> _mockControllerLogger;
    private readonly Mock<ILogger<CompanyAuthService>> _mockCompanyAuthLogger;
    private readonly Mock<ILogger<DriverAuthService>> _mockDriverAuthLogger;
    private readonly Mock<ILogger<RoleAuthorizationMiddleware>> _mockMiddlewareLogger;
    private readonly AccountManagementService _accountManagementService;
    private readonly CompanyAuthService _companyAuthService;
    private readonly DriverAuthService _driverAuthService;

    public AccountSuspensionTests()
    {
        _mockTenantRepo = new Mock<ITenantRepository>();
        _mockDriverRepo = new Mock<IDriverRepository>();
        _mockAuditRepo = new Mock<IAccountAuditRepository>();
        _mockRefreshTokenRepo = new Mock<IRefreshTokenRepository>();
        _mockPasswordHasher = new Mock<IPasswordHasher>();
        _mockJwtTokenService = new Mock<IJwtTokenService>();
        _mockBlacklistService = new Mock<ITokenBlacklistService>();
        _mockAccountMgmtLogger = new Mock<ILogger<AccountManagementService>>();
        _mockControllerLogger = new Mock<ILogger<PlatformAdminController>>();
        _mockCompanyAuthLogger = new Mock<ILogger<CompanyAuthService>>();
        _mockDriverAuthLogger = new Mock<ILogger<DriverAuthService>>();
        _mockMiddlewareLogger = new Mock<ILogger<RoleAuthorizationMiddleware>>();

        _accountManagementService = new AccountManagementService(
            _mockTenantRepo.Object,
            _mockDriverRepo.Object,
            _mockAuditRepo.Object,
            _mockRefreshTokenRepo.Object,
            _mockAccountMgmtLogger.Object);

        _companyAuthService = new CompanyAuthService(
            _mockTenantRepo.Object,
            _mockPasswordHasher.Object,
            _mockJwtTokenService.Object,
            _mockCompanyAuthLogger.Object);

        _driverAuthService = new DriverAuthService(
            _mockDriverRepo.Object,
            _mockPasswordHasher.Object,
            _mockJwtTokenService.Object,
            _mockDriverAuthLogger.Object);
    }

    #region Acceptance Criterion 1: Platform admin can suspend a company or driver account

    [Fact]
    public async Task SuspendCompany_WhenCalledByPlatformAdmin_UpdatesStatusToSuspended_AndRevokesTokens()
    {
        // Arrange
        const string tenantId = "TNT-COMP-001";
        var tenant = new Tenant
        {
            TenantId = tenantId,
            CompanyName = "Apex Energy",
            Status = "Active",
            BusinessEmail = "admin@apexenergy.com"
        };

        _mockTenantRepo.Setup(r => r.GetTenantByIdAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(tenant);
        _mockTenantRepo.Setup(r => r.UpdateTenantStatusAsync(tenantId, "Suspended", It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        // Act
        var response = await _accountManagementService.SuspendCompanyAsync(
            tenantId, "Terms of service violation", "platform_superadmin@evnexus.com");

        // Assert
        response.Should().NotBeNull();
        response.AccountId.Should().Be(tenantId);
        response.AccountType.Should().Be("Company");
        response.Status.Should().Be("Suspended");
        response.PreviousStatus.Should().Be("Active");
        response.Action.Should().Be("Suspend");
        response.Reason.Should().Be("Terms of service violation");
        response.PerformedBy.Should().Be("platform_superadmin@evnexus.com");
        response.Timestamp.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));

        // Verify status update in database
        _mockTenantRepo.Verify(r => r.UpdateTenantStatusAsync(tenantId, "Suspended", It.IsAny<CancellationToken>()), Times.Once);

        // Verify all active refresh tokens for the user/tenant are revoked server-side immediately
        _mockRefreshTokenRepo.Verify(r => r.RevokeAllUserTokensAsync(tenantId, It.IsAny<CancellationToken>()), Times.Once);

        // Verify audit log entry is recorded with timestamp
        _mockAuditRepo.Verify(r => r.RecordStatusAuditAsync(
            It.Is<AccountStatusAudit>(a =>
                a.AccountId == tenantId &&
                a.AccountType == "Company" &&
                a.Action == "Suspend" &&
                a.PreviousStatus == "Active" &&
                a.NewStatus == "Suspended" &&
                a.Reason == "Terms of service violation" &&
                a.PerformedBy == "platform_superadmin@evnexus.com" &&
                a.Timestamp <= DateTime.UtcNow),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SuspendDriver_WhenCalledByPlatformAdmin_UpdatesStatusToSuspended_AndRevokesTokens()
    {
        // Arrange
        const string driverId = "DRV-1002";
        var driver = new Driver
        {
            DriverId = driverId,
            Name = "Alice Driver",
            Email = "alice@driver.com",
            Status = "Active"
        };

        _mockDriverRepo.Setup(r => r.GetDriverByIdAsync(driverId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(driver);
        _mockDriverRepo.Setup(r => r.UpdateDriverStatusAsync(driverId, "Suspended", It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        // Act
        var response = await _accountManagementService.SuspendDriverAsync(
            driverId, "Fraudulent payment activity", "admin@evnexus.com");

        // Assert
        response.Should().NotBeNull();
        response.AccountId.Should().Be(driverId);
        response.AccountType.Should().Be("Driver");
        response.Status.Should().Be("Suspended");
        response.PreviousStatus.Should().Be("Active");
        response.Action.Should().Be("Suspend");
        response.Reason.Should().Be("Fraudulent payment activity");

        _mockDriverRepo.Verify(r => r.UpdateDriverStatusAsync(driverId, "Suspended", It.IsAny<CancellationToken>()), Times.Once);
        _mockRefreshTokenRepo.Verify(r => r.RevokeAllUserTokensAsync(driverId, It.IsAny<CancellationToken>()), Times.Once);
        _mockAuditRepo.Verify(r => r.RecordStatusAuditAsync(
            It.Is<AccountStatusAudit>(a => a.AccountId == driverId && a.NewStatus == "Suspended"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task PlatformAdminController_SuspendCompany_WhenSuccessful_Returns200WithUpdatedDetails()
    {
        // Arrange
        var mockMgmt = new Mock<IAccountManagementService>();
        var controller = new PlatformAdminController(mockMgmt.Object, _mockControllerLogger.Object);

        var claims = new List<Claim>
        {
            new(ClaimTypes.Role, AppRoles.PlatformAdmin),
            new(ClaimTypes.Name, "platform_admin@evnexus.com")
        };
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(claims, "Bearer"))
            }
        };

        var expectedResponse = new AccountStatusResponseDto
        {
            AccountId = "TNT-101",
            AccountType = "Company",
            Status = "Suspended",
            PreviousStatus = "Active",
            Action = "Suspend",
            Reason = "Non-compliance",
            PerformedBy = "platform_admin@evnexus.com",
            Timestamp = DateTime.UtcNow,
            Message = "Company account 'Apex' has been suspended successfully."
        };

        mockMgmt.Setup(m => m.SuspendCompanyAsync("TNT-101", "Non-compliance", "platform_admin@evnexus.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedResponse);

        // Act
        var result = await controller.SuspendCompany("TNT-101", new SuspendAccountRequestDto { Reason = "Non-compliance" }, CancellationToken.None);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var apiResponse = okResult.Value.Should().BeOfType<ApiResponse<AccountStatusResponseDto>>().Subject;
        apiResponse.Success.Should().BeTrue();
        apiResponse.Data!.Status.Should().Be("Suspended");
        apiResponse.Data.AccountId.Should().Be("TNT-101");
    }

    [Fact]
    public async Task RoleAuthorizationMiddleware_WhenNonAdminCallsAdminEndpoint_Returns403Forbidden()
    {
        // Arrange
        var context = new DefaultHttpContext();
        context.Request.Headers.Authorization = "Bearer driver.or.company.token";

        // Caller has 'CompanyAdmin' role, NOT 'PlatformAdmin'
        var claims = new List<Claim>
        {
            new(ClaimTypes.Role, AppRoles.CompanyAdmin),
            new(ClaimTypes.NameIdentifier, "TNT-101")
        };
        context.User = new ClaimsPrincipal(new ClaimsIdentity(claims, "Bearer"));

        // Protected endpoint requires PlatformAdmin
        var endpoint = new Endpoint(
            _ => Task.CompletedTask,
            new EndpointMetadataCollection(new RequireRoleAttribute(AppRoles.PlatformAdmin)),
            "PlatformAdmin Endpoint");
        context.SetEndpoint(endpoint);

        var nextCalled = false;
        var middleware = new RoleAuthorizationMiddleware(_ =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        }, _mockMiddlewareLogger.Object);

        // Act
        await middleware.InvokeAsync(context, _mockBlacklistService.Object);

        // Assert
        nextCalled.Should().BeFalse();
        context.Response.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
    }

    [Fact]
    public async Task RoleAuthorizationMiddleware_WhenPlatformAdminCallsAdminEndpoint_AllowsExecution()
    {
        // Arrange
        var context = new DefaultHttpContext();
        context.Request.Headers.Authorization = "Bearer valid.platform.admin.token";

        // Caller has 'PlatformAdmin' role
        var claims = new List<Claim>
        {
            new(ClaimTypes.Role, AppRoles.PlatformAdmin),
            new(ClaimTypes.NameIdentifier, "ADMIN-001")
        };
        context.User = new ClaimsPrincipal(new ClaimsIdentity(claims, "Bearer"));

        var endpoint = new Endpoint(
            _ => Task.CompletedTask,
            new EndpointMetadataCollection(new RequireRoleAttribute(AppRoles.PlatformAdmin)),
            "PlatformAdmin Endpoint");
        context.SetEndpoint(endpoint);

        _mockBlacklistService.Setup(b => b.IsTokenRevokedAsync(It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var nextCalled = false;
        var middleware = new RoleAuthorizationMiddleware(_ =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        }, _mockMiddlewareLogger.Object);

        // Act
        await middleware.InvokeAsync(context, _mockBlacklistService.Object);

        // Assert
        nextCalled.Should().BeTrue();
        context.Response.StatusCode.Should().Be(StatusCodes.Status200OK);
    }

    #endregion

    #region Acceptance Criterion 2: Suspended accounts cannot log in and receive a clear message

    [Fact]
    public async Task CompanyLogin_WhenCompanyIsSuspended_ThrowsInvalidCredentialsException_WithClearMessage()
    {
        // Arrange
        var tenant = new Tenant
        {
            TenantId = "TNT-SUSPENDED-1",
            CompanyName = "Suspended Corp",
            BusinessEmail = "suspended@corp.com",
            PasswordHash = "$2a$11$mockedHash",
            Status = "Suspended" // Suspended account!
        };

        _mockTenantRepo.Setup(r => r.GetTenantByEmailAsync("suspended@corp.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(tenant);
        _mockPasswordHasher.Setup(p => p.VerifyPassword("password123", "$2a$11$mockedHash"))
            .Returns(true);

        var loginDto = new CompanyLoginRequestDto
        {
            BusinessEmail = "suspended@corp.com",
            Password = "password123"
        };

        // Act & Assert
        var act = () => _companyAuthService.LoginCompanyAsync(loginDto);
        var exception = await act.Should().ThrowAsync<InvalidCredentialsException>();
        exception.WithMessage("Account is suspended. Please contact platform support.");
    }

    [Fact]
    public async Task CompanyLogin_WhenStaffMemberBelongsToSuspendedTenant_ThrowsInvalidCredentialsException_WithClearMessage()
    {
        // Arrange
        var staff = new CompanyUser
        {
            UserId = "USR-STAFF-1",
            TenantId = "TNT-SUSPENDED-1",
            Email = "staff@corp.com",
            PasswordHash = "$2a$11$mockedHash",
            Status = "Active"
        };

        var tenant = new Tenant
        {
            TenantId = "TNT-SUSPENDED-1",
            CompanyName = "Suspended Parent Corp",
            Status = "Suspended" // Parent tenant is suspended!
        };

        _mockTenantRepo.Setup(r => r.GetTenantByEmailAsync("staff@corp.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync((Tenant?)null);
        _mockTenantRepo.Setup(r => r.GetStaffUserByEmailAsync("staff@corp.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(staff);
        _mockTenantRepo.Setup(r => r.GetTenantByIdAsync("TNT-SUSPENDED-1", It.IsAny<CancellationToken>()))
            .ReturnsAsync(tenant);
        _mockPasswordHasher.Setup(p => p.VerifyPassword("password123", "$2a$11$mockedHash"))
            .Returns(true);

        var loginDto = new CompanyLoginRequestDto
        {
            BusinessEmail = "staff@corp.com",
            Password = "password123"
        };

        // Act & Assert
        var act = () => _companyAuthService.LoginCompanyAsync(loginDto);
        var exception = await act.Should().ThrowAsync<InvalidCredentialsException>();
        exception.WithMessage("Account is suspended. Please contact platform support.");
    }

    [Fact]
    public async Task DriverLogin_WhenDriverIsSuspended_ThrowsInvalidCredentialsException_WithClearMessage()
    {
        // Arrange
        var driver = new Driver
        {
            DriverId = "DRV-SUSPENDED-1",
            Email = "driver.suspended@test.com",
            PasswordHash = "$2a$11$mockedHash",
            Status = "Suspended" // Suspended driver!
        };

        _mockDriverRepo.Setup(r => r.GetDriverByEmailAsync("driver.suspended@test.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(driver);
        _mockPasswordHasher.Setup(p => p.VerifyPassword("password123", "$2a$11$mockedHash"))
            .Returns(true);

        var loginDto = new DriverLoginRequestDto
        {
            Email = "driver.suspended@test.com",
            Password = "password123"
        };

        // Act & Assert
        var act = () => _driverAuthService.LoginDriverAsync(loginDto);
        var exception = await act.Should().ThrowAsync<InvalidCredentialsException>();
        exception.WithMessage("Account is suspended. Please contact platform support.");
    }

    [Fact]
    public async Task SessionRefresh_WhenCompanyIsSuspended_ThrowsSecurityTokenException_WithClearMessage()
    {
        // Arrange
        var sessionLogger = new Mock<ILogger<SessionService>>();
        var sessionService = new SessionService(
            _mockRefreshTokenRepo.Object,
            _mockBlacklistService.Object,
            _mockJwtTokenService.Object,
            _mockTenantRepo.Object,
            _mockDriverRepo.Object,
            sessionLogger.Object);

        const string refreshToken = "RT-company-token";
        var tokenRecord = new RefreshToken
        {
            TokenId = "TOK-1",
            Token = refreshToken,
            UserId = "TNT-SUSPENDED-1",
            UserType = "Tenant",
            Role = AppRoles.CompanyAdmin,
            ExpiresAt = DateTime.UtcNow.AddDays(2),
            IsRevoked = false
        };

        var tenant = new Tenant
        {
            TenantId = "TNT-SUSPENDED-1",
            CompanyName = "Suspended Corp",
            Status = "Suspended"
        };

        _mockRefreshTokenRepo.Setup(r => r.GetRefreshTokenAsync(refreshToken, It.IsAny<CancellationToken>()))
            .ReturnsAsync(tokenRecord);
        _mockTenantRepo.Setup(r => r.GetTenantByIdAsync("TNT-SUSPENDED-1", It.IsAny<CancellationToken>()))
            .ReturnsAsync(tenant);

        // Act & Assert
        var act = () => sessionService.RefreshSessionAsync(refreshToken);
        var exception = await act.Should().ThrowAsync<SecurityTokenException>();
        exception.WithMessage("Account is suspended. Please contact platform support.");
    }

    [Fact]
    public async Task SessionRefresh_WhenDriverIsSuspended_ThrowsSecurityTokenException_WithClearMessage()
    {
        // Arrange
        var sessionLogger = new Mock<ILogger<SessionService>>();
        var sessionService = new SessionService(
            _mockRefreshTokenRepo.Object,
            _mockBlacklistService.Object,
            _mockJwtTokenService.Object,
            _mockTenantRepo.Object,
            _mockDriverRepo.Object,
            sessionLogger.Object);

        const string refreshToken = "RT-driver-token";
        var tokenRecord = new RefreshToken
        {
            TokenId = "TOK-2",
            Token = refreshToken,
            UserId = "DRV-SUSPENDED-1",
            UserType = "Driver",
            Role = AppRoles.Driver,
            ExpiresAt = DateTime.UtcNow.AddDays(2),
            IsRevoked = false
        };

        var driver = new Driver
        {
            DriverId = "DRV-SUSPENDED-1",
            Name = "Suspended Driver",
            Status = "Suspended"
        };

        _mockRefreshTokenRepo.Setup(r => r.GetRefreshTokenAsync(refreshToken, It.IsAny<CancellationToken>()))
            .ReturnsAsync(tokenRecord);
        _mockDriverRepo.Setup(d => d.GetDriverByIdAsync("DRV-SUSPENDED-1", It.IsAny<CancellationToken>()))
            .ReturnsAsync(driver);

        // Act & Assert
        var act = () => sessionService.RefreshSessionAsync(refreshToken);
        var exception = await act.Should().ThrowAsync<SecurityTokenException>();
        exception.WithMessage("Account is suspended. Please contact platform support.");
    }

    #endregion

    #region Acceptance Criterion 3: Platform admin can reactivate a suspended account

    [Fact]
    public async Task ReactivateCompany_WhenCalledByPlatformAdmin_UpdatesStatusToActive_AndRecordsAudit()
    {
        // Arrange
        const string tenantId = "TNT-COMP-002";
        var tenant = new Tenant
        {
            TenantId = tenantId,
            CompanyName = "Beta Energy",
            Status = "Suspended" // Initially suspended
        };

        _mockTenantRepo.Setup(r => r.GetTenantByIdAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(tenant);
        _mockTenantRepo.Setup(r => r.UpdateTenantStatusAsync(tenantId, "Active", It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        // Act
        var response = await _accountManagementService.ReactivateCompanyAsync(
            tenantId, "Payment dispute resolved", "admin@evnexus.com");

        // Assert
        response.Should().NotBeNull();
        response.AccountId.Should().Be(tenantId);
        response.AccountType.Should().Be("Company");
        response.Status.Should().Be("Active");
        response.PreviousStatus.Should().Be("Suspended");
        response.Action.Should().Be("Reactivate");
        response.Reason.Should().Be("Payment dispute resolved");
        response.PerformedBy.Should().Be("admin@evnexus.com");
        response.Timestamp.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));

        // Verify status update in database
        _mockTenantRepo.Verify(r => r.UpdateTenantStatusAsync(tenantId, "Active", It.IsAny<CancellationToken>()), Times.Once);

        // Verify audit log entry is recorded with timestamp
        _mockAuditRepo.Verify(r => r.RecordStatusAuditAsync(
            It.Is<AccountStatusAudit>(a =>
                a.AccountId == tenantId &&
                a.AccountType == "Company" &&
                a.Action == "Reactivate" &&
                a.PreviousStatus == "Suspended" &&
                a.NewStatus == "Active"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ReactivateDriver_WhenCalledByPlatformAdmin_UpdatesStatusToActive_AndRecordsAudit()
    {
        // Arrange
        const string driverId = "DRV-1003";
        var driver = new Driver
        {
            DriverId = driverId,
            Name = "Bob Driver",
            Status = "Suspended" // Initially suspended
        };

        _mockDriverRepo.Setup(r => r.GetDriverByIdAsync(driverId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(driver);
        _mockDriverRepo.Setup(r => r.UpdateDriverStatusAsync(driverId, "Active", It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        // Act
        var response = await _accountManagementService.ReactivateDriverAsync(
            driverId, "Identity re-verified", "admin@evnexus.com");

        // Assert
        response.Should().NotBeNull();
        response.AccountId.Should().Be(driverId);
        response.AccountType.Should().Be("Driver");
        response.Status.Should().Be("Active");
        response.PreviousStatus.Should().Be("Suspended");
        response.Action.Should().Be("Reactivate");
        response.Reason.Should().Be("Identity re-verified");

        _mockDriverRepo.Verify(r => r.UpdateDriverStatusAsync(driverId, "Active", It.IsAny<CancellationToken>()), Times.Once);
        _mockAuditRepo.Verify(r => r.RecordStatusAuditAsync(
            It.Is<AccountStatusAudit>(a => a.AccountId == driverId && a.Action == "Reactivate" && a.NewStatus == "Active"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task CompanyLogin_AfterReactivation_Succeeds()
    {
        // Arrange
        var tenant = new Tenant
        {
            TenantId = "TNT-REACTIVATED-1",
            CompanyName = "Reactivated Corp",
            BusinessEmail = "reactivated@corp.com",
            PasswordHash = "$2a$11$mockedHash",
            Status = "Active", // Account is Active after reactivation!
            Role = AppRoles.CompanyAdmin
        };

        _mockTenantRepo.Setup(r => r.GetTenantByEmailAsync("reactivated@corp.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(tenant);
        _mockPasswordHasher.Setup(p => p.VerifyPassword("password123", "$2a$11$mockedHash"))
            .Returns(true);
        _mockJwtTokenService.Setup(j => j.GenerateToken(tenant))
            .Returns(("valid.jwt.token", 3600));

        var loginDto = new CompanyLoginRequestDto
        {
            BusinessEmail = "reactivated@corp.com",
            Password = "password123"
        };

        // Act
        var response = await _companyAuthService.LoginCompanyAsync(loginDto);

        // Assert
        response.Should().NotBeNull();
        response.AccessToken.Should().Be("valid.jwt.token");
        response.CompanyName.Should().Be("Reactivated Corp");
    }

    [Fact]
    public async Task DriverLogin_AfterReactivation_Succeeds()
    {
        // Arrange
        var driver = new Driver
        {
            DriverId = "DRV-REACTIVATED-1",
            Name = "Reactivated Driver",
            Email = "reactivated.driver@test.com",
            PasswordHash = "$2a$11$mockedHash",
            Status = "Active", // Account is Active after reactivation!
            Role = AppRoles.Driver
        };

        _mockDriverRepo.Setup(r => r.GetDriverByEmailAsync("reactivated.driver@test.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(driver);
        _mockPasswordHasher.Setup(p => p.VerifyPassword("password123", "$2a$11$mockedHash"))
            .Returns(true);
        _mockJwtTokenService.Setup(j => j.GenerateDriverToken(driver))
            .Returns(("valid.driver.jwt.token", 3600));

        var loginDto = new DriverLoginRequestDto
        {
            Email = "reactivated.driver@test.com",
            Password = "password123"
        };

        // Act
        var response = await _driverAuthService.LoginDriverAsync(loginDto);

        // Assert
        response.Should().NotBeNull();
        response.AccessToken.Should().Be("valid.driver.jwt.token");
        response.Name.Should().Be("Reactivated Driver");
    }

    #endregion

    #region Acceptance Criterion 4: Suspension/reactivation actions are recorded with a timestamp

    [Fact]
    public async Task AccountManagementService_SequenceOfSuspendAndReactivate_RecordsDistinctTimestampsAndActions()
    {
        // Arrange
        const string tenantId = "TNT-AUDIT-CYCLE";
        var tenant = new Tenant
        {
            TenantId = tenantId,
            CompanyName = "Audit Cycle Corp",
            Status = "Active"
        };

        _mockTenantRepo.Setup(r => r.GetTenantByIdAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(tenant);

        var recordedAudits = new List<AccountStatusAudit>();
        _mockAuditRepo.Setup(r => r.RecordStatusAuditAsync(It.IsAny<AccountStatusAudit>(), It.IsAny<CancellationToken>()))
            .Callback<AccountStatusAudit, CancellationToken>((a, _) => recordedAudits.Add(a))
            .Returns(Task.CompletedTask);

        // Act 1: Suspend
        await _accountManagementService.SuspendCompanyAsync(
            tenantId, "Billing investigation", "admin1@evnexus.com");

        // Simulate tenant status change
        tenant.Status = "Suspended";

        // Act 2: Reactivate
        await _accountManagementService.ReactivateCompanyAsync(
            tenantId, "Investigation cleared", "admin2@evnexus.com");

        // Assert
        recordedAudits.Should().HaveCount(2);

        var firstAudit = recordedAudits[0];
        firstAudit.Action.Should().Be("Suspend");
        firstAudit.PreviousStatus.Should().Be("Active");
        firstAudit.NewStatus.Should().Be("Suspended");
        firstAudit.Reason.Should().Be("Billing investigation");
        firstAudit.PerformedBy.Should().Be("admin1@evnexus.com");
        firstAudit.Timestamp.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));

        var secondAudit = recordedAudits[1];
        secondAudit.Action.Should().Be("Reactivate");
        secondAudit.PreviousStatus.Should().Be("Suspended");
        secondAudit.NewStatus.Should().Be("Active");
        secondAudit.Reason.Should().Be("Investigation cleared");
        secondAudit.PerformedBy.Should().Be("admin2@evnexus.com");
        secondAudit.Timestamp.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public async Task PlatformAdminController_GetAuditHistory_ReturnsAuditListWithTimestamps()
    {
        // Arrange
        var mockMgmt = new Mock<IAccountManagementService>();
        var controller = new PlatformAdminController(mockMgmt.Object, _mockControllerLogger.Object);

        var auditTime1 = DateTime.UtcNow.AddHours(-2);
        var auditTime2 = DateTime.UtcNow.AddMinutes(-30);

        var audits = new List<AccountStatusAuditDto>
        {
            new()
            {
                AuditId = "AUD-2",
                AccountId = "TNT-101",
                AccountType = "Company",
                Action = "Reactivate",
                PreviousStatus = "Suspended",
                NewStatus = "Active",
                Reason = "Resolution",
                PerformedBy = "admin@evnexus.com",
                Timestamp = auditTime2
            },
            new()
            {
                AuditId = "AUD-1",
                AccountId = "TNT-101",
                AccountType = "Company",
                Action = "Suspend",
                PreviousStatus = "Active",
                NewStatus = "Suspended",
                Reason = "Investigation",
                PerformedBy = "admin@evnexus.com",
                Timestamp = auditTime1
            }
        };

        mockMgmt.Setup(m => m.GetAccountAuditHistoryAsync("TNT-101", It.IsAny<CancellationToken>()))
            .ReturnsAsync(audits);

        // Act
        var result = await controller.GetAccountAuditHistory("TNT-101", CancellationToken.None);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var apiResponse = okResult.Value.Should().BeOfType<ApiResponse<IReadOnlyList<AccountStatusAuditDto>>>().Subject;
        apiResponse.Success.Should().BeTrue();
        apiResponse.Data.Should().HaveCount(2);
        apiResponse.Data![0].Action.Should().Be("Reactivate");
        apiResponse.Data[0].Timestamp.Should().Be(auditTime2);
        apiResponse.Data[1].Action.Should().Be("Suspend");
        apiResponse.Data[1].Timestamp.Should().Be(auditTime1);
    }

    #endregion
}
