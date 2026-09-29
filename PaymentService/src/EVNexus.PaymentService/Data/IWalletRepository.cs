using System.Threading.Tasks;
using EVNexus.PaymentService.Models;

namespace EVNexus.PaymentService.Data;

public interface IWalletRepository
{
    Task<Wallet?> GetWalletByDriverIdAsync(string driverId);
    Task<Wallet> CreateWalletAsync(string driverId);
    Task<bool> TopUpAsync(string driverId, decimal amount, string? idempotencyKey = null);
    Task<bool> ChargeWalletAndCompletePaymentAsync(string driverId, string paymentId, decimal finalAmount, string sessionId, decimal energyConsumedKwh);
    Task<(System.Collections.Generic.IEnumerable<WalletTransaction> Transactions, int TotalCount)> GetWalletTransactionsAsync(string driverId, int page, int pageSize);
}
