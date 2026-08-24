using EVNexus.AuthService.Data;
using EVNexus.AuthService.DTOs;
using EVNexus.AuthService.Exceptions;
using EVNexus.AuthService.Models;

namespace EVNexus.AuthService.Services;

public interface ICompanyAuthService
{
    Task<CompanyRegisterResponseDto> RegisterCompanyAsync(CompanyRegisterRequestDto request, CancellationToken cancellationToken = default);
}

public class CompanyAuthService : ICompanyAuthService
{
    private readonly ITenantRepository _tenantRepository;
    private readonly IPasswordHasher _passwordHasher;
    private readonly ILogger<CompanyAuthService> _logger;

    public CompanyAuthService(
        ITenantRepository tenantRepository,
        IPasswordHasher passwordHasher,
        ILogger<CompanyAuthService> logger)
    {
        _tenantRepository = tenantRepository;
        _passwordHasher = passwordHasher;
        _logger = logger;
    }

    public async Task<CompanyRegisterResponseDto> RegisterCompanyAsync(
        CompanyRegisterRequestDto request,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Processing company registration for email: {Email}", request.BusinessEmail);

        // 1. Check if business email is already registered
        var isEmailTaken = await _tenantRepository.IsEmailRegisteredAsync(request.BusinessEmail, cancellationToken);
        if (isEmailTaken)
        {
            _logger.LogWarning("Registration failed: Email {Email} is already registered.", request.BusinessEmail);
            throw new DuplicateEmailException(request.BusinessEmail);
        }

        // 2. Check if registration number is already registered
        var isRegNumTaken = await _tenantRepository.IsRegistrationNumberRegisteredAsync(request.RegistrationNumber, cancellationToken);
        if (isRegNumTaken)
        {
            _logger.LogWarning("Registration failed: Registration number {RegNum} is already registered.", request.RegistrationNumber);
            throw new DuplicateRegistrationNumberException(request.RegistrationNumber);
        }

        // 3. Generate unique Tenant ID
        var tenantId = $"TNT-{Guid.NewGuid():N}".ToUpperInvariant();

        // 4. Securely hash password (never plain text)
        var passwordHash = _passwordHasher.HashPassword(request.Password);

        // 5. Create Tenant entity
        var now = DateTime.UtcNow;
        var tenant = new Tenant
        {
            TenantId = tenantId,
            CompanyName = request.CompanyName.Trim(),
            RegistrationNumber = request.RegistrationNumber.Trim(),
            BusinessEmail = request.BusinessEmail.Trim().ToLowerInvariant(),
            Phone = request.Phone.Trim(),
            Address = request.Address.Trim(),
            PasswordHash = passwordHash,
            Role = "CompanyAdmin",
            Status = "Active",
            CreatedAt = now,
            UpdatedAt = now
        };

        // 6. Persist using parameterized ADO.NET
        await _tenantRepository.CreateTenantAsync(tenant, cancellationToken);
        _logger.LogInformation("Company successfully registered with Tenant ID: {TenantId}", tenantId);

        return new CompanyRegisterResponseDto
        {
            TenantId = tenant.TenantId,
            CompanyName = tenant.CompanyName,
            RegistrationNumber = tenant.RegistrationNumber,
            BusinessEmail = tenant.BusinessEmail,
            Phone = tenant.Phone,
            CreatedAt = tenant.CreatedAt,
            Message = "Company registered successfully with isolated tenant profile."
        };
    }
}
