using System.ComponentModel.DataAnnotations;
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
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace EVNexus.AuthService.Tests;

public class CompanyStaffManagementTests
{
    private readonly Mock<ITenantRepository> _mockTenantRepo;
    private readonly Mock<IPasswordHasher> _mockPasswordHasher;
    private readonly Mock<IJwtTokenService> _mockJwtTokenService;
    private readonly Mock<ILogger<CompanyAuthService>> _mockAuthLogger;
    private readonly Mock<IStationRepository> _mockStationRepo;
    private readonly Mock<ITenantContext> _mockTenantContext;
    private readonly Mock<ILogger<CompanyDataController>> _mockControllerLogger;
    private readonly Mock<ILogger<RoleAuthorizationMiddleware>> _mockMiddlewareLogger;
    private readonly CompanyAuthService _companyAuthService;

    public CompanyStaffManagementTests()
    {
        _mockTenantRepo = new Mock<ITenantRepository>();
        _mockPasswordHasher = new Mock<IPasswordHasher>();
        _mockJwtTokenService = new Mock<IJwtTokenService>();
        _mockAuthLogger = new Mock<ILogger<CompanyAuthService>>();
        _mockStationRepo = new Mock<IStationRepository>();
        _mockTenantContext = new Mock<ITenantContext>();
        _mockControllerLogger = new Mock<ILogger<CompanyDataController>>();
        _mockMiddlewareLogger = new Mock<ILogger<RoleAuthorizationMiddleware>>();

        _companyAuthService = new CompanyAuthService(
            _mockTenantRepo.Object,
            _mockPasswordHasher.Object,
            _mockJwtTokenService.Object,
            _mockAuthLogger.Object);
    }

    private static Tenant CreateSampleTenant(string tenantId = "TNT-CORP-1001", string email = "admin@greenpulse.com")
    {
        return new Tenant
        {
            TenantId = tenantId,
            CompanyName = "GreenPulse EV",
            RegistrationNumber = "REG-GP-999",
            BusinessEmail = email,
            Phone = "+1-555-0100",
            Address = "100 Clean Energy Way",
            PasswordHash = "hashed_admin_password",
            Role = AppRoles.CompanyAdmin,
            Status = "Active",
            IsEmailVerified = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }

    private static CompanyUser CreateSampleStaff(
        string userId = "STF-2001",
        string tenantId = "TNT-CORP-1001",
        string email = "operator@greenpulse.com",
        string role = AppRoles.Operator,
        string status = "Active")
    {
        return new CompanyUser
        {
            UserId = userId,
            TenantId = tenantId,
            Name = "Jane Operator",
            Email = email,
            Phone = "+1-555-0101",
            PasswordHash = "hashed_staff_password",
            Role = role,
            Status = status,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }

    private CompanyDataController CreateControllerWithTenant(string? tenantId, string role = AppRoles.CompanyAdmin)
    {
        _mockTenantContext.Setup(c => c.TenantId).Returns(tenantId);

        var controller = new CompanyDataController(
            _mockStationRepo.Object,
            _mockTenantContext.Object,
            _mockControllerLogger.Object,
            _companyAuthService);

        var httpContext = new DefaultHttpContext();
        if (!string.IsNullOrWhiteSpace(tenantId))
        {
            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, tenantId),
                new("tenant_id", tenantId),
                new(ClaimTypes.Role, role),
                new("role", role)
            };
            httpContext.User = new ClaimsPrincipal(new ClaimsIdentity(claims, "Bearer"));
        }

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = httpContext
        };

