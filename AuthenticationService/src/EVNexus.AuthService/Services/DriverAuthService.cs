using EVNexus.AuthService.Data;
using EVNexus.AuthService.DTOs;
using EVNexus.AuthService.Exceptions;
using EVNexus.AuthService.Models;

namespace EVNexus.AuthService.Services;

public interface IDriverAuthService
{
    Task<DriverRegisterResponseDto> RegisterDriverAsync(DriverRegisterRequestDto request, CancellationToken cancellationToken = default);
    Task<DriverLoginResponseDto> LoginDriverAsync(DriverLoginRequestDto request, CancellationToken cancellationToken = default);
    Task<DriverProfileResponseDto> GetDriverProfileAsync(string driverId, CancellationToken cancellationToken = default);
    Task<DriverProfileResponseDto> UpdateDriverProfileAsync(string driverId, UpdateDriverProfileRequestDto request, CancellationToken cancellationToken = default);
    Task ChangeDriverPasswordAsync(string driverId, ChangeDriverPasswordRequestDto request, CancellationToken cancellationToken = default);
    Task<VerifyEmailResponseDto> VerifyDriverEmailAsync(string email, string code, CancellationToken cancellationToken = default);
    Task<InitiateEmailChangeResponseDto> ResendDriverVerificationCodeAsync(string email, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<DriverVehicleDto>> GetDriverVehiclesAsync(string driverId, CancellationToken cancellationToken = default);
    Task<DriverVehicleDto> AddDriverVehicleAsync(string driverId, CreateDriverVehicleRequestDto request, CancellationToken cancellationToken = default);
    Task<DriverVehicleDto> UpdateDriverVehicleAsync(string driverId, string vehicleId, UpdateDriverVehicleRequestDto request, CancellationToken cancellationToken = default);
    Task<bool> DeleteDriverVehicleAsync(string driverId, string vehicleId, CancellationToken cancellationToken = default);
    Task<DriverVehicleDto> SetDefaultDriverVehicleAsync(string driverId, string vehicleId, CancellationToken cancellationToken = default);
}

public class DriverAuthService : IDriverAuthService
{
    private readonly IDriverRepository _driverRepository;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IJwtTokenService _jwtTokenService;
    private readonly ILogger<DriverAuthService> _logger;

    public DriverAuthService(
        IDriverRepository driverRepository,
        IPasswordHasher passwordHasher,
        IJwtTokenService jwtTokenService,
        ILogger<DriverAuthService> logger)
    {
        _driverRepository = driverRepository;
        _passwordHasher = passwordHasher;
        _jwtTokenService = jwtTokenService;
        _logger = logger;
    }

    public async Task<DriverRegisterResponseDto> RegisterDriverAsync(
        DriverRegisterRequestDto request,
        CancellationToken cancellationToken = default)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        _logger.LogInformation("Processing driver registration for email: {Email}", normalizedEmail);

        // 1. Check for duplicate driver email
        var isEmailTaken = await _driverRepository.IsEmailRegisteredAsync(normalizedEmail, cancellationToken);
        if (isEmailTaken)
        {
            _logger.LogWarning("Driver registration failed: Email {Email} is already registered.", normalizedEmail);
            throw new DuplicateEmailException(normalizedEmail);
        }

        // 2. Generate unique Driver ID and Wallet ID
        var driverId = $"DRV-{Guid.NewGuid():N}".ToUpperInvariant();
        var walletId = $"WLT-{Guid.NewGuid():N}".ToUpperInvariant();

        // 3. Hash password securely (never plain text)
        var passwordHash = _passwordHasher.HashPassword(request.Password);

        // 4. Construct Driver and Wallet domain entities (unverified by default)
        var now = DateTime.UtcNow;
        var driver = new Driver
        {
            DriverId = driverId,
            Name = request.Name.Trim(),
            Email = normalizedEmail,
            Phone = request.Phone.Trim(),
            PasswordHash = passwordHash,
            Role = "Driver",
            Status = "Active",
            IsEmailVerified = false,
            CreatedAt = now,
            UpdatedAt = now
        };

