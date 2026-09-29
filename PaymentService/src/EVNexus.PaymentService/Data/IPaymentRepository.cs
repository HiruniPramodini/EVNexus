using System.Threading.Tasks;
using EVNexus.PaymentService.Models;

namespace EVNexus.PaymentService.Data;

public interface IPaymentRepository
{
    Task<string> AuthorizePaymentAsync(PaymentTransaction transaction);
    Task<bool> CompletePaymentAsync(string paymentId, decimal finalAmount);
    Task<bool> UpdatePaymentStatusAsync(string paymentId, string status);
    Task<PaymentTransaction?> GetPaymentByIdAsync(string paymentId);
    Task<PaymentTransaction?> GetPaymentBySessionIdAsync(string sessionId);
    Task<PaymentTransaction?> GetPaymentBySessionForDriverAsync(string sessionId, string driverId);
    Task<(System.Collections.Generic.IEnumerable<PaymentTransaction> Transactions, int TotalCount)> GetPaymentTransactionsAsync(string driverId, int page, int pageSize);
}
