using System.Security.Claims;
using EVNexus.AuthService.Attributes;
using EVNexus.AuthService.Controllers;
using EVNexus.AuthService.Data;
using EVNexus.AuthService.DTOs;
using EVNexus.AuthService.Middleware;
using EVNexus.AuthService.Models;
using EVNexus.AuthService.Security;
using EVNexus.AuthService.Services;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace EVNexus.AuthService.Tests;

public class CompanyApprovalWorkflowTests
{
    private readonly Mock<ITenantRepository> _mockTenantRepo;
    private readonly Mock<IDriverRepository> _mockDriverRepo;
    private readonly Mock<IAccountAuditRepository> _mockAuditRepo;
    private readonly Mock<IRefreshTokenRepository> _mockRefreshTokenRepo;
    private readonly Mock<IStationRepository> _mockStationRepo;
    private readonly Mock<ITenantContext> _mockTenantContext;
    private readonly Mock<IPasswordHasher> _mockPasswordHasher;
    private readonly Mock<IJwtTokenService> _mockJwtTokenService;
    private readonly Mock<ITokenBlacklistService> _mockBlacklistService;
    private readonly Mock<ILogger<AccountManagementService>> _mockAccountMgmtLogger;
    private readonly Mock<ILogger<PlatformAdminController>> _mockAdminControllerLogger;
    private readonly Mock<ILogger<CompanyDataController>> _mockCompanyDataLogger;
    private readonly Mock<ILogger<CompanyAuthService>> _mockCompanyAuthLogger;
    private readonly Mock<ILogger<RoleAuthorizationMiddleware>> _mockMiddlewareLogger;
    private readonly Mock<ILogger<StatusNotificationService>> _mockNotifLogger;
    private readonly StatusNotificationService _statusNotificationService;
    private readonly AccountManagementService _accountManagementService;
    private readonly CompanyAuthService _companyAuthService;

    public CompanyApprovalWorkflowTests()
    {
        _mockTenantRepo = new Mock<ITenantRepository>();
        _mockDriverRepo = new Mock<IDriverRepository>();
        _mockAuditRepo = new Mock<IAccountAuditRepository>();
        _mockRefreshTokenRepo = new Mock<IRefreshTokenRepository>();
        _mockStationRepo = new Mock<IStationRepository>();
        _mockTenantContext = new Mock<ITenantContext>();
        _mockPasswordHasher = new Mock<IPasswordHasher>();
        _mockJwtTokenService = new Mock<IJwtTokenService>();
        _mockBlacklistService = new Mock<ITokenBlacklistService>();
        _mockAccountMgmtLogger = new Mock<ILogger<AccountManagementService>>();
        _mockAdminControllerLogger = new Mock<ILogger<PlatformAdminController>>();
        _mockCompanyDataLogger = new Mock<ILogger<CompanyDataController>>();
        _mockCompanyAuthLogger = new Mock<ILogger<CompanyAuthService>>();
        _mockMiddlewareLogger = new Mock<ILogger<RoleAuthorizationMiddleware>>();
        _mockNotifLogger = new Mock<ILogger<StatusNotificationService>>();

        _statusNotificationService = new StatusNotificationService(_mockNotifLogger.Object);

        _accountManagementService = new AccountManagementService(
            _mockTenantRepo.Object,
            _mockDriverRepo.Object,
            _mockAuditRepo.Object,
            _mockRefreshTokenRepo.Object,
            _mockAccountMgmtLogger.Object,
            _statusNotificationService);

        _companyAuthService = new CompanyAuthService(
            _mockTenantRepo.Object,
            _mockPasswordHasher.Object,
            _mockJwtTokenService.Object,
            _mockCompanyAuthLogger.Object);
    }

    #region Acceptance Criterion 1: New company accounts default to 'pending' status after registration