        var wallet = new Wallet
        {
            WalletId = walletId,
            DriverId = driverId,
            Balance = 0.00m,
            Currency = "USD",
            Status = "Active",
            CreatedAt = now,
            UpdatedAt = now
        };

        // 5. Persist atomically using parameterized ADO.NET
        await _driverRepository.CreateDriverWithWalletAsync(driver, wallet, cancellationToken);

        // 6. Generate 24-hour verification code and link
        var verificationCode = Random.Shared.Next(100000, 1000000).ToString();
        var expiresAt = DateTime.UtcNow.AddHours(24);

        await _driverRepository.SaveDriverVerificationCodeAsync(
            driver.DriverId, driver.Email, verificationCode, expiresAt, cancellationToken);

        _logger.LogInformation("Driver registered successfully with ID: {DriverId}, Wallet ID: {WalletId}. Verification code generated with 24-hour expiry.", driverId, walletId);

        return new DriverRegisterResponseDto
        {
            DriverId = driver.DriverId,
            Name = driver.Name,
            Email = driver.Email,
            Phone = driver.Phone,
            WalletId = wallet.WalletId,
            WalletBalance = wallet.Balance,
            Currency = wallet.Currency,
            CreatedAt = driver.CreatedAt,
            Message = "Driver account and zero-balance wallet created successfully. A verification code has been dispatched. Please verify your email to unlock full platform access.",
            VerificationCode = verificationCode,
            VerificationLink = $"/verify-email?email={Uri.EscapeDataString(driver.Email)}&code={verificationCode}",
            ExpiresAt = expiresAt,
            IsEmailVerified = false
        };
    }

    public async Task<DriverLoginResponseDto> LoginDriverAsync(
        DriverLoginRequestDto request,
        CancellationToken cancellationToken = default)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        _logger.LogInformation("Processing driver login attempt for email: {Email}", normalizedEmail);

        // 1. Fetch driver by email
        var driver = await _driverRepository.GetDriverByEmailAsync(normalizedEmail, cancellationToken);
        if (driver == null)
        {
            _logger.LogWarning("Driver login failed: No driver found with email {Email}", normalizedEmail);
            throw new InvalidCredentialsException("Invalid email or password.");
        }

        // 2. Verify password hash
        var isPasswordValid = _passwordHasher.VerifyPassword(request.Password, driver.PasswordHash);
        if (!isPasswordValid)
        {
            _logger.LogWarning("Driver login failed: Invalid password supplied for Driver ID {DriverId}", driver.DriverId);
            throw new InvalidCredentialsException("Invalid email or password.");
        }

        // 3. Verify driver status
        if (!string.Equals(driver.Status, "Active", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("Driver login failed: Account for Driver ID {DriverId} is not active (Status: {Status})", driver.DriverId, driver.Status);
            throw new InvalidCredentialsException("Account is currently inactive or suspended.");
        }

        // 4. Generate signed JWT token with Driver ID and Role claims
        var (token, expiresInSeconds) = _jwtTokenService.GenerateDriverToken(driver);
        _logger.LogInformation("Driver login successful for Driver ID: {DriverId}, Role: {Role}, IsEmailVerified: {Verified}", driver.DriverId, driver.Role, driver.IsEmailVerified);

        // 5. Fetch associated wallet details if available
        var wallet = await _driverRepository.GetWalletByDriverIdAsync(driver.DriverId, cancellationToken);

        return new DriverLoginResponseDto
        {
            AccessToken = token,
            TokenType = "Bearer",
            ExpiresIn = expiresInSeconds,
            DriverId = driver.DriverId,
            Name = driver.Name,
            Email = driver.Email,
            Role = driver.Role,
            WalletId = wallet?.WalletId ?? string.Empty,
            WalletBalance = wallet?.Balance ?? 0.00m,
            Currency = wallet?.Currency ?? "USD",
            IsEmailVerified = driver.IsEmailVerified
        };
    }

