using EVNexus.AuthService.Data;
using EVNexus.AuthService.DTOs;
using EVNexus.AuthService.Exceptions;
using EVNexus.AuthService.Models;

namespace EVNexus.AuthService.Services;

public interface IDriverAuthService
{
    Task<DriverRegisterResponseDto> RegisterDriverAsync(DriverRegisterRequestDto request, CancellationToken cancellationToken = default);
}

public class DriverAuthService : IDriverAuthService
{
    private readonly IDriverRepository _driverRepository;
    private readonly IPasswordHasher _passwordHasher;
    private readonly ILogger<DriverAuthService> _logger;

    public DriverAuthService(
        IDriverRepository driverRepository,
        IPasswordHasher passwordHasher,
        ILogger<DriverAuthService> logger)
    {
        _driverRepository = driverRepository;
        _passwordHasher = passwordHasher;
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
}
