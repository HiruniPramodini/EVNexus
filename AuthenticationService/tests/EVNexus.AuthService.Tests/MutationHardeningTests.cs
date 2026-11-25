using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text.Json;
using EVNexus.AuthService.Attributes;
using EVNexus.AuthService.Configuration;
using EVNexus.AuthService.Data;
using EVNexus.AuthService.DTOs;
using EVNexus.AuthService.Middleware;
using EVNexus.AuthService.Models;
using EVNexus.AuthService.Security;
using EVNexus.AuthService.Services;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;

namespace EVNexus.AuthService.Tests;

/// <summary>
/// Mutation-guided test hardening suite for AuthenticationService.
/// Each test targets real surviving or uncovered mutants discovered by Stryker.NET 5.0.0
/// across AccountManagementService, JwtTokenService, SessionService,
/// TenantResolutionMiddleware, and RoleAuthorizationMiddleware.
/// </summary>
public class MutationHardeningTests
{
    private const string Valid32CharKey = "12345678901234567890123456789012"; // exact 32-char boundary
    private const string ValidLongKey = "EVNexus_Mutation_Testing_Secret_Key_2026_Secure!";

    #region AccountManagementService — NotFound Guards, Audit Formats, Notifications, Queries

    private static (
        AccountManagementService Service,
        Mock<ITenantRepository> TenantRepo,
        Mock<IDriverRepository> DriverRepo,
        Mock<IAccountAuditRepository> AuditRepo,
        Mock<IRefreshTokenRepository> RefreshRepo,
        Mock<IStatusNotificationService> NotifService)
        CreateAccountManagementSut(bool withNotificationService = true)
    {
        var tenantRepo = new Mock<ITenantRepository>();
        var driverRepo = new Mock<IDriverRepository>();
        var auditRepo = new Mock<IAccountAuditRepository>();
        var refreshRepo = new Mock<IRefreshTokenRepository>();
        var logger = new Mock<ILogger<AccountManagementService>>();
        var notifService = new Mock<IStatusNotificationService>();

        var service = new AccountManagementService(
            tenantRepo.Object,
            driverRepo.Object,
            auditRepo.Object,
            refreshRepo.Object,
            logger.Object,
            withNotificationService ? notifService.Object : null);

        return (service, tenantRepo, driverRepo, auditRepo, refreshRepo, notifService);
    }

    [Fact]
    public async Task AccountManagement_NotFoundGuards_ThrowKeyNotFoundExceptionWithAccountId()
    {
        var (service, tenantRepo, driverRepo, _, _, _) = CreateAccountManagementSut();

        tenantRepo.Setup(r => r.GetTenantByIdAsync("TNT-MISSING", It.IsAny<CancellationToken>()))
            .ReturnsAsync((Tenant?)null);
        driverRepo.Setup(r => r.GetDriverByIdAsync("DRV-MISSING", It.IsAny<CancellationToken>()))
            .ReturnsAsync((Driver?)null);

        (await Assert.ThrowsAsync<KeyNotFoundException>(
            () => service.SuspendCompanyAsync("TNT-MISSING", "reason", "admin")))
            .Message.Should().Contain("TNT-MISSING");

        (await Assert.ThrowsAsync<KeyNotFoundException>(
            () => service.ReactivateCompanyAsync("TNT-MISSING", "reason", "admin")))
            .Message.Should().Contain("TNT-MISSING");

        (await Assert.ThrowsAsync<KeyNotFoundException>(
            () => service.ApproveCompanyAsync("TNT-MISSING", "notes", "admin")))
            .Message.Should().Contain("TNT-MISSING");

        (await Assert.ThrowsAsync<KeyNotFoundException>(
            () => service.RejectCompanyAsync("TNT-MISSING", "reason", "admin")))
            .Message.Should().Contain("TNT-MISSING");

        (await Assert.ThrowsAsync<KeyNotFoundException>(
            () => service.SuspendDriverAsync("DRV-MISSING", "reason", "admin")))
            .Message.Should().Contain("DRV-MISSING");

        (await Assert.ThrowsAsync<KeyNotFoundException>(
            () => service.ReactivateDriverAsync("DRV-MISSING", "reason", "admin")))
            .Message.Should().Contain("DRV-MISSING");
    }

