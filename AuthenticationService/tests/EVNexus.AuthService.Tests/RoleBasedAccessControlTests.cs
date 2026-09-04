using System.Security.Claims;
using System.Text.Json;
using EVNexus.AuthService.Attributes;
using EVNexus.AuthService.Controllers;
using EVNexus.AuthService.Data;
using EVNexus.AuthService.DTOs;
using EVNexus.AuthService.Middleware;
using EVNexus.AuthService.Models;
using EVNexus.AuthService.Security;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace EVNexus.AuthService.Tests;

public class RoleBasedAccessControlTests
{
    private readonly Mock<ILogger<RoleAuthorizationMiddleware>> _mockMiddlewareLogger;
    private readonly Mock<ILogger<DriverDataController>> _mockDriverControllerLogger;
    private readonly Mock<IDriverRepository> _mockDriverRepo;

    public RoleBasedAccessControlTests()
    {
        _mockMiddlewareLogger = new Mock<ILogger<RoleAuthorizationMiddleware>>();
        _mockDriverControllerLogger = new Mock<ILogger<DriverDataController>>();
        _mockDriverRepo = new Mock<IDriverRepository>();
    }

    private static Endpoint CreateEndpointWithRoleMetadata(string[]? requireRoles = null, string? authorizeRoles = null, bool allowAnonymous = false)
    {
        var metadata = new List<object>();

        if (allowAnonymous)
        {
            metadata.Add(new AllowAnonymousAttribute());
        }

        if (requireRoles != null)
        {
            metadata.Add(new RequireRoleAttribute(requireRoles));
        }

        if (!string.IsNullOrWhiteSpace(authorizeRoles))
        {
            metadata.Add(new AuthorizeAttribute { Roles = authorizeRoles });
        }

        var endpointMetadata = new EndpointMetadataCollection(metadata);
        return new Endpoint(
            requestDelegate: (ctx) => Task.CompletedTask,
            metadata: endpointMetadata,
            displayName: "TestEndpoint");
    }

    private static DefaultHttpContext CreateHttpContext(string? role, string callerId = "USER-001", string roleClaimType = "role")
    {
        var context = new DefaultHttpContext();
        context.Connection.RemoteIpAddress = System.Net.IPAddress.Parse("127.0.0.1");

        if (!string.IsNullOrWhiteSpace(role))
        {
            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, callerId),
                new(ClaimTypes.Email, $"{callerId.ToLowerInvariant()}@evnexus.test")
            };

            if (role == AppRoles.Driver)
            {
                claims.Add(new Claim("driver_id", callerId));
            }
            else
            {
                claims.Add(new Claim("tenant_id", callerId));
            }

            if (roleClaimType == "ClaimTypes.Role")
            {
                claims.Add(new Claim(ClaimTypes.Role, role));
            }
            else if (roleClaimType == "both")
            {
                claims.Add(new Claim(ClaimTypes.Role, role));
                claims.Add(new Claim("role", role));
            }
            else
            {
                claims.Add(new Claim("role", role));
            }

