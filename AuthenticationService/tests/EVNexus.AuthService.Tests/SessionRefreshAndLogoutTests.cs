using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text.Json;
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
using Microsoft.IdentityModel.Tokens;
using Moq;
using Xunit;

namespace EVNexus.AuthService.Tests;

public class SessionRefreshAndLogoutTests
{
    private readonly Mock<IRefreshTokenRepository> _mockRefreshTokenRepo;
    private readonly Mock<ITenantRepository> _mockTenantRepo;
    private readonly Mock<IDriverRepository> _mockDriverRepo;
    private readonly Mock<IJwtTokenService> _mockJwtTokenService;
    private readonly Mock<ITokenBlacklistService> _mockTokenBlacklistService;
    private readonly Mock<ICompanyAuthService> _mockCompanyAuthService;
    private readonly Mock<IDriverAuthService> _mockDriverAuthService;
    private readonly Mock<ILogger<SessionService>> _mockSessionLogger;
    private readonly Mock<ILogger<TokenBlacklistService>> _mockBlacklistLogger;
    private readonly Mock<ILogger<AuthController>> _mockControllerLogger;
    private readonly Mock<ILogger<RoleAuthorizationMiddleware>> _mockMiddlewareLogger;
    private readonly SessionService _sessionService;

    public SessionRefreshAndLogoutTests()
    {
        _mockRefreshTokenRepo = new Mock<IRefreshTokenRepository>();
        _mockTenantRepo = new Mock<ITenantRepository>();
        _mockDriverRepo = new Mock<IDriverRepository>();
        _mockJwtTokenService = new Mock<IJwtTokenService>();
        _mockTokenBlacklistService = new Mock<ITokenBlacklistService>();
        _mockCompanyAuthService = new Mock<ICompanyAuthService>();
        _mockDriverAuthService = new Mock<IDriverAuthService>();
        _mockSessionLogger = new Mock<ILogger<SessionService>>();
        _mockBlacklistLogger = new Mock<ILogger<TokenBlacklistService>>();
        _mockControllerLogger = new Mock<ILogger<AuthController>>();
        _mockMiddlewareLogger = new Mock<ILogger<RoleAuthorizationMiddleware>>();

        _sessionService = new SessionService(
            _mockRefreshTokenRepo.Object,
            _mockTokenBlacklistService.Object,
            _mockJwtTokenService.Object,
            _mockTenantRepo.Object,
            _mockDriverRepo.Object,
            _mockSessionLogger.Object);
    }

    #region Acceptance Criterion 1: Refresh token endpoint issues a new access token before expiry without re-login

