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
    Task<CompanyProfileResponseDto> UpdateCompanyProfileAsync(string tenantId, UpdateCompanyProfileRequestDto request, CancellationToken cancellationToken = default);
    Task<InitiateEmailChangeResponseDto> InitiateEmailChangeAsync(string tenantId, InitiateEmailChangeRequestDto request, CancellationToken cancellationToken = default);
    Task<VerifyEmailResponseDto> VerifyCompanyEmailAsync(string email, string code, CancellationToken cancellationToken = default);
    Task<InitiateEmailChangeResponseDto> ResendCompanyVerificationCodeAsync(string email, CancellationToken cancellationToken = default);
    Task<StaffResponseDto> CreateStaffMemberAsync(string tenantId, CreateStaffRequestDto request, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<StaffResponseDto>> GetStaffMembersAsync(string tenantId, CancellationToken cancellationToken = default);
    Task<StaffResponseDto> DeactivateStaffMemberAsync(string tenantId, string userId, CancellationToken cancellationToken = default);
    Task<StaffResponseDto> ReactivateStaffMemberAsync(string tenantId, string userId, CancellationToken cancellationToken = default);
    Task<bool> DeleteCompanyAsync(string tenantId, CancellationToken cancellationToken = default);
    Task<BillingInfoDto> GetBillingInfoAsync(string tenantId, CancellationToken cancellationToken = default);
    Task<BillingInfoDto> UpdateBillingInfoAsync(string tenantId, UpdateBillingRequestDto request, CancellationToken cancellationToken = default);
}

public class CompanyAuthService : ICompanyAuthService
{
    private readonly ITenantRepository _tenantRepository;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IJwtTokenService _jwtTokenService;
    private readonly ILogger<CompanyAuthService> _logger;
    private readonly ISessionService? _sessionService;

    public CompanyAuthService(
        ITenantRepository tenantRepository,
        IPasswordHasher passwordHasher,
        IJwtTokenService jwtTokenService,
        ILogger<CompanyAuthService> logger,
        ISessionService? sessionService = null)
    {
        _tenantRepository = tenantRepository;
        _passwordHasher = passwordHasher;
        _jwtTokenService = jwtTokenService;
        _logger = logger;
        _sessionService = sessionService;
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

        // 5. Create Tenant entity (unverified by default until email verified, pending approval by default)
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
            Status = "Pending",
            IsEmailVerified = false,
            CreatedAt = now,
            UpdatedAt = now
        };

        // 6. Persist using parameterized ADO.NET
        await _tenantRepository.CreateTenantAsync(tenant, cancellationToken);

        // 7. Generate 24-hour verification code and link
        var verificationCode = Random.Shared.Next(100000, 1000000).ToString();
        var expiresAt = DateTime.UtcNow.AddHours(24);

        await _tenantRepository.SaveEmailVerificationCodeAsync(
            tenant.TenantId, tenant.BusinessEmail, verificationCode, expiresAt, cancellationToken);

        _logger.LogInformation("Company successfully registered with Tenant ID: {TenantId} in Pending status. Verification code generated with 24-hour expiry.", tenantId);