    [Fact]
    public async Task AccountManagement_AllStatusTransitions_RecordExactAuditPrefixAccountTypeAndMessages()
    {
        var (service, tenantRepo, driverRepo, auditRepo, _, _) = CreateAccountManagementSut(withNotificationService: false);

        var tenant = new Tenant
        {
            TenantId = "TNT-MUT-1",
            CompanyName = "VoltGrid Ltd",
            BusinessEmail = "ops@voltgrid.io",
            Status = "Pending"
        };
        var driver = new Driver
        {
            DriverId = "DRV-MUT-1",
            Name = "Nimal Perera",
            Email = "nimal@ev.lk",
            Status = "Active"
        };

        var capturedAudits = new List<AccountStatusAudit>();
        auditRepo.Setup(r => r.RecordStatusAuditAsync(It.IsAny<AccountStatusAudit>(), It.IsAny<CancellationToken>()))
            .Callback<AccountStatusAudit, CancellationToken>((a, _) => capturedAudits.Add(a))
            .Returns(Task.CompletedTask);

        tenantRepo.Setup(r => r.GetTenantByIdAsync("TNT-MUT-1", It.IsAny<CancellationToken>())).ReturnsAsync(tenant);
        driverRepo.Setup(r => r.GetDriverByIdAsync("DRV-MUT-1", It.IsAny<CancellationToken>())).ReturnsAsync(driver);

        // 1. Approve company (null notification service exercises fallback summary string)
        var approveRes = await service.ApproveCompanyAsync("TNT-MUT-1", "Verified", "admin");
        approveRes.Message.Should().Be("Company account 'VoltGrid Ltd' has been approved successfully.");
        approveRes.NotificationSummary.Should().Be("Simulated approval notification dispatched to ops@voltgrid.io.");

        // 2. Suspend company
        tenant.Status = "Active";
        var suspendCoRes = await service.SuspendCompanyAsync("TNT-MUT-1", null, "admin");
        suspendCoRes.Message.Should().Be("Company account 'VoltGrid Ltd' has been suspended successfully.");

        // 3. Reactivate company
        tenant.Status = "Suspended";
        var reactivateCoRes = await service.ReactivateCompanyAsync("TNT-MUT-1", null, "admin");
        reactivateCoRes.Message.Should().Be("Company account 'VoltGrid Ltd' has been reactivated successfully.");

        // 4. Reject company (null notification service exercises fallback summary string)
        tenant.Status = "Pending";
        var rejectRes = await service.RejectCompanyAsync("TNT-MUT-1", "Invalid license", "admin");
        rejectRes.Message.Should().Be("Company registration for 'VoltGrid Ltd' has been rejected.");
        rejectRes.NotificationSummary.Should().Be("Simulated rejection notification dispatched to ops@voltgrid.io.");

        // 5. Suspend driver
        var suspendDrvRes = await service.SuspendDriverAsync("DRV-MUT-1", null, "admin");
        suspendDrvRes.Message.Should().Be("Driver account 'Nimal Perera' has been suspended successfully.");

        // 6. Reactivate driver
        driver.Status = "Suspended";
        var reactivateDrvRes = await service.ReactivateDriverAsync("DRV-MUT-1", null, "admin");
        reactivateDrvRes.Message.Should().Be("Driver account 'Nimal Perera' has been reactivated successfully.");

        capturedAudits.Should().HaveCount(6);
        foreach (var audit in capturedAudits)
        {
            audit.AuditId.Should().StartWith("AUD-");
            audit.AuditId.Length.Should().Be(16);
            audit.AuditId[4..].Should().MatchRegex("^[0-9A-F]{12}$");
        }

        capturedAudits[0].AccountType.Should().Be("Company");
        capturedAudits[1].AccountType.Should().Be("Company");
        capturedAudits[2].AccountType.Should().Be("Company");
        capturedAudits[3].AccountType.Should().Be("Company");
        capturedAudits[4].AccountType.Should().Be("Driver");
        capturedAudits[5].AccountType.Should().Be("Driver");
    }

