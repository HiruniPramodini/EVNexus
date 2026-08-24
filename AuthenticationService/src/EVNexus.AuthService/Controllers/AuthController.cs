using System.Security.Claims;
using EVNexus.AuthService.DTOs;
using EVNexus.AuthService.Exceptions;
using EVNexus.AuthService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EVNexus.AuthService.Controllers;

[ApiController]
[Route("api/auth")]
[Produces("application/json")]
public class AuthController : ControllerBase
{
    private readonly ICompanyAuthService _companyAuthService;
    private readonly ILogger<AuthController> _logger;

    public AuthController(ICompanyAuthService companyAuthService, ILogger<AuthController> logger)
    {
        _companyAuthService = companyAuthService;
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

            return BadRequest(ApiResponse<object>.Fail("Validation failed.", errors));
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

            return BadRequest(ApiResponse<object>.Fail("Validation failed.", errors));
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
}
