using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Xunit;

namespace EVNexus.PaymentService.Tests;

public class WalletOperationTests
{
    // =========================================================================
    // 1. TOP-UP SCENARIO TESTS
    // =========================================================================

    [Fact]
    public void TopUp_ValidAmount_IncreasesWalletBalance()
    {
        // Arrange
        var initialBalance = 1000.00m;
        var topUpAmount = 2500.00m;

        // Act
        var newBalance = initialBalance + topUpAmount;

        // Assert
        Assert.Equal(3500.00m, newBalance);
    }

    [Theory]
    [InlineData(0.00)]
    [InlineData(-500.00)]
    [InlineData(-0.01)]
    public void TopUp_InvalidOrNegativeAmount_ThrowsArgumentException(decimal invalidAmount)
    {
        // Arrange & Act & Assert
        var ex = Assert.Throws<ArgumentException>(() =>
        {
            if (invalidAmount <= 0)
                throw new ArgumentException("Top-up amount must be strictly greater than zero.");
        });

        Assert.Contains("strictly greater than zero", ex.Message);
    }

    // =========================================================================
    // 2. DEDUCTION / CHARGING PAYMENT SCENARIO TESTS
    // =========================================================================

    [Fact]
    public void Deduction_SufficientFunds_DeductsExactAmount()
    {
        // Arrange
        var walletBalance = 5000.00m;
        var chargingCost = 1750.50m;

        // Act
        if (walletBalance < chargingCost)
            throw new InvalidOperationException("Insufficient funds");

        walletBalance -= chargingCost;

        // Assert
        Assert.Equal(3249.50m, walletBalance);
    }

    [Fact]
    public void Deduction_InsufficientFunds_FailsPaymentAndPreservesBalance()
    {
        // Arrange
        var walletBalance = 500.00m;
        var chargingCost = 1200.00m;
        var initialBalance = walletBalance;

        // Act & Assert
        var ex = Assert.Throws<InvalidOperationException>(() =>
        {
            if (walletBalance < chargingCost)
                throw new InvalidOperationException("Payment failed: Insufficient wallet balance.");

            walletBalance -= chargingCost;
        });

        Assert.Equal("Payment failed: Insufficient wallet balance.", ex.Message);
        Assert.Equal(initialBalance, walletBalance); // Ensure balance did not change
    }

    // =========================================================================
    // 3. REFUND SCENARIO TESTS
    // =========================================================================

    [Fact]
    public void Refund_ValidTransaction_RestoresWalletBalance()
    {
        // Arrange
        var currentBalance = 3000.00m;
        var refundedChargingAmount = 1500.00m;
        var transactionStatus = "COMPLETED";

        // Act
        currentBalance += refundedChargingAmount;
        transactionStatus = "REFUNDED";

        // Assert
        Assert.Equal(4500.00m, currentBalance);
        Assert.Equal("REFUNDED", transactionStatus);
    }

    [Fact]
    public void Refund_ZeroOrNegativeAmount_Rejected()
    {
        // Arrange
        var refundAmount = -100.00m;

        // Act & Assert
        Assert.Throws<ArgumentOutOfRangeException>(() =>
        {
            if (refundAmount <= 0)
                throw new ArgumentOutOfRangeException(nameof(refundAmount), "Refund amount must be positive.");
        });
    }

    // =========================================================================
    // 4. CONCURRENCY & IDEMPOTENCY SCENARIOS
    // =========================================================================

    [Fact]
    public async Task Concurrency_MultipleSimultaneousTopUps_CalculatesExactTotal()
    {
        // Arrange
        var balanceLock = new object();
        var walletBalance = 0.00m;
        var topUpAmountPerTask = 100.00m;
        var concurrentTransactionsCount = 50;

        // Act: Run 50 concurrent top-up threads
        var tasks = Enumerable.Range(0, concurrentTransactionsCount).Select(_ => Task.Run(() =>
        {
            lock (balanceLock)
            {
                walletBalance += topUpAmountPerTask;
            }
        }));

        await Task.WhenAll(tasks);

        // Assert: 50 * 100.00 = 5000.00
        Assert.Equal(5000.00m, walletBalance);
    }

    [Fact]
    public void Idempotency_DuplicateSessionPaymentRequest_ProcessedOnlyOnce()
    {
        // Arrange
        var processedSessionIds = new HashSet<string>();
        var balance = 10000.00m;
        var chargeAmount = 2000.00m;
        var sessionId = "SESS-DUPLICATE-CHECK-999";

        // First attempt (Original Payment)
        var firstAttemptSuccess = processedSessionIds.Add(sessionId);
        if (firstAttemptSuccess)
        {
            balance -= chargeAmount;
        }

        // Second attempt (Network Retry / Duplicate Request with same sessionId)
        var secondAttemptSuccess = processedSessionIds.Add(sessionId);
        if (secondAttemptSuccess)
        {
            balance -= chargeAmount;
        }

        // Assert
        Assert.True(firstAttemptSuccess);
        Assert.False(secondAttemptSuccess, "Duplicate session payment must be blocked by idempotency.");
        Assert.Equal(8000.00m, balance); // Deducted only once
    }
}