    public async Task<DriverProfileResponseDto> GetDriverProfileAsync(
        string driverId,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Retrieving driver profile for Driver ID: {DriverId}", driverId);

        var driver = await _driverRepository.GetDriverByIdAsync(driverId, cancellationToken);
        if (driver == null)
        {
            _logger.LogWarning("Driver profile lookup failed: Driver ID {DriverId} not found.", driverId);
            throw new DriverNotFoundException(driverId);
        }

        var wallet = await _driverRepository.GetWalletByDriverIdAsync(driverId, cancellationToken);
        var vehicles = (await _driverRepository.GetVehiclesByDriverIdAsync(driverId, cancellationToken)) ?? Array.Empty<DriverVehicle>();

        return new DriverProfileResponseDto
        {
            DriverId = driver.DriverId,
            Name = driver.Name,
            Email = driver.Email,
            Phone = driver.Phone,
            Role = driver.Role,
            Status = driver.Status,
            IsEmailVerified = driver.IsEmailVerified,
            CreatedAt = driver.CreatedAt,
            UpdatedAt = driver.UpdatedAt,
            WalletId = wallet?.WalletId ?? string.Empty,
            WalletBalance = wallet?.Balance ?? 0.00m,
            Currency = wallet?.Currency ?? "USD",
            Vehicles = vehicles.Select(MapToVehicleDto).ToList()
        };
    }

    public async Task<DriverProfileResponseDto> UpdateDriverProfileAsync(
        string driverId,
        UpdateDriverProfileRequestDto request,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Updating profile for Driver ID: {DriverId}", driverId);

        var driver = await _driverRepository.GetDriverByIdAsync(driverId, cancellationToken);
        if (driver == null)
        {
            _logger.LogWarning("Driver profile update failed: Driver ID {DriverId} not found.", driverId);
            throw new DriverNotFoundException(driverId);
        }

        var trimmedName = request.Name.Trim();
        var trimmedPhone = request.Phone.Trim();

        await _driverRepository.UpdateDriverProfileAsync(driverId, trimmedName, trimmedPhone, cancellationToken);
        _logger.LogInformation("Driver profile updated successfully for Driver ID: {DriverId}", driverId);

        var updatedDriver = await _driverRepository.GetDriverByIdAsync(driverId, cancellationToken);
        var wallet = await _driverRepository.GetWalletByDriverIdAsync(driverId, cancellationToken);

        return new DriverProfileResponseDto
        {
            DriverId = updatedDriver?.DriverId ?? driverId,
            Name = updatedDriver?.Name ?? trimmedName,
            Email = updatedDriver?.Email ?? driver.Email,
            Phone = updatedDriver?.Phone ?? trimmedPhone,
            Role = updatedDriver?.Role ?? driver.Role,
            Status = updatedDriver?.Status ?? driver.Status,
            CreatedAt = updatedDriver?.CreatedAt ?? driver.CreatedAt,
            UpdatedAt = updatedDriver?.UpdatedAt ?? DateTime.UtcNow,
            WalletId = wallet?.WalletId ?? string.Empty,
            WalletBalance = wallet?.Balance ?? 0.00m,
            Currency = wallet?.Currency ?? "USD"
        };
    }