            var identity = new ClaimsIdentity(claims, "Bearer");
            context.User = new ClaimsPrincipal(identity);
        }

        return context;
    }

    // =========================================================================
    // ACCEPTANCE CRITERION 1: Company-only endpoints reject driver token with 403
    // =========================================================================

    [Fact]
    public async Task RoleAuthorizationMiddleware_WhenDriverTokenCallsCompanyEndpoint_Returns403Forbidden()
    {
        // Arrange
        var nextInvoked = false;
        RequestDelegate next = (ctx) =>
        {
            nextInvoked = true;
            return Task.CompletedTask;
        };

        var middleware = new RoleAuthorizationMiddleware(next, _mockMiddlewareLogger.Object);
        var context = CreateHttpContext(role: AppRoles.Driver, callerId: "DRV-1234-ABCD");
        context.Request.Path = "/api/company/stations";
        context.Request.Method = "GET";
        context.SetEndpoint(CreateEndpointWithRoleMetadata(requireRoles: new[] { AppRoles.CompanyAdmin }));

        // Act
        await middleware.InvokeAsync(context);

        // Assert
        context.Response.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        nextInvoked.Should().BeFalse();

        // Acceptance Criterion 4: Verify unauthorized access was logged as a warning
        _mockMiddlewareLogger.Verify(
            x => x.Log(
                LogLevel.Warning,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, t) => v.ToString()!.Contains("Unauthorized role access attempt") &&
                                             v.ToString()!.Contains("DRV-1234-ABCD") &&
                                             v.ToString()!.Contains("CompanyAdmin")),
                It.IsAny<Exception>(),
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }

    [Fact]
    public async Task RoleAuthorizationMiddleware_WhenDriverTokenCallsCompanyProfile_Returns403Forbidden()
    {
        // Arrange
        var nextInvoked = false;
        RequestDelegate next = (ctx) =>
        {
            nextInvoked = true;
            return Task.CompletedTask;
        };

        var middleware = new RoleAuthorizationMiddleware(next, _mockMiddlewareLogger.Object);
        var context = CreateHttpContext(role: AppRoles.Driver, callerId: "DRV-5678-EFGH");
        context.Request.Path = "/api/auth/company/profile";
        context.Request.Method = "GET";
        context.SetEndpoint(CreateEndpointWithRoleMetadata(authorizeRoles: AppRoles.CompanyAdmin));

        // Act
        await middleware.InvokeAsync(context);

        // Assert
        context.Response.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        nextInvoked.Should().BeFalse();

        _mockMiddlewareLogger.Verify(
            x => x.Log(
                LogLevel.Warning,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, t) => v.ToString()!.Contains("Unauthorized role access attempt")),
                It.IsAny<Exception>(),
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }

    // =========================================================================
    // ACCEPTANCE CRITERION 2: Driver-only endpoints reject company token with 403
    // =========================================================================

    [Fact]
    public async Task RoleAuthorizationMiddleware_WhenCompanyTokenCallsDriverEndpoint_Returns403Forbidden()
    {
        // Arrange
        var nextInvoked = false;
        RequestDelegate next = (ctx) =>
        {
            nextInvoked = true;
            return Task.CompletedTask;
        };

        var middleware = new RoleAuthorizationMiddleware(next, _mockMiddlewareLogger.Object);
        var context = CreateHttpContext(role: AppRoles.CompanyAdmin, callerId: "TNT-CORP-9999");
        context.Request.Path = "/api/driver/wallet";
        context.Request.Method = "GET";
        context.SetEndpoint(CreateEndpointWithRoleMetadata(requireRoles: new[] { AppRoles.Driver }));

        // Act
        await middleware.InvokeAsync(context);

        // Assert
        context.Response.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        nextInvoked.Should().BeFalse();

        // Acceptance Criterion 4: Verify unauthorized access was logged as a warning
        _mockMiddlewareLogger.Verify(
            x => x.Log(
                LogLevel.Warning,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, t) => v.ToString()!.Contains("Unauthorized role access attempt") &&
                                             v.ToString()!.Contains("TNT-CORP-9999") &&
                                             v.ToString()!.Contains("Driver")),
                It.IsAny<Exception>(),
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }

    [Fact]
    public async Task RoleAuthorizationMiddleware_WhenCompanyTokenCallsDriverProfile_Returns403Forbidden()
    {
        // Arrange
        var nextInvoked = false;
        RequestDelegate next = (ctx) =>
        {
            nextInvoked = true;
            return Task.CompletedTask;
        };

        var middleware = new RoleAuthorizationMiddleware(next, _mockMiddlewareLogger.Object);
        var context = CreateHttpContext(role: AppRoles.CompanyAdmin, callerId: "TNT-CORP-1234");
        context.Request.Path = "/api/auth/driver/profile";
        context.Request.Method = "GET";
        context.SetEndpoint(CreateEndpointWithRoleMetadata(authorizeRoles: AppRoles.Driver));

        // Act
        await middleware.InvokeAsync(context);

        // Assert
        context.Response.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        nextInvoked.Should().BeFalse();
    }

    // =========================================================================
    // ACCEPTANCE CRITERION 3: Reusable across all controllers & positive path
    // =========================================================================

    [Fact]
    public async Task RoleAuthorizationMiddleware_WhenCompanyTokenCallsCompanyEndpoint_AllowsAccess()
    {
        // Arrange
        var nextInvoked = false;
        RequestDelegate next = (ctx) =>
        {
            nextInvoked = true;
            return Task.CompletedTask;
        };

        var middleware = new RoleAuthorizationMiddleware(next, _mockMiddlewareLogger.Object);
        var context = CreateHttpContext(role: AppRoles.CompanyAdmin, callerId: "TNT-CORP-1111", roleClaimType: "both");
        context.Request.Path = "/api/company/stations";
        context.SetEndpoint(CreateEndpointWithRoleMetadata(requireRoles: new[] { AppRoles.CompanyAdmin }));

        // Act
        await middleware.InvokeAsync(context);

        // Assert
        nextInvoked.Should().BeTrue();
        context.Response.StatusCode.Should().Be(StatusCodes.Status200OK);
    }

    [Fact]
    public async Task RoleAuthorizationMiddleware_WhenDriverTokenCallsDriverEndpoint_AllowsAccess()
    {
        // Arrange
        var nextInvoked = false;
        RequestDelegate next = (ctx) =>
        {
            nextInvoked = true;
            return Task.CompletedTask;
        };

        var middleware = new RoleAuthorizationMiddleware(next, _mockMiddlewareLogger.Object);
        var context = CreateHttpContext(role: AppRoles.Driver, callerId: "DRV-1111-2222", roleClaimType: "ClaimTypes.Role");
        context.Request.Path = "/api/driver/wallet";
        context.SetEndpoint(CreateEndpointWithRoleMetadata(requireRoles: new[] { AppRoles.Driver }));

        // Act
        await middleware.InvokeAsync(context);

        // Assert
        nextInvoked.Should().BeTrue();
        context.Response.StatusCode.Should().Be(StatusCodes.Status200OK);
    }

    [Fact]
    public async Task RoleAuthorizationMiddleware_WhenEndpointAllowsAnonymous_BypassesRoleCheck()
    {
        // Arrange
        var nextInvoked = false;
        RequestDelegate next = (ctx) =>
        {
            nextInvoked = true;
            return Task.CompletedTask;
        };

        var middleware = new RoleAuthorizationMiddleware(next, _mockMiddlewareLogger.Object);
        var context = new DefaultHttpContext(); // unauthenticated
        context.Request.Path = "/api/auth/company/login";
        context.SetEndpoint(CreateEndpointWithRoleMetadata(requireRoles: new[] { AppRoles.CompanyAdmin }, allowAnonymous: true));

        // Act
        await middleware.InvokeAsync(context);

        // Assert
        nextInvoked.Should().BeTrue();
    }

    [Fact]
    public async Task RoleAuthorizationMiddleware_WhenEndpointHasNoRoleRestrictions_AllowsAccess()
    {
        // Arrange
        var nextInvoked = false;
        RequestDelegate next = (ctx) =>
        {
            nextInvoked = true;
            return Task.CompletedTask;
        };

        var middleware = new RoleAuthorizationMiddleware(next, _mockMiddlewareLogger.Object);
        var context = new DefaultHttpContext();
        context.Request.Path = "/health";
        context.SetEndpoint(new Endpoint((ctx) => Task.CompletedTask, EndpointMetadataCollection.Empty, "HealthEndpoint"));

        // Act
        await middleware.InvokeAsync(context);

        // Assert
        nextInvoked.Should().BeTrue();
    }

    [Fact]
    public async Task RoleAuthorizationMiddleware_WhenUnauthenticatedCallerAccessesProtectedEndpoint_Returns401()
    {
        // Arrange
        var nextInvoked = false;
        RequestDelegate next = (ctx) =>
        {
            nextInvoked = true;
            return Task.CompletedTask;
        };

        var middleware = new RoleAuthorizationMiddleware(next, _mockMiddlewareLogger.Object);
        var context = new DefaultHttpContext(); // No User / unauthenticated
        context.Request.Path = "/api/company/stations";
        context.SetEndpoint(CreateEndpointWithRoleMetadata(requireRoles: new[] { AppRoles.CompanyAdmin }));

        // Act
        await middleware.InvokeAsync(context);

        // Assert
        context.Response.StatusCode.Should().Be(StatusCodes.Status401Unauthorized);
        nextInvoked.Should().BeFalse();
    }

    // =========================================================================
    // CONTROLLER & ENDPOINT SPECIFIC TESTS
    // =========================================================================

    [Fact]
    public async Task DriverDataController_GetDriverWallet_WhenFound_ReturnsWalletDto()
    {
        // Arrange
        const string driverId = "DRV-1234-TEST";
        var wallet = new Wallet
        {
            WalletId = "WLT-5678-TEST",
            DriverId = driverId,
            Balance = 45.50m,
            Currency = "USD",
            Status = "Active",
            UpdatedAt = DateTime.UtcNow
        };

        _mockDriverRepo.Setup(r => r.GetWalletByDriverIdAsync(driverId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(wallet);

        var controller = new DriverDataController(_mockDriverRepo.Object, _mockDriverControllerLogger.Object);
        var httpContext = CreateHttpContext(AppRoles.Driver, driverId);
        controller.ControllerContext = new ControllerContext { HttpContext = httpContext };

        // Act
        var result = await controller.GetDriverWallet(CancellationToken.None);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = okResult.Value.Should().BeOfType<ApiResponse<DriverWalletDto>>().Subject;
        response.Success.Should().BeTrue();
        response.Data.Should().NotBeNull();
        response.Data!.DriverId.Should().Be(driverId);
        response.Data.Balance.Should().Be(45.50m);
    }

    [Fact]
    public async Task DriverDataController_GetDriverWallet_WhenNotFound_Returns404NotFound()
    {
        // Arrange
        const string driverId = "DRV-MISSING-99";
        _mockDriverRepo.Setup(r => r.GetWalletByDriverIdAsync(driverId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Wallet?)null);

        var controller = new DriverDataController(_mockDriverRepo.Object, _mockDriverControllerLogger.Object);
        var httpContext = CreateHttpContext(AppRoles.Driver, driverId);
        controller.ControllerContext = new ControllerContext { HttpContext = httpContext };

        // Act
        var result = await controller.GetDriverWallet(CancellationToken.None);

        // Assert
        var notFound = result.Should().BeOfType<NotFoundObjectResult>().Subject;
        var response = notFound.Value.Should().BeOfType<ApiResponse<object>>().Subject;
        response.Success.Should().BeFalse();
        response.Message.Should().Contain("not found");
    }

    [Fact]
    public void ControllerAnnotations_EnforceStrictRoleSeparation()
    {
        // Assert CompanyDataController has RequireRole CompanyAdmin
        var companyControllerType = typeof(CompanyDataController);
        var companyRoleAttr = companyControllerType.GetCustomAttributes(typeof(RequireRoleAttribute), true)
            .Cast<RequireRoleAttribute>()
            .FirstOrDefault();
        companyRoleAttr.Should().NotBeNull();
        companyRoleAttr!.Roles.Should().Contain(AppRoles.CompanyAdmin);
        companyRoleAttr.Roles.Should().NotContain(AppRoles.Driver);

        // Assert DriverDataController has RequireRole Driver
        var driverControllerType = typeof(DriverDataController);
        var driverRoleAttr = driverControllerType.GetCustomAttributes(typeof(RequireRoleAttribute), true)
            .Cast<RequireRoleAttribute>()
            .FirstOrDefault();
        driverRoleAttr.Should().NotBeNull();
        driverRoleAttr!.Roles.Should().Contain(AppRoles.Driver);
        driverRoleAttr.Roles.Should().NotContain(AppRoles.CompanyAdmin);
    }
}
