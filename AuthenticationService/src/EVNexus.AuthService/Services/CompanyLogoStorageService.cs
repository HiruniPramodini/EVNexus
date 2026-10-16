using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace EVNexus.AuthService.Services;

public interface ICompanyLogoStorageService
{
    Task<string> SaveLogoAsync(string tenantId, IFormFile file, CancellationToken cancellationToken = default);
    (string FilePath, string ContentType)? GetLogoFile(string fileName);
    Task<bool> DeleteLogoFileAsync(string fileNameOrUrl, CancellationToken cancellationToken = default);
}

public class CompanyLogoStorageService : ICompanyLogoStorageService
{
    private const long MaxFileSizeBytes = 5 * 1024 * 1024; // 5 MB
    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".webp"
    };

    private static readonly byte[] JpegHeader = [0xFF, 0xD8, 0xFF];
    private static readonly byte[] PngHeader = [0x89, 0x50, 0x4E, 0x47];
    private static readonly byte[] RiffHeader = [0x52, 0x49, 0x46, 0x46]; // "RIFF"
    private static readonly byte[] WebpHeader = [0x57, 0x45, 0x42, 0x50]; // "WEBP"

    private readonly string _storageDirectory;
    private readonly ILogger<CompanyLogoStorageService> _logger;

    public CompanyLogoStorageService(
        IConfiguration configuration,
        ILogger<CompanyLogoStorageService> logger)
    {
        _logger = logger;

        var configuredPath = configuration["Uploads:StoragePath"] 
                          ?? configuration["Uploads__StoragePath"] 
                          ?? Path.Combine("uploads", "company-logos");

        _storageDirectory = Path.IsPathRooted(configuredPath)
            ? configuredPath
            : Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), configuredPath));

        if (!Directory.Exists(_storageDirectory))
        {
            Directory.CreateDirectory(_storageDirectory);
        }
    }

    public async Task<string> SaveLogoAsync(string tenantId, IFormFile file, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
        {
            throw new ArgumentException("Tenant ID is required for saving company logo.", nameof(tenantId));
        }

        if (file == null || file.Length == 0)
        {
            throw new ArgumentException("No image file was provided for upload.", nameof(file));
        }

        if (file.Length > MaxFileSizeBytes)
        {
            throw new ArgumentException($"File size exceeds the maximum allowed limit of {MaxFileSizeBytes / (1024 * 1024)} MB.", nameof(file));
        }

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(extension) || !AllowedExtensions.Contains(extension))
        {
            throw new ArgumentException("Invalid file format. Only JPG, JPEG, PNG, and WEBP images are supported.", nameof(file));
        }

        // Validate image content using magic bytes to ensure file is genuinely an image
        ValidateImageMagicBytes(file, extension);

        var cleanTenantId = Regex.Replace(tenantId, @"[^a-zA-Z0-9_\-]", "_");
        var uniqueFileName = $"logo_{cleanTenantId}_{Guid.NewGuid():N}{extension}";
        var destinationPath = Path.Combine(_storageDirectory, uniqueFileName);

        // Clean up previously saved logo files for this tenant
        CleanupPreviousLogos(cleanTenantId);

        await using (var fileStream = new FileStream(destinationPath, FileMode.Create, FileAccess.Write, FileShare.None))
        {
            await file.CopyToAsync(fileStream, cancellationToken);
        }

        _logger.LogInformation("Successfully stored profile logo for tenant {TenantId} at {FilePath}", tenantId, destinationPath);

        // Return the relative API route that will be served consistently via Gateway and Auth Service
        return $"/api/auth/company/profile/picture/{uniqueFileName}";
    }

    public (string FilePath, string ContentType)? GetLogoFile(string fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName))
        {
            return null;
        }

        // Prevent directory traversal attacks
        var safeFileName = Path.GetFileName(fileName);
        var targetPath = Path.GetFullPath(Path.Combine(_storageDirectory, safeFileName));

        // Ensure the path resides inside the designated storage directory
        if (!targetPath.StartsWith(_storageDirectory, StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("Potential path traversal attempt detected for file: {FileName}", fileName);
            return null;
        }

        if (!File.Exists(targetPath))
        {
            return null;
        }

        var ext = Path.GetExtension(safeFileName).ToLowerInvariant();
        var contentType = ext switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".webp" => "image/webp",
            _ => "application/octet-stream"
        };

        return (targetPath, contentType);
    }

    public Task<bool> DeleteLogoFileAsync(string fileNameOrUrl, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(fileNameOrUrl))
        {
            return Task.FromResult(false);
        }

        var fileName = Path.GetFileName(fileNameOrUrl);
        var safePath = Path.GetFullPath(Path.Combine(_storageDirectory, fileName));

        if (safePath.StartsWith(_storageDirectory, StringComparison.OrdinalIgnoreCase) && File.Exists(safePath))
        {
            try
            {
                File.Delete(safePath);
                return Task.FromResult(true);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to delete file {FilePath}", safePath);
            }
        }

        return Task.FromResult(false);
    }

    private static void ValidateImageMagicBytes(IFormFile file, string extension)
    {
        using var stream = file.OpenReadStream();
        var buffer = new byte[12];
        var bytesRead = stream.Read(buffer, 0, buffer.Length);

        if (bytesRead < 4)
        {
            throw new ArgumentException("The uploaded file is empty or corrupted.", nameof(file));
        }

        // Check JPEG
        if (buffer[0] == JpegHeader[0] && buffer[1] == JpegHeader[1] && buffer[2] == JpegHeader[2])
        {
            if (extension != ".jpg" && extension != ".jpeg")
            {
                throw new ArgumentException("The file extension does not match the actual image format (JPEG).", nameof(file));
            }
            return;
        }

        // Check PNG
        if (buffer[0] == PngHeader[0] && buffer[1] == PngHeader[1] && buffer[2] == PngHeader[2] && buffer[3] == PngHeader[3])
        {
            if (extension != ".png")
            {
                throw new ArgumentException("The file extension does not match the actual image format (PNG).", nameof(file));
            }
            return;
        }

        // Check WEBP (RIFF at 0..3, WEBP at 8..11)
        if (bytesRead >= 12 &&
            buffer[0] == RiffHeader[0] && buffer[1] == RiffHeader[1] && buffer[2] == RiffHeader[2] && buffer[3] == RiffHeader[3] &&
            buffer[8] == WebpHeader[0] && buffer[9] == WebpHeader[1] && buffer[10] == WebpHeader[2] && buffer[11] == WebpHeader[3])
        {
            if (extension != ".webp")
            {
                throw new ArgumentException("The file extension does not match the actual image format (WEBP).", nameof(file));
            }
            return;
        }

        throw new ArgumentException("File content does not match a valid JPG, PNG, or WEBP image.", nameof(file));
    }

    private void CleanupPreviousLogos(string cleanTenantId)
    {
        try
        {
            var pattern = $"logo_{cleanTenantId}_*";
            var existingFiles = Directory.GetFiles(_storageDirectory, pattern);
            foreach (var existing in existingFiles)
            {
                try
                {
                    File.Delete(existing);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Could not delete old logo file {FilePath}", existing);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to scan for previous logos for tenant {TenantId}", cleanTenantId);
        }
    }
}
