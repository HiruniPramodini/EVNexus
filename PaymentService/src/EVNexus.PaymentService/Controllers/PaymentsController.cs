using System.Threading.Tasks;
using EVNexus.PaymentService.Data;
using EVNexus.PaymentService.Kafka;
using EVNexus.PaymentService.Models;
using EVNexus.PaymentService.Services;
using Microsoft.AspNetCore.Mvc;

namespace EVNexus.PaymentService.Controllers;

[ApiController]
[Route("api/payment")]
public class PaymentsController : ControllerBase
{
    private readonly IPaymentRepository _repository;
    private readonly KafkaProducerService _kafkaProducer;
    private readonly WalletDeductService _walletDeduct;

    public PaymentsController(
        IPaymentRepository repository,
        KafkaProducerService kafkaProducer,
        WalletDeductService walletDeduct)
    {
        _repository = repository;
        _kafkaProducer = kafkaProducer;
        _walletDeduct = walletDeduct;
    }

    [HttpPost("authorize")]
    public async Task<IActionResult> AuthorizePayment([FromBody] AuthorizePaymentDto dto)
    {
        // 1. Idempotency Check: Don't authorize if already exists for this session
        var existing = await _repository.GetPaymentBySessionIdAsync(dto.SessionId);
        if (existing != null)
        {
            return Ok(new { success = true, data = existing });
        }

        var payment = new PaymentTransaction
        {
            SessionId = dto.SessionId,
            DriverId = dto.DriverId,
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

        if (payment.Status == "COMPLETED")
        {
            return Ok(new { success = true, data = payment });
        }

        var success = await _repository.CompletePaymentAsync(paymentId, finalAmount);
        if (!success) return BadRequest("Failed to complete payment");

        var completed = await _repository.GetPaymentByIdAsync(paymentId);
        if (completed != null)
        {
            // Deduct from driver's wallet (non-fatal — payment is already recorded)
            await _walletDeduct.DeductAsync(
                completed.DriverId,
                completed.FinalAmount,
                completed.SessionId,
                HttpContext.RequestAborted);

            // Publish payment-completed Kafka event for dashboard analytics
            await _kafkaProducer.PublishPaymentCompletedAsync(completed);
        }

        return Ok(new { success = true, data = completed });
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
