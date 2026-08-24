using EVNexus.AuthService.Data;
using EVNexus.AuthService.DTOs;
using EVNexus.AuthService.Exceptions;
using EVNexus.AuthService.Models;

namespace EVNexus.AuthService.Services;

public interface ICompanyAuthService
{
    Task<CompanyRegisterResponseDto> RegisterCompanyAsync(CompanyRegisterRequestDto request, CancellationToken cancellationToken = default);
    Task<CompanyLoginResponseDto> LoginCompanyAsync(CompanyLoginRequestDto request, CancellationToken cancellationToken = default);
    Task<CompanyProfileResponseDto> GetCompanyProfileAsync(string tenantId, CancellationToken cancellationToken = default);
}

public class CompanyAuthService : ICompanyAuthService
{
    private readonly ITenantRepository _tenantRepository;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IJwtTokenService _jwtTokenService;
    private readonly ILogger<CompanyAuthService> _logger;

    public CompanyAuthService(
        ITenantRepository tenantRepository,
        IPasswordHasher passwordHasher,
        IJwtTokenService jwtTokenService,
        ILogger<CompanyAuthService> logger)
    {
        _tenantRepository = tenantRepository;
        _passwordHasher = passwordHasher;
        _jwtTokenService = jwtTokenService;
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

    public async Task<CompanyLoginResponseDto> LoginCompanyAsync(
        CompanyLoginRequestDto request,
        CancellationToken cancellationToken = default)
    {
        var normalizedEmail = request.BusinessEmail.Trim().ToLowerInvariant();
        _logger.LogInformation("Processing login attempt for company email: {Email}", normalizedEmail);

        // 1. Fetch tenant by business email
        var tenant = await _tenantRepository.GetTenantByEmailAsync(normalizedEmail, cancellationToken);
        if (tenant == null)
        {
            _logger.LogWarning("Login failed: Business email {Email} not found.", normalizedEmail);
            throw new InvalidCredentialsException();
        }

        // 2. Verify password hash
        var isPasswordValid = _passwordHasher.VerifyPassword(request.Password, tenant.PasswordHash);
        if (!isPasswordValid)
        {
            _logger.LogWarning("Login failed: Invalid password supplied for email {Email}.", normalizedEmail);
            throw new InvalidCredentialsException();
        }

        // 3. Verify tenant status
        if (!string.Equals(tenant.Status, "Active", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("Login failed: Tenant {TenantId} is not in Active state (Current status: {Status}).", tenant.TenantId, tenant.Status);
            throw new InvalidCredentialsException("Account is currently inactive or suspended.");
        }

        // 4. Generate signed JWT token with Tenant ID and Role claims
        var (token, expiresInSeconds) = _jwtTokenService.GenerateToken(tenant);
        _logger.LogInformation("Login successful for Tenant ID: {TenantId}, Role: {Role}", tenant.TenantId, tenant.Role);

        return new CompanyLoginResponseDto
        {
            AccessToken = token,
            TokenType = "Bearer",
            ExpiresIn = expiresInSeconds,
            TenantId = tenant.TenantId,
            CompanyName = tenant.CompanyName,
            BusinessEmail = tenant.BusinessEmail,
            Role = tenant.Role
        };
    }

    public async Task<CompanyProfileResponseDto> GetCompanyProfileAsync(
        string tenantId,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Retrieving company profile for Tenant ID: {TenantId}", tenantId);

        var tenant = await _tenantRepository.GetTenantByIdAsync(tenantId, cancellationToken);
        if (tenant == null)
        {
            _logger.LogWarning("Company profile lookup failed: Tenant ID {TenantId} not found.", tenantId);
            throw new TenantNotFoundException(tenantId);
        }

        return new CompanyProfileResponseDto
        {
            TenantId = tenant.TenantId,
            CompanyName = tenant.CompanyName,
            RegistrationNumber = tenant.RegistrationNumber,
            BusinessEmail = tenant.BusinessEmail,
            Phone = tenant.Phone,
            Address = tenant.Address,
            Role = tenant.Role,
            Status = tenant.Status,
            CreatedAt = tenant.CreatedAt
        };
    }
}