    [Fact]
    public async Task RefreshSession_ForCompanyTenant_IssuesNewAccessTokenAndRotatedRefreshToken()
    {
        // Arrange
        const string currentToken = "RT-valid-tenant-token";
        var existingRefreshToken = new RefreshToken
        {
            TokenId = "TOK-12345",
            Token = currentToken,
            UserId = "TNT-COMP-101",
            UserType = "Tenant",
            Role = AppRoles.CompanyAdmin,
            ExpiresAt = DateTime.UtcNow.AddDays(5),
            IsRevoked = false
        };

        var tenant = new Tenant
        {
            TenantId = "TNT-COMP-101",
            CompanyName = "EcoCharge Corp",
            BusinessEmail = "admin@ecocharge.com",
            Role = AppRoles.CompanyAdmin,
            Status = "Active"
        };

        _mockRefreshTokenRepo.Setup(r => r.GetRefreshTokenAsync(currentToken, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingRefreshToken);
        _mockTenantRepo.Setup(r => r.GetTenantByIdAsync("TNT-COMP-101", It.IsAny<CancellationToken>()))
            .ReturnsAsync(tenant);
        _mockJwtTokenService.Setup(j => j.GenerateToken(tenant))
            .Returns(("new.jwt.access.token", 3600));

        // Act
        var result = await _sessionService.RefreshSessionAsync(currentToken);

        // Assert
        result.Should().NotBeNull();
        result.AccessToken.Should().Be("new.jwt.access.token");
        result.ExpiresIn.Should().Be(3600);
        result.Role.Should().Be(AppRoles.CompanyAdmin);
        result.RefreshToken.Should().NotBeNullOrWhiteSpace().And.NotBe(currentToken);

        // Verify token rotation: old token is revoked with replaced_by reference
        _mockRefreshTokenRepo.Verify(r => r.RevokeRefreshTokenAsync(currentToken, It.Is<string>(newToken => !string.IsNullOrEmpty(newToken)), It.IsAny<CancellationToken>()), Times.Once);
        _mockRefreshTokenRepo.Verify(r => r.SaveRefreshTokenAsync(It.IsAny<RefreshToken>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RefreshSession_ForStaffOperator_IssuesNewAccessTokenWithOperatorRole()
    {
        // Arrange
        const string currentToken = "RT-staff-operator-token";
        var existingRefreshToken = new RefreshToken
        {
            TokenId = "TOK-STAFF-1",
            Token = currentToken,
            UserId = "USR-STAFF-99",
            UserType = "Staff",
            Role = AppRoles.Operator,
            ExpiresAt = DateTime.UtcNow.AddDays(3),
            IsRevoked = false
        };

        var staff = new CompanyUser
        {
            UserId = "USR-STAFF-99",
            TenantId = "TNT-COMP-101",
            Name = "Sam Operator",
            Email = "sam@ecocharge.com",
            Role = AppRoles.Operator,
            Status = "Active"
        };

        var tenant = new Tenant
        {
            TenantId = "TNT-COMP-101",
            CompanyName = "EcoCharge Corp",
            Status = "Active"
        };

        _mockRefreshTokenRepo.Setup(r => r.GetRefreshTokenAsync(currentToken, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingRefreshToken);
        _mockTenantRepo.Setup(r => r.GetStaffUserByIdAsync("USR-STAFF-99", It.IsAny<CancellationToken>()))
            .ReturnsAsync(staff);
        _mockTenantRepo.Setup(r => r.GetTenantByIdAsync("TNT-COMP-101", It.IsAny<CancellationToken>()))
            .ReturnsAsync(tenant);
        _mockJwtTokenService.Setup(j => j.GenerateStaffToken(staff, tenant))
            .Returns(("new.operator.jwt.token", 3600));

        // Act
        var result = await _sessionService.RefreshSessionAsync(currentToken);

        // Assert
        result.Should().NotBeNull();
        result.AccessToken.Should().Be("new.operator.jwt.token");
        result.Role.Should().Be(AppRoles.Operator);
        result.RefreshToken.Should().NotBe(currentToken);
    }

    [Fact]
    public async Task RefreshSession_ForDriver_IssuesNewAccessTokenWithDriverRole()
    {
        // Arrange
        const string currentToken = "RT-driver-token";
        var existingRefreshToken = new RefreshToken
        {
            TokenId = "TOK-DRV-1",
            Token = currentToken,
            UserId = "DRV-12345",
            UserType = "Driver",
            Role = AppRoles.Driver,
            ExpiresAt = DateTime.UtcNow.AddDays(4),
            IsRevoked = false
        };

        var driver = new Driver
        {
            DriverId = "DRV-12345",
            Name = "John Driver",
            Email = "john@driver.com",
            Role = AppRoles.Driver,
            Status = "Active"
        };

        _mockRefreshTokenRepo.Setup(r => r.GetRefreshTokenAsync(currentToken, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingRefreshToken);
        _mockDriverRepo.Setup(d => d.GetDriverByIdAsync("DRV-12345", It.IsAny<CancellationToken>()))
            .ReturnsAsync(driver);
        _mockJwtTokenService.Setup(j => j.GenerateDriverToken(driver))
            .Returns(("new.driver.jwt.token", 3600));

        // Act
        var result = await _sessionService.RefreshSessionAsync(currentToken);

        // Assert
        result.Should().NotBeNull();
        result.AccessToken.Should().Be("new.driver.jwt.token");
        result.Role.Should().Be(AppRoles.Driver);
        result.UserId.Should().Be("DRV-12345");
    }

    [Fact]
    public async Task AuthController_RefreshToken_WhenValid_Returns200WithTokens()
    {
        // Arrange
        var controller = new AuthController(
            _mockCompanyAuthService.Object,
            _mockDriverAuthService.Object,
            _mockControllerLogger.Object,
            _sessionService);

        var existingRefreshToken = new RefreshToken
        {
            TokenId = "TOK-123",
            Token = "RT-valid-token",
            UserId = "TNT-COMP-101",
            UserType = "Tenant",
            Role = AppRoles.CompanyAdmin,
            ExpiresAt = DateTime.UtcNow.AddDays(6),
            IsRevoked = false
        };

        var tenant = new Tenant
        {
            TenantId = "TNT-COMP-101",
            CompanyName = "Volt Corp",
            Status = "Active",
            Role = AppRoles.CompanyAdmin
        };

        _mockRefreshTokenRepo.Setup(r => r.GetRefreshTokenAsync("RT-valid-token", It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingRefreshToken);
        _mockTenantRepo.Setup(r => r.GetTenantByIdAsync("TNT-COMP-101", It.IsAny<CancellationToken>()))
            .ReturnsAsync(tenant);
        _mockJwtTokenService.Setup(j => j.GenerateToken(tenant))
            .Returns(("refreshed.access.token", 3600));

        var request = new RefreshTokenRequestDto { RefreshToken = "RT-valid-token" };

        // Act
        var actionResult = await controller.RefreshToken(request, CancellationToken.None);

        // Assert
        var okResult = actionResult.Should().BeOfType<OkObjectResult>().Subject;
        var apiResponse = okResult.Value.Should().BeOfType<ApiResponse<RefreshTokenResponseDto>>().Subject;
        apiResponse.Success.Should().BeTrue();
        apiResponse.Data!.AccessToken.Should().Be("refreshed.access.token");
        apiResponse.Data.RefreshToken.Should().NotBeNullOrWhiteSpace();
    }

    #endregion

    #region Acceptance Criterion 2: Logout endpoint invalidates the current token/session server-side

    [Fact]
    public async Task LogoutSession_InvalidatesAccessTokenInBlacklist_AndRevokesRefreshTokenInDatabase()
    {
        // Arrange
        const string rawBearer = "Bearer eyJhbGciOiJIUzI1NiJ9.sampletoken.signature";
        const string refreshToken = "RT-user-session-token";
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Jti, "jwt-unique-id-999"),
            new("tenant_id", "TNT-COMP-101")
        };
        var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, "Bearer"));

        // Act
        await _sessionService.LogoutSessionAsync(rawBearer, refreshToken, principal);

        // Assert
        _mockTokenBlacklistService.Verify(b => b.RevokeTokenAsync(
            "eyJhbGciOiJIUzI1NiJ9.sampletoken.signature",
            "jwt-unique-id-999",
            "TNT-COMP-101",
            It.IsAny<DateTime>(),
            It.IsAny<CancellationToken>()), Times.Once);

        _mockRefreshTokenRepo.Verify(r => r.RevokeRefreshTokenAsync(refreshToken, null, It.IsAny<CancellationToken>()), Times.Once);
        _mockRefreshTokenRepo.Verify(r => r.RevokeAllUserTokensAsync("TNT-COMP-101", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RoleAuthorizationMiddleware_WhenCallerUsesLoggedOutToken_Returns401Unauthorized()
    {
        // Arrange
        var context = new DefaultHttpContext();
        context.Request.Headers.Authorization = "Bearer revoked.access.token";

        var claims = new List<Claim>
        {
            new(ClaimTypes.Role, AppRoles.CompanyAdmin),
            new(JwtRegisteredClaimNames.Jti, "revoked-jti-123")
        };
        context.User = new ClaimsPrincipal(new ClaimsIdentity(claims, "Bearer"));

        // Mock protected endpoint with RequireRole
        var endpoint = new Endpoint(
            _ => Task.CompletedTask,
            new EndpointMetadataCollection(new RequireRoleAttribute(AppRoles.CompanyAdmin)),
            "Protected Endpoint");
        context.SetEndpoint(endpoint);

        var blacklistMock = new Mock<ITokenBlacklistService>();
        blacklistMock.Setup(b => b.IsTokenRevokedAsync("revoked.access.token", "revoked-jti-123", It.IsAny<CancellationToken>()))
            .ReturnsAsync(true); // Token is blacklisted!

        var nextCalled = false;
        var middleware = new RoleAuthorizationMiddleware(_ =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        }, _mockMiddlewareLogger.Object);

        // Act
        await middleware.InvokeAsync(context, blacklistMock.Object);

        // Assert
        nextCalled.Should().BeFalse();
        context.Response.StatusCode.Should().Be(StatusCodes.Status401Unauthorized);
    }

    [Fact]
    public async Task RoleAuthorizationMiddleware_WhenTokenNotRevoked_AllowsRequest()
    {
        // Arrange
        var context = new DefaultHttpContext();
        context.Request.Headers.Authorization = "Bearer valid.active.token";

        var claims = new List<Claim>
        {
            new(ClaimTypes.Role, AppRoles.CompanyAdmin),
            new(JwtRegisteredClaimNames.Jti, "active-jti-456")
        };
        context.User = new ClaimsPrincipal(new ClaimsIdentity(claims, "Bearer"));

        var endpoint = new Endpoint(
            _ => Task.CompletedTask,
            new EndpointMetadataCollection(new RequireRoleAttribute(AppRoles.CompanyAdmin)),
            "Protected Endpoint");
        context.SetEndpoint(endpoint);

        var blacklistMock = new Mock<ITokenBlacklistService>();
        blacklistMock.Setup(b => b.IsTokenRevokedAsync("valid.active.token", "active-jti-456", It.IsAny<CancellationToken>()))
            .ReturnsAsync(false); // Token is valid!

        var nextCalled = false;
        var middleware = new RoleAuthorizationMiddleware(_ =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        }, _mockMiddlewareLogger.Object);

        // Act
        await middleware.InvokeAsync(context, blacklistMock.Object);

        // Assert
        nextCalled.Should().BeTrue();
        context.Response.StatusCode.Should().Be(StatusCodes.Status200OK);
    }

    [Fact]
    public async Task AuthController_Logout_WhenCalledWithToken_Returns200OkAndInvalidatesSession()
    {
        // Arrange
        var controller = new AuthController(
            _mockCompanyAuthService.Object,
            _mockDriverAuthService.Object,
            _mockControllerLogger.Object,
            _sessionService);

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
        controller.Request.Headers.Authorization = "Bearer eyJhbGciOiJIUzI1NiJ9.test.jwt";

        var logoutRequest = new LogoutRequestDto { RefreshToken = "RT-session-to-revoke" };

        // Act
        var actionResult = await controller.Logout(logoutRequest, CancellationToken.None);

        // Assert
        var okResult = actionResult.Should().BeOfType<OkObjectResult>().Subject;
        var apiResponse = okResult.Value.Should().BeOfType<ApiResponse<object>>().Subject;
        apiResponse.Success.Should().BeTrue();
        apiResponse.Message.Should().Contain("invalidated server-side");

        _mockTokenBlacklistService.Verify(b => b.RevokeTokenAsync(
            "eyJhbGciOiJIUzI1NiJ9.test.jwt",
            null,
            null,
            It.IsAny<DateTime>(),
            It.IsAny<CancellationToken>()), Times.Once);

        _mockRefreshTokenRepo.Verify(r => r.RevokeRefreshTokenAsync("RT-session-to-revoke", null, It.IsAny<CancellationToken>()), Times.Once);
    }

    #endregion

    #region Acceptance Criterion 3: Expired refresh tokens are rejected with a 401

    [Fact]
    public async Task RefreshSession_WhenRefreshTokenIsExpired_ThrowsSecurityTokenExpiredException()
    {
        // Arrange
        const string expiredToken = "RT-expired-token";
        var tokenRecord = new RefreshToken
        {
            TokenId = "TOK-EXPIRED",
            Token = expiredToken,
            UserId = "TNT-COMP-101",
            UserType = "Tenant",
            Role = AppRoles.CompanyAdmin,
            ExpiresAt = DateTime.UtcNow.AddMinutes(-10), // Expired!
            IsRevoked = false
        };

        _mockRefreshTokenRepo.Setup(r => r.GetRefreshTokenAsync(expiredToken, It.IsAny<CancellationToken>()))
            .ReturnsAsync(tokenRecord);

        // Act & Assert
        var act = () => _sessionService.RefreshSessionAsync(expiredToken);
        await act.Should().ThrowAsync<SecurityTokenExpiredException>()
            .WithMessage("*expired*");
    }

    [Fact]
    public async Task AuthController_RefreshToken_WhenTokenExpired_Returns401Unauthorized()
    {
        // Arrange
        var controller = new AuthController(
            _mockCompanyAuthService.Object,
            _mockDriverAuthService.Object,
            _mockControllerLogger.Object,
            _sessionService);

        const string expiredToken = "RT-expired-token-401";
        var tokenRecord = new RefreshToken
        {
            TokenId = "TOK-EXPIRED-401",
            Token = expiredToken,
            UserId = "TNT-COMP-101",
            UserType = "Tenant",
            Role = AppRoles.CompanyAdmin,
            ExpiresAt = DateTime.UtcNow.AddHours(-1), // Expired
            IsRevoked = false
        };

        _mockRefreshTokenRepo.Setup(r => r.GetRefreshTokenAsync(expiredToken, It.IsAny<CancellationToken>()))
            .ReturnsAsync(tokenRecord);

        var request = new RefreshTokenRequestDto { RefreshToken = expiredToken };

        // Act
        var actionResult = await controller.RefreshToken(request, CancellationToken.None);

        // Assert - AC 3 requirement: Expired refresh tokens are rejected with a 401
        var unauthorizedResult = actionResult.Should().BeOfType<UnauthorizedObjectResult>().Subject;
        unauthorizedResult.StatusCode.Should().Be(StatusCodes.Status401Unauthorized);

        var apiResponse = unauthorizedResult.Value.Should().BeOfType<ApiResponse<object>>().Subject;
        apiResponse.Success.Should().BeFalse();
        apiResponse.Message.Should().Contain("Refresh token has expired");
    }

    [Fact]
    public async Task AuthController_RefreshToken_WhenTokenRevoked_Returns401Unauthorized()
    {
        // Arrange
        var controller = new AuthController(
            _mockCompanyAuthService.Object,
            _mockDriverAuthService.Object,
            _mockControllerLogger.Object,
            _sessionService);

        const string revokedToken = "RT-revoked-token";
        var tokenRecord = new RefreshToken
        {
            TokenId = "TOK-REVOKED",
            Token = revokedToken,
            UserId = "TNT-COMP-101",
            UserType = "Tenant",
            Role = AppRoles.CompanyAdmin,
            ExpiresAt = DateTime.UtcNow.AddDays(3),
            IsRevoked = true // Already revoked!
        };

        _mockRefreshTokenRepo.Setup(r => r.GetRefreshTokenAsync(revokedToken, It.IsAny<CancellationToken>()))
            .ReturnsAsync(tokenRecord);

        var request = new RefreshTokenRequestDto { RefreshToken = revokedToken };

        // Act
        var actionResult = await controller.RefreshToken(request, CancellationToken.None);

        // Assert
        var unauthorizedResult = actionResult.Should().BeOfType<UnauthorizedObjectResult>().Subject;
        unauthorizedResult.StatusCode.Should().Be(StatusCodes.Status401Unauthorized);
    }

    [Fact]
    public async Task AuthController_RefreshToken_WhenTokenNotFound_Returns401Unauthorized()
    {
        // Arrange
        var controller = new AuthController(
            _mockCompanyAuthService.Object,
            _mockDriverAuthService.Object,
            _mockControllerLogger.Object,
            _sessionService);

        _mockRefreshTokenRepo.Setup(r => r.GetRefreshTokenAsync("RT-unknown-token", It.IsAny<CancellationToken>()))
            .ReturnsAsync((RefreshToken?)null);

        var request = new RefreshTokenRequestDto { RefreshToken = "RT-unknown-token" };

        // Act
        var actionResult = await controller.RefreshToken(request, CancellationToken.None);

        // Assert
        var unauthorizedResult = actionResult.Should().BeOfType<UnauthorizedObjectResult>().Subject;
        unauthorizedResult.StatusCode.Should().Be(StatusCodes.Status401Unauthorized);
    }

    #endregion

    #region Acceptance Criterion 4: Logout is tested with an automated test case

    [Fact]
    public async Task Logout_CompleteEndToEndFlow_InvalidatesSessionAndRejectsSubsequentAccess()
    {
        // 1. Setup in-memory TokenBlacklistService backed by RefreshTokenRepository
        var blacklistService = new TokenBlacklistService(_mockRefreshTokenRepo.Object, _mockBlacklistLogger.Object);
        var sessionService = new SessionService(
            _mockRefreshTokenRepo.Object,
            blacklistService,
            _mockJwtTokenService.Object,
            _mockTenantRepo.Object,
            _mockDriverRepo.Object,
            _mockSessionLogger.Object);

        var controller = new AuthController(
            _mockCompanyAuthService.Object,
            _mockDriverAuthService.Object,
            _mockControllerLogger.Object,
            sessionService);

        const string activeAccessToken = "eyJhbGciOiJIUzI1NiJ9.active.access.token";
        const string activeJti = "jti-session-12345";
        const string activeRefreshToken = "RT-active-refresh-token";

        var claims = new List<Claim>
        {
            new(ClaimTypes.Role, AppRoles.CompanyAdmin),
            new(JwtRegisteredClaimNames.Jti, activeJti),
            new("tenant_id", "TNT-101")
        };
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(claims, "Bearer"))
            }
        };
        controller.Request.Headers.Authorization = $"Bearer {activeAccessToken}";

        // 2. Perform Logout
        var logoutResult = await controller.Logout(new LogoutRequestDto { RefreshToken = activeRefreshToken }, CancellationToken.None);
        logoutResult.Should().BeOfType<OkObjectResult>();

        // 3. Verify access token is now blacklisted server-side
        var isBlacklisted = await blacklistService.IsTokenRevokedAsync(activeAccessToken, activeJti);
        isBlacklisted.Should().BeTrue();

        // 4. Verify RoleAuthorizationMiddleware rejects subsequent requests with this token
        var subsequentContext = new DefaultHttpContext();
        subsequentContext.Request.Headers.Authorization = $"Bearer {activeAccessToken}";
        subsequentContext.User = new ClaimsPrincipal(new ClaimsIdentity(claims, "Bearer"));
        var protectedEndpoint = new Endpoint(
            _ => Task.CompletedTask,
            new EndpointMetadataCollection(new RequireRoleAttribute(AppRoles.CompanyAdmin)),
            "Company Profile Protected");
        subsequentContext.SetEndpoint(protectedEndpoint);

        var middlewareExecuted = false;
        var middleware = new RoleAuthorizationMiddleware(_ =>
        {
            middlewareExecuted = true;
            return Task.CompletedTask;
        }, _mockMiddlewareLogger.Object);

        await middleware.InvokeAsync(subsequentContext, blacklistService);

        // 5. Subsequent access MUST be rejected with HTTP 401 Unauthorized
        middlewareExecuted.Should().BeFalse();
        subsequentContext.Response.StatusCode.Should().Be(StatusCodes.Status401Unauthorized);
    }

    #endregion
}
