using System.Security.Claims;
using EVNexus.AuthService.Attributes;
using EVNexus.AuthService.DTOs;
using EVNexus.AuthService.Exceptions;
using EVNexus.AuthService.Security;
using EVNexus.AuthService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EVNexus.AuthService.Controllers;

[ApiController]
[Route("api/auth")]
[Produces("application/json")]
public class AuthController : ControllerBase
{
    private const string ValidationFailedMessage = "Validation failed.";
    private readonly ICompanyAuthService _companyAuthService;
    private readonly IDriverAuthService _driverAuthService;
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        ICompanyAuthService companyAuthService,
        IDriverAuthService driverAuthService,
        ILogger<AuthController> logger)
    {
        _companyAuthService = companyAuthService;
        _driverAuthService = driverAuthService;
        _logger = logger;
    }

    /// <summary>
    /// Registers a new company with business details and creates an isolated tenant record.
    /// </summary>
    /// <param name="request">Company registration details</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Registration confirmation with unique Tenant ID</returns>
    [HttpPost("company/register")]
    [ProducesResponseType(typeof(ApiResponse<CompanyRegisterResponseDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> RegisterCompany(
        [FromBody] CompanyRegisterRequestDto request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            var errors = ModelState.Values
                .SelectMany(v => v.Errors)
                .Select(e => e.ErrorMessage)
                .ToList();

            return BadRequest(ApiResponse<object>.Fail(ValidationFailedMessage, errors));
        }

        try
        {
            var result = await _companyAuthService.RegisterCompanyAsync(request, cancellationToken);
            return StatusCode(StatusCodes.Status201Created, ApiResponse<CompanyRegisterResponseDto>.Ok(result, "Company registered successfully."));
        }
        catch (DuplicateEmailException ex)
        {
            return Conflict(ApiResponse<object>.Fail(ex.Message, new List<string> { ex.Message }));
        }
        catch (DuplicateRegistrationNumberException ex)
        {
            return Conflict(ApiResponse<object>.Fail(ex.Message, new List<string> { ex.Message }));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error occurred during company registration.");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse<object>.Fail("An unexpected error occurred while processing your registration. Please try again later."));
        }
    }

    /// <summary>
    /// Authenticates company credentials and issues a signed JWT access token with Tenant ID and role claims.
    /// </summary>
    /// <param name="request">Login credentials (email and password)</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>JWT Access token with Tenant ID and role claims</returns>
    [HttpPost("company/login")]
    [ProducesResponseType(typeof(ApiResponse<CompanyLoginResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> LoginCompany(
        [FromBody] CompanyLoginRequestDto request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            var errors = ModelState.Values
                .SelectMany(v => v.Errors)
                .Select(e => e.ErrorMessage)
                .ToList();

            return BadRequest(ApiResponse<object>.Fail(ValidationFailedMessage, errors));
        }

        try
        {
            var result = await _companyAuthService.LoginCompanyAsync(request, cancellationToken);
            return Ok(ApiResponse<CompanyLoginResponseDto>.Ok(result, "Login successful."));
        }
        catch (InvalidCredentialsException ex)
        {
            return Unauthorized(ApiResponse<object>.Fail(ex.Message, new List<string> { ex.Message }));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error occurred during company login.");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse<object>.Fail("An unexpected error occurred while processing your login. Please try again later."));
        }
    }

    /// <summary>
    /// Protected endpoint that returns the authenticated company profile.
    /// Requires a valid Bearer JWT token with Tenant ID claim.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Company profile details</returns>
    [HttpGet("company/profile")]
    [Authorize(Roles = "CompanyAdmin")]
    [RequireRole(AppRoles.CompanyAdmin)]
    [ProducesResponseType(typeof(ApiResponse<CompanyProfileResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetCompanyProfile(CancellationToken cancellationToken)
    {
        var tenantId = User.FindFirstValue("tenant_id")
                    ?? User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(tenantId))
        {
            return Unauthorized(ApiResponse<object>.Fail("Tenant identification claim is missing from authentication token."));
        }

        try
        {
            var profile = await _companyAuthService.GetCompanyProfileAsync(tenantId, cancellationToken);
            return Ok(ApiResponse<CompanyProfileResponseDto>.Ok(profile, "Company profile retrieved successfully."));
        }
        catch (TenantNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error occurred while retrieving company profile for Tenant {TenantId}", tenantId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse<object>.Fail("An error occurred while retrieving profile information."));
        }
    }

    /// <summary>
    /// Updates the authenticated company's profile details (name, phone, address, logo).
    /// Enforces that business email cannot be changed without prior re-verification.
    /// </summary>
    [HttpPut("company/profile")]
    [Authorize(Roles = "CompanyAdmin")]
    [RequireRole(AppRoles.CompanyAdmin)]
    [ProducesResponseType(typeof(ApiResponse<CompanyProfileResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> UpdateCompanyProfile(
        [FromBody] UpdateCompanyProfileRequestDto request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            var errors = ModelState.Values
                .SelectMany(v => v.Errors)
                .Select(e => e.ErrorMessage)
                .ToList();
            return BadRequest(ApiResponse<object>.Fail("Validation failed.", errors));
        }

        var tenantId = User.FindFirstValue("tenant_id")
                    ?? User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(tenantId))
        {
            return Unauthorized(ApiResponse<object>.Fail("Tenant identification claim is missing from authentication token."));
        }

        try
        {
            var updatedProfile = await _companyAuthService.UpdateCompanyProfileAsync(tenantId, request, cancellationToken);
            return Ok(ApiResponse<CompanyProfileResponseDto>.Ok(updatedProfile, "Company profile updated successfully."));
        }
        catch (BusinessEmailChangeRequiresVerificationException ex)
        {
            return BadRequest(ApiResponse<object>.Fail(ex.Message));
        }
        catch (EmailVerificationException ex)
        {
            return BadRequest(ApiResponse<object>.Fail(ex.Message));
        }
        catch (DuplicateEmailException ex)
        {
            return Conflict(ApiResponse<object>.Fail(ex.Message));
        }
        catch (TenantNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error occurred while updating company profile for Tenant {TenantId}", tenantId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse<object>.Fail("An error occurred while updating profile information."));
        }
    }

    /// <summary>
    /// Initiates email re-verification by generating a secure verification code.
    /// </summary>
    [HttpPost("company/request-email-change")]
    [Authorize(Roles = "CompanyAdmin")]
    [RequireRole(AppRoles.CompanyAdmin)]
    [ProducesResponseType(typeof(ApiResponse<InitiateEmailChangeResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> RequestEmailChange(
        [FromBody] InitiateEmailChangeRequestDto request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            var errors = ModelState.Values
                .SelectMany(v => v.Errors)
                .Select(e => e.ErrorMessage)
                .ToList();
            return BadRequest(ApiResponse<object>.Fail("Validation failed.", errors));
        }

        var tenantId = User.FindFirstValue("tenant_id")
                    ?? User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(tenantId))
        {
            return Unauthorized(ApiResponse<object>.Fail("Tenant identification claim is missing from authentication token."));
        }

        try
        {
            var result = await _companyAuthService.InitiateEmailChangeAsync(tenantId, request, cancellationToken);
            return Ok(ApiResponse<InitiateEmailChangeResponseDto>.Ok(result, "Verification code generated successfully."));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<object>.Fail(ex.Message));
        }
        catch (DuplicateEmailException ex)
        {
            return Conflict(ApiResponse<object>.Fail(ex.Message));
        }
        catch (TenantNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error occurred while initiating email change for Tenant {TenantId}", tenantId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse<object>.Fail("An error occurred while initiating email change."));
        }
    }

    /// <summary>
    /// Verifies a newly registered account's email address using a 24-hour verification code.
    /// Marks the account as verified in the database upon successful verification.
    /// </summary>
    /// <param name="request">Email and verification code</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Verification result confirming full platform access</returns>
    [HttpPost("verify-email")]
    [ProducesResponseType(typeof(ApiResponse<VerifyEmailResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> VerifyEmail(
        [FromBody] VerifyEmailRequestDto request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            var errors = ModelState.Values
                .SelectMany(v => v.Errors)
                .Select(e => e.ErrorMessage)
                .ToList();
            return BadRequest(ApiResponse<object>.Fail(ValidationFailedMessage, errors));
        }

        return await ProcessEmailVerificationAsync(request.Email, request.VerificationCode, cancellationToken);
    }

    /// <summary>
    /// Verifies a newly registered account's email address via link query parameters (?email=...&code=...).
    /// </summary>
    [HttpGet("verify-email")]
    [ProducesResponseType(typeof(ApiResponse<VerifyEmailResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> VerifyEmailFromLink(
        [FromQuery] string? email,
        [FromQuery] string? code,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(code))
        {
            return BadRequest(ApiResponse<object>.Fail("Email address and verification code query parameters are required."));
        }

        return await ProcessEmailVerificationAsync(email, code, cancellationToken);
    }

    /// <summary>
    /// Resends a fresh 24-hour verification code to an unverified account's registered email address.
    /// </summary>
    [HttpPost("resend-verification")]
    [ProducesResponseType(typeof(ApiResponse<InitiateEmailChangeResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> ResendVerification(
        [FromBody] ResendVerificationRequestDto request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            var errors = ModelState.Values
                .SelectMany(v => v.Errors)
                .Select(e => e.ErrorMessage)
                .ToList();
            return BadRequest(ApiResponse<object>.Fail(ValidationFailedMessage, errors));
        }

        try
        {
            try
            {
                var companyResult = await _companyAuthService.ResendCompanyVerificationCodeAsync(request.Email, cancellationToken);
                return Ok(ApiResponse<InitiateEmailChangeResponseDto>.Ok(companyResult, "Verification code resent successfully."));
            }
            catch (TenantNotFoundException)
            {
                var driverResult = await _driverAuthService.ResendDriverVerificationCodeAsync(request.Email, cancellationToken);
                return Ok(ApiResponse<InitiateEmailChangeResponseDto>.Ok(driverResult, "Verification code resent successfully."));
            }
        }
        catch (AccountAlreadyVerifiedException ex)
        {
            return BadRequest(ApiResponse<object>.Fail(ex.Message));
        }
        catch (DriverNotFoundException)
        {
            return NotFound(ApiResponse<object>.Fail($"No account was found with the email '{request.Email}'."));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error resending verification code to {Email}", request.Email);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse<object>.Fail("An unexpected error occurred while resending the verification code."));
        }
    }

    private async Task<IActionResult> ProcessEmailVerificationAsync(string email, string code, CancellationToken cancellationToken)
    {
        try
        {
            try
            {
                var result = await _companyAuthService.VerifyCompanyEmailAsync(email, code, cancellationToken);
                return Ok(ApiResponse<VerifyEmailResponseDto>.Ok(result, result.Message));
            }
            catch (TenantNotFoundException)
            {
                var driverResult = await _driverAuthService.VerifyDriverEmailAsync(email, code, cancellationToken);
                return Ok(ApiResponse<VerifyEmailResponseDto>.Ok(driverResult, driverResult.Message));
            }
        }
        catch (VerificationCodeExpiredException ex)
        {
            return BadRequest(ApiResponse<object>.Fail(ex.Message, new List<string> { ex.Message }));
        }
        catch (VerificationCodeAlreadyUsedException ex)
        {
            return BadRequest(ApiResponse<object>.Fail(ex.Message, new List<string> { ex.Message }));
        }
        catch (EmailVerificationException ex)
        {
            return BadRequest(ApiResponse<object>.Fail(ex.Message, new List<string> { ex.Message }));
        }
        catch (DriverNotFoundException)
        {
            return NotFound(ApiResponse<object>.Fail($"No account was found with the email '{email}'."));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error verifying email for {Email}", email);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse<object>.Fail("An unexpected error occurred while verifying your email. Please try again."));
        }
    }

    /// <summary>
    /// Registers a new EV driver with personal details and automatically creates an associated zero-balance wallet record.
    /// </summary>
    /// <param name="request">Driver registration details</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Registration confirmation with Driver ID, Wallet ID, and zero initial balance</returns>
    [HttpPost("driver/register")]
    [ProducesResponseType(typeof(ApiResponse<DriverRegisterResponseDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> RegisterDriver(
        [FromBody] DriverRegisterRequestDto request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            var errors = ModelState.Values
                .SelectMany(v => v.Errors)
                .Select(e => e.ErrorMessage)
                .ToList();

            return BadRequest(ApiResponse<object>.Fail(ValidationFailedMessage, errors));
        }

        try
        {
            var result = await _driverAuthService.RegisterDriverAsync(request, cancellationToken);
            return StatusCode(StatusCodes.Status201Created, ApiResponse<DriverRegisterResponseDto>.Ok(result, "Driver registered successfully with an active zero-balance wallet."));
        }
        catch (DuplicateEmailException ex)
        {
            return Conflict(ApiResponse<object>.Fail(ex.Message, new List<string> { ex.Message }));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error occurred during driver registration.");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse<object>.Fail("An unexpected error occurred while processing your driver registration. Please try again later."));
        }
    }

    /// <summary>
    /// Authenticates EV driver credentials and issues a signed JWT access token containing driver ID and role.
    /// </summary>
    /// <param name="request">Driver login credentials (email and password)</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>JWT Access token with Driver ID and role claims</returns>
    [HttpPost("driver/login")]
    [ProducesResponseType(typeof(ApiResponse<DriverLoginResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> LoginDriver(
        [FromBody] DriverLoginRequestDto request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            var errors = ModelState.Values
                .SelectMany(v => v.Errors)
                .Select(e => e.ErrorMessage)
                .ToList();

            return BadRequest(ApiResponse<object>.Fail(ValidationFailedMessage, errors));
        }

        try
        {
            var result = await _driverAuthService.LoginDriverAsync(request, cancellationToken);
            return Ok(ApiResponse<DriverLoginResponseDto>.Ok(result, "Driver login successful."));
        }
        catch (InvalidCredentialsException ex)
        {
            return Unauthorized(ApiResponse<object>.Fail(ex.Message, new List<string> { ex.Message }));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error occurred during driver login.");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse<object>.Fail("An unexpected error occurred while processing your login. Please try again later."));
        }
    }

    /// <summary>
    /// Protected endpoint that returns the authenticated EV driver's profile and charging wallet balance.
    /// Requires a valid Bearer JWT token with Driver ID and Driver role claim.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Driver profile and wallet details</returns>
    [HttpGet("driver/profile")]
    [Authorize(Roles = "Driver")]
    [RequireRole(AppRoles.Driver)]
    [ProducesResponseType(typeof(ApiResponse<DriverProfileResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetDriverProfile(CancellationToken cancellationToken)
    {
        var driverId = User.FindFirstValue("driver_id")
                    ?? User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(driverId))
        {
            return Unauthorized(ApiResponse<object>.Fail("Driver identification claim is missing from authentication token."));
        }

        try
        {
            var profile = await _driverAuthService.GetDriverProfileAsync(driverId, cancellationToken);
            return Ok(ApiResponse<DriverProfileResponseDto>.Ok(profile, "Driver profile retrieved successfully."));
        }
        catch (DriverNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error occurred while retrieving driver profile for Driver {DriverId}", driverId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse<object>.Fail("An error occurred while retrieving profile information."));
        }
    }

    /// <summary>
    /// Updates the authenticated EV driver's profile details (name and phone number).
    /// Requires a valid Bearer JWT token with Driver ID and Driver role claim.
    /// </summary>
    [HttpPut("driver/profile")]
    [Authorize(Roles = "Driver")]
    [RequireRole(AppRoles.Driver)]
    [ProducesResponseType(typeof(ApiResponse<DriverProfileResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateDriverProfile(
        [FromBody] UpdateDriverProfileRequestDto request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            var errors = ModelState.Values
                .SelectMany(v => v.Errors)
                .Select(e => e.ErrorMessage)
                .ToList();
            return BadRequest(ApiResponse<object>.Fail(ValidationFailedMessage, errors));
        }

        var driverId = User.FindFirstValue("driver_id")
                    ?? User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(driverId))
        {
            return Unauthorized(ApiResponse<object>.Fail("Driver identification claim is missing from authentication token."));
        }

        try
        {
            var updatedProfile = await _driverAuthService.UpdateDriverProfileAsync(driverId, request, cancellationToken);
            return Ok(ApiResponse<DriverProfileResponseDto>.Ok(updatedProfile, "Driver profile updated successfully."));
        }
        catch (DriverNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error occurred while updating profile for Driver {DriverId}", driverId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse<object>.Fail("An error occurred while updating profile information."));
        }
    }

    /// <summary>
    /// Changes the authenticated EV driver's password after confirming their current password.
    /// Requires a valid Bearer JWT token with Driver ID and Driver role claim.
    /// </summary>
    [HttpPut("driver/change-password")]
    [Authorize(Roles = "Driver")]
    [RequireRole(AppRoles.Driver)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ChangeDriverPassword(
        [FromBody] ChangeDriverPasswordRequestDto request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            var errors = ModelState.Values
                .SelectMany(v => v.Errors)
                .Select(e => e.ErrorMessage)
                .ToList();
            return BadRequest(ApiResponse<object>.Fail(ValidationFailedMessage, errors));
        }

        var driverId = User.FindFirstValue("driver_id")
                    ?? User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(driverId))
        {
            return Unauthorized(ApiResponse<object>.Fail("Driver identification claim is missing from authentication token."));
        }

        try
        {
            await _driverAuthService.ChangeDriverPasswordAsync(driverId, request, cancellationToken);
            return Ok(ApiResponse<object>.Ok(new { }, "Password changed successfully."));
        }
        catch (InvalidCurrentPasswordException ex)
        {
            return BadRequest(ApiResponse<object>.Fail(ex.Message, new List<string> { ex.Message }));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<object>.Fail(ex.Message, new List<string> { ex.Message }));
        }
        catch (DriverNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error occurred while changing password for Driver {DriverId}", driverId);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse<object>.Fail("An error occurred while processing password change."));
        }
    }
}
