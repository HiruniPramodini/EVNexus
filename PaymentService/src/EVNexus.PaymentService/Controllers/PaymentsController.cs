using System.Threading.Tasks;
using EVNexus.PaymentService.Data;
using EVNexus.PaymentService.Kafka;
using EVNexus.PaymentService.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EVNexus.PaymentService.Controllers;

[ApiController]
[Route("api/payment")]
[Authorize]
public class PaymentsController : ControllerBase
{
    private readonly IPaymentRepository _repository;
    private readonly KafkaProducerService _kafkaProducer;
    private readonly IWalletRepository _walletRepo;

    public PaymentsController(
        IPaymentRepository repository,
        KafkaProducerService kafkaProducer,
        IWalletRepository walletRepo)
    {
        _repository = repository;
        _kafkaProducer = kafkaProducer;
        _walletRepo = walletRepo;
    }

    [HttpPost("authorize")]
    [Authorize(Roles = "Driver")]
    public async Task<IActionResult> AuthorizePayment([FromBody] AuthorizePaymentDto dto)
    {
        // 1. Get identity from JWT
        var driverIdClaim = User.FindFirst("driver_id")?.Value;
        
        if (string.IsNullOrEmpty(driverIdClaim))
        {
            return Unauthorized("Driver identity not found in token");
        }

        // 2. Idempotency Check: Don't authorize if already exists for this session
        var existing = await _repository.GetPaymentBySessionIdAsync(dto.SessionId);
        if (existing != null)
        {
            return Ok(new { success = true, data = existing });
        }

        var payment = new PaymentTransaction
        {
            SessionId = dto.SessionId,
            DriverId = driverIdClaim, // Ignore dto.DriverId
            CompanyId = dto.CompanyId,
            StationId = dto.StationId,
            ChargerId = dto.ChargerId,
            EstimatedAmount = dto.EstimatedAmount
        };

        var id = await _repository.AuthorizePaymentAsync(payment);
        var created = await _repository.GetPaymentByIdAsync(id);

        return Ok(new { success = true, data = created });
    }

    [HttpPost("{paymentId}/complete")]
    public async Task<IActionResult> CompletePayment(string paymentId, [FromBody] CompletePaymentDto dto)
    {
        return await ProcessCompletion(paymentId, dto.FinalAmount);
    }

    [HttpPost("complete-by-session/{sessionId}")]
    public async Task<IActionResult> CompletePaymentBySession(string sessionId, [FromBody] CompletePaymentDto dto)
    {
        var existing = await _repository.GetPaymentBySessionIdAsync(sessionId);
        if (existing == null) return NotFound("Payment not found for session");
        
        return await ProcessCompletion(existing.PaymentId, dto.FinalAmount);
    }

    private async Task<IActionResult> ProcessCompletion(string paymentId, decimal finalAmount)
    {
        var payment = await _repository.GetPaymentByIdAsync(paymentId);
        if (payment == null) return NotFound("Payment not found");
        
        // Ensure tenant isolation for completion operations, or if driver, driver owns payment
        var roleClaim = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? User.FindFirst("role")?.Value;
        if (roleClaim == "Driver")
        {
            var driverIdClaim = User.FindFirst("driver_id")?.Value;
            if (payment.DriverId != driverIdClaim) return Forbid();
        }
        else
        {
            var tenantIdClaim = User.FindFirst("tenant_id")?.Value;
            if (string.IsNullOrEmpty(tenantIdClaim)) return Unauthorized("Tenant identity missing");
            if (payment.CompanyId != tenantIdClaim) return Forbid();
        }

        if (payment.Status == "COMPLETED")
        {
            return Ok(new { success = true, data = payment });
        }

        var success = await _walletRepo.ChargeWalletAndCompletePaymentAsync(payment.DriverId, paymentId, finalAmount, payment.SessionId, payment.EnergyConsumedKwh);
        if (!success) return BadRequest("Insufficient balance or payment failed");

        var completed = await _repository.GetPaymentByIdAsync(paymentId);
        
        return Ok(new { success = true, data = completed });
    }

    [HttpGet("transactions")]
    [Authorize(Roles = "Driver")]
    public async Task<IActionResult> GetPaymentTransactions([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        if (page < 1 || pageSize < 1 || pageSize > 100)
            return BadRequest("Invalid pagination parameters. page >= 1, 1 <= pageSize <= 100.");

        var driverIdClaim = User.FindFirst("driver_id")?.Value;
        if (string.IsNullOrEmpty(driverIdClaim)) return Unauthorized("Driver identity not found in token");

        var (transactions, totalCount) = await _repository.GetPaymentTransactionsAsync(driverIdClaim, page, pageSize);
        var totalPages = totalCount == 0 ? 0 : (int)System.Math.Ceiling((double)totalCount / pageSize);

        return Ok(new Models.PaginatedResponse<PaymentTransaction>
        {
            Success = true,
            Data = transactions,
            Pagination = new Models.PaginationMetadata
            {
                Page = page,
                PageSize = pageSize,
                TotalCount = totalCount,
                TotalPages = totalPages
            }
        });
    }

    [HttpGet("session/{sessionId}/status")]
    [Authorize(Roles = "Driver")]
    public async Task<IActionResult> GetPaymentStatusBySession(string sessionId)
    {
        var driverIdClaim = User.FindFirst("driver_id")?.Value;
        if (string.IsNullOrEmpty(driverIdClaim)) return Unauthorized("Driver identity not found in token");

        var payment = await _repository.GetPaymentBySessionForDriverAsync(sessionId, driverIdClaim);
        if (payment == null)
        {
            return NotFound(new { success = false, message = "Payment not found for session" });
        }

        return Ok(new
        {
            success = true,
            data = new
            {
                sessionId = payment.SessionId,
                paymentId = payment.PaymentId,
                status = payment.Status,
                amount = payment.Status == "COMPLETED" ? payment.FinalAmount : payment.EstimatedAmount,
                currency = payment.Currency,
                completedAt = payment.CompletedAt
            }
        });
    }
}

public class AuthorizePaymentDto
{
    public string SessionId { get; set; } = string.Empty;
    public string DriverId { get; set; } = string.Empty;
    public string CompanyId { get; set; } = string.Empty;
    public string StationId { get; set; } = string.Empty;
    public string ChargerId { get; set; } = string.Empty;
    public decimal EstimatedAmount { get; set; }
}

public class CompletePaymentDto
{
    public decimal FinalAmount { get; set; }
}
