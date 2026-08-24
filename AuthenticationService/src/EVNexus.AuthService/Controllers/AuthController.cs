using EVNexus.AuthService.DTOs;
using EVNexus.AuthService.Exceptions;
using EVNexus.AuthService.Services;
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
}
