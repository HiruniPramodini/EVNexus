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

        // 4. Construct Driver and Wallet domain entities
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
        _logger.LogInformation("Driver registered successfully with ID: {DriverId}, Wallet ID: {WalletId}", driverId, walletId);

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
            Message = "Driver account and zero-balance wallet created successfully."
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
        _logger.LogInformation("Driver login successful for Driver ID: {DriverId}, Role: {Role}", driver.DriverId, driver.Role);

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
            Currency = wallet?.Currency ?? "USD"
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

        return new DriverProfileResponseDto
        {
            DriverId = driver.DriverId,
            Name = driver.Name,
            Email = driver.Email,
            Phone = driver.Phone,
            Role = driver.Role,
            Status = driver.Status,
            CreatedAt = driver.CreatedAt,
            WalletId = wallet?.WalletId ?? string.Empty,
            WalletBalance = wallet?.Balance ?? 0.00m,
            Currency = wallet?.Currency ?? "USD"
        };
    }
}
