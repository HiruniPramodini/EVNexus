using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Security.Claims;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using EVNexus.PaymentService.Controllers;
using EVNexus.PaymentService.Data;
using EVNexus.PaymentService.Forecasting;
using EVNexus.PaymentService.Kafka;
using EVNexus.PaymentService.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace EVNexus.PaymentService.Tests;

/// <summary>
/// Mutation-guided test hardening suite for PaymentService.
/// Kills real surviving and uncovered mutants discovered by Stryker.NET 5.0.0 across:
/// - ForecastService (ML.NET SSA boundary >= 15 days vs < 7 days baseline, non-negative clamping)
/// - OutboxPublisherService (exponential backoff arithmetic 5 * 2^n, 300s cap, ExecuteAsync loop & cancellation)
/// - WalletController (exact $5,000 boundary, pagination pageSize 1 & 100 boundaries, totalPages division, failure path)
/// - PaymentsController (idempotent authorization, completion paths for Driver & CompanyAdmin, pagination division)
/// - CompanyAnalyticsController (all 5 endpoints, role/tenant guards, historicalDays 1 & 365 boundaries, -historicalDays, hasHistory & isBaseline)
/// </summary>
public class PaymentMutationHardeningTests
{
    private static ClaimsPrincipal CreatePrincipal(string role, string? driverId = null, string? tenantId = null, bool useShortRoleClaim = false)
    {
        var claims = new List<Claim>
        {
            new(useShortRoleClaim ? "role" : ClaimTypes.Role, role)
        };
        if (driverId != null) claims.Add(new Claim("driver_id", driverId));
        if (tenantId != null) claims.Add(new Claim("tenant_id", tenantId));

        return new ClaimsPrincipal(new ClaimsIdentity(claims, "Bearer"));
    }

    #region ForecastService — Real SSA Execution (15+ days), Exact 7-Day Boundary, Negative Clamping

    [Fact]
    public void ForecastService_With21DaysIncreasingAndVolatileData_ExecutesRealSsaAndProducesSequentialNonNegativeForecasts()
    {
        // Note: ML.NET ForecastBySsa requires seriesLength > 2 * windowSize.
        // With 14 points (windowSize=7), 14 > 14 is false so SSA throws and falls back to average!
        // With 21 points (windowSize=7), 21 > 14 is true so SSA genuinely executes lines 64-85.
        var service = new ForecastService(new Mock<ILogger<ForecastService>>().Object);
        var start = new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc);
        var series = new List<RevenueData>();
        var values = new float[]
        {
            100, 120, 140, 160, 180, 200, 220,
            110, 130, 150, 170, 190, 210, 230,
            120, 140, 160, 180, 200, 220, 240
        };
        for (int i = 0; i < values.Length; i++)
        {
            series.Add(new RevenueData { Date = start.AddDays(i), Amount = values[i] });
        }

        var results = service.PredictNext7Days(series).ToList();