        return new CompanyRegisterResponseDto
        {
            TenantId = tenant.TenantId,
            CompanyName = tenant.CompanyName,
            RegistrationNumber = tenant.RegistrationNumber,
            BusinessEmail = tenant.BusinessEmail,
            Phone = tenant.Phone,
            CreatedAt = tenant.CreatedAt,
            Message = "Company registered successfully. A verification code has been dispatched. Please verify your email to unlock full platform access.",
            VerificationCode = verificationCode,
            VerificationLink = $"/verify-email?email={Uri.EscapeDataString(tenant.BusinessEmail)}&code={verificationCode}",
            ExpiresAt = expiresAt,
            IsEmailVerified = false
        };
    }

    public async Task<CompanyLoginResponseDto> LoginCompanyAsync(CompanyLoginRequestDto request, CancellationToken cancellationToken = default)
    {
        var normalizedEmail = request.BusinessEmail.Trim().ToLowerInvariant();

        // 1. Check if the user is a primary Tenant (Company Admin)
        var tenant = await _tenantRepository.GetTenantByEmailAsync(normalizedEmail, cancellationToken);
        if (tenant != null)
        {
            var isPasswordValid = _passwordHasher.VerifyPassword(request.Password, tenant.PasswordHash);
            if (!isPasswordValid)
            {
                _logger.LogWarning("Login failed: Invalid password supplied for company email {Email}.", normalizedEmail);
                throw new InvalidCredentialsException();
            }

            // 3. Verify tenant status
            if (string.Equals(tenant.Status, "Suspended", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("Login rejected: Tenant {TenantId} account is suspended.", tenant.TenantId);
                throw new InvalidCredentialsException("Account is suspended. Please contact platform support.");
            }

            if (string.Equals(tenant.Status, "Rejected", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("Login rejected: Tenant {TenantId} account was rejected.", tenant.TenantId);
                throw new InvalidCredentialsException("Account registration was rejected. Please contact platform support.");
            }

            if (string.Equals(tenant.Status, "Inactive", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("Login failed: Tenant {TenantId} is not in Active state (Current status: {Status}).", tenant.TenantId, tenant.Status);
                throw new InvalidCredentialsException("Account is currently inactive or suspended.");
            }

            // 4. Generate signed JWT token with Tenant ID and Role claims
            var (token, expiresInSeconds) = _jwtTokenService.GenerateToken(tenant);
            var refreshToken = _sessionService != null
                ? await _sessionService.GenerateAndSaveRefreshTokenAsync(tenant.TenantId, "Tenant", tenant.Role, null, cancellationToken)
                : string.Empty;

            _logger.LogInformation("Login successful for Tenant ID: {TenantId}, Role: {Role}, Status: {Status}, IsEmailVerified: {Verified}",
                tenant.TenantId, tenant.Role, tenant.Status, tenant.IsEmailVerified);

            return new CompanyLoginResponseDto
            {
                AccessToken = token,
                TokenType = "Bearer",
                ExpiresIn = expiresInSeconds,
                TenantId = tenant.TenantId,
                CompanyName = tenant.CompanyName,
                BusinessEmail = tenant.BusinessEmail,
                Role = tenant.Role,
                Status = tenant.Status,
                IsEmailVerified = tenant.IsEmailVerified,
                RefreshToken = refreshToken
            };
        }

        // 2. If not found in tenants, check company_users (staff accounts)
        var staffUser = await _tenantRepository.GetStaffUserByEmailAsync(normalizedEmail, cancellationToken);
        if (staffUser != null)
        {
            var isPasswordValid = _passwordHasher.VerifyPassword(request.Password, staffUser.PasswordHash);
            if (!isPasswordValid)
            {
                _logger.LogWarning("Login failed: Invalid password supplied for staff email {Email}.", normalizedEmail);
                throw new InvalidCredentialsException();
            }

            if (!string.Equals(staffUser.Status, "Active", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("Login failed: Staff account {UserId} is deactivated (Status: {Status}).", staffUser.UserId, staffUser.Status);
                throw new InvalidCredentialsException("Account is currently inactive or suspended.");
            }

            var associatedTenant = await _tenantRepository.GetTenantByIdAsync(staffUser.TenantId, cancellationToken);
            if (associatedTenant != null && string.Equals(associatedTenant.Status, "Suspended", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("Login rejected: Company tenant {TenantId} for staff {UserId} is suspended.", staffUser.TenantId, staffUser.UserId);
                throw new InvalidCredentialsException("Account is suspended. Please contact platform support.");
            }

            if (associatedTenant == null || !string.Equals(associatedTenant.Status, "Active", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("Login failed: Associated tenant {TenantId} for staff {UserId} is inactive or not found.", staffUser.TenantId, staffUser.UserId);
                throw new InvalidCredentialsException("Company account is currently inactive or suspended.");
            }

            var (token, expiresInSeconds) = _jwtTokenService.GenerateStaffToken(staffUser, associatedTenant);
            var refreshToken = _sessionService != null
                ? await _sessionService.GenerateAndSaveRefreshTokenAsync(staffUser.UserId, "Staff", staffUser.Role, null, cancellationToken)
                : string.Empty;

            _logger.LogInformation("Login successful for Staff ID: {UserId}, Tenant ID: {TenantId}, Role: {Role}", staffUser.UserId, staffUser.TenantId, staffUser.Role);

            return new CompanyLoginResponseDto
            {
                AccessToken = token,
                TokenType = "Bearer",
                ExpiresIn = expiresInSeconds,
                TenantId = associatedTenant.TenantId,
                CompanyName = associatedTenant.CompanyName,
                BusinessEmail = staffUser.Email,
                Role = staffUser.Role,
                IsEmailVerified = associatedTenant.IsEmailVerified,
                RefreshToken = refreshToken
            };
        }

        _logger.LogWarning("Login failed: Business email {Email} not found in companies or staff.", normalizedEmail);
        throw new InvalidCredentialsException();
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
            LogoUrl = tenant.LogoUrl,
            Role = tenant.Role,
            Status = tenant.Status,
            IsEmailVerified = tenant.IsEmailVerified,
            CreatedAt = tenant.CreatedAt,
            UpdatedAt = tenant.UpdatedAt
        };
    }

    public async Task<CompanyProfileResponseDto> UpdateCompanyProfileAsync(
        string tenantId,
        UpdateCompanyProfileRequestDto request,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Processing company profile update for Tenant ID: {TenantId}", tenantId);

        var currentTenant = await _tenantRepository.GetTenantByIdAsync(tenantId, cancellationToken);
        if (currentTenant == null)
        {
            _logger.LogWarning("Company profile update failed: Tenant ID {TenantId} not found.", tenantId);
            throw new TenantNotFoundException(tenantId);
        }

        // Check if business email update is requested
        if (!string.IsNullOrWhiteSpace(request.BusinessEmail) &&
            !string.Equals(request.BusinessEmail.Trim(), currentTenant.BusinessEmail, StringComparison.OrdinalIgnoreCase))
        {
            var newEmail = request.BusinessEmail.Trim().ToLowerInvariant();

            // Criterion: Business email cannot be changed without re-verification
            if (string.IsNullOrWhiteSpace(request.EmailVerificationCode))
            {
                _logger.LogWarning("Tenant {TenantId} attempted to change business email without verification code.", tenantId);
                throw new BusinessEmailChangeRequiresVerificationException("Business email cannot be changed without re-verification.");
            }

            var isValid = await _tenantRepository.ValidateAndConsumeVerificationCodeAsync(
                tenantId, newEmail, request.EmailVerificationCode.Trim(), cancellationToken);

            if (!isValid)
            {
                _logger.LogWarning("Tenant {TenantId} provided invalid or expired verification code for email {Email}.", tenantId, newEmail);
                throw new EmailVerificationException("Invalid or expired email verification code.");
            }

            // Ensure email is not already taken by another tenant
            var isTaken = await _tenantRepository.IsEmailRegisteredAsync(newEmail, cancellationToken);
            if (isTaken)
            {
                _logger.LogWarning("Tenant {TenantId} attempted to change email to {Email} which is already registered.", tenantId, newEmail);
                throw new DuplicateEmailException(newEmail);
            }

            await _tenantRepository.UpdateTenantEmailAsync(tenantId, newEmail, cancellationToken);
            _logger.LogInformation("Business email for Tenant {TenantId} successfully updated to {Email}.", tenantId, newEmail);
        }

        // Update core company profile details: Name, Phone, Address, Logo
        var updatedTenant = await _tenantRepository.UpdateTenantProfileAsync(
            tenantId,
            request.CompanyName.Trim(),
            request.Phone.Trim(),
            request.Address.Trim(),
            request.LogoUrl?.Trim(),
            cancellationToken);

        if (updatedTenant == null)
        {
            throw new TenantNotFoundException(tenantId);
        }

        _logger.LogInformation("Company profile for Tenant {TenantId} successfully updated.", tenantId);

        return new CompanyProfileResponseDto
        {
            TenantId = updatedTenant.TenantId,
            CompanyName = updatedTenant.CompanyName,
            RegistrationNumber = updatedTenant.RegistrationNumber,
            BusinessEmail = updatedTenant.BusinessEmail,
            Phone = updatedTenant.Phone,
            Address = updatedTenant.Address,
            LogoUrl = updatedTenant.LogoUrl,
            Role = updatedTenant.Role,
            Status = updatedTenant.Status,
            CreatedAt = updatedTenant.CreatedAt,
            UpdatedAt = updatedTenant.UpdatedAt
        };
    }

    public async Task<InitiateEmailChangeResponseDto> InitiateEmailChangeAsync(
        string tenantId,
        InitiateEmailChangeRequestDto request,
        CancellationToken cancellationToken = default)
    {
        var currentTenant = await _tenantRepository.GetTenantByIdAsync(tenantId, cancellationToken);
        if (currentTenant == null)
        {
            throw new TenantNotFoundException(tenantId);
        }

        var normalizedNewEmail = request.NewBusinessEmail.Trim().ToLowerInvariant();
        if (string.Equals(normalizedNewEmail, currentTenant.BusinessEmail, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("The requested email is already your current registered business email.");
        }

        var isTaken = await _tenantRepository.IsEmailRegisteredAsync(normalizedNewEmail, cancellationToken);
        if (isTaken)
        {
            throw new DuplicateEmailException(normalizedNewEmail);
        }

        // Generate 6-digit verification code
        var verificationCode = Random.Shared.Next(100000, 999999).ToString();
        var expiresAt = DateTime.UtcNow.AddMinutes(15);

        await _tenantRepository.SaveEmailVerificationCodeAsync(
            tenantId, normalizedNewEmail, verificationCode, expiresAt, cancellationToken);

        _logger.LogInformation("Generated email change verification code for Tenant {TenantId} to new email {NewEmail}.", tenantId, normalizedNewEmail);

        return new InitiateEmailChangeResponseDto
        {
            Message = "Verification code generated successfully. Please enter this code to confirm your new business email.",
            NewBusinessEmail = normalizedNewEmail,
            VerificationCode = verificationCode,
            ExpiresAt = expiresAt
        };
    }

    public async Task<VerifyEmailResponseDto> VerifyCompanyEmailAsync(
        string email,
        string code,
        CancellationToken cancellationToken = default)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();
        _logger.LogInformation("Attempting to verify company email for {Email}", normalizedEmail);

        var tenant = await _tenantRepository.GetTenantByEmailAsync(normalizedEmail, cancellationToken);
        if (tenant == null)
        {
            throw new TenantNotFoundException($"Account with email '{normalizedEmail}' was not found.");
        }

        if (tenant.IsEmailVerified)
        {
            return new VerifyEmailResponseDto
            {
                IsVerified = true,
                Email = normalizedEmail,
                AccountType = "Company",
                Message = "Account email is already verified. Full platform access is unlocked."
            };
        }

        var (success, status) = await _tenantRepository.ValidateAndConsumeTenantRegistrationCodeAsync(normalizedEmail, code, cancellationToken);
        if (!success)
        {
            if (status == "Expired")
            {
                throw new VerificationCodeExpiredException("Verification code has expired. Verification links and codes expire after 24 hours. Please request a new code.");
            }
            if (status == "AlreadyUsed")
            {
                throw new VerificationCodeAlreadyUsedException("Verification code has already been used.");
            }
            throw new EmailVerificationException("Invalid verification code or email.");
        }

        await _tenantRepository.MarkEmailAsVerifiedAsync(tenant.TenantId, cancellationToken);
        _logger.LogInformation("Company email verified successfully for Tenant ID: {TenantId}", tenant.TenantId);

        return new VerifyEmailResponseDto
        {
            IsVerified = true,
            Email = normalizedEmail,
            AccountType = "Company",
            Message = "Email verified successfully! Full platform access is now granted."
        };
    }

    public async Task<InitiateEmailChangeResponseDto> ResendCompanyVerificationCodeAsync(
        string email,
        CancellationToken cancellationToken = default)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();
        _logger.LogInformation("Resending verification code for company email: {Email}", normalizedEmail);

        var tenant = await _tenantRepository.GetTenantByEmailAsync(normalizedEmail, cancellationToken);
        if (tenant == null)
        {
            throw new TenantNotFoundException($"Account with email '{normalizedEmail}' was not found.");
        }

        if (tenant.IsEmailVerified)
        {
            throw new AccountAlreadyVerifiedException("Account email is already verified.");
        }

        var verificationCode = Random.Shared.Next(100000, 1000000).ToString();
        var expiresAt = DateTime.UtcNow.AddHours(24);

        await _tenantRepository.SaveEmailVerificationCodeAsync(
            tenant.TenantId, normalizedEmail, verificationCode, expiresAt, cancellationToken);

        _logger.LogInformation("Resent 24-hour verification code for Tenant {TenantId}.", tenant.TenantId);

        return new InitiateEmailChangeResponseDto
        {
            Message = "New verification code generated successfully. It will expire in 24 hours.",
            NewBusinessEmail = normalizedEmail,
            VerificationCode = verificationCode,
            ExpiresAt = expiresAt
        };
    }

    public async Task<StaffResponseDto> CreateStaffMemberAsync(
        string tenantId,
        CreateStaffRequestDto request,
        CancellationToken cancellationToken = default)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        _logger.LogInformation("Creating staff account {Email} for Tenant ID: {TenantId}", normalizedEmail, tenantId);

        if (string.Equals(request.Role, "CompanyAdmin", StringComparison.OrdinalIgnoreCase))
        {
            throw new ArgumentException("Staff accounts cannot be created with CompanyAdmin role.");
        }

        var isTenantEmailTaken = await _tenantRepository.IsEmailRegisteredAsync(normalizedEmail, cancellationToken);
        var isStaffEmailTaken = await _tenantRepository.IsStaffEmailRegisteredAsync(normalizedEmail, cancellationToken);
        if (isTenantEmailTaken || isStaffEmailTaken)
        {
            _logger.LogWarning("Staff creation failed: Email {Email} is already registered.", normalizedEmail);
            throw new DuplicateEmailException(normalizedEmail);
        }

        var role = !string.IsNullOrWhiteSpace(request.Role) ? request.Role.Trim() : "Operator";

        var user = new CompanyUser
        {
            UserId = $"STF-{Guid.NewGuid():N}".ToUpperInvariant(),
            TenantId = tenantId.Trim(),
            Name = request.Name.Trim(),
            Email = normalizedEmail,
            Phone = request.Phone?.Trim(),
            PasswordHash = _passwordHasher.HashPassword(request.Password),
            Role = role,
            Status = "Active",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var created = await _tenantRepository.CreateStaffUserAsync(user, cancellationToken);
        return MapToStaffDto(created);
    }

    public async Task<IReadOnlyList<StaffResponseDto>> GetStaffMembersAsync(
        string tenantId,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Retrieving staff members for Tenant ID: {TenantId}", tenantId);
        var list = await _tenantRepository.GetStaffUsersByTenantIdAsync(tenantId, cancellationToken);
        return list.Select(MapToStaffDto).ToList();
    }

    public async Task<StaffResponseDto> DeactivateStaffMemberAsync(
        string tenantId,
        string userId,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Deactivating staff member {UserId} for Tenant ID: {TenantId}", userId, tenantId);

        var existing = await _tenantRepository.GetStaffUserByIdAsync(userId, tenantId, cancellationToken);
        if (existing == null)
        {
            _logger.LogWarning("Staff deactivation failed: User {UserId} not found under Tenant {TenantId}", userId, tenantId);
            throw new KeyNotFoundException($"Staff member '{userId}' was not found under your company tenant.");
        }

        await _tenantRepository.UpdateStaffUserStatusAsync(userId, tenantId, "Inactive", cancellationToken);
        existing.Status = "Inactive";
        existing.UpdatedAt = DateTime.UtcNow;

        return MapToStaffDto(existing);
    }

    public async Task<StaffResponseDto> ReactivateStaffMemberAsync(
        string tenantId,
        string userId,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Reactivating staff member {UserId} for Tenant ID: {TenantId}", userId, tenantId);

        var existing = await _tenantRepository.GetStaffUserByIdAsync(userId, tenantId, cancellationToken);
        if (existing == null)
        {
            _logger.LogWarning("Staff reactivation failed: User {UserId} not found under Tenant {TenantId}", userId, tenantId);
            throw new KeyNotFoundException($"Staff member '{userId}' was not found under your company tenant.");
        }

        await _tenantRepository.UpdateStaffUserStatusAsync(userId, tenantId, "Active", cancellationToken);
        existing.Status = "Active";
        existing.UpdatedAt = DateTime.UtcNow;

        return MapToStaffDto(existing);
    }

    public async Task<bool> DeleteCompanyAsync(
        string tenantId,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Deleting company account for Tenant ID: {TenantId}", tenantId);

        var tenant = await _tenantRepository.GetTenantByIdAsync(tenantId, cancellationToken);
        if (tenant == null)
        {
            throw new TenantNotFoundException(tenantId);
        }

        return await _tenantRepository.DeleteTenantAsync(tenantId, cancellationToken);
    }

    public async Task<BillingInfoDto> GetBillingInfoAsync(
        string tenantId,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Retrieving billing info for Tenant ID: {TenantId}", tenantId);

        var tenant = await _tenantRepository.GetTenantByIdAsync(tenantId, cancellationToken);
        if (tenant == null)
        {
            throw new TenantNotFoundException(tenantId);
        }

        return new BillingInfoDto
        {
            TenantId = tenant.TenantId,
            Plan = "Enterprise Scale",
            BillingEmail = tenant.BusinessEmail,
            PaymentMethod = "Corporate Visa **** 4242",
            MonthlyAmount = 499.00m,
            Currency = "USD",
            Status = "Active",
            NextBillingDate = DateTime.UtcNow.AddDays(30)
        };
    }

    public async Task<BillingInfoDto> UpdateBillingInfoAsync(
        string tenantId,
        UpdateBillingRequestDto request,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Updating billing info for Tenant ID: {TenantId}", tenantId);

        var tenant = await _tenantRepository.GetTenantByIdAsync(tenantId, cancellationToken);
        if (tenant == null)
        {
            throw new TenantNotFoundException(tenantId);
        }

        return new BillingInfoDto
        {
            TenantId = tenant.TenantId,
            Plan = request.Plan.Trim(),
            BillingEmail = request.BillingEmail.Trim().ToLowerInvariant(),
            PaymentMethod = request.PaymentMethod.Trim(),
            MonthlyAmount = 499.00m,
            Currency = "USD",
            Status = "Active",
            NextBillingDate = DateTime.UtcNow.AddDays(30)
        };
    }

    private static StaffResponseDto MapToStaffDto(CompanyUser user)
    {
        return new StaffResponseDto
        {
            UserId = user.UserId,
            TenantId = user.TenantId,
            Name = user.Name,
            Email = user.Email,
            Phone = user.Phone,
            Role = user.Role,
            Status = user.Status,
            CreatedAt = user.CreatedAt,
            UpdatedAt = user.UpdatedAt
        };
    }
}