    [Fact]
    public async Task AccountManagement_RejectCompany_UsesNotificationContentWhenNotificationServiceProvided()
    {
        var (service, tenantRepo, _, _, _, notifService) = CreateAccountManagementSut(withNotificationService: true);

        var tenant = new Tenant
        {
            TenantId = "TNT-NOTIF-1",
            CompanyName = "NovaCharge",
            BusinessEmail = "info@novacharge.com",
            Status = "Pending"
        };
        tenantRepo.Setup(r => r.GetTenantByIdAsync("TNT-NOTIF-1", It.IsAny<CancellationToken>())).ReturnsAsync(tenant);
        notifService.Setup(n => n.SendRejectionNotificationAsync(tenant, "Missing KYC", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new SimulatedNotificationDto { Content = "Custom rejection body for NovaCharge" });

        var res = await service.RejectCompanyAsync("TNT-NOTIF-1", "Missing KYC", "admin");

        res.NotificationSummary.Should().Be("Custom rejection body for NovaCharge");
    }

    [Fact]
    public async Task AccountManagement_GetAccountAuditHistory_MapsAllFieldsAndGetPendingCompaniesReturnsList()
    {
        var (service, tenantRepo, _, auditRepo, _, _) = CreateAccountManagementSut();

        var ts = new DateTime(2026, 10, 15, 8, 30, 0, DateTimeKind.Utc);
        auditRepo.Setup(r => r.GetAuditHistoryByAccountIdAsync("TNT-HIST-1", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<AccountStatusAudit>
            {
                new()
                {
                    AuditId = "AUD-ABCDEF123456",
                    AccountId = "TNT-HIST-1",
                    AccountType = "Company",
                    Action = "Suspend",
                    PreviousStatus = "Active",
                    NewStatus = "Suspended",
                    Reason = "Audit review",
                    PerformedBy = "superadmin",
                    Timestamp = ts
                }
            });

        var pendingTenants = new List<Tenant>
        {
            new() { TenantId = "TNT-P1", CompanyName = "Pending Co 1", Status = "Pending" },
            new() { TenantId = "TNT-P2", CompanyName = "Pending Co 2", Status = "Pending" }
        };
        tenantRepo.Setup(r => r.GetPendingTenantsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(pendingTenants);

        var history = await service.GetAccountAuditHistoryAsync("TNT-HIST-1");
        history.Should().HaveCount(1);
        history[0].AuditId.Should().Be("AUD-ABCDEF123456");
        history[0].AccountId.Should().Be("TNT-HIST-1");
        history[0].AccountType.Should().Be("Company");
        history[0].Action.Should().Be("Suspend");
        history[0].PreviousStatus.Should().Be("Active");
        history[0].NewStatus.Should().Be("Suspended");
        history[0].Reason.Should().Be("Audit review");
        history[0].PerformedBy.Should().Be("superadmin");
        history[0].Timestamp.Should().Be(ts);

        var pending = await service.GetPendingCompaniesAsync();
        pending.Should().HaveCount(2);
        pending[0].TenantId.Should().Be("TNT-P1");
        pending[1].TenantId.Should().Be("TNT-P2");
    }

    #endregion

    #region JwtTokenService — Key Length Boundary, Expiry Fallback, Staff & PlatformAdmin Tokens

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("1234567890123456789012345678901")] // 31 chars: just below 32-char boundary
    public void JwtTokenService_InvalidOrShortKey_ThrowsInvalidOperationException(string badKey)
    {
        var options = Options.Create(new JwtSettings
        {
            Key = badKey,
            Issuer = "EVNexus.AuthService",
            Audience = "EVNexus.Microservices",
            ExpiryMinutes = 30
        });

        var act = () => new JwtTokenService(options);
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*32 characters*");
    }

    [Fact]
    public void JwtTokenService_Exact32CharKey_SucceedsAndRespectsExpiryBoundary()
    {
        // Exact 32 chars kills `< 32` -> `<= 32` boundary mutant
        var customExpiryService = new JwtTokenService(Options.Create(new JwtSettings
        {
            Key = Valid32CharKey,
            Issuer = "EVNexus.AuthService",
            Audience = "EVNexus.Microservices",
            ExpiryMinutes = 15
        }));

        var zeroExpiryService = new JwtTokenService(Options.Create(new JwtSettings
        {
            Key = Valid32CharKey,
            Issuer = "EVNexus.AuthService",
            Audience = "EVNexus.Microservices",
            ExpiryMinutes = 0
        }));

        var negativeExpiryService = new JwtTokenService(Options.Create(new JwtSettings
        {
            Key = Valid32CharKey,
            Issuer = "EVNexus.AuthService",
            Audience = "EVNexus.Microservices",
            ExpiryMinutes = -5
        }));

        var tenant = new Tenant
        {
            TenantId = "TNT-JWT-1",
            CompanyName = "GreenVolt",
            BusinessEmail = "admin@greenvolt.lk",
            RegistrationNumber = "REG-9988",
            Role = AppRoles.CompanyAdmin
        };
        var driver = new Driver
        {
            DriverId = "DRV-JWT-1",
            Name = "Kasun",
            Email = "kasun@ev.lk",
            Role = AppRoles.Driver
        };
        var staff = new CompanyUser
        {
            UserId = "STF-JWT-1",
            TenantId = tenant.TenantId,
            Name = "Operator One",
            Email = "op1@greenvolt.lk",
            Role = AppRoles.Operator
        };

        var handler = new JwtSecurityTokenHandler();

        // Tenant token
        var (t15, s15) = customExpiryService.GenerateToken(tenant);
        s15.Should().Be(900);
        zeroExpiryService.GenerateToken(tenant).ExpiresInSeconds.Should().Be(3600);
        negativeExpiryService.GenerateToken(tenant).ExpiresInSeconds.Should().Be(3600);
        var jwtTenant = handler.ReadJwtToken(t15);
        jwtTenant.Claims.Should().Contain(c => c.Type == "role" && c.Value == AppRoles.CompanyAdmin);
        jwtTenant.Claims.Should().Contain(c => c.Type == "registration_number" && c.Value == "REG-9988");
        jwtTenant.Claims.Should().Contain(c => c.Type == "company_name" && c.Value == "GreenVolt");

        // Driver token
        var (d15, ds15) = customExpiryService.GenerateDriverToken(driver);
        ds15.Should().Be(900);
        zeroExpiryService.GenerateDriverToken(driver).ExpiresInSeconds.Should().Be(3600);
        negativeExpiryService.GenerateDriverToken(driver).ExpiresInSeconds.Should().Be(3600);
        var jwtDriver = handler.ReadJwtToken(d15);
        jwtDriver.Claims.Should().Contain(c => c.Type == "role" && c.Value == AppRoles.Driver);
        jwtDriver.Claims.Should().Contain(c => c.Type == "driver_id" && c.Value == "DRV-JWT-1");

        // Staff token (previously 0% covered)
        var (st15, sts15) = customExpiryService.GenerateStaffToken(staff, tenant);
        sts15.Should().Be(900);
        zeroExpiryService.GenerateStaffToken(staff, tenant).ExpiresInSeconds.Should().Be(3600);
        negativeExpiryService.GenerateStaffToken(staff, tenant).ExpiresInSeconds.Should().Be(3600);
        var jwtStaff = handler.ReadJwtToken(st15);
        jwtStaff.Issuer.Should().Be("EVNexus.AuthService");
        jwtStaff.Audiences.Should().Contain("EVNexus.Microservices");
        jwtStaff.Claims.Should().Contain(c => c.Type == "user_id" && c.Value == "STF-JWT-1");
        jwtStaff.Claims.Should().Contain(c => c.Type == "staff_id" && c.Value == "STF-JWT-1");
        jwtStaff.Claims.Should().Contain(c => c.Type == "tenant_id" && c.Value == "TNT-JWT-1");
        jwtStaff.Claims.Should().Contain(c => c.Type == "name" && c.Value == "Operator One");
        jwtStaff.Claims.Should().Contain(c => c.Type == "role" && c.Value == AppRoles.Operator);
        jwtStaff.Claims.Should().Contain(c => c.Type == "company_name" && c.Value == "GreenVolt");
        jwtStaff.Claims.Should().Contain(c => c.Type == "registration_number" && c.Value == "REG-9988");

        // PlatformAdmin token (previously 0% covered)
        var (pa15, pas15) = customExpiryService.GeneratePlatformAdminToken("ADM-01", "root@evnexus.io", "Super Admin");
        pas15.Should().Be(900);
        zeroExpiryService.GeneratePlatformAdminToken("ADM-01", "root@evnexus.io", "Super Admin").ExpiresInSeconds.Should().Be(3600);
        negativeExpiryService.GeneratePlatformAdminToken("ADM-01", "root@evnexus.io", "Super Admin").ExpiresInSeconds.Should().Be(3600);
        var jwtAdmin = handler.ReadJwtToken(pa15);
        jwtAdmin.Issuer.Should().Be("EVNexus.AuthService");
        jwtAdmin.Audiences.Should().Contain("EVNexus.Microservices");
        jwtAdmin.Claims.Should().Contain(c => c.Type == "admin_id" && c.Value == "ADM-01");
        jwtAdmin.Claims.Should().Contain(c => c.Type == "name" && c.Value == "Super Admin");
        jwtAdmin.Claims.Should().Contain(c => c.Type == "role" && c.Value == AppRoles.PlatformAdmin);
    }

    #endregion

    #region SessionService — RefreshToken Properties & Logout Claim Fallbacks

    private static (
        SessionService Service,
        Mock<IRefreshTokenRepository> RefreshRepo,
        Mock<ITokenBlacklistService> Blacklist)
        CreateSessionSut()
    {
        var refreshRepo = new Mock<IRefreshTokenRepository>();
        var blacklist = new Mock<ITokenBlacklistService>();
        var jwt = new Mock<IJwtTokenService>();
        var tenantRepo = new Mock<ITenantRepository>();
        var driverRepo = new Mock<IDriverRepository>();
        var logger = new Mock<ILogger<SessionService>>();

        var svc = new SessionService(
            refreshRepo.Object,
            blacklist.Object,
            jwt.Object,
            tenantRepo.Object,
            driverRepo.Object,
            logger.Object);

        return (svc, refreshRepo, blacklist);
    }

    [Fact]
    public async Task SessionService_GenerateAndSaveRefreshToken_PopulatesUrlSafeTokenAndAllEntityFields()
    {
        var (service, refreshRepo, _) = CreateSessionSut();

        RefreshToken? saved = null;
        refreshRepo.Setup(r => r.SaveRefreshTokenAsync(It.IsAny<RefreshToken>(), It.IsAny<CancellationToken>()))
            .Callback<RefreshToken, CancellationToken>((rt, _) => saved = rt)
            .ReturnsAsync((RefreshToken rt, CancellationToken _) => rt);

        // Run several times to ensure URL-safe base64 replacements (+, /, =) are exercised
        for (int i = 0; i < 5; i++)
        {
            var token = await service.GenerateAndSaveRefreshTokenAsync("DRV-77", "Driver", AppRoles.Driver, "jti-99");

            token.Should().StartWith("RT-");
            token.Should().NotContain("+").And.NotContain("/").And.NotContain("=");

            saved.Should().NotBeNull();
            saved!.Token.Should().Be(token);
            saved.TokenId.Should().StartWith("TOK-");
            saved.TokenId.Length.Should().Be(16);
            saved.TokenId[4..].Should().MatchRegex("^[0-9A-F]{12}$");
            saved.JwtId.Should().Be("jti-99");
            saved.UserId.Should().Be("DRV-77");
            saved.UserType.Should().Be("Driver");
            saved.Role.Should().Be(AppRoles.Driver);
            saved.IsRevoked.Should().BeFalse();
            saved.ExpiresAt.Should().BeCloseTo(DateTime.UtcNow.AddDays(7), TimeSpan.FromSeconds(10));
            saved.CreatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(10));
        }
    }

    [Theory]
    [InlineData("tenant_id", "TNT-10")]
    [InlineData("driver_id", "DRV-20")]
    [InlineData("user_id", "USR-30")]
    [InlineData(ClaimTypes.NameIdentifier, "NID-40")]
    public async Task SessionService_LogoutSession_ResolvesUserIdAcrossFullClaimFallbackChain(string claimType, string expectedUserId)
    {
        var (service, refreshRepo, blacklist) = CreateSessionSut();
        var principal = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(claimType, expectedUserId),
            new Claim(JwtRegisteredClaimNames.Jti, "jti-abc")
        }, "Bearer"));

        await service.LogoutSessionAsync("raw.jwt.without.bearer.prefix", "RT-123", principal);

        // Raw token without "Bearer " prefix must NOT be sliced by 7 chars
        blacklist.Verify(b => b.RevokeTokenAsync(
            "raw.jwt.without.bearer.prefix",
            "jti-abc",
            expectedUserId,
            It.IsAny<DateTime>(),
            It.IsAny<CancellationToken>()), Times.Once);

        refreshRepo.Verify(r => r.RevokeRefreshTokenAsync("RT-123", null, It.IsAny<CancellationToken>()), Times.Once);
        refreshRepo.Verify(r => r.RevokeAllUserTokensAsync(expectedUserId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SessionService_LogoutSession_PrefersHigherPriorityUserIdClaimsAndStripsBearerPrefix()
    {
        var (service, refreshRepo, blacklist) = CreateSessionSut();

        // tenant_id takes precedence over driver_id/user_id/NameIdentifier
        var tenantPrincipal = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim("tenant_id", "TNT-FIRST"),
            new Claim("driver_id", "DRV-SECOND"),
            new Claim("user_id", "USR-THIRD"),
            new Claim(ClaimTypes.NameIdentifier, "NID-FOURTH")
        }, "Bearer"));

        await service.LogoutSessionAsync("Bearer my.access.token", null, tenantPrincipal);

        blacklist.Verify(b => b.RevokeTokenAsync("my.access.token", null, "TNT-FIRST", It.IsAny<DateTime>(), It.IsAny<CancellationToken>()), Times.Once);
        refreshRepo.Verify(r => r.RevokeAllUserTokensAsync("TNT-FIRST", It.IsAny<CancellationToken>()), Times.Once);

        // driver_id takes precedence over user_id/NameIdentifier
        var driverPrincipal = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim("driver_id", "DRV-FIRST"),
            new Claim("user_id", "USR-SECOND"),
            new Claim(ClaimTypes.NameIdentifier, "NID-THIRD")
        }, "Bearer"));

        await service.LogoutSessionAsync("Bearer drv.token", null, driverPrincipal);
        refreshRepo.Verify(r => r.RevokeAllUserTokensAsync("DRV-FIRST", It.IsAny<CancellationToken>()), Times.Once);

        // user_id takes precedence over NameIdentifier
        var staffPrincipal = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim("user_id", "USR-FIRST"),
            new Claim(ClaimTypes.NameIdentifier, "NID-SECOND")
        }, "Bearer"));

        await service.LogoutSessionAsync("Bearer stf.token", null, staffPrincipal);
        refreshRepo.Verify(r => r.RevokeAllUserTokensAsync("USR-FIRST", It.IsAny<CancellationToken>()), Times.Once);
    }

    #endregion

    #region TenantResolutionMiddleware — Claim Fallback, Header Spoofing & Error Payload

    [Fact]
    public async Task TenantResolutionMiddleware_CompanyAdminFallsBackToNameIdentifier_WhileDriverDoesNot()
    {
        var logger = new Mock<ILogger<TenantResolutionMiddleware>>();
        var nextCalls = 0;
        var middleware = new TenantResolutionMiddleware(_ =>
        {
            nextCalls++;
            return Task.CompletedTask;
        }, logger.Object);

        // 1. CompanyAdmin with NameIdentifier only -> sets TenantId
        var companyCtx = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.Role, "CompanyAdmin"),
                new Claim(ClaimTypes.NameIdentifier, "TNT-FALLBACK")
            }, "Bearer"))
        };
        var companyTenantContext = new TenantContext();
        await middleware.InvokeAsync(companyCtx, companyTenantContext);
        companyTenantContext.TenantId.Should().Be("TNT-FALLBACK");
        nextCalls.Should().Be(1);

        // 2. CompanyAdmin with BOTH tenant_id and NameIdentifier -> prefers tenant_id
        var bothCtx = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.Role, "CompanyAdmin"),
                new Claim("tenant_id", "TNT-PRIMARY"),
                new Claim(ClaimTypes.NameIdentifier, "TNT-SECONDARY")
            }, "Bearer"))
        };
        var bothTenantContext = new TenantContext();
        await middleware.InvokeAsync(bothCtx, bothTenantContext);
        bothTenantContext.TenantId.Should().Be("TNT-PRIMARY");
        nextCalls.Should().Be(2);

        // 3. Driver with NameIdentifier and X-Tenant-ID header -> does NOT set TenantId and does NOT 403
        var driverCtx = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.Role, "Driver"),
                new Claim(ClaimTypes.NameIdentifier, "DRV-100")
            }, "Bearer"))
        };
        driverCtx.Request.Headers["X-Tenant-ID"] = "TNT-OTHER";
        ITenantContext driverTenantContext = new TenantContext();
        await middleware.InvokeAsync(driverCtx, driverTenantContext);
        driverTenantContext.HasTenant.Should().BeFalse();
        driverCtx.Response.StatusCode.Should().Be(StatusCodes.Status200OK);
        nextCalls.Should().Be(3);

        // 4. CompanyAdmin with whitespace X-Tenant-ID header -> allowed through to _next
        var wsCtx = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(new[]
            {
                new Claim("tenant_id", "TNT-PRIMARY")
            }, "Bearer"))
        };
        wsCtx.Request.Headers["X-Tenant-ID"] = "   ";
        var wsTenantContext = new TenantContext();
        await middleware.InvokeAsync(wsCtx, wsTenantContext);
        wsCtx.Response.StatusCode.Should().Be(StatusCodes.Status200OK);
        nextCalls.Should().Be(4);
    }

    [Fact]
    public async Task TenantResolutionMiddleware_CrossTenantSpoof_WritesJsonErrorBodyAndContentType()
    {
        var logger = new Mock<ILogger<TenantResolutionMiddleware>>();
        var nextCalled = false;
        var middleware = new TenantResolutionMiddleware(_ =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        }, logger.Object);

        var ctx = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(new[]
            {
                new Claim("tenant_id", "TNT-A")
            }, "Bearer"))
        };
        ctx.Request.Headers["X-Tenant-ID"] = "TNT-B";
        ctx.Response.Body = new MemoryStream();

        await middleware.InvokeAsync(ctx, new TenantContext());

        nextCalled.Should().BeFalse();
        ctx.Response.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        ctx.Response.ContentType.Should().Be("application/json");

        ctx.Response.Body.Position = 0;
        var body = await new StreamReader(ctx.Response.Body).ReadToEndAsync();
        body.Should().Contain("Cross-tenant access forbidden");
    }

    #endregion

    #region RoleAuthorizationMiddleware — Short-Circuiting, Multi-Role Matching, Error Payloads

    [Fact]
    public async Task RoleAuthorizationMiddleware_AllowAnonymousAndNoRoles_InvokeNextExactlyOnce()
    {
        var logger = new Mock<ILogger<RoleAuthorizationMiddleware>>();
        var nextCount = 0;
        var middleware = new RoleAuthorizationMiddleware(_ =>
        {
            nextCount++;
            return Task.CompletedTask;
        }, logger.Object);

        // AllowAnonymous with RequireRole still bypasses role check and invokes _next once
        var anonCtx = new DefaultHttpContext();
        anonCtx.SetEndpoint(new Endpoint(
            _ => Task.CompletedTask,
            new EndpointMetadataCollection(new AllowAnonymousAttribute(), new RequireRoleAttribute(AppRoles.PlatformAdmin)),
            "AnonEndpoint"));
        await middleware.InvokeAsync(anonCtx);
        nextCount.Should().Be(1);

        // Endpoint with blank/whitespace roles produces empty requirements and invokes _next once
        var emptyRoleCtx = new DefaultHttpContext();
        emptyRoleCtx.SetEndpoint(new Endpoint(
            _ => Task.CompletedTask,
            new EndpointMetadataCollection(new RequireRoleAttribute("  "), new AuthorizeAttribute { Roles = " , " }),
            "EmptyRoleEndpoint"));
        await middleware.InvokeAsync(emptyRoleCtx);
        nextCount.Should().Be(2);
    }

    [Fact]
    public async Task RoleAuthorizationMiddleware_MultiRoleAuthorizeWithWhitespaceAndCustomRoleClaim_AllowsAccess()
    {
        var logger = new Mock<ILogger<RoleAuthorizationMiddleware>>();
        var nextCount = 0;
        var middleware = new RoleAuthorizationMiddleware(_ =>
        {
            nextCount++;
            return Task.CompletedTask;
        }, logger.Object);

        // User has ONLY custom "role" claim = "Operator" (not ClaimTypes.Role), endpoint allows " CompanyAdmin , Operator "
        var ctx = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(new[]
            {
                new Claim("role", "Operator"),
                new Claim("role", "SupportViewer")
            }, "Bearer"))
        };
        ctx.SetEndpoint(new Endpoint(
            _ => Task.CompletedTask,
            new EndpointMetadataCollection(new AuthorizeAttribute { Roles = " CompanyAdmin , Operator " }),
            "MultiRoleEndpoint"));

        await middleware.InvokeAsync(ctx);

        ctx.Response.StatusCode.Should().Be(StatusCodes.Status200OK);
        nextCount.Should().Be(1);
    }

    [Fact]
    public async Task RoleAuthorizationMiddleware_UnauthenticatedForbiddenAndRevoked_WriteExpectedJsonBodies()
    {
        var logger = new Mock<ILogger<RoleAuthorizationMiddleware>>();
        var middleware = new RoleAuthorizationMiddleware(_ => Task.CompletedTask, logger.Object);

        // 1. Unauthenticated -> 401 JSON
        var unauthCtx = new DefaultHttpContext();
        unauthCtx.Request.Path = "/api/admin/companies/pending";
        unauthCtx.Response.Body = new MemoryStream();
        unauthCtx.SetEndpoint(new Endpoint(
            _ => Task.CompletedTask,
            new EndpointMetadataCollection(new RequireRoleAttribute(AppRoles.PlatformAdmin)),
            "AdminOnly"));

        await middleware.InvokeAsync(unauthCtx);
        unauthCtx.Response.StatusCode.Should().Be(StatusCodes.Status401Unauthorized);
        unauthCtx.Response.ContentType.Should().Be("application/json");
        unauthCtx.Response.Body.Position = 0;
        var unauthJson = await new StreamReader(unauthCtx.Response.Body).ReadToEndAsync();
        unauthJson.Should().Contain("Authentication required");

        // 2. Forbidden with zero roles & no id claims -> 403 JSON with "None" and error details
        var forbidCtx = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(Array.Empty<Claim>(), "Bearer"))
        };
        forbidCtx.Request.Path = "/api/admin/company/1/suspend";
        forbidCtx.Response.Body = new MemoryStream();
        forbidCtx.SetEndpoint(new Endpoint(
            _ => Task.CompletedTask,
            new EndpointMetadataCollection(new RequireRoleAttribute(AppRoles.PlatformAdmin)),
            "AdminOnly"));

        await middleware.InvokeAsync(forbidCtx);
        forbidCtx.Response.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        forbidCtx.Response.ContentType.Should().Be("application/json");
        forbidCtx.Response.Body.Position = 0;
        var forbidJson = await new StreamReader(forbidCtx.Response.Body).ReadToEndAsync();
        var forbidDoc = JsonDocument.Parse(forbidJson).RootElement;
        forbidDoc.GetProperty("Message").GetString().Should().Be("Access denied: Insufficient permissions for role. Required role(s): PlatformAdmin.");
        forbidDoc.GetProperty("Errors")[0].GetString().Should().Be("Caller role 'None' is forbidden from accessing '/api/admin/company/1/suspend'.");

        // 3. Revoked token with non-Bearer auth header -> passes null rawToken to blacklist & writes camelCase 401 JSON
        var blacklist = new Mock<ITokenBlacklistService>();
        blacklist.Setup(b => b.IsTokenRevokedAsync(null, "jti-revoked", It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var revokedCtx = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(new[]
            {
                new Claim(JwtRegisteredClaimNames.Jti, "jti-revoked")
            }, "Bearer"))
        };
        revokedCtx.Request.Headers.Authorization = "Basic not-a-bearer-token";
        revokedCtx.Response.Body = new MemoryStream();
        revokedCtx.SetEndpoint(new Endpoint(
            _ => Task.CompletedTask,
            new EndpointMetadataCollection(new RequireRoleAttribute(AppRoles.Driver)),
            "DriverOnly"));

        await middleware.InvokeAsync(revokedCtx, blacklist.Object);
        revokedCtx.Response.StatusCode.Should().Be(StatusCodes.Status401Unauthorized);
        revokedCtx.Response.ContentType.Should().Be("application/json");
        revokedCtx.Response.Body.Position = 0;
        var revokedJson = await new StreamReader(revokedCtx.Response.Body).ReadToEndAsync();
        revokedJson.Should().Contain("\"success\":false");
        revokedJson.Should().Contain("Session has been logged out or token has been revoked");
    }

    #endregion
}