        return controller;
    }

    private static Endpoint CreateEndpointWithRoleMetadata(string[]? requireRoles = null, string? authorizeRoles = null)
    {
        var metadata = new List<object>();

        if (requireRoles != null)
        {
            metadata.Add(new RequireRoleAttribute(requireRoles));
        }

        if (!string.IsNullOrWhiteSpace(authorizeRoles))
        {
            metadata.Add(new AuthorizeAttribute { Roles = authorizeRoles });
        }

        return new Endpoint(
            requestDelegate: (ctx) => Task.CompletedTask,
            metadata: new EndpointMetadataCollection(metadata),
            displayName: "TestStaffEndpoint");
    }

    private static DefaultHttpContext CreateHttpContext(string role, string tenantId = "TNT-CORP-1001")
    {
        var context = new DefaultHttpContext();
        context.Connection.RemoteIpAddress = System.Net.IPAddress.Parse("127.0.0.1");

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, tenantId),
            new("tenant_id", tenantId),
            new(ClaimTypes.Role, role),
            new("role", role)
        };

        var identity = new ClaimsIdentity(claims, "Bearer");
        context.User = new ClaimsPrincipal(identity);
        return context;
    }

    // =========================================================================
    // ACCEPTANCE CRITERION 1: Company admin can create a staff account under their own tenant only
    // =========================================================================

    [Fact]
    public async Task CreateStaffMember_ValidRequest_CreatesUnderCallerTenantOnly()
    {
        // Arrange
        const string callerTenantId = "TNT-CORP-1001";
        var request = new CreateStaffRequestDto
        {
            Name = "John Operator",
            Email = "john.op@greenpulse.com",
            Password = "Password123!",
            Phone = "+1-555-0102",
            Role = AppRoles.Operator
        };

        _mockTenantRepo.Setup(r => r.IsEmailRegisteredAsync(request.Email, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        _mockTenantRepo.Setup(r => r.IsStaffEmailRegisteredAsync(request.Email, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        _mockPasswordHasher.Setup(h => h.HashPassword(request.Password))
            .Returns("hashed_pwd_99");
        _mockTenantRepo.Setup(r => r.CreateStaffUserAsync(It.IsAny<CompanyUser>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((CompanyUser u, CancellationToken ct) => u);

        // Act
        var result = await _companyAuthService.CreateStaffMemberAsync(callerTenantId, request);

        // Assert
        result.Should().NotBeNull();
        result.TenantId.Should().Be(callerTenantId, "staff member must be strictly scoped to caller's tenant");
        result.Email.Should().Be(request.Email.ToLowerInvariant());
        result.Role.Should().Be(AppRoles.Operator);
        result.Status.Should().Be("Active");
        result.UserId.Should().StartWith("STF-");

        _mockTenantRepo.Verify(r => r.CreateStaffUserAsync(
            It.Is<CompanyUser>(u => u.TenantId == callerTenantId && u.Role == AppRoles.Operator && u.Email == request.Email.ToLowerInvariant()),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task CreateStaffMember_AttemptToAssignCompanyAdminRole_FailsWithArgumentException()
    {
        // Arrange
        const string callerTenantId = "TNT-CORP-1001";
        var request = new CreateStaffRequestDto
        {
            Name = "Rogue Admin",
            Email = "rogue@greenpulse.com",
            Password = "Password123!",
            Role = AppRoles.CompanyAdmin
        };

        // Act
        var act = () => _companyAuthService.CreateStaffMemberAsync(callerTenantId, request);

        // Assert
        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*CompanyAdmin*");
    }

    [Fact]
    public async Task CreateStaffMember_DuplicateEmail_FailsWithConflict()
    {
        // Arrange
        const string callerTenantId = "TNT-CORP-1001";
        var request = new CreateStaffRequestDto
        {
            Name = "Duplicate User",
            Email = "existing@greenpulse.com",
            Password = "Password123!",
            Role = AppRoles.Operator
        };

        _mockTenantRepo.Setup(r => r.IsEmailRegisteredAsync(request.Email, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        // Act
        var act = () => _companyAuthService.CreateStaffMemberAsync(callerTenantId, request);

        // Assert
        await act.Should().ThrowAsync<DuplicateEmailException>();
    }

    [Fact]
    public async Task Controller_CreateStaffMember_WhenTenantMissing_Returns403Forbidden()
    {
        // Arrange
        var controller = CreateControllerWithTenant(tenantId: null);
        var request = new CreateStaffRequestDto
        {
            Name = "Test Operator",
            Email = "test@op.com",
            Password = "Password123!"
        };

        // Act
        var actionResult = await controller.CreateStaffMember(request, CancellationToken.None);

        // Assert
        var objectResult = actionResult.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
    }

    [Fact]
    public async Task Controller_CreateStaffMember_WhenValid_Returns201Created()
    {
        // Arrange
        const string tenantId = "TNT-CORP-1001";
        var controller = CreateControllerWithTenant(tenantId);
        var request = new CreateStaffRequestDto
        {
            Name = "Staff User",
            Email = "new.staff@greenpulse.com",
            Password = "Password123!",
            Role = AppRoles.Operator
        };

        _mockTenantRepo.Setup(r => r.IsEmailRegisteredAsync(request.Email, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        _mockTenantRepo.Setup(r => r.IsStaffEmailRegisteredAsync(request.Email, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        _mockPasswordHasher.Setup(h => h.HashPassword(request.Password))
            .Returns("hashed_pwd");
        _mockTenantRepo.Setup(r => r.CreateStaffUserAsync(It.IsAny<CompanyUser>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((CompanyUser u, CancellationToken ct) => u);

        // Act
        var actionResult = await controller.CreateStaffMember(request, CancellationToken.None);

        // Assert
        var objectResult = actionResult.Should().BeOfType<ObjectResult>().Subject;
        objectResult.StatusCode.Should().Be(StatusCodes.Status201Created);
        var response = objectResult.Value.Should().BeOfType<ApiResponse<StaffResponseDto>>().Subject;
        response.Success.Should().BeTrue();
        response.Data!.TenantId.Should().Be(tenantId);
    }

    // =========================================================================
    // ACCEPTANCE CRITERION 2: Staff accounts have restricted permissions (cannot delete company or manage billing)
    // =========================================================================

    [Fact]
    public async Task RoleAuthorizationMiddleware_WhenOperatorCallsDeleteCompany_Returns403Forbidden()
    {
        // Arrange
        var nextInvoked = false;
        RequestDelegate next = (ctx) =>
        {
            nextInvoked = true;
            return Task.CompletedTask;
        };

        var middleware = new RoleAuthorizationMiddleware(next, _mockMiddlewareLogger.Object);
        var context = CreateHttpContext(role: AppRoles.Operator);
        context.Request.Path = "/api/company";
        context.Request.Method = "DELETE";
        context.SetEndpoint(CreateEndpointWithRoleMetadata(requireRoles: new[] { AppRoles.CompanyAdmin }));

        // Act
        await middleware.InvokeAsync(context);

        // Assert
        context.Response.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        nextInvoked.Should().BeFalse();

        _mockMiddlewareLogger.Verify(
            x => x.Log(
                LogLevel.Warning,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, t) => v.ToString()!.Contains("Unauthorized role access attempt") &&
                                             v.ToString()!.Contains(AppRoles.Operator) &&
                                             v.ToString()!.Contains(AppRoles.CompanyAdmin)),
                It.IsAny<Exception>(),
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }

    [Fact]
    public async Task RoleAuthorizationMiddleware_WhenOperatorCallsBillingEndpoint_Returns403Forbidden()
    {
        // Arrange
        var nextInvoked = false;
        RequestDelegate next = (ctx) =>
        {
            nextInvoked = true;
            return Task.CompletedTask;
        };

        var middleware = new RoleAuthorizationMiddleware(next, _mockMiddlewareLogger.Object);
        var context = CreateHttpContext(role: AppRoles.Operator);
        context.Request.Path = "/api/company/billing";
        context.Request.Method = "GET";
        context.SetEndpoint(CreateEndpointWithRoleMetadata(requireRoles: new[] { AppRoles.CompanyAdmin }));

        // Act
        await middleware.InvokeAsync(context);

        // Assert
        context.Response.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        nextInvoked.Should().BeFalse();
    }

    [Fact]
    public async Task RoleAuthorizationMiddleware_WhenOperatorCallsStaffManagement_Returns403Forbidden()
    {
        // Arrange
        var nextInvoked = false;
        RequestDelegate next = (ctx) =>
        {
            nextInvoked = true;
            return Task.CompletedTask;
        };

        var middleware = new RoleAuthorizationMiddleware(next, _mockMiddlewareLogger.Object);
        var context = CreateHttpContext(role: AppRoles.Operator);
        context.Request.Path = "/api/company/staff";
        context.Request.Method = "POST";
        context.SetEndpoint(CreateEndpointWithRoleMetadata(requireRoles: new[] { AppRoles.CompanyAdmin }));

        // Act
        await middleware.InvokeAsync(context);

        // Assert
        context.Response.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        nextInvoked.Should().BeFalse();
    }

    [Fact]
    public async Task RoleAuthorizationMiddleware_WhenCompanyAdminCallsProtectedEndpoints_AllowsRequest()
    {
        // Arrange
        var nextInvoked = false;
        RequestDelegate next = (ctx) =>
        {
            nextInvoked = true;
            return Task.CompletedTask;
        };

        var middleware = new RoleAuthorizationMiddleware(next, _mockMiddlewareLogger.Object);
        var context = CreateHttpContext(role: AppRoles.CompanyAdmin);
        context.Request.Path = "/api/company/billing";
        context.Request.Method = "GET";
        context.SetEndpoint(CreateEndpointWithRoleMetadata(requireRoles: new[] { AppRoles.CompanyAdmin }));

        // Act
        await middleware.InvokeAsync(context);

        // Assert
        nextInvoked.Should().BeTrue();
        context.Response.StatusCode.Should().Be(StatusCodes.Status200OK);
    }

    [Fact]
    public async Task Controller_CompanyAdmin_CanAccessBillingAndManageStaff()
    {
        // Arrange
        const string tenantId = "TNT-CORP-1001";
        var controller = CreateControllerWithTenant(tenantId);
        var tenant = CreateSampleTenant(tenantId);
        _mockTenantRepo.Setup(r => r.GetTenantByIdAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(tenant);
        _mockTenantRepo.Setup(r => r.GetStaffUsersByTenantIdAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<CompanyUser> { CreateSampleStaff(tenantId: tenantId) });

        // Act
        var billingResult = await controller.GetBillingInfo(CancellationToken.None);
        var staffResult = await controller.GetStaffMembers(CancellationToken.None);

        // Assert
        var okBilling = billingResult.Should().BeOfType<OkObjectResult>().Subject;
        var billingData = okBilling.Value.Should().BeOfType<ApiResponse<BillingInfoDto>>().Subject;
        billingData.Data!.TenantId.Should().Be(tenantId);

        var okStaff = staffResult.Should().BeOfType<OkObjectResult>().Subject;
        var staffData = okStaff.Value.Should().BeOfType<ApiResponse<IReadOnlyList<StaffResponseDto>>>().Subject;
        staffData.Data!.Should().HaveCount(1);
    }

    // =========================================================================
    // ACCEPTANCE CRITERION 3: Company admin can deactivate a staff account
    // =========================================================================

    [Fact]
    public async Task DeactivateStaff_ExistingStaffUnderSameTenant_UpdatesStatusToInactive()
    {
        // Arrange
        const string tenantId = "TNT-CORP-1001";
        const string staffUserId = "STF-2001";
        var staff = CreateSampleStaff(staffUserId, tenantId, status: "Active");

        _mockTenantRepo.Setup(r => r.GetStaffUserByIdAsync(staffUserId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(staff);
        _mockTenantRepo.Setup(r => r.UpdateStaffUserStatusAsync(staffUserId, tenantId, "Inactive", It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        // Act
        var result = await _companyAuthService.DeactivateStaffMemberAsync(tenantId, staffUserId);

        // Assert
        result.Should().NotBeNull();
        result.UserId.Should().Be(staffUserId);
        result.Status.Should().Be("Inactive");

        _mockTenantRepo.Verify(r => r.UpdateStaffUserStatusAsync(staffUserId, tenantId, "Inactive", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task DeactivateStaff_BelongingToDifferentTenant_ThrowsKeyNotFoundException()
    {
        // Arrange
        const string callerTenantId = "TNT-CORP-1001";
        const string otherStaffUserId = "STF-9999";

        _mockTenantRepo.Setup(r => r.GetStaffUserByIdAsync(otherStaffUserId, callerTenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((CompanyUser?)null);

        // Act
        var act = () => _companyAuthService.DeactivateStaffMemberAsync(callerTenantId, otherStaffUserId);

        // Assert
        await act.Should().ThrowAsync<KeyNotFoundException>()
            .WithMessage($"*'{otherStaffUserId}' was not found under your company tenant*");
    }

    [Fact]
    public async Task Controller_DeactivateStaff_WhenFound_Returns200WithDeactivatedStatus()
    {
        // Arrange
        const string tenantId = "TNT-CORP-1001";
        const string staffUserId = "STF-2001";
        var controller = CreateControllerWithTenant(tenantId);
        var staff = CreateSampleStaff(staffUserId, tenantId, status: "Active");

        _mockTenantRepo.Setup(r => r.GetStaffUserByIdAsync(staffUserId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(staff);
        _mockTenantRepo.Setup(r => r.UpdateStaffUserStatusAsync(staffUserId, tenantId, "Inactive", It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        // Act
        var actionResult = await controller.DeactivateStaffMember(staffUserId, CancellationToken.None);

        // Assert
        var okResult = actionResult.Should().BeOfType<OkObjectResult>().Subject;
        var response = okResult.Value.Should().BeOfType<ApiResponse<StaffResponseDto>>().Subject;
        response.Success.Should().BeTrue();
        response.Data!.Status.Should().Be("Inactive");
    }

    [Fact]
    public async Task Controller_DeactivateStaff_WhenCrossTenant_Returns404NotFound()
    {
        // Arrange
        const string tenantId = "TNT-CORP-1001";
        const string staffUserId = "STF-OTHER-999";
        var controller = CreateControllerWithTenant(tenantId);

        _mockTenantRepo.Setup(r => r.GetStaffUserByIdAsync(staffUserId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((CompanyUser?)null);

        // Act
        var actionResult = await controller.DeactivateStaffMember(staffUserId, CancellationToken.None);

        // Assert
        actionResult.Should().BeOfType<NotFoundObjectResult>();
    }

    // =========================================================================
    // ACCEPTANCE CRITERION 4: Staff login uses the same Auth login API with the 'operator' role claim
    // =========================================================================

    [Fact]
    public async Task LoginCompany_WithStaffCredentials_IssuesJwtWithOperatorRoleClaim()
    {
        // Arrange
        const string tenantId = "TNT-CORP-1001";
        const string staffEmail = "op@greenpulse.com";
        const string password = "OperatorPassword123!";

        var request = new CompanyLoginRequestDto
        {
            BusinessEmail = staffEmail,
            Password = password
        };

        var tenant = CreateSampleTenant(tenantId);
        var staffUser = CreateSampleStaff("STF-3001", tenantId, staffEmail, role: AppRoles.Operator, status: "Active");

        // Not in tenants table
        _mockTenantRepo.Setup(r => r.GetTenantByEmailAsync(staffEmail, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Tenant?)null);
        // Found in company_users table
        _mockTenantRepo.Setup(r => r.GetStaffUserByEmailAsync(staffEmail, It.IsAny<CancellationToken>()))
            .ReturnsAsync(staffUser);
        _mockPasswordHasher.Setup(h => h.VerifyPassword(password, staffUser.PasswordHash))
            .Returns(true);
        _mockTenantRepo.Setup(r => r.GetTenantByIdAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(tenant);
        _mockJwtTokenService.Setup(j => j.GenerateStaffToken(staffUser, tenant))
            .Returns(("signed_jwt_operator_token", 3600));

        // Act
        var result = await _companyAuthService.LoginCompanyAsync(request);

        // Assert
        result.Should().NotBeNull();
        result.AccessToken.Should().Be("signed_jwt_operator_token");
        result.TenantId.Should().Be(tenantId);
        result.BusinessEmail.Should().Be(staffEmail);
        result.Role.Should().Be(AppRoles.Operator, "staff login must return 'Operator' role claim");
        result.CompanyName.Should().Be(tenant.CompanyName);

        _mockJwtTokenService.Verify(j => j.GenerateStaffToken(staffUser, tenant), Times.Once);
    }

    [Fact]
    public async Task LoginCompany_WhenStaffAccountIsDeactivated_ThrowsInvalidCredentialsException()
    {
        // Arrange
        const string staffEmail = "deactivated.op@greenpulse.com";
        const string password = "Password123!";

        var request = new CompanyLoginRequestDto
        {
            BusinessEmail = staffEmail,
            Password = password
        };

        var staffUser = CreateSampleStaff("STF-3002", "TNT-CORP-1001", staffEmail, status: "Inactive");

        _mockTenantRepo.Setup(r => r.GetTenantByEmailAsync(staffEmail, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Tenant?)null);
        _mockTenantRepo.Setup(r => r.GetStaffUserByEmailAsync(staffEmail, It.IsAny<CancellationToken>()))
            .ReturnsAsync(staffUser);
        _mockPasswordHasher.Setup(h => h.VerifyPassword(password, staffUser.PasswordHash))
            .Returns(true);

        // Act
        var act = () => _companyAuthService.LoginCompanyAsync(request);

        // Assert
        await act.Should().ThrowAsync<InvalidCredentialsException>()
            .WithMessage("*inactive or suspended*");
    }

    [Fact]
    public async Task LoginCompany_WhenStaffSuppliesWrongPassword_ThrowsInvalidCredentialsException()
    {
        // Arrange
        const string staffEmail = "op@greenpulse.com";
        var request = new CompanyLoginRequestDto
        {
            BusinessEmail = staffEmail,
            Password = "WrongPassword!"
        };

        var staffUser = CreateSampleStaff("STF-3003", "TNT-CORP-1001", staffEmail, status: "Active");

        _mockTenantRepo.Setup(r => r.GetTenantByEmailAsync(staffEmail, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Tenant?)null);
        _mockTenantRepo.Setup(r => r.GetStaffUserByEmailAsync(staffEmail, It.IsAny<CancellationToken>()))
            .ReturnsAsync(staffUser);
        _mockPasswordHasher.Setup(h => h.VerifyPassword(request.Password, staffUser.PasswordHash))
            .Returns(false);

        // Act
        var act = () => _companyAuthService.LoginCompanyAsync(request);

        // Assert
        await act.Should().ThrowAsync<InvalidCredentialsException>();
    }

    [Fact]
    public async Task DeleteCompany_WhenCalledByAdmin_DeletesTenantSuccessfully()
    {
        // Arrange
        const string tenantId = "TNT-CORP-1001";
        var tenant = CreateSampleTenant(tenantId);
        _mockTenantRepo.Setup(r => r.GetTenantByIdAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(tenant);
        _mockTenantRepo.Setup(r => r.DeleteTenantAsync(tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        // Act
        var result = await _companyAuthService.DeleteCompanyAsync(tenantId);

        // Assert
        result.Should().BeTrue();
        _mockTenantRepo.Verify(r => r.DeleteTenantAsync(tenantId, It.IsAny<CancellationToken>()), Times.Once);
    }
}
