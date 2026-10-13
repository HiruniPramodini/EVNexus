using System.Threading.Tasks;
using EVNexus.PaymentService.Data;
using EVNexus.PaymentService.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EVNexus.PaymentService.Controllers;

[ApiController]
[Route("api/payment/wallet")]
[Authorize(Roles = "Driver")]
public class WalletController : ControllerBase
{
    private readonly IWalletRepository _repository;

    public WalletController(IWalletRepository repository)
    {
        _repository = repository;
    }

    [HttpGet]
    public async Task<IActionResult> GetWallet()
    {
        var driverIdClaim = User.FindFirst("driver_id")?.Value;
        if (string.IsNullOrEmpty(driverIdClaim)) return Unauthorized();

        var wallet = await _repository.GetWalletByDriverIdAsync(driverIdClaim);
        if (wallet == null)
        {
            wallet = await _repository.CreateWalletAsync(driverIdClaim);
        }

        return Ok(new { success = true, data = wallet });
    }

    [HttpPost("topup")]
    public async Task<IActionResult> TopUp([FromBody] TopUpDto dto)
    {
        var driverIdClaim = User.FindFirst("driver_id")?.Value;
        if (string.IsNullOrEmpty(driverIdClaim)) return Unauthorized();

        if (dto.Amount <= 0) return BadRequest("Top-up amount must be greater than zero.");
        if (dto.Amount > 5000m) return BadRequest("Top-up amount exceeds maximum allowed limit of $5,000.00.");

        var success = await _repository.TopUpAsync(driverIdClaim, dto.Amount, dto.IdempotencyKey);
        if (!success) return BadRequest("Top-up failed.");

        var wallet = await _repository.GetWalletByDriverIdAsync(driverIdClaim);
        return Ok(new { success = true, data = wallet });
    }

    [HttpGet("transactions")]
    public async Task<IActionResult> GetWalletTransactions([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        if (page < 1 || pageSize < 1 || pageSize > 100)
            return BadRequest("Invalid pagination parameters. page >= 1, 1 <= pageSize <= 100.");

        var driverIdClaim = User.FindFirst("driver_id")?.Value;
        if (string.IsNullOrEmpty(driverIdClaim)) return Unauthorized();

        var (transactions, totalCount) = await _repository.GetWalletTransactionsAsync(driverIdClaim, page, pageSize);
        var totalPages = totalCount == 0 ? 0 : (int)System.Math.Ceiling((double)totalCount / pageSize);

        return Ok(new PaginatedResponse<WalletTransaction>
        {
            Success = true,
            Data = transactions,
            Pagination = new PaginationMetadata
            {
                Page = page,
                PageSize = pageSize,
                TotalCount = totalCount,
                TotalPages = totalPages
            }
        });
    }
}

public class TopUpDto
{
    public decimal Amount { get; set; }
    public string? IdempotencyKey { get; set; }
}
