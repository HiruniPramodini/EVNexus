# EVNexus Mutation Testing & Fault-Tolerance Suite (Stryker.NET 5.0.0)

> **Course:** SE3112 – Advanced Software Engineering (BSc. Hons in Computer Science – Y3S1)  
> **Team No:** 32  
> **Student Name:** K.T.L. Perera  
> **Student ID:** `IT24610793`  
> **Assigned Testing Paradigm:** Mutation Testing & Fault-Tolerance  
> **Mutation Engine:** Stryker.NET `5.0.0` (Roslyn C# AST Mutator, Coverage-Based Per-Test)  
> **Repository:** [EVNexus](https://github.com/HiruniPramodini/EVNexus)

---

## 1. Executive Overview

Code coverage (line/branch coverage) only proves that production code was *executed* during testing — it does **not** prove that test assertions would actually fail if a subtle defect were introduced. **Mutation Testing** solves this by systematically injecting artificial faults (*mutants*) into the C# Abstract Syntax Tree (AST) using Roslyn (e.g., flipping `<` to `<=`, `&&` to `||`, `+` to `-`, `true` to `false`, `Any()` to `All()`, removing statements) and re-running the unit test suite against each mutant:

- **Killed:** At least one unit test failed -> the test suite detected the fault.
- **Survived:** All unit tests still passed -> potential weak assertion, missing boundary case, or an *equivalent mutant*.
- **NoCoverage:** No test executed that line of code.
- **Timeout:** The mutation caused an infinite loop/hang and was terminated cleanly.
- **Ignored:** Filtered intentionally (e.g., non-functional `ILogger` calls via `ignore-methods`).

$$\text{Mutation Score} = \frac{\text{Killed} + \text{Timeout}}{\text{Killed} + \text{Timeout} + \text{Survived} + \text{NoCoverage}} \times 100\%$$

---

## 2. Multi-Microservice Mutation Architecture

EVNexus evaluates mutation fault-tolerance across **both microservices that own isolated, deterministic unit test suites**:

| Microservice | Target Production Assembly | Test Suite | Mutated Critical Components | Quality Gate (`break` / `low` / `high`) |
| :--- | :--- | :--- | :--- | :---: |
| **AuthenticationService** | `EVNexus.AuthService.csproj` | `EVNexus.AuthService.Tests` (211 tests) | `AccountManagementService`, `SessionService`, `JwtTokenService`, `RoleAuthorizationMiddleware`, `TenantResolutionMiddleware` | **70% / 70% / 85%** |
| **PaymentService** | `EVNexus.PaymentService.csproj` | `EVNexus.PaymentService.Tests` (78 tests) | `ForecastService` (ML.NET SSA), `OutboxPublisherService` (Kafka backoff), `WalletController`, `PaymentsController`, `CompanyAnalyticsController` | **65% / 65% / 80%** |

> **Scope Justification (Why `MapService` and `DashboardAnalyticsService` are excluded):**
> - `MapService.Tests` relies on MySQL-backed `WebApplicationFactory` integration tests (`StationCrudIntegrationTests`, `SessionIntegrationTests`, `ChargerCrudIntegrationTests`, `CompanySessionsIntegrationTests`), while `MapDomainUnitTests` exercises self-contained math helpers rather than `EVNexus.MapService` production classes. Running hundreds of mutants against live MySQL containers is non-deterministic and slow.
> - `DashboardAnalyticsService` currently contains only the default ASP.NET WeatherForecast template; all live company analytics and ML.NET 7-day revenue forecasting reside in `PaymentService` (`CompanyAnalyticsController` + `ForecastService`) and **are** mutation-tested here.

### Idiomatic Stryker.NET 5.0.0 Optimizations Applied
1. **`"coverage-analysis": "perTest"`:** Maps each mutant to only the specific xUnit tests that cover that statement, reducing execution time drastically compared to full-suite re-runs per mutant.
2. **`"ignore-methods": ["*Log*", "LogInformation", ..., "ConfigureAwait"]`:** Suppresses non-functional telemetry/logging string mutations that create false-positive survivors without improving business fault tolerance.
3. **`"break-on-initial-test-failure": true`:** Fails fast if the baseline unit test suite is broken before mutating.
4. **Real Quality Gates (No `|| true`):** Both `run-mutation.ps1` and GitHub Actions (`.github/workflows/mutation-testing.yml`) return non-zero exit codes whenever any microservice drops below its configured `break` threshold.

---

## 3. File Structure

```text
tests/mutation-stryker/
├── stryker-auth.json        # AuthenticationService Stryker.NET 5.0.0 configuration
├── stryker-payment.json     # PaymentService Stryker.NET 5.0.0 configuration
├── stryker-config.json      # Default/primary Stryker configuration (AuthService)
├── run-mutation.ps1         # Cross-platform PowerShell 5.1 / 7+ runner & unified HTML dashboard builder
└── README.md                # Setup, Before/After metrics, equivalent mutant analysis & VIVA guide

AuthenticationService/tests/EVNexus.AuthService.Tests/
└── MutationHardeningTests.cs        # +19 mutation-guided tests targeting AuthService survivors

PaymentService/tests/EVNexus.PaymentService.Tests/
└── PaymentMutationHardeningTests.cs # +15 mutation-guided tests targeting PaymentService survivors

.github/workflows/
├── mutation-testing.yml     # Dedicated CI workflow with step summary & 14-day artifact retention
└── testing-pipeline.yml     # Unified group pipeline (Stage 2 wired to run-mutation.ps1)
```

---

## 4. Verified Before vs. After Mutation Testing Results

All results below were measured locally with **Stryker.NET 5.0.0** on **.NET 8.0**:

### Overall Microservice Comparison

| Microservice | Baseline Score (Before) | Hardened Score (After) | Improvement | Mutants Killed / Valid | NoCoverage (Before -> After) | Quality Gate |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **AuthenticationService** | 43.99% (150/341) | **90.67%** (272/300) | **+46.68%** | 272 / 300 | 52 -> **0** | PASS (>= 70%) |
| **PaymentService** | 43.81% (99/226) | **90.52%** (191/211) | **+46.71%** | 191 / 211 | 46 -> **0** | PASS (>= 65%) |
| **Weighted Combined Total** | **43.92%** (249/567) | **90.61%** (463/511) | **+46.69%** | **463 / 511** | **98 -> 0** | **PASS** |

### Per-File Breakdown

| Service | Source File | Baseline Score | Hardened Score | Killed | Survived | NoCoverage | Ignored (Log/Filter) |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| Auth | `AccountManagementService.cs` | 45.54% | **100.00%** | 90 | 0 | 0 | 35 |
| Auth | `TenantResolutionMiddleware.cs` | 56.67% | **100.00%** | 28 | 0 | 0 | 6 |
| Auth | `JwtTokenService.cs` | 24.49% | **91.84%** | 45 | 4 | 0 | 6 |
| Auth | `SessionService.cs` | 44.23% | **86.96%** | 40 | 6 | 0 | 11 |
| Auth | `RoleAuthorizationMiddleware.cs` | 47.96% | **79.31%** | 69 | 18 | 0 | 31 |
| Payment | `WalletController.cs` | 65.91% | **97.73%** | 43 | 1 | 0 | 3 |
| Payment | `CompanyAnalyticsController.cs` | 40.82% | **91.84%** | 45 | 4 | 0 | 9 |
| Payment | `PaymentsController.cs` | 46.67% | **88.00%** | 66 | 9 | 0 | 11 |
| Payment | `ForecastService.cs` | 30.56% | **87.10%** | 27 | 4 | 0 | 13 |
| Payment | `OutboxPublisherService.cs` | 18.18% | **83.33%** | 10 | 2 | 0 | 19 |

---

## 5. Real Defects & Test Weaknesses Uncovered by Mutation Testing

1. **Silent ML.NET SSA Fallback Defect in `ForecastService.cs`:**
   - The existing test `PredictNext7Days_WithSufficientData_ExecutesSsaForecasting` passed 14 daily records and passed all assertions — yet Stryker reported **0% coverage on lines 69–83** (the SSA output loop)!
   - **Root Cause:** ML.NET's `ForecastBySsa` requires `seriesLength > 2 * windowSize`. With 14 records, `windowSize = Math.Min(14 / 2, 7) = 7`, so `14 > 14` was `false`, throwing an internal ML.NET exception silently swallowed by the `catch` fallback!
   - **Fix in Tests:** `PaymentMutationHardeningTests` now tests 21-day periodic/declining series (genuinely exercising SSA and negative clamping) alongside the exact 7-day and 14-day boundary behaviors.
2. **Unverified Exponential Backoff Math in `OutboxPublisherService.cs`:**
   - Mutating `Math.Min(5 * Math.Pow(2, message.RetryCount), 300)` to `5 / Math.Pow(...)` and `Math.Max(...)` **survived** because the existing test only asserted `It.IsAny<DateTime>()`.
   - **Fix in Tests:** Added exact timing assertions verifying `RetryCount=2` schedules ~20s and `RetryCount=10` caps at ~300s.
3. **Unverified Multi-Tenant & Security Boundaries in `AuthService`:**
   - In `TenantResolutionMiddleware.cs`, mutating `tenantContext.HasTenant && !string.Equals(...)` to `||` survived — a critical multi-tenant isolation guard.
   - In `JwtTokenService.cs`, `key.Length < 32` mutated to `<= 32` survived, `ExpiryMinutes > 0` boundary mutations survived, and `GenerateStaffToken`/`GeneratePlatformAdminToken` had zero coverage.
   - In `SessionService.cs`, mutating `IsRevoked = false` to `IsRevoked = true` when issuing a new refresh token survived because `SaveRefreshTokenAsync` was only verified with `It.IsAny<RefreshToken>()`.
4. **Missing Financial & Pagination Boundary Checks in `WalletController` & `PaymentsController`:**
   - Mutating `dto.Amount > 5000m` to `>= 5000m` survived (missing exact `$5,000` boundary test).
   - Mutating `(double)totalCount / pageSize` to `*` survived because multi-page `TotalPages` was never asserted.

---

## 6. Equivalent Mutant Analysis (Remaining Survivors)

Stryker.NET's remaining 48 survivors across 511 valid mutants were audited and are predominantly **equivalent mutants** (syntactically different code with identical observable behavior) or non-functional DTO/log defaults:

| File & Line | Original Code | Surviving Mutant | Why It Is Equivalent / Non-Critical |
| :--- | :--- | :--- | :--- |
| `WalletController.cs:62` & `PaymentsController.cs:122` | `totalCount == 0 ? 0 : (int)Math.Ceiling((double)totalCount / pageSize)` | `false ? 0 : (int)Math.Ceiling(...)` | When `totalCount == 0`, `(int)Math.Ceiling(0.0 / pageSize)` already evaluates to `0`. Mathematically equivalent. |
| `ForecastService.cs:50, 76, 97` | `if (windowSize < 2) windowSize = 2;` (and `< 0` clamps) | `if (windowSize <= 2) windowSize = 2;` (and `<= 0`) | Assigning `2` when the value is already `2` (or `0` when already `0`) produces identical state. Mathematically equivalent. |
| `CompanyAnalyticsController.cs:108` | `revenueData.Count > 0 && revenueData.Any(r => r.Amount > 0)` | `revenueData.Count >= 0 && revenueData.Any(...)` | On an empty list (`Count == 0`), `Any(...)` returns `false`, so the boolean outcome is identical. |
| `SessionService.cs:193` & `RoleAuthorizationMiddleware.cs:43` | `FindFirstValue(JwtRegisteredClaimNames.Jti) ?? FindFirstValue("jti")` | Swapping or dropping one operand | The constant `JwtRegisteredClaimNames.Jti` literally equals `"jti"`, so both lookups are identical. |
| `JwtTokenService.cs:49, 87, 125, 163` | `new(ClaimTypes.Role, ...)` followed by `new("role", ...)` | `new("", ...)` on the second line | `JwtSecurityTokenHandler` automatically maps `ClaimTypes.Role` to `"role"` in serialized JWTs, making the duplicate `"role"` claim redundant. |
| `SessionService.cs:67-185` (`CompileError`) | `string newAccessToken; int expiresIn; string role;` in `if/else` | Stryker Safe Mode (`CS0165`) | Mutating branch conditions triggers C# definite-assignment compiler errors (`CS0165`); Stryker safely excludes non-compiling mutants from the score denominator. |

---

## 7. Quick Start & Execution Commands

### Prerequisites
- [.NET 8.0 SDK](https://dotnet.microsoft.com/download/dotnet/8.0) (`dotnet --version`)
- PowerShell 5.1 (built-in Windows) or PowerShell 7+ (`pwsh`)
- Local tool manifest restored via `dotnet tool restore` (`dotnet-stryker 5.0.0` is pinned in `.config/dotnet-tools.json`)

### Commands (Run from Repository Root)

```powershell
# 1. Fast Live Demo (Recommended for 2-Minute VIVA - runs in ~45-60s)
powershell -ExecutionPolicy Bypass -File ".\tests\mutation-stryker\run-mutation.ps1" -Service Auth -QuickDemo -OpenReport

# 2. Fast Live Demo on PaymentService ML.NET Forecasting
powershell -ExecutionPolicy Bypass -File ".\tests\mutation-stryker\run-mutation.ps1" -Service Payment -QuickDemo -OpenReport

# 3. Full Multi-Microservice Mutation Quality Gate (Auth + Payment, ~7 mins)
powershell -ExecutionPolicy Bypass -File ".\tests\mutation-stryker\run-mutation.ps1" -Service All -OpenReport

# 4. Run Single Microservice Full Suite (Auth or Payment)
powershell -ExecutionPolicy Bypass -File ".\tests\mutation-stryker\run-mutation.ps1" -Service Auth -SkipRestore -OpenReport
powershell -ExecutionPolicy Bypass -File ".\tests\mutation-stryker\run-mutation.ps1" -Service Payment -SkipRestore -OpenReport
```

### Generated Reports (Ignored by Git)
- **Unified Multi-Service Mutation Dashboard:** `tests/reports/mutation/index.html`
- **Machine-Readable Summary JSON:** `tests/reports/mutation/summary.json`
- **AuthenticationService Stryker Interactive Report:** `tests/reports/mutation/auth/reports/mutation-report.html`
- **PaymentService Stryker Interactive Report:** `tests/reports/mutation/payment/reports/mutation-report.html`

---

## 8. Two-Minute Live Demo & VIVA Guide

### Suggested 2-Minute Live Demo Flow
1. **0:00–0:20 (Architecture & Config):** Show `stryker-auth.json` and `stryker-payment.json` — point out `coverage-analysis: "perTest"`, `ignore-methods` (logging noise reduction), `mutation-level: "Standard"`, and enforced `thresholds.break`.
2. **0:20–1:10 (Live Execution):** Run:
   ```powershell
   powershell -ExecutionPolicy Bypass -File ".\tests\mutation-stryker\run-mutation.ps1" -Service Auth -QuickDemo -SkipRestore -OpenReport
   ```
   While Stryker runs (~40s), explain how Roslyn compiles mutated AST branches in memory and runs only per-test covering tests.
3. **1:10–1:40 (Interactive Dashboard Walkthrough):** Open `tests/reports/mutation/index.html` and drill into a Stryker HTML report showing green **Killed** mutants, red **Survived** mutants, and exact inline code diffs.
4. **1:40–2:00 (Real Impact & CI/CD):** Highlight the **43.92% -> 90.61%** jump, the silent ML.NET SSA fallback bug caught in `ForecastService.cs`, one textbook equivalent mutant (`WalletController.cs:62` or `ForecastService.cs:50`), and `.github/workflows/mutation-testing.yml`.

### Key VIVA Concepts to Defend
- **Mutation Score vs. Code Coverage:** Code coverage measures execution; mutation score measures *assertion effectiveness* (oracle strength). Example: `ForecastService.cs` had passing tests and high coverage, yet mutation testing exposed 0% coverage of the real SSA loop.
- **Equivalent Mutants:** Why 100% mutation score is often impossible/undesirable (e.g., `x < 0 ? 0 : x` vs `x <= 0 ? 0 : x`), and why a **70%–85%** threshold is industry standard.
- **Performance Optimization:** Why we use `coverage-analysis: "perTest"`, `concurrency`, `ignore-methods` for logging, and scoped `mutate` globs (excluding SQL/ADO.NET `Data/**` adapters).
- **CI/CD Quality Gate:** Non-zero exit code when score `< break`, plus `$GITHUB_STEP_SUMMARY` and 14-day artifact retention.