    public async Task ChangeDriverPasswordAsync(
        string driverId,
        ChangeDriverPasswordRequestDto request,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Processing password change request for Driver ID: {DriverId}", driverId);

        var driver = await _driverRepository.GetDriverByIdAsync(driverId, cancellationToken);
        if (driver == null)
        {
            _logger.LogWarning("Password change failed: Driver ID {DriverId} not found.", driverId);
            throw new DriverNotFoundException(driverId);
        }

        // 1. Verify current password
        var isCurrentPasswordValid = _passwordHasher.VerifyPassword(request.CurrentPassword, driver.PasswordHash);
        if (!isCurrentPasswordValid)
        {
            _logger.LogWarning("Password change failed: Incorrect current password provided for Driver ID: {DriverId}", driverId);
            throw new InvalidCurrentPasswordException("Current password is incorrect.");
        }

        // 2. Prevent reusing the same password
        if (string.Equals(request.CurrentPassword, request.NewPassword, StringComparison.Ordinal))
        {
            _logger.LogWarning("Password change failed: New password identical to current password for Driver ID: {DriverId}", driverId);
            throw new InvalidOperationException("New password cannot be the same as your current password.");
        }

        // 3. Hash new password securely
        var newPasswordHash = _passwordHasher.HashPassword(request.NewPassword);

        // 4. Update password in database
        await _driverRepository.UpdateDriverPasswordAsync(driverId, newPasswordHash, cancellationToken);
        _logger.LogInformation("Password successfully changed for Driver ID: {DriverId}", driverId);
    }

    public async Task<VerifyEmailResponseDto> VerifyDriverEmailAsync(
        string email,
        string code,
        CancellationToken cancellationToken = default)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();
        _logger.LogInformation("Attempting to verify driver email for {Email}", normalizedEmail);

        var driver = await _driverRepository.GetDriverByEmailAsync(normalizedEmail, cancellationToken);
        if (driver == null)
        {
            throw new DriverNotFoundException($"Driver with email '{normalizedEmail}' was not found.");
        }

        if (driver.IsEmailVerified)
        {
            return new VerifyEmailResponseDto
            {
                IsVerified = true,
                Email = normalizedEmail,
                AccountType = "Driver",
                Message = "Account email is already verified. Full platform access is unlocked."
            };
        }

        var (success, status) = await _driverRepository.ValidateAndConsumeDriverVerificationCodeAsync(normalizedEmail, code, cancellationToken);
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

        await _driverRepository.MarkDriverEmailAsVerifiedAsync(driver.DriverId, cancellationToken);
        _logger.LogInformation("Driver email verified successfully for Driver ID: {DriverId}", driver.DriverId);

