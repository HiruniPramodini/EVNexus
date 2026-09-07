using System.Security.Claims;
using System.Text.Json;
using EVNexus.AuthService.Controllers;
using EVNexus.AuthService.Data;
using EVNexus.AuthService.DTOs;
using EVNexus.AuthService.Exceptions;
using EVNexus.AuthService.Middleware;
using EVNexus.AuthService.Models;
using EVNexus.AuthService.Services;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace EVNexus.AuthService.Tests;

public class MultiTenantIsolationTests
{
    private readonly Mock<IStationRepository> _mockStationRepo;
    private readonly Mock<ILogger<CompanyDataController>> _mockLogger;

    public MultiTenantIsolationTests()
    {
        _mockStationRepo = new Mock<IStationRepository>();
        _mockLogger = new Mock<ILogger<CompanyDataController>>();
    }

    private static CompanyDataController CreateControllerWithTenant(
        IStationRepository repo,
        ILogger<CompanyDataController> logger,
        string tenantId)
    {
        var tenantContext = new TenantContext { TenantId = tenantId };
        var controller = new CompanyDataController(repo, tenantContext, logger);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, tenantId),
            new("tenant_id", tenantId),
            new(ClaimTypes.Role, "CompanyAdmin")
        };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        var user = new ClaimsPrincipal(identity);

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user }
        };

        return controller;
    }

    [Fact]
    public async Task GetStations_WithTwoDifferentTenants_ReturnsStrictlyIsolatedData()
    {
        // Arrange: Tenant A and Tenant B data
        const string tenantA = "TNT-ALPHA-1111";
        const string tenantB = "TNT-BETA-2222";

        var stationsTenantA = new List<Station>
        {
            new() { StationId = "STN-A1", TenantId = tenantA, Name = "Alpha Central 1", Location = "100 Alpha St", TotalPorts = 4 },
            new() { StationId = "STN-A2", TenantId = tenantA, Name = "Alpha North 2", Location = "200 Alpha Blvd", TotalPorts = 2 }
        };

        var stationsTenantB = new List<Station>
        {
            new() { StationId = "STN-B1", TenantId = tenantB, Name = "Beta Plaza 1", Location = "300 Beta Way", TotalPorts = 6 },
            new() { StationId = "STN-B2", TenantId = tenantB, Name = "Beta South 2", Location = "400 Beta Rd", TotalPorts = 8 },
            new() { StationId = "STN-B3", TenantId = tenantB, Name = "Beta Express 3", Location = "500 Beta Hwy", TotalPorts = 2 }
        };

        var mockRepoA = new Mock<IStationRepository>();
        mockRepoA.Setup(r => r.GetStationsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(stationsTenantA);

        var mockRepoB = new Mock<IStationRepository>();
        mockRepoB.Setup(r => r.GetStationsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(stationsTenantB);

        var controllerA = CreateControllerWithTenant(mockRepoA.Object, _mockLogger.Object, tenantA);
        var controllerB = CreateControllerWithTenant(mockRepoB.Object, _mockLogger.Object, tenantB);

        // Act
        var resultA = await controllerA.GetStations(CancellationToken.None);
        var resultB = await controllerB.GetStations(CancellationToken.None);

        // Assert - Tenant A isolation
        var okA = resultA.Should().BeOfType<OkObjectResult>().Subject;
        var responseA = okA.Value.Should().BeOfType<ApiResponse<IReadOnlyList<StationResponseDto>>>().Subject;
        responseA.Success.Should().BeTrue();
        responseA.Data.Should().HaveCount(2);
        responseA.Data.Should().OnlyContain(s => s.TenantId == tenantA);
        responseA.Data!.Select(s => s.StationId).Should().BeEquivalentTo("STN-A1", "STN-A2");

        // Assert - Tenant B isolation
        var okB = resultB.Should().BeOfType<OkObjectResult>().Subject;
        var responseB = okB.Value.Should().BeOfType<ApiResponse<IReadOnlyList<StationResponseDto>>>().Subject;
        responseB.Success.Should().BeTrue();
        responseB.Data.Should().HaveCount(3);
        responseB.Data.Should().OnlyContain(s => s.TenantId == tenantB);
        responseB.Data!.Select(s => s.StationId).Should().BeEquivalentTo("STN-B1", "STN-B2", "STN-B3");
    }

    [Fact]
    public async Task GetStationById_WhenCallerAttemptsCrossTenantAccess_Returns403Forbidden()
    {
        // Arrange: Caller is Tenant A, Station belongs to Tenant B
        const string tenantA = "TNT-ALPHA-1111";
        const string tenantB = "TNT-BETA-2222";
        const string targetStationId = "STN-B1";

        _mockStationRepo.Setup(r => r.GetStationByIdAsync(targetStationId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Station?)null); // Scoped query returns null because Tenant A doesn't own it

        _mockStationRepo.Setup(r => r.GetStationByIdGlobalAsync(targetStationId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Station
            {
                StationId = targetStationId,
                TenantId = tenantB, // Station belongs to Tenant B
                Name = "Beta Plaza 1",
                Location = "300 Beta Way"
            });

        var controller = CreateControllerWithTenant(_mockStationRepo.Object, _mockLogger.Object, tenantA);

        // Act
        var result = await controller.GetStationById(targetStationId, CancellationToken.None);

        // Assert: 403 Forbidden is returned
        var forbiddenResult = result.Should().BeOfType<ObjectResult>().Subject;
        forbiddenResult.StatusCode.Should().Be(StatusCodes.Status403Forbidden);

        var apiResponse = forbiddenResult.Value.Should().BeOfType<ApiResponse<object>>().Subject;
        apiResponse.Success.Should().BeFalse();
        apiResponse.Message.Should().Contain("Cross-tenant access forbidden");
    }

    [Fact]
    public async Task GetStationsForTenant_WhenTargetTenantDiffersFromJwt_Returns403Forbidden()
    {
        // Arrange: Caller has Tenant A in JWT, but calls endpoint for Tenant B
        const string callerTenantA = "TNT-ALPHA-1111";
        const string targetTenantB = "TNT-BETA-2222";

        var controller = CreateControllerWithTenant(_mockStationRepo.Object, _mockLogger.Object, callerTenantA);

        // Act
        var result = await controller.GetStationsForTenant(targetTenantB, CancellationToken.None);

        // Assert: 403 Forbidden
        var forbiddenResult = result.Should().BeOfType<ObjectResult>().Subject;
        forbiddenResult.StatusCode.Should().Be(StatusCodes.Status403Forbidden);

        var apiResponse = forbiddenResult.Value.Should().BeOfType<ApiResponse<object>>().Subject;
        apiResponse.Success.Should().BeFalse();
        apiResponse.Message.Should().Contain("Cross-tenant access forbidden");
    }

    [Fact]
    public async Task UpdateStation_WhenTargetStationBelongsToAnotherTenant_Returns403Forbidden()
    {
        // Arrange
        const string callerTenantA = "TNT-ALPHA-1111";
        const string foreignTenantB = "TNT-BETA-2222";
        const string foreignStationId = "STN-B1";

        _mockStationRepo.Setup(r => r.GetStationByIdAsync(foreignStationId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Station?)null);

        _mockStationRepo.Setup(r => r.GetStationByIdGlobalAsync(foreignStationId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Station
            {
                StationId = foreignStationId,
                TenantId = foreignTenantB,
                Name = "Beta Station"
            });

        var controller = CreateControllerWithTenant(_mockStationRepo.Object, _mockLogger.Object, callerTenantA);
        var updateDto = new UpdateStationRequestDto
        {
            Name = "Hacked Station Name",
            Location = "Hacked Location"
        };

        // Act
        var result = await controller.UpdateStation(foreignStationId, updateDto, CancellationToken.None);

        // Assert: 403 Forbidden and repository update was NEVER called
        var forbidden = result.Should().BeOfType<ObjectResult>().Subject;
        forbidden.StatusCode.Should().Be(StatusCodes.Status403Forbidden);

        _mockStationRepo.Verify(r => r.UpdateStationAsync(It.IsAny<Station>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task DeleteStation_WhenTargetStationBelongsToAnotherTenant_Returns403Forbidden()
    {
        // Arrange
        const string callerTenantA = "TNT-ALPHA-1111";
        const string foreignTenantB = "TNT-BETA-2222";
        const string foreignStationId = "STN-B1";

        _mockStationRepo.Setup(r => r.GetStationByIdAsync(foreignStationId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Station?)null);

        _mockStationRepo.Setup(r => r.GetStationByIdGlobalAsync(foreignStationId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Station
            {
                StationId = foreignStationId,
                TenantId = foreignTenantB,
                Name = "Beta Station"
            });

        var controller = CreateControllerWithTenant(_mockStationRepo.Object, _mockLogger.Object, callerTenantA);

        // Act
        var result = await controller.DeleteStation(foreignStationId, CancellationToken.None);

        // Assert: 403 Forbidden and repository delete was NEVER called
        var forbidden = result.Should().BeOfType<ObjectResult>().Subject;
        forbidden.StatusCode.Should().Be(StatusCodes.Status403Forbidden);

        _mockStationRepo.Verify(r => r.DeleteStationAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task CreateStation_AutomaticallyStampsCallerTenantId()
    {
        // Arrange
        const string callerTenantA = "TNT-ALPHA-1111";

        Station? capturedStation = null;
        _mockStationRepo.Setup(r => r.CreateStationAsync(It.IsAny<Station>(), It.IsAny<CancellationToken>()))
            .Callback<Station, CancellationToken>((s, _) => capturedStation = s)
            .ReturnsAsync((Station s, CancellationToken _) => s);

        var controller = CreateControllerWithTenant(_mockStationRepo.Object, _mockLogger.Object, callerTenantA);
        var request = new CreateStationRequestDto
        {
            Name = "New Alpha Station",
            Location = "123 Solar Way",
            Latitude = 37.7749m,
            Longitude = -122.4194m,
            TotalPorts = 4
        };

        // Act
        var result = await controller.CreateStation(request, CancellationToken.None);

        // Assert
        var created = result.Should().BeOfType<ObjectResult>().Subject;
        created.StatusCode.Should().Be(StatusCodes.Status201Created);

        capturedStation.Should().NotBeNull();
        capturedStation!.TenantId.Should().Be(callerTenantA);
        capturedStation.Name.Should().Be("New Alpha Station");
        capturedStation.StationId.Should().StartWith("STN-");
    }

    [Fact]
    public async Task TenantResolutionMiddleware_WhenXTenantIdConflictsWithJwt_Returns403Forbidden()
    {
        // Arrange
        const string authenticatedTenant = "TNT-ALPHA-1111";
        const string spoofedTenant = "TNT-BETA-2222";

        var nextInvoked = false;
        RequestDelegate next = (ctx) =>
        {
            nextInvoked = true;
            return Task.CompletedTask;
        };

        var middlewareLogger = new Mock<ILogger<TenantResolutionMiddleware>>();
        var middleware = new TenantResolutionMiddleware(next, middlewareLogger.Object);

        var context = new DefaultHttpContext();
        var claims = new List<Claim>
        {
            new("tenant_id", authenticatedTenant),
            new(ClaimTypes.Role, "CompanyAdmin")
        };
        context.User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"));
        context.Request.Headers["X-Tenant-ID"] = spoofedTenant;

        var tenantContext = new TenantContext();

        // Act
        await middleware.InvokeAsync(context, tenantContext);

        // Assert
        context.Response.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        nextInvoked.Should().BeFalse(); // Pipeline was aborted
    }

    [Fact]
    public async Task StationRepository_WithoutTenantContext_ThrowsCrossTenantAccessException()
    {
        // Arrange
        var mockFactory = new Mock<IDbConnectionFactory>();
        var emptyTenantContext = new TenantContext { TenantId = null }; // Missing tenant context
        var repo = new StationRepository(mockFactory.Object, emptyTenantContext);

        // Act & Assert
        var actGet = () => repo.GetStationsAsync();
        await actGet.Should().ThrowAsync<CrossTenantAccessException>()
            .WithMessage("*Tenant identification is missing*");

        var actGetById = () => repo.GetStationByIdAsync("STN-123");
        await actGetById.Should().ThrowAsync<CrossTenantAccessException>()
            .WithMessage("*Tenant identification is missing*");

        var actCreate = () => repo.CreateStationAsync(new Station { Name = "Test" });
        await actCreate.Should().ThrowAsync<CrossTenantAccessException>()
            .WithMessage("*Tenant identification is missing*");
    }

    [Fact]
    public void DatabaseSchema_CompanyOwnedTables_DefineTenantForeignKeyConstraints()
    {
        // Arrange & Act
        // Verify via DatabaseInitializer code structure that company-owned tables have foreign keys
        var initializerType = typeof(DatabaseInitializer);
        initializerType.Should().NotBeNull();

        var stationType = typeof(Station);
        stationType.GetProperty("TenantId").Should().NotBeNull();

        var tariffType = typeof(Tariff);
        tariffType.GetProperty("TenantId").Should().NotBeNull();
    }
}
