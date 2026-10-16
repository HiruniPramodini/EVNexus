using System.Security.Claims;
using System.Text;
using EVNexus.AuthService.Controllers;
using EVNexus.AuthService.Data;
using EVNexus.AuthService.DTOs;
using EVNexus.AuthService.Exceptions;
using EVNexus.AuthService.Models;
using EVNexus.AuthService.Services;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace EVNexus.AuthService.Tests;

public class CompanyProfilePictureTests : IDisposable
{
    private readonly string _testUploadsDir;
    private readonly Mock<ILogger<CompanyLogoStorageService>> _mockStorageLogger;
    private readonly Mock<ILogger<AuthController>> _mockControllerLogger;
    private readonly Mock<ICompanyAuthService> _mockCompanyAuthService;
    private readonly Mock<IDriverAuthService> _mockDriverAuthService;
    private readonly IConfiguration _configuration;
    private readonly CompanyLogoStorageService _storageService;

    public CompanyProfilePictureTests()
    {
        _testUploadsDir = Path.Combine(Path.GetTempPath(), "evnexus_test_uploads_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_testUploadsDir);

        var configValues = new Dictionary<string, string?>
        {
            { "Uploads:StoragePath", _testUploadsDir }
        };
        _configuration = new ConfigurationBuilder().AddInMemoryCollection(configValues).Build();

        _mockStorageLogger = new Mock<ILogger<CompanyLogoStorageService>>();
        _mockControllerLogger = new Mock<ILogger<AuthController>>();
        _mockCompanyAuthService = new Mock<ICompanyAuthService>();
        _mockDriverAuthService = new Mock<IDriverAuthService>();

        _storageService = new CompanyLogoStorageService(_configuration, _mockStorageLogger.Object);
    }

    public void Dispose()
    {
        try
        {
            if (Directory.Exists(_testUploadsDir))
            {
                Directory.Delete(_testUploadsDir, true);
            }
        }
        catch
        {
            // Ignore cleanup failures in test temp folder
        }
    }

    private static IFormFile CreateMockFormFile(string fileName, byte[] content, string contentType)
    {
        var stream = new MemoryStream(content);
        return new FormFile(stream, 0, content.Length, "file", fileName)
        {
            Headers = new HeaderDictionary(),
            ContentType = contentType
        };
    }

    private static byte[] CreateValidPngBytes(int size = 100)
    {
        var bytes = new byte[Math.Max(size, 8)];
        // PNG signature: 89 50 4E 47 0D 0A 1A 0A
        bytes[0] = 0x89;
        bytes[1] = 0x50;
        bytes[2] = 0x4E;
        bytes[3] = 0x47;
        bytes[4] = 0x0D;
        bytes[5] = 0x0A;
        bytes[6] = 0x1A;
        bytes[7] = 0x0A;
        return bytes;
    }

    private static byte[] CreateValidJpegBytes(int size = 100)
    {
        var bytes = new byte[Math.Max(size, 4)];
        // JPEG signature: FF D8 FF
        bytes[0] = 0xFF;
        bytes[1] = 0xD8;
        bytes[2] = 0xFF;
        bytes[3] = 0xE0;
        return bytes;
    }

    private static byte[] CreateValidWebpBytes(int size = 100)
    {
        var bytes = new byte[Math.Max(size, 12)];
        // "RIFF" .... "WEBP"
        bytes[0] = 0x52; bytes[1] = 0x49; bytes[2] = 0x46; bytes[3] = 0x46;
        bytes[8] = 0x57; bytes[9] = 0x45; bytes[10] = 0x42; bytes[11] = 0x50;
        return bytes;
    }

    [Fact]
    public async Task SaveLogoAsync_ValidPngFile_SavesFileAndReturnsRelativeUrl()
    {
        // Arrange
        var file = CreateMockFormFile("logo.png", CreateValidPngBytes(), "image/png");

        // Act
        var relativeUrl = await _storageService.SaveLogoAsync("TNT-TEST-001", file);

        // Assert
        relativeUrl.Should().StartWith("/api/auth/company/profile/picture/logo_TNT-TEST-001_");
        relativeUrl.Should().EndWith(".png");

        var fileName = Path.GetFileName(relativeUrl);
        var fileInfo = _storageService.GetLogoFile(fileName);
        fileInfo.Should().NotBeNull();
        fileInfo!.Value.ContentType.Should().Be("image/png");
        File.Exists(fileInfo.Value.FilePath).Should().BeTrue();
    }

    [Fact]
    public async Task SaveLogoAsync_ValidJpegFile_SavesFileWithJpegContentType()
    {
        // Arrange
        var file = CreateMockFormFile("photo.jpg", CreateValidJpegBytes(), "image/jpeg");

        // Act
        var relativeUrl = await _storageService.SaveLogoAsync("TNT-CORP-200", file);

        // Assert
        relativeUrl.Should().EndWith(".jpg");
        var fileName = Path.GetFileName(relativeUrl);
        var fileInfo = _storageService.GetLogoFile(fileName);
        fileInfo.Should().NotBeNull();
        fileInfo!.Value.ContentType.Should().Be("image/jpeg");
    }

    [Fact]
    public async Task SaveLogoAsync_ValidWebpFile_SavesFileWithWebpContentType()
    {
        // Arrange
        var file = CreateMockFormFile("banner.webp", CreateValidWebpBytes(), "image/webp");

        // Act
        var relativeUrl = await _storageService.SaveLogoAsync("TNT-WEBP-300", file);

        // Assert
        relativeUrl.Should().EndWith(".webp");
        var fileName = Path.GetFileName(relativeUrl);
        var fileInfo = _storageService.GetLogoFile(fileName);
        fileInfo.Should().NotBeNull();
        fileInfo!.Value.ContentType.Should().Be("image/webp");
    }

    [Fact]
    public async Task SaveLogoAsync_WhenFileExceeds5MB_ThrowsArgumentException()
    {
        // Arrange: 5MB + 1 byte
        var largeContent = new byte[(5 * 1024 * 1024) + 1];
        var file = CreateMockFormFile("big.png", largeContent, "image/png");

        // Act
        var act = () => _storageService.SaveLogoAsync("TNT-001", file);

        // Assert
        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*exceeds the maximum allowed limit of 5 MB*");
    }

    [Fact]
    public async Task SaveLogoAsync_DisallowedExtension_ThrowsArgumentException()
    {
        // Arrange
        var file = CreateMockFormFile("exploit.exe", [0x4D, 0x5A, 0x90, 0x00], "application/octet-stream");

        // Act
        var act = () => _storageService.SaveLogoAsync("TNT-001", file);

        // Assert
        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*Only JPG, JPEG, PNG, and WEBP*");
    }

    [Fact]
    public async Task SaveLogoAsync_SpoofedExtensionWithInvalidMagicBytes_ThrowsArgumentException()
    {
        // Arrange: Named .png but contents are raw text
        var fakeBytes = Encoding.UTF8.GetBytes("<html><body>not an image</body></html>");
        var file = CreateMockFormFile("fake.png", fakeBytes, "image/png");

        // Act
        var act = () => _storageService.SaveLogoAsync("TNT-001", file);

        // Assert
        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*File content does not match a valid JPG, PNG, or WEBP image.*");
    }

    [Fact]
    public async Task SaveLogoAsync_MismatchedMagicBytes_ThrowsArgumentException()
    {
        // Arrange: Extension is .png but magic bytes are JPEG
        var jpegBytes = CreateValidJpegBytes();
        var file = CreateMockFormFile("mismatch.png", jpegBytes, "image/png");

        // Act
        var act = () => _storageService.SaveLogoAsync("TNT-001", file);

        // Assert
        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*does not match the actual image format (JPEG)*");
    }

    [Fact]
    public async Task SaveLogoAsync_ReplacesOldLogoForSameTenant()
    {
        // Arrange: Upload first logo
        var file1 = CreateMockFormFile("first.png", CreateValidPngBytes(), "image/png");
        var url1 = await _storageService.SaveLogoAsync("TNT-REPLACE-01", file1);
        var oldFile = Path.GetFileName(url1);

        // Act: Upload second logo for same tenant
        var file2 = CreateMockFormFile("second.png", CreateValidPngBytes(), "image/png");
        var url2 = await _storageService.SaveLogoAsync("TNT-REPLACE-01", file2);

        // Assert
        url1.Should().NotBe(url2);
        _storageService.GetLogoFile(oldFile).Should().BeNull(); // Old file removed
        var newFile = Path.GetFileName(url2);
        _storageService.GetLogoFile(newFile).Should().NotBeNull();
    }

    [Fact]
    public void GetLogoFile_PathTraversalAttempt_ReturnsNull()
    {
        // Act
        var result = _storageService.GetLogoFile("../../../windows/system32/cmd.exe");

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public void GetLogoFile_NonExistentFile_ReturnsNull()
    {
        // Act
        var result = _storageService.GetLogoFile("nonexistent_file_12345.png");

        // Assert
        result.Should().BeNull();
    }

    // ==========================================
    // Controller Endpoint Tests
    // ==========================================

    [Fact]
    public async Task UploadCompanyProfilePicture_ValidFile_ReturnsOk200()
    {
        // Arrange
        var controller = new AuthController(
            _mockCompanyAuthService.Object,
            _mockDriverAuthService.Object,
            _mockControllerLogger.Object,
            logoStorageService: _storageService);

        var user = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim("tenant_id", "TNT-CORP-999"),
            new Claim(ClaimTypes.Role, "CompanyAdmin")
        }, "mock"));

        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = user } };

        var updatedProfile = new CompanyProfileResponseDto
        {
            TenantId = "TNT-CORP-999",
            CompanyName = "SolarDrive Ltd",
            LogoUrl = "/api/auth/company/profile/picture/logo_TNT_CORP_999_sample.png"
        };

        _mockCompanyAuthService
            .Setup(s => s.UpdateCompanyLogoAsync("TNT-CORP-999", It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(updatedProfile);

        var validFile = CreateMockFormFile("logo.png", CreateValidPngBytes(), "image/png");

        // Act
        var result = await controller.UploadCompanyProfilePicture(validFile, CancellationToken.None);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var apiResponse = okResult.Value.Should().BeOfType<ApiResponse<CompanyProfileResponseDto>>().Subject;
        apiResponse.Success.Should().BeTrue();
        apiResponse.Data!.LogoUrl.Should().Be(updatedProfile.LogoUrl);
    }

    [Fact]
    public async Task UploadCompanyProfilePicture_MissingFile_ReturnsBadRequest400()
    {
        // Arrange
        var controller = new AuthController(
            _mockCompanyAuthService.Object,
            _mockDriverAuthService.Object,
            _mockControllerLogger.Object,
            logoStorageService: _storageService);

        var user = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim("tenant_id", "TNT-CORP-999"),
            new Claim(ClaimTypes.Role, "CompanyAdmin")
        }, "mock"));

        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = user } };

        // Act
        var result = await controller.UploadCompanyProfilePicture(null, CancellationToken.None);

        // Assert
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task UploadCompanyProfilePicture_MissingTenantClaim_ReturnsUnauthorized401()
    {
        // Arrange
        var controller = new AuthController(
            _mockCompanyAuthService.Object,
            _mockDriverAuthService.Object,
            _mockControllerLogger.Object,
            logoStorageService: _storageService);

        // No tenant claim
        var user = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.Role, "CompanyAdmin")
        }, "mock"));

        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = user } };
        var validFile = CreateMockFormFile("logo.png", CreateValidPngBytes(), "image/png");

        // Act
        var result = await controller.UploadCompanyProfilePicture(validFile, CancellationToken.None);

        // Assert
        result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    [Fact]
    public async Task GetCompanyProfilePicture_ExistingFile_ReturnsPhysicalFileWithCacheControl()
    {
        // Arrange: Upload file to storage first
        var file = CreateMockFormFile("avatar.png", CreateValidPngBytes(), "image/png");
        var relativeUrl = await _storageService.SaveLogoAsync("TNT-CACHE-01", file);
        var fileName = Path.GetFileName(relativeUrl);

        var controller = new AuthController(
            _mockCompanyAuthService.Object,
            _mockDriverAuthService.Object,
            _mockControllerLogger.Object,
            logoStorageService: _storageService);

        var httpContext = new DefaultHttpContext();
        controller.ControllerContext = new ControllerContext { HttpContext = httpContext };

        // Act
        var result = controller.GetCompanyProfilePicture(fileName);

        // Assert
        var physicalResult = result.Should().BeOfType<PhysicalFileResult>().Subject;
        physicalResult.ContentType.Should().Be("image/png");
        httpContext.Response.Headers.CacheControl.ToString().Should().Contain("max-age=86400");
    }

    [Fact]
    public void GetCompanyProfilePicture_NonExistentFile_ReturnsNotFound404()
    {
        // Arrange
        var controller = new AuthController(
            _mockCompanyAuthService.Object,
            _mockDriverAuthService.Object,
            _mockControllerLogger.Object,
            logoStorageService: _storageService);

        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };

        // Act
        var result = controller.GetCompanyProfilePicture("missing.png");

        // Assert
        result.Should().BeOfType<NotFoundObjectResult>();
    }
}
