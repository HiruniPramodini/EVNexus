using System.Net.Http;
using System.Net.Http.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace EVNexus.PaymentService.Services;

/// <summary>
/// Calls the Auth Service internal wallet deduct endpoint to charge a driver's wallet
/// upon payment completion. Failures are logged but are non-fatal — the payment record
/// is already committed to the DB before this call.
/// </summary>
public class WalletDeductService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<WalletDeductService> _logger;
    private readonly IConfiguration _configuration;

    public WalletDeductService(HttpClient httpClient, ILogger<WalletDeductService> logger, IConfiguration configuration)
    {
        _httpClient = httpClient;
        _logger = logger;
        _configuration = configuration;
    }

    /// <summary>
    /// Attempts to deduct the final payment amount from the driver's wallet.
    /// Returns true on success, false if insufficient funds or any error.
    /// </summary>
    public async Task<bool> DeductAsync(string driverId, decimal amount, string sessionId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(driverId) || amount <= 0)
        {
            _logger.LogWarning("DeductAsync skipped: invalid driverId or amount (driverId={DriverId}, amount={Amount}).", driverId, amount);
            return false;
        }

        var payload = new { DriverId = driverId, Amount = amount, SessionId = sessionId };

        using var request = new HttpRequestMessage(HttpMethod.Post, "api/driver/wallet/deduct");
        request.Content = JsonContent.Create(payload);
        var internalApiKey = _configuration["INTERNAL_API_KEY"] ?? string.Empty;
        request.Headers.Add("X-Internal-Api-Key", internalApiKey);

        try
        {
            var response = await _httpClient.SendAsync(request, cancellationToken);

            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Wallet deduction successful: driver={DriverId}, amount={Amount}, session={SessionId}.",
                    driverId, amount, sessionId);
                return true;
            }

            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogWarning("Wallet deduction failed: status={Status}, driver={DriverId}, session={SessionId}, body={Body}.",
                (int)response.StatusCode, driverId, sessionId, body);
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception during wallet deduction for driver {DriverId}, session {SessionId}.", driverId, sessionId);
            return false;
        }
    }
}
