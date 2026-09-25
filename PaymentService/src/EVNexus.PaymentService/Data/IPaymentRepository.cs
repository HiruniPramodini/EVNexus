using System.Threading.Tasks;
using EVNexus.PaymentService.Models;

namespace EVNexus.PaymentService.Data;

public interface IPaymentRepository
{
    Task<string> AuthorizePaymentAsync(PaymentTransaction transaction);
    Task<bool> CompletePaymentAsync(string paymentId, decimal finalAmount);
    Task<PaymentTransaction?> GetPaymentByIdAsync(string paymentId);
    Task<PaymentTransaction?> GetPaymentBySessionIdAsync(string sessionId);
}