        Assert.Equal(7, results.Count);
        Assert.Equal(start.AddDays(21), results[0].Date);
        Assert.Equal(start.AddDays(27), results[6].Date);
        Assert.All(results, r => Assert.True(r.PredictedRevenue >= 0m));
        // Real SSA on this periodic ramp produces varied non-constant predictions (unlike constant average fallback)
        Assert.True(results.Select(r => r.PredictedRevenue).Distinct().Count() > 1,
            "SSA should execute and produce non-constant forecast values rather than falling back to average.");
    }

    [Fact]
    public void ForecastService_WithSharplyDecliningSeries_ClampsNegativeSsaPredictionsToZero()
    {
        var service = new ForecastService(new Mock<ILogger<ForecastService>>().Object);
        var start = new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc);
        // Steep downward trend across 21 days causes SSA linear projection to go below 0
        var series = Enumerable.Range(0, 21)
            .Select(i => new RevenueData { Date = start.AddDays(i), Amount = Math.Max(0f, 1000f - (i * 55f)) })
            .ToList();

        var results = service.PredictNext7Days(series).ToList();

        Assert.Equal(7, results.Count);
        Assert.All(results, r => Assert.True(r.PredictedRevenue >= 0m));
        Assert.Contains(results, r => r.PredictedRevenue == 0m);
    }

    [Fact]
    public void ForecastService_Exact7Days_TriggersSsaPathOrFallbackWithExactAverage_NotMin()
    {
        var service = new ForecastService(new Mock<ILogger<ForecastService>>().Object);
        var start = new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc);

        // 7 items triggers try-block (dataList.Count < 7 is FALSE -> kills <= 7 mutant)
        // Because windowSize = 3, seriesLength = 7 (> 2*3 = 6), SSA actually runs on 7 items!
        var sevenDays = new List<RevenueData>
        {
            new() { Date = start.AddDays(0), Amount = 100f },
            new() { Date = start.AddDays(1), Amount = 200f },
            new() { Date = start.AddDays(2), Amount = 300f },
            new() { Date = start.AddDays(3), Amount = 400f },
            new() { Date = start.AddDays(4), Amount = 500f },
            new() { Date = start.AddDays(5), Amount = 600f },
            new() { Date = start.AddDays(6), Amount = 700f }
        };

        var sevenDayResults = service.PredictNext7Days(sevenDays).ToList();
        Assert.Equal(7, sevenDayResults.Count);
        Assert.Equal(start.AddDays(7), sevenDayResults[0].Date);
        // If mutated to <= 7, all 7 predictions would equal flat average 400.00
        Assert.Contains(sevenDayResults, r => r.PredictedRevenue != 400m);

        // 14 items causes SSA (windowSize=7, seriesLength=14) to enter catch fallback -> must use Average (200), not Min (100)!
        var fourteenDays = Enumerable.Range(0, 14)
            .Select(i => new RevenueData { Date = start.AddDays(i), Amount = i % 2 == 0 ? 100f : 300f })
            .ToList();
        var fallbackResults = service.PredictNext7Days(fourteenDays).ToList();
        Assert.All(fallbackResults, r => Assert.Equal(200m, r.PredictedRevenue));
    }

    [Fact]
    public void ForecastService_WithNegativeHistoricalValues_ClampsBaselineToZero()
    {
        var service = new ForecastService(new Mock<ILogger<ForecastService>>().Object);
        var start = new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc);
        var negativeData = new List<RevenueData>
        {
            new() { Date = start, Amount = -50f },
            new() { Date = start.AddDays(1), Amount = -100f }
        };

        var results = service.PredictNext7Days(negativeData).ToList();
        Assert.Equal(7, results.Count);
        Assert.All(results, r => Assert.Equal(0m, r.PredictedRevenue));
    }

    #endregion

    #region OutboxPublisherService — Backoff Formula, 300s Cap, Polling Loop & Cancellation

    private static (
        OutboxPublisherService Service,
        Mock<IOutboxRepository> OutboxRepo,
        Mock<KafkaProducerService> KafkaProducer)
        CreateOutboxSut(int pollingMs = 50, int batchSize = 25)
    {
        var logger = new Mock<ILogger<OutboxPublisherService>>();
        var serviceProvider = new Mock<IServiceProvider>();
        var scopeFactory = new Mock<IServiceScopeFactory>();
        var scope = new Mock<IServiceScope>();
        var scopedProvider = new Mock<IServiceProvider>();
        var outboxRepo = new Mock<IOutboxRepository>();

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Kafka:BootstrapServers"] = "localhost:9092",
                ["Kafka:Topics:PaymentCompleted"] = "payment-completed",
                ["Outbox:PollingIntervalMs"] = pollingMs.ToString(),
                ["Outbox:BatchSize"] = batchSize.ToString()
            })
            .Build();

        var kafkaProducer = new Mock<KafkaProducerService>(config, new Mock<ILogger<KafkaProducerService>>().Object);

        serviceProvider.Setup(s => s.GetService(typeof(IServiceScopeFactory))).Returns(scopeFactory.Object);
        scopeFactory.Setup(s => s.CreateScope()).Returns(scope.Object);
        scope.Setup(s => s.ServiceProvider).Returns(scopedProvider.Object);
        scopedProvider.Setup(s => s.GetService(typeof(IOutboxRepository))).Returns(outboxRepo.Object);
        scopedProvider.Setup(s => s.GetService(typeof(KafkaProducerService))).Returns(kafkaProducer.Object);

        var svc = new OutboxPublisherService(logger.Object, serviceProvider.Object, config);
        return (svc, outboxRepo, kafkaProducer);
    }

    [Fact]
    public async Task OutboxPublisher_FailureBackoff_UsesExponentialFormulaAndCapsAt300Seconds()
    {
        var (service, outboxRepo, kafkaProducer) = CreateOutboxSut(batchSize: 17);

        var msgRetry2 = new OutboxMessage { Id = 10, AggregateId = "PAY-10", Payload = "{}", RetryCount = 2 };
        var msgRetry10 = new OutboxMessage { Id = 11, AggregateId = "PAY-11", Payload = "{}", RetryCount = 10 };

        outboxRepo.Setup(r => r.GetPendingMessagesAsync(17))
            .ReturnsAsync(new List<OutboxMessage> { msgRetry2, msgRetry10 });
        kafkaProducer.Setup(k => k.PublishMessageAsync(It.IsAny<string>(), It.IsAny<string>()))
            .ThrowsAsync(new InvalidOperationException("Broker unavailable"));

        var recorded = new Dictionary<long, DateTime>();
        outboxRepo.Setup(r => r.RecordFailureAsync(It.IsAny<long>(), "Broker unavailable", It.IsAny<DateTime>()))
            .Callback<long, string, DateTime>((id, _, avail) => recorded[id] = avail)
            .Returns(Task.CompletedTask);

        var before = DateTime.UtcNow;
        var method = typeof(OutboxPublisherService).GetMethod("ProcessPendingMessagesAsync", BindingFlags.NonPublic | BindingFlags.Instance)!;
        await (Task)method.Invoke(service, new object[] { CancellationToken.None })!;

        // Verify configured batchSize (17) was actually read from config (kills Outbox:BatchSize string mutant)
        outboxRepo.Verify(r => r.GetPendingMessagesAsync(17), Times.Once);

        // RetryCount = 2 -> 5 * 2^2 = 20 seconds (kills 5 / 2^2 = 1.25s and Math.Max = 300s)
        var delay2 = (recorded[10] - before).TotalSeconds;
        Assert.InRange(delay2, 18.0, 25.0);

        // RetryCount = 10 -> 5 * 2^10 = 5120s capped by Math.Min(..., 300) -> 300 seconds
        var delay10 = (recorded[11] - before).TotalSeconds;
        Assert.InRange(delay10, 295.0, 305.0);
    }

    [Fact]
    public async Task OutboxPublisher_ExecuteAsync_PollsAndStopsCleanlyOnCancellation()
    {
        var (service, outboxRepo, kafkaProducer) = CreateOutboxSut(pollingMs: 30, batchSize: 10);
        var publishedSignal = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);

        var calls = 0;
        outboxRepo.Setup(r => r.GetPendingMessagesAsync(10))
            .ReturnsAsync(() =>
            {
                calls++;
                return new List<OutboxMessage>
                {
                    new() { Id = 100, AggregateId = "PAY-LOOP", Payload = "{}" }
                };
            });
        kafkaProducer.Setup(k => k.PublishMessageAsync("PAY-LOOP", "{}")).Returns(Task.CompletedTask);
        outboxRepo.Setup(r => r.MarkAsPublishedAsync(100))
            .Callback(() => publishedSignal.TrySetResult(true))
            .Returns(Task.CompletedTask);

        await service.StartAsync(CancellationToken.None);
        var completed = await Task.WhenAny(publishedSignal.Task, Task.Delay(5000));
        await service.StopAsync(CancellationToken.None);

        Assert.Same(publishedSignal.Task, completed);
        Assert.True(calls >= 1);
        outboxRepo.Verify(r => r.MarkAsPublishedAsync(100), Times.AtLeastOnce);
    }

    [Fact]
    public async Task OutboxPublisher_ProcessPendingMessages_StopsEarlyWhenTokenAlreadyCancelled()
    {
        var (service, outboxRepo, kafkaProducer) = CreateOutboxSut();
        using var cts = new CancellationTokenSource();
        cts.Cancel();

        outboxRepo.Setup(r => r.GetPendingMessagesAsync(It.IsAny<int>()))
            .ReturnsAsync(new List<OutboxMessage>
            {
                new() { Id = 201, AggregateId = "PAY-CANCEL", Payload = "{}" }
            });

        var method = typeof(OutboxPublisherService).GetMethod("ProcessPendingMessagesAsync", BindingFlags.NonPublic | BindingFlags.Instance)!;
        await (Task)method.Invoke(service, new object[] { cts.Token })!;

        kafkaProducer.Verify(k => k.PublishMessageAsync(It.IsAny<string>(), It.IsAny<string>()), Times.Never);
    }

    #endregion

    #region WalletController — Exact Boundaries ($5000, PageSize 1 & 100), TotalPages Math, Error Messages

    [Fact]
    public async Task WalletController_TopUp_AllowsExact5000Boundary_AndValidatesErrors()
    {
        var mockRepo = new Mock<IWalletRepository>();
        var controller = new WalletController(mockRepo.Object)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = CreatePrincipal("Driver", driverId: "DRV-W1") }
            }
        };

        // Exact 5000m must succeed (kills `dto.Amount > 5000m` -> `>= 5000m` mutant)
        mockRepo.Setup(r => r.TopUpAsync("DRV-W1", 5000m, null)).ReturnsAsync(true);
        mockRepo.Setup(r => r.GetWalletByDriverIdAsync("DRV-W1")).ReturnsAsync(new Wallet { DriverId = "DRV-W1", Balance = 5000m });

        var okResult = Assert.IsType<OkObjectResult>(await controller.TopUp(new TopUpDto { Amount = 5000m }));
        var json = JsonSerializer.Serialize(okResult.Value);
        Assert.Contains("\"success\":true", json);

        // Zero amount returns specific message
        var badZero = Assert.IsType<BadRequestObjectResult>(await controller.TopUp(new TopUpDto { Amount = 0m }));
        Assert.Contains("greater than zero", badZero.Value?.ToString());

        // 5000.01m exceeds limit with specific message
        var badMax = Assert.IsType<BadRequestObjectResult>(await controller.TopUp(new TopUpDto { Amount = 5000.01m }));
        Assert.Contains("5,000.00", badMax.Value?.ToString());

        // Repo failure returns BadRequest with message
        mockRepo.Setup(r => r.TopUpAsync("DRV-W1", 25m, "FAIL-KEY")).ReturnsAsync(false);
        var badFail = Assert.IsType<BadRequestObjectResult>(await controller.TopUp(new TopUpDto { Amount = 25m, IdempotencyKey = "FAIL-KEY" }));
        Assert.Equal("Top-up failed.", badFail.Value?.ToString());

        // GetWallet returns success: true
        var walletOk = Assert.IsType<OkObjectResult>(await controller.GetWallet());
        Assert.Contains("\"success\":true", JsonSerializer.Serialize(walletOk.Value));
    }

    [Fact]
    public async Task WalletController_GetTransactions_EnforcesPageSizeBoundariesAndComputesExactTotalPages()
    {
        var mockRepo = new Mock<IWalletRepository>();
        var controller = new WalletController(mockRepo.Object)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = CreatePrincipal("Driver", driverId: "DRV-W2") }
            }
        };

        // Exact boundary pageSize = 1 and pageSize = 100 must succeed (kills <= 1 and >= 100 mutants)
        mockRepo.Setup(r => r.GetWalletTransactionsAsync("DRV-W2", 1, 1))
            .ReturnsAsync((new List<WalletTransaction> { new() { Amount = 10m } }, 3));
        var resMin = Assert.IsType<OkObjectResult>(await controller.GetWalletTransactions(page: 1, pageSize: 1));
        var payloadMin = Assert.IsType<PaginatedResponse<WalletTransaction>>(resMin.Value);
        Assert.True(payloadMin.Success);
        Assert.Equal(3, payloadMin.Pagination.TotalPages);
        Assert.Equal(3, payloadMin.Pagination.TotalCount);
        Assert.Equal(1, payloadMin.Pagination.Page);
        Assert.Equal(1, payloadMin.Pagination.PageSize);

        mockRepo.Setup(r => r.GetWalletTransactionsAsync("DRV-W2", 1, 100))
            .ReturnsAsync((new List<WalletTransaction>(), 0));
        var resMax = Assert.IsType<OkObjectResult>(await controller.GetWalletTransactions(page: 1, pageSize: 100));
        var payloadMax = Assert.IsType<PaginatedResponse<WalletTransaction>>(resMax.Value);
        Assert.Equal(0, payloadMax.Pagination.TotalPages);

        // Multi-page division check: 25 items / 10 per page = 3 pages (kills `/` -> `*` mutant which gives 250)
        mockRepo.Setup(r => r.GetWalletTransactionsAsync("DRV-W2", 2, 10))
            .ReturnsAsync((new List<WalletTransaction>(), 25));
        var resDiv = Assert.IsType<OkObjectResult>(await controller.GetWalletTransactions(page: 2, pageSize: 10));
        var payloadDiv = Assert.IsType<PaginatedResponse<WalletTransaction>>(resDiv.Value);
        Assert.Equal(3, payloadDiv.Pagination.TotalPages);
        Assert.Equal(2, payloadDiv.Pagination.Page);
        Assert.Equal(10, payloadDiv.Pagination.PageSize);

        // Invalid pagination returns message
        var badPage = Assert.IsType<BadRequestObjectResult>(await controller.GetWalletTransactions(page: 0, pageSize: 10));
        Assert.Contains("Invalid pagination parameters", badPage.Value?.ToString());
    }

    #endregion

    #region PaymentsController — Idempotency, Completion Paths, Pagination Math, Error Payloads

    private static (
        PaymentsController Controller,
        Mock<IPaymentRepository> PaymentRepo,
        Mock<IWalletRepository> WalletRepo)
        CreatePaymentsController(ClaimsPrincipal user)
    {
        var paymentRepo = new Mock<IPaymentRepository>();
        var walletRepo = new Mock<IWalletRepository>();
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Kafka:BootstrapServers"] = "localhost:9092" })
            .Build();
        var kafkaProducer = new Mock<KafkaProducerService>(config, new Mock<ILogger<KafkaProducerService>>().Object);

        var controller = new PaymentsController(paymentRepo.Object, kafkaProducer.Object, walletRepo.Object)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = user }
            }
        };

        return (controller, paymentRepo, walletRepo);
    }

    [Fact]
    public async Task PaymentsController_AuthorizeAndComplete_CoverIdempotencyOwnershipAndErrorPaths()
    {
        // 1. Missing driver_id claim -> 401 with message
        var (noIdCtrl, _, _) = CreatePaymentsController(CreatePrincipal("Driver", driverId: null));
        var unauth = Assert.IsType<UnauthorizedObjectResult>(await noIdCtrl.AuthorizePayment(new AuthorizePaymentDto { SessionId = "S-1" }));
        Assert.Contains("Driver identity not found", unauth.Value?.ToString());

        var unauthTx = Assert.IsType<UnauthorizedObjectResult>(await noIdCtrl.GetPaymentTransactions());
        Assert.Contains("Driver identity not found", unauthTx.Value?.ToString());

        var unauthStatus = Assert.IsType<UnauthorizedObjectResult>(await noIdCtrl.GetPaymentStatusBySession("S-1"));
        Assert.Contains("Driver identity not found", unauthStatus.Value?.ToString());

        // 2. Idempotent AuthorizePayment returns existing payment with success=true
        var (drvCtrl, payRepo, walletRepo) = CreatePaymentsController(CreatePrincipal("Driver", driverId: "DRV-1", useShortRoleClaim: true));
        var existing = new PaymentTransaction { PaymentId = "PAY-EX", SessionId = "S-EX", DriverId = "DRV-1", CompanyId = "COMP-1", Status = "AUTHORIZED" };
        payRepo.Setup(r => r.GetPaymentBySessionIdAsync("S-EX")).ReturnsAsync(existing);

        var idempRes = Assert.IsType<OkObjectResult>(await drvCtrl.AuthorizePayment(new AuthorizePaymentDto { SessionId = "S-EX" }));
        Assert.Contains("\"success\":true", JsonSerializer.Serialize(idempRes.Value));
        payRepo.Verify(r => r.AuthorizePaymentAsync(It.IsAny<PaymentTransaction>()), Times.Never);

        // 3. CompletePaymentBySession when session not found -> 404 with message
        payRepo.Setup(r => r.GetPaymentBySessionIdAsync("S-NONE")).ReturnsAsync((PaymentTransaction?)null);
        var notFoundBySess = Assert.IsType<NotFoundObjectResult>(await drvCtrl.CompletePaymentBySession("S-NONE", new CompletePaymentDto { FinalAmount = 10m }));
        Assert.Equal("Payment not found for session", notFoundBySess.Value?.ToString());

        // 4. CompletePayment when payment not found -> 404 with message
        payRepo.Setup(r => r.GetPaymentByIdAsync("PAY-NONE")).ReturnsAsync((PaymentTransaction?)null);
        var notFoundById = Assert.IsType<NotFoundObjectResult>(await drvCtrl.CompletePayment("PAY-NONE", new CompletePaymentDto { FinalAmount = 10m }));
        Assert.Equal("Payment not found", notFoundById.Value?.ToString());

        // 5. Driver trying to complete ANOTHER driver's payment -> Forbid
        payRepo.Setup(r => r.GetPaymentByIdAsync("PAY-OTHER")).ReturnsAsync(new PaymentTransaction { PaymentId = "PAY-OTHER", DriverId = "DRV-OTHER", CompanyId = "COMP-1", Status = "AUTHORIZED" });
        Assert.IsType<ForbidResult>(await drvCtrl.CompletePayment("PAY-OTHER", new CompletePaymentDto { FinalAmount = 10m }));

        // 6. Already COMPLETED payment -> idempotent 200 without charging wallet again
        payRepo.Setup(r => r.GetPaymentByIdAsync("PAY-DONE")).ReturnsAsync(new PaymentTransaction { PaymentId = "PAY-DONE", DriverId = "DRV-1", CompanyId = "COMP-1", Status = "COMPLETED" });
        var doneRes = Assert.IsType<OkObjectResult>(await drvCtrl.CompletePayment("PAY-DONE", new CompletePaymentDto { FinalAmount = 10m }));
        Assert.Contains("\"success\":true", JsonSerializer.Serialize(doneRes.Value));
        walletRepo.Verify(w => w.ChargeWalletAndCompletePaymentAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<decimal>(), It.IsAny<string>(), It.IsAny<decimal>()), Times.Never);

        // 7. Insufficient balance -> BadRequest with message
        payRepo.Setup(r => r.GetPaymentByIdAsync("PAY-LOW")).ReturnsAsync(new PaymentTransaction { PaymentId = "PAY-LOW", SessionId = "S-LOW", DriverId = "DRV-1", CompanyId = "COMP-1", Status = "AUTHORIZED", EnergyConsumedKwh = 5m });
        walletRepo.Setup(w => w.ChargeWalletAndCompletePaymentAsync("DRV-1", "PAY-LOW", 99m, "S-LOW", 5m)).ReturnsAsync(false);
        var lowRes = Assert.IsType<BadRequestObjectResult>(await drvCtrl.CompletePayment("PAY-LOW", new CompletePaymentDto { FinalAmount = 99m }));
        Assert.Contains("Insufficient balance", lowRes.Value?.ToString());

        // 8. Successful completion by session -> 200 with success=true
        payRepo.Setup(r => r.GetPaymentBySessionIdAsync("S-OK")).ReturnsAsync(new PaymentTransaction { PaymentId = "PAY-OK", SessionId = "S-OK", DriverId = "DRV-1", CompanyId = "COMP-1", Status = "AUTHORIZED", EnergyConsumedKwh = 12m });
        payRepo.Setup(r => r.GetPaymentByIdAsync("PAY-OK")).ReturnsAsync(new PaymentTransaction { PaymentId = "PAY-OK", SessionId = "S-OK", DriverId = "DRV-1", CompanyId = "COMP-1", Status = "AUTHORIZED", EnergyConsumedKwh = 12m });
        walletRepo.Setup(w => w.ChargeWalletAndCompletePaymentAsync("DRV-1", "PAY-OK", 45m, "S-OK", 12m)).ReturnsAsync(true);
        var okComp = Assert.IsType<OkObjectResult>(await drvCtrl.CompletePaymentBySession("S-OK", new CompletePaymentDto { FinalAmount = 45m }));
        Assert.Contains("\"success\":true", JsonSerializer.Serialize(okComp.Value));

        // 9. CompanyAdmin missing tenant_id -> Unauthorized with message
        var (noTenantCtrl, noTenantPayRepo, _) = CreatePaymentsController(CreatePrincipal("CompanyAdmin", tenantId: null));
        noTenantPayRepo.Setup(r => r.GetPaymentByIdAsync("PAY-1")).ReturnsAsync(new PaymentTransaction { PaymentId = "PAY-1", CompanyId = "COMP-1", Status = "AUTHORIZED" });
        var noTenantRes = Assert.IsType<UnauthorizedObjectResult>(await noTenantCtrl.CompletePayment("PAY-1", new CompletePaymentDto { FinalAmount = 10m }));
        Assert.Equal("Tenant identity missing", noTenantRes.Value?.ToString());

        // 10. Status NotFound includes success=false and message
        payRepo.Setup(r => r.GetPaymentBySessionForDriverAsync("S-404", "DRV-1")).ReturnsAsync((PaymentTransaction?)null);
        var status404 = Assert.IsType<NotFoundObjectResult>(await drvCtrl.GetPaymentStatusBySession("S-404"));
        var status404Json = JsonSerializer.Serialize(status404.Value);
        Assert.Contains("\"success\":false", status404Json);
        Assert.Contains("Payment not found for session", status404Json);
    }

    [Fact]
    public async Task PaymentsController_GetTransactions_EnforcesBoundariesAndExactTotalPages()
    {
        var (ctrl, payRepo, _) = CreatePaymentsController(CreatePrincipal("Driver", driverId: "DRV-P1"));

        // Exact boundary pageSize = 1 and pageSize = 100
        payRepo.Setup(r => r.GetPaymentTransactionsAsync("DRV-P1", 1, 1))
            .ReturnsAsync((new List<PaymentTransaction> { new() { PaymentId = "P-1" } }, 4));
        var r1 = Assert.IsType<OkObjectResult>(await ctrl.GetPaymentTransactions(page: 1, pageSize: 1));
        var p1 = Assert.IsType<PaginatedResponse<PaymentTransaction>>(r1.Value);
        Assert.True(p1.Success);
        Assert.Equal(4, p1.Pagination.TotalPages);
        Assert.Equal(4, p1.Pagination.TotalCount);

        payRepo.Setup(r => r.GetPaymentTransactionsAsync("DRV-P1", 1, 100))
            .ReturnsAsync((new List<PaymentTransaction>(), 0));
        var r100 = Assert.IsType<OkObjectResult>(await ctrl.GetPaymentTransactions(page: 1, pageSize: 100));
        var p100 = Assert.IsType<PaginatedResponse<PaymentTransaction>>(r100.Value);
        Assert.Equal(0, p100.Pagination.TotalPages);

        // 25 / 10 = 3 total pages (kills `/` -> `*` mutant)
        payRepo.Setup(r => r.GetPaymentTransactionsAsync("DRV-P1", 2, 10))
            .ReturnsAsync((new List<PaymentTransaction>(), 25));
        var rDiv = Assert.IsType<OkObjectResult>(await ctrl.GetPaymentTransactions(page: 2, pageSize: 10));
        var pDiv = Assert.IsType<PaginatedResponse<PaymentTransaction>>(rDiv.Value);
        Assert.Equal(3, pDiv.Pagination.TotalPages);
        Assert.Equal(2, pDiv.Pagination.Page);
        Assert.Equal(10, pDiv.Pagination.PageSize);

        // Invalid pagination returns message
        var bad = Assert.IsType<BadRequestObjectResult>(await ctrl.GetPaymentTransactions(page: 0, pageSize: 10));
        Assert.Contains("Invalid pagination parameters", bad.Value?.ToString());
    }

    #endregion

    #region CompanyAnalyticsController — All Endpoints, Roles, Boundaries, Date Range & Flags

    [Theory]
    [InlineData("CompanyAdmin", false)]
    [InlineData("Operator", true)]
    [InlineData("Company", true)]
    public async Task CompanyAnalyticsController_AllEndpoints_AllowValidCompanyRolesAndRejectUnauthorized(string role, bool useShortRoleClaim)
    {
        var mockRepo = new Mock<ICompanyAnalyticsRepository>();
        var forecastService = new ForecastService(new Mock<ILogger<ForecastService>>().Object);

        mockRepo.Setup(r => r.GetDashboardAnalyticsAsync("COMP-1", null, null, null))
            .ReturnsAsync(new DashboardAnalyticsDto { TotalRevenue = 1200m });
        mockRepo.Setup(r => r.GetCompanyTransactionsAsync("COMP-1", 50, null, null, null))
            .ReturnsAsync(new List<TransactionDto>());
        mockRepo.Setup(r => r.GetCompanyRevenueTrendAsync("COMP-1", null, null, null))
            .ReturnsAsync(new List<RevenueTrendDto>());
        mockRepo.Setup(r => r.GetStationAnalyticsAsync("COMP-1", null, null, null))
            .ReturnsAsync(new List<StationAnalyticsDto>());

        var controller = new CompanyAnalyticsController(mockRepo.Object, forecastService)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = CreatePrincipal(role, tenantId: "COMP-1", useShortRoleClaim: useShortRoleClaim) }
            }
        };

        // Authorized calls succeed with success=true
        Assert.Contains("\"success\":true", JsonSerializer.Serialize(Assert.IsType<OkObjectResult>(await controller.GetDashboardAnalytics("COMP-1")).Value));
        Assert.Contains("\"success\":true", JsonSerializer.Serialize(Assert.IsType<OkObjectResult>(await controller.GetCompanyTransactions("COMP-1")).Value));
        Assert.Contains("\"success\":true", JsonSerializer.Serialize(Assert.IsType<OkObjectResult>(await controller.GetCompanyRevenueTrend("COMP-1")).Value));
        Assert.Contains("\"success\":true", JsonSerializer.Serialize(Assert.IsType<OkObjectResult>(await controller.GetStationAnalytics("COMP-1")).Value));

        // Cross-tenant calls are forbidden on all 4 endpoints
        Assert.IsType<ForbidResult>(await controller.GetDashboardAnalytics("COMP-OTHER"));
        Assert.IsType<ForbidResult>(await controller.GetCompanyTransactions("COMP-OTHER"));
        Assert.IsType<ForbidResult>(await controller.GetCompanyRevenueTrend("COMP-OTHER"));
        Assert.IsType<ForbidResult>(await controller.GetStationAnalytics("COMP-OTHER"));
    }

    [Fact]
    public async Task CompanyAnalyticsController_GetForecast_ValidatesExactBoundariesDateDirectionSortingAndFlags()
    {
        var mockRepo = new Mock<ICompanyAnalyticsRepository>();
        var mockForecast = new Mock<IForecastService>();
        var controller = new CompanyAnalyticsController(mockRepo.Object, mockForecast.Object)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = CreatePrincipal("CompanyAdmin", tenantId: "COMP-F") }
            }
        };

        DateTime? capturedStart = null;
        DateTime? capturedEnd = null;
        List<RevenueData>? capturedInput = null;

        mockForecast.Setup(f => f.PredictNext7Days(It.IsAny<IEnumerable<RevenueData>>()))
            .Callback<IEnumerable<RevenueData>>(d => capturedInput = d.ToList())
            .Returns(new List<RevenueForecast> { new() { Date = DateTime.UtcNow.Date.AddDays(1), PredictedRevenue = 50m } });

        // Exact boundary historicalDays = 1 and 365 (kills <= 1 and >= 365 mutants)
        mockRepo.Setup(r => r.GetCompanyRevenueTrendAsync("COMP-F", It.IsAny<DateTime?>(), It.IsAny<DateTime?>(), null))
            .Callback<string, DateTime?, DateTime?, string?>((_, s, e, _) => { capturedStart = s; capturedEnd = e; })
            .ReturnsAsync(new List<RevenueTrendDto>
            {
                new() { Date = "2026-10-05", Revenue = 0m },
                new() { Date = "not-a-date", Revenue = 999m },
                new() { Date = "2026-10-01", Revenue = 100m }
            });

        var res1 = Assert.IsType<OkObjectResult>(await controller.GetCompanyForecast("COMP-F", historicalDays: 1));
        Assert.NotNull(capturedStart);
        Assert.NotNull(capturedEnd);
        // startDate MUST be strictly before endDate (kills `-historicalDays` -> `+historicalDays` mutant)
        Assert.True(capturedStart < capturedEnd);

        // Invalid date filtered out and valid dates sorted ascending (kills OrderByDescending and == DateTime.MinValue mutants)
        Assert.NotNull(capturedInput);
        Assert.Equal(2, capturedInput!.Count);
        Assert.Equal(new DateTime(2026, 10, 1), capturedInput[0].Date);
        Assert.Equal(100f, capturedInput[0].Amount);
        Assert.Equal(new DateTime(2026, 10, 5), capturedInput[1].Date);
        Assert.Equal(0f, capturedInput[1].Amount);

        var json1 = JsonSerializer.Serialize(res1.Value);
        Assert.Contains("\"success\":true", json1);
        Assert.Contains("\"isBaseline\":true", json1);
        Assert.Contains("\"hasHistory\":true", json1);

        // Exact boundary historicalDays = 365 with 7 valid items -> isBaseline MUST be false (kills `< 7` -> `<= 7` mutant)
        var sevenTrends = Enumerable.Range(1, 7)
            .Select(d => new RevenueTrendDto { Date = $"2026-10-{d:00}", Revenue = 0m })
            .ToList();
        mockRepo.Setup(r => r.GetCompanyRevenueTrendAsync("COMP-F", It.IsAny<DateTime?>(), It.IsAny<DateTime?>(), null))
            .ReturnsAsync(sevenTrends);

        var res365 = Assert.IsType<OkObjectResult>(await controller.GetCompanyForecast("COMP-F", historicalDays: 365));
        var json365 = JsonSerializer.Serialize(res365.Value);
        Assert.Contains("\"isBaseline\":false", json365);
        // All 7 revenues are 0 -> hasHistory MUST be false (kills `r.Amount >= 0` and `||` mutants)
        Assert.Contains("\"hasHistory\":false", json365);

        // Invalid historicalDays message check
        var bad = Assert.IsType<BadRequestObjectResult>(await controller.GetCompanyForecast("COMP-F", historicalDays: 0));
        Assert.Contains("between 1 and 365", bad.Value?.ToString());
    }

    #endregion
}