        return new VerifyEmailResponseDto
        {
            IsVerified = true,
            Email = normalizedEmail,
            AccountType = "Driver",
            Message = "Email verified successfully! Full platform access is now granted."
        };
    }

    public async Task<InitiateEmailChangeResponseDto> ResendDriverVerificationCodeAsync(
        string email,
        CancellationToken cancellationToken = default)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();
        _logger.LogInformation("Resending verification code for driver email: {Email}", normalizedEmail);

        var driver = await _driverRepository.GetDriverByEmailAsync(normalizedEmail, cancellationToken);
        if (driver == null)
        {
            throw new DriverNotFoundException($"Driver with email '{normalizedEmail}' was not found.");
        }

        if (driver.IsEmailVerified)
        {
            throw new AccountAlreadyVerifiedException("Account email is already verified.");
        }

        var verificationCode = Random.Shared.Next(100000, 1000000).ToString();
        var expiresAt = DateTime.UtcNow.AddHours(24);

        await _driverRepository.SaveDriverVerificationCodeAsync(
            driver.DriverId, normalizedEmail, verificationCode, expiresAt, cancellationToken);

        _logger.LogInformation("Resent 24-hour verification code for Driver {DriverId}.", driver.DriverId);

        return new InitiateEmailChangeResponseDto
        {
            Message = "New verification code generated successfully. It will expire in 24 hours.",
            NewBusinessEmail = normalizedEmail,
            VerificationCode = verificationCode,
            ExpiresAt = expiresAt
        };
    }

    public async Task<IReadOnlyList<DriverVehicleDto>> GetDriverVehiclesAsync(
        string driverId,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Retrieving vehicles for Driver ID: {DriverId}", driverId);
        var vehicles = (await _driverRepository.GetVehiclesByDriverIdAsync(driverId, cancellationToken)) ?? Array.Empty<DriverVehicle>();
        return vehicles.Select(MapToVehicleDto).ToList();
    }

    public async Task<DriverVehicleDto> AddDriverVehicleAsync(
        string driverId,
        CreateDriverVehicleRequestDto request,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Adding vehicle {Make} {Model} for Driver ID: {DriverId}", request.Make, request.Model, driverId);

        var vehicleId = $"VEH-{Guid.NewGuid():N}".ToUpperInvariant();
        var vehicle = new DriverVehicle
        {
            VehicleId = vehicleId,
            DriverId = driverId.Trim(),
            Make = request.Make.Trim(),
            Model = request.Model.Trim(),
            PlateNumber = request.PlateNumber.Trim().ToUpperInvariant(),
            ConnectorType = request.ConnectorType.Trim(),
            IsDefault = request.IsDefault,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var created = await _driverRepository.CreateVehicleAsync(vehicle, cancellationToken);
        return MapToVehicleDto(created);
    }

    public async Task<DriverVehicleDto> UpdateDriverVehicleAsync(
        string driverId,
        string vehicleId,
        UpdateDriverVehicleRequestDto request,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Updating vehicle {VehicleId} for Driver ID: {DriverId}", vehicleId, driverId);

        var updated = await _driverRepository.UpdateVehicleAsync(
            vehicleId,
            driverId,
            request.Make.Trim(),
            request.Model.Trim(),
            request.PlateNumber.Trim().ToUpperInvariant(),
            request.ConnectorType.Trim(),
            request.IsDefault,
            cancellationToken);

        if (updated == null)
        {
            _logger.LogWarning("Vehicle {VehicleId} not found or does not belong to Driver {DriverId}", vehicleId, driverId);
            throw new KeyNotFoundException($"Vehicle '{vehicleId}' was not found for the authenticated driver.");
        }

        return MapToVehicleDto(updated);
    }

    public async Task<bool> DeleteDriverVehicleAsync(
        string driverId,
        string vehicleId,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Deleting vehicle {VehicleId} for Driver ID: {DriverId}", vehicleId, driverId);

        var success = await _driverRepository.DeleteVehicleAsync(vehicleId, driverId, cancellationToken);
        if (!success)
        {
            _logger.LogWarning("Delete failed: Vehicle {VehicleId} not found or does not belong to Driver {DriverId}", vehicleId, driverId);
            throw new KeyNotFoundException($"Vehicle '{vehicleId}' was not found for the authenticated driver.");
        }

        return true;
    }

    public async Task<DriverVehicleDto> SetDefaultDriverVehicleAsync(
        string driverId,
        string vehicleId,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Setting vehicle {VehicleId} as default for Driver ID: {DriverId}", vehicleId, driverId);

        var success = await _driverRepository.SetDefaultVehicleAsync(vehicleId, driverId, cancellationToken);
        if (!success)
        {
            _logger.LogWarning("Set default failed: Vehicle {VehicleId} not found or does not belong to Driver {DriverId}", vehicleId, driverId);
            throw new KeyNotFoundException($"Vehicle '{vehicleId}' was not found for the authenticated driver.");
        }

        var vehicle = await _driverRepository.GetVehicleByIdAsync(vehicleId, driverId, cancellationToken);
        return MapToVehicleDto(vehicle!);
    }

    private static DriverVehicleDto MapToVehicleDto(DriverVehicle vehicle)
    {
        return new DriverVehicleDto
        {
            VehicleId = vehicle.VehicleId,
            DriverId = vehicle.DriverId,
            Make = vehicle.Make,
            Model = vehicle.Model,
            PlateNumber = vehicle.PlateNumber,
            ConnectorType = vehicle.ConnectorType,
            IsDefault = vehicle.IsDefault,
            CreatedAt = vehicle.CreatedAt,
            UpdatedAt = vehicle.UpdatedAt
        };
    }
}