    [Fact]
    public async Task RegisterCompany_SetsDefaultStatusToPending()
    {
        // Arrange
        var request = new CompanyRegisterRequestDto
        {
            CompanyName = "SolarCharge Networks Ltd",
            RegistrationNumber = "SCN-2026-001",
            BusinessEmail = "contact@solarcharge.com",
            Phone = "+1-555-0987",
            Address = "450 Sun Boulevard, Phoenix, AZ",
            Password = "SecurePassword123!"
        };

        _mockTenantRepo.Setup(r => r.IsEmailRegisteredAsync(request.BusinessEmail, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        _mockTenantRepo.Setup(r => r.IsRegistrationNumberRegisteredAsync(request.RegistrationNumber, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        _mockPasswordHasher.Setup(p => p.HashPassword(request.Password))
            .Returns("$2a$11$mockedHashedPassword");

        Tenant? persistedTenant = null;
        _mockTenantRepo.Setup(r => r.CreateTenantAsync(It.IsAny<Tenant>(), It.IsAny<CancellationToken>()))
            .Callback<Tenant, CancellationToken>((t, _) => persistedTenant = t)
            .ReturnsAsync((Tenant t, CancellationToken _) => t);

        // Act
        var response = await _companyAuthService.RegisterCompanyAsync(request);

        // Assert
        response.Should().NotBeNull();
        response.TenantId.Should().StartWith("TNT-");

        persistedTenant.Should().NotBeNull();
        // AC 1: New company accounts default to 'pending' status after registration
        persistedTenant!.Status.Should().Be("Pending");
        persistedTenant.IsEmailVerified.Should().BeFalse();
        persistedTenant.Role.Should().Be("CompanyAdmin");
    }

    #endregion

    #region Acceptance Criterion 2: Platform admin can approve or reject a pending company

    [Fact]
    public async Task ApproveCompany_WhenPending_UpdatesStatusToActive_AndRecordsAudit()
    {
        // Arrange
        const string tenantId = "TNT-PENDING-001";
        var tenant = new Tenant
        {
            TenantId = tenantId,
            CompanyName = "VoltStream Mobility",
            BusinessEmail = "admin@voltstream.com",
            Status = "Pending"
        };

        _mockTenantRepo.Setup(r => r.GetTenantByIdAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(tenant);
        _mockTenantRepo.Setup(r => r.UpdateTenantStatusAsync(tenantId, "Active", It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        // Act
        var response = await _accountManagementService.ApproveCompanyAsync(
            tenantId, "Verified business tax document", "superadmin@evnexus.com");

        // Assert
        response.Should().NotBeNull();
        response.TenantId.Should().Be(tenantId);
        response.Status.Should().Be("Active");
        response.PreviousStatus.Should().Be("Pending");
        response.Action.Should().Be("Approve");
        response.PerformedBy.Should().Be("superadmin@evnexus.com");
        response.NotificationSent.Should().BeTrue();

        _mockTenantRepo.Verify(r => r.UpdateTenantStatusAsync(tenantId, "Active", It.IsAny<CancellationToken>()), Times.Once);
        _mockAuditRepo.Verify(r => r.RecordStatusAuditAsync(
            It.Is<AccountStatusAudit>(a => a.AccountId == tenantId && a.Action == "Approve" && a.NewStatus == "Active"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RejectCompany_WhenPending_UpdatesStatusToRejected_AndRevokesTokens()
    {
        // Arrange
        const string tenantId = "TNT-PENDING-002";
        var tenant = new Tenant
        {
            TenantId = tenantId,
            CompanyName = "Bogus Charging LLC",
            BusinessEmail = "contact@bogus.com",
            Status = "Pending"
        };

        _mockTenantRepo.Setup(r => r.GetTenantByIdAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(tenant);
        _mockTenantRepo.Setup(r => r.UpdateTenantStatusAsync(tenantId, "Rejected", It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        // Act
        var response = await _accountManagementService.RejectCompanyAsync(
            tenantId, "Invalid business license provided", "superadmin@evnexus.com");

        // Assert
        response.Should().NotBeNull();
        response.TenantId.Should().Be(tenantId);
        response.Status.Should().Be("Rejected");
        response.PreviousStatus.Should().Be("Pending");
        response.Action.Should().Be("Reject");
        response.Reason.Should().Be("Invalid business license provided");

        _mockTenantRepo.Verify(r => r.UpdateTenantStatusAsync(tenantId, "Rejected", It.IsAny<CancellationToken>()), Times.Once);
        _mockRefreshTokenRepo.Verify(r => r.RevokeAllUserTokensAsync(tenantId, It.IsAny<CancellationToken>()), Times.Once);
        _mockAuditRepo.Verify(r => r.RecordStatusAuditAsync(
            It.Is<AccountStatusAudit>(a => a.AccountId == tenantId && a.Action == "Reject" && a.NewStatus == "Rejected"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task PlatformAdminController_ApproveCompany_Returns200WithApprovedDetails()
    {
        // Arrange
        var mockMgmt = new Mock<IAccountManagementService>();
        var controller = new PlatformAdminController(mockMgmt.Object, _mockAdminControllerLogger.Object, _statusNotificationService);

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

        var expectedDto = new CompanyApprovalResponseDto
        {
            TenantId = "TNT-101",
            CompanyName = "SolarCharge",
            Status = "Active",
            PreviousStatus = "Pending",
            Action = "Approve",
            PerformedBy = "platform_admin@evnexus.com",
            NotificationSent = true,
            Message = "Company account 'SolarCharge' has been approved successfully."
        };

        mockMgmt.Setup(m => m.ApproveCompanyAsync("TNT-101", "Looks good", "platform_admin@evnexus.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedDto);

        // Act
        var result = await controller.ApproveCompany("TNT-101", new ApproveCompanyRequestDto { Notes = "Looks good" }, CancellationToken.None);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var apiResponse = okResult.Value.Should().BeOfType<ApiResponse<CompanyApprovalResponseDto>>().Subject;
        apiResponse.Success.Should().BeTrue();
        apiResponse.Data!.Status.Should().Be("Active");
        apiResponse.Data.Action.Should().Be("Approve");
    }

    [Fact]
    public async Task PlatformAdminController_RejectCompany_Returns200WithRejectedDetails()
    {
        // Arrange
        var mockMgmt = new Mock<IAccountManagementService>();
        var controller = new PlatformAdminController(mockMgmt.Object, _mockAdminControllerLogger.Object, _statusNotificationService);

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

        var expectedDto = new CompanyApprovalResponseDto
        {
            TenantId = "TNT-102",
            CompanyName = "Reject Corp",
            Status = "Rejected",
            PreviousStatus = "Pending",
            Action = "Reject",
            Reason = "Unverifiable tax ID",
            PerformedBy = "platform_admin@evnexus.com",
            NotificationSent = true,
            Message = "Company registration for 'Reject Corp' has been rejected."
        };

        mockMgmt.Setup(m => m.RejectCompanyAsync("TNT-102", "Unverifiable tax ID", "platform_admin@evnexus.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedDto);

        // Act
        var result = await controller.RejectCompany("TNT-102", new RejectCompanyRequestDto { Reason = "Unverifiable tax ID" }, CancellationToken.None);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var apiResponse = okResult.Value.Should().BeOfType<ApiResponse<CompanyApprovalResponseDto>>().Subject;
        apiResponse.Success.Should().BeTrue();
        apiResponse.Data!.Status.Should().Be("Rejected");
        apiResponse.Data.Reason.Should().Be("Unverifiable tax ID");
    }

    [Fact]
    public async Task NonAdminCaller_WhenCallingApproveOrReject_Returns403Forbidden()
    {
        // Arrange
        var context = new DefaultHttpContext();
        context.Request.Headers.Authorization = "Bearer company.admin.token";

        // Caller has 'CompanyAdmin' role, NOT 'PlatformAdmin'
        var claims = new List<Claim>
        {
            new(ClaimTypes.Role, AppRoles.CompanyAdmin),
            new(ClaimTypes.NameIdentifier, "TNT-101")
        };
        context.User = new ClaimsPrincipal(new ClaimsIdentity(claims, "Bearer"));

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

    #endregion

    #region Acceptance Criterion 3: Pending companies cannot create charging stations until approved

    [Fact]
    public async Task CreateStation_WhenCompanyIsPending_Returns403ForbiddenWithClearMessage()
    {
        // Arrange
        const string tenantId = "TNT-PENDING-999";
        var controller = new CompanyDataController(
            _mockStationRepo.Object,
            _mockTenantContext.Object,
            _mockCompanyDataLogger.Object,
            _companyAuthService,
            _mockTenantRepo.Object);

        var claims = new List<Claim>
        {
            new(ClaimTypes.Role, AppRoles.CompanyAdmin),
            new("tenant_id", tenantId)
        };
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(claims, "Bearer"))
            }
        };

        var pendingTenant = new Tenant
        {
            TenantId = tenantId,
            CompanyName = "Unapproved Charging Co",
            Status = "Pending" // PENDING APPROVAL!
        };

        _mockTenantRepo.Setup(r => r.GetTenantByIdAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(pendingTenant);

        var request = new CreateStationRequestDto
        {
            Name = "Downtown Supercharger",
            Location = "123 Main St",
            Latitude = 37.7749m,
            Longitude = -122.4194m,
            TotalPorts = 4
        };

        // Act
        var result = await controller.CreateStation(request, CancellationToken.None);

        // Assert - AC 3: Pending companies cannot create charging stations until approved
        var objResult = result.Should().BeOfType<ObjectResult>().Subject;
        objResult.StatusCode.Should().Be(StatusCodes.Status403Forbidden);

        var response = objResult.Value.Should().BeOfType<ApiResponse<object>>().Subject;
        response.Success.Should().BeFalse();
        response.Message.Should().Contain("pending approval");
        response.Message.Should().Contain("cannot create charging stations until your account has been approved");

        // Station must NOT be created in repository
        _mockStationRepo.Verify(r => r.CreateStationAsync(It.IsAny<Station>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task CreateStation_WhenCompanyIsApproved_SuccessfullyCreatesStation()
    {
        // Arrange
        const string tenantId = "TNT-APPROVED-100";
        var controller = new CompanyDataController(
            _mockStationRepo.Object,
            _mockTenantContext.Object,
            _mockCompanyDataLogger.Object,
            _companyAuthService,
            _mockTenantRepo.Object);

        var claims = new List<Claim>
        {
            new(ClaimTypes.Role, AppRoles.CompanyAdmin),
            new("tenant_id", tenantId)
        };
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(claims, "Bearer"))
            }
        };

        var approvedTenant = new Tenant
        {
            TenantId = tenantId,
            CompanyName = "Approved Charging Co",
            Status = "Active" // ACTIVE / APPROVED!
        };

        _mockTenantRepo.Setup(r => r.GetTenantByIdAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(approvedTenant);

        var request = new CreateStationRequestDto
        {
            Name = "Metro Fast Charger",
            Location = "500 Market St",
            Latitude = 37.789m,
            Longitude = -122.401m,
            TotalPorts = 6
        };

        var createdStation = new Station
        {
            StationId = "STN-NEW-1",
            TenantId = tenantId,
            Name = request.Name,
            Location = request.Location,
            Latitude = request.Latitude,
            Longitude = request.Longitude,
            TotalPorts = request.TotalPorts,
            Status = "Active"
        };

        _mockStationRepo.Setup(r => r.CreateStationAsync(It.IsAny<Station>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(createdStation);

        // Act
        var result = await controller.CreateStation(request, CancellationToken.None);

        // Assert
        var objResult = result.Should().BeOfType<ObjectResult>().Subject;
        objResult.StatusCode.Should().Be(StatusCodes.Status201Created);

        var response = objResult.Value.Should().BeOfType<ApiResponse<StationResponseDto>>().Subject;
        response.Success.Should().BeTrue();
        response.Data!.Name.Should().Be("Metro Fast Charger");
        response.Data.TenantId.Should().Be(tenantId);
    }

    #endregion

    #region Acceptance Criterion 4: Company receives a status notification (simulated) on approval/rejection

    [Fact]
    public async Task ApproveCompany_DispatchesSimulatedApprovalNotificationToBusinessEmail()
    {
        // Arrange
        const string tenantId = "TNT-NOTIF-APP";
        var tenant = new Tenant
        {
            TenantId = tenantId,
            CompanyName = "CleanDrive Mobility",
            BusinessEmail = "hello@cleandrive.com",
            Status = "Pending"
        };

        _mockTenantRepo.Setup(r => r.GetTenantByIdAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(tenant);

        // Act
        var response = await _accountManagementService.ApproveCompanyAsync(
            tenantId, "All KYC documents verified", "admin@evnexus.com");

        // Assert
        response.NotificationSent.Should().BeTrue();
        response.NotificationSummary.Should().Contain("CleanDrive Mobility");

        var sentNotifications = _statusNotificationService.GetSentNotifications(tenantId);
        sentNotifications.Should().HaveCount(1);
        sentNotifications[0].Status.Should().Be("Approved");
        sentNotifications[0].RecipientEmail.Should().Be("hello@cleandrive.com");
        sentNotifications[0].Subject.Should().Contain("Account Approved");
        sentNotifications[0].Content.Should().Contain("All KYC documents verified");
    }

    [Fact]
    public async Task RejectCompany_DispatchesSimulatedRejectionNotificationWithReasonToBusinessEmail()
    {
        // Arrange
        const string tenantId = "TNT-NOTIF-REJ";
        var tenant = new Tenant
        {
            TenantId = tenantId,
            CompanyName = "Questionable Power Co",
            BusinessEmail = "contact@questionable.com",
            Status = "Pending"
        };

        _mockTenantRepo.Setup(r => r.GetTenantByIdAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(tenant);

        // Act
        var response = await _accountManagementService.RejectCompanyAsync(
            tenantId, "Business registration number could not be verified with authorities.", "admin@evnexus.com");

        // Assert
        response.NotificationSent.Should().BeTrue();

        var sentNotifications = _statusNotificationService.GetSentNotifications(tenantId);
        sentNotifications.Should().HaveCount(1);
        sentNotifications[0].Status.Should().Be("Rejected");
        sentNotifications[0].RecipientEmail.Should().Be("contact@questionable.com");
        sentNotifications[0].Subject.Should().Contain("Account Status Update");
        sentNotifications[0].Content.Should().Contain("Business registration number could not be verified");
    }

    #endregion
}
