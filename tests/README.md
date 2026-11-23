# ⚡ EVNexus — Automated Microservice Testing Pipeline

> **Course:** SE3112 – Advanced Software Engineering (BSc. Hons in Computer Science – Y3S1)  
> **Team No:** 32  
> **Repository:** [EVNexus](https://github.com/HiruniPramodini/EVNexus)

---

## 👥 Team Members & Role Allocation

| Student Name | Student ID | Individual Testing Paradigm / Ownership | Primary Tools Utilized |
| :--- | :--- | :--- | :--- |
| **A.G.H. Pramodini** | `IT24610786` | **UI / End-to-End (E2E) Browser Testing** | Selenium WebDriver, Headless Chrome, Node.js |
| **K.T.L. Perera** | `IT24610793` | **Mutation Testing & Fault-Tolerance** | Stryker.NET 4.4.1 / 5.0.0, Roslyn C# Mutator |
| **N.P.K.N. Pathirana** | `IT24610784` | **Unit Testing & Mocking Test Doubles** | xUnit, Moq, `[Theory]`/`[InlineData]`, ReportGenerator |
| **J.M. Asmal** | `IT24610803` | **API Load & Performance Testing** | Apache JMeter 5.6.3, Non-GUI Engine, APDEX Analyzer |

---

## 🏗️ Architecture & Testing Layers

EVNexus implements a **4-tier automated test verification framework** integrated into a single unified pipeline:

```text
[ Git Push / PR ] ──▶ [ CI/CD Pipeline: GitHub Actions / run-all-tests.ps1 ]
                              │
  ┌───────────────────────────┼───────────────────────────┐
  ▼                           ▼                           ▼
[ Layer 1: Unit Tests ]     [ Layer 2: Mutation ]      [ Layer 3: Selenium E2E ]
• xUnit + Moq doubles       • Stryker.NET 5.0          • 12 Browser Journeys
• 268 Isolated Tests        • Arithmetic/Equality      • Headless Chrome
• ReportGenerator Coverage  • Killed/Survived score    • UI Functional Verif.
                              │
                              ▼
                    [ Layer 4: JMeter Load ]
                    • 5,000 Transactions (10 endpoints)
                    • 178.65 req/s throughput
                    • Mean latency 20.24ms (SLA < 200ms)
                              │
                              ▼
                    [ Unified HTML Reports ]
                    tests/reports/index.html
```

---

## 🚀 Quick Start & Execution Commands

### Prerequisites
- [.NET 8.0 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- [Node.js 20+ LTS](https://nodejs.org/)
- Google Chrome (installed on machine)
- *(Optional)* Apache JMeter 5.6.3 (CLI available or fallback engine)

### 1. Unified Test Automation Pipeline (Group Demo - 2 Minutes)
To execute the complete 4-stage pipeline sequentially and generate all HTML dashboards:

```powershell
# Run all 4 testing stages from repository root
pwsh ./tests/run-all-tests.ps1 -OpenReports
```

To run a fast pipeline excluding slow mutation scans:
```powershell
pwsh ./tests/run-all-tests.ps1 -SkipMutation
```

---

## 🎯 Individual Live Demo Commands (2 Minutes Each)

### 1. Unit Testing & Mocking — N.P.K.N. Pathirana (`IT24610784`)
Runs 268 isolated unit tests across Authentication, Payment, Map, and Analytics services, and compiles the Cobertura HTML coverage report:

```powershell
# Execute unit test suite with code coverage and open HTML dashboard
pwsh ./tests/unit-testing/run-unit-tests.ps1 -OpenReport
```
- **Key Verifications:**
  - `Mock<ITenantRepository>`, `Mock<IDriverRepository>`, `Mock<IJwtTokenService>` isolation.
  - Parameterized testing with `[Theory]` and `[InlineData]` verifying Haversine geo-math and tariff calculation edge cases.
  - 100% pass rate (268/268 tests).
  - 50% line coverage and 31% branch coverage visualized in ReportGenerator.

---

### 2. Mutation Testing — K.T.L. Perera (`IT24610793`)
Executes Stryker.NET mutation testing against core domain logic to verify fault-tolerance and test assertion strength:

```powershell
# Fast live demonstration on AccountManagementService
pwsh ./tests/mutation-stryker/run-mutation.ps1 -QuickDemo -OpenReport

# Full microservice mutation run
pwsh ./tests/mutation-stryker/run-mutation.ps1 -OpenReport
```
- **Key Verifications:**
  - Seeds artificial defects (mutations in Boolean logic, equality operators `==` to `!=`, string literals, arithmetic).
  - Calculates Killed vs. Survived mutants.
  - Proves that unit tests actively detect seeded defects rather than merely executing code blindly.

---

### 3. UI / E2E Browser Testing — A.G.H. Pramodini (`IT24610786`)
Executes Selenium WebDriver against the EVNexus React single-page application across 12 user journeys:

```powershell
# Execute 12 headless Chrome browser journeys
pwsh ./tests/e2e-selenium/run-selenium.ps1 -OpenReport
```
- **Journeys Covered:**
  1. `TC-SEL-01`: Public landing page & navigation
  2. `TC-SEL-02`: Company operator authentication portal
  3. `TC-SEL-03`: EV driver authentication portal
  4. `TC-SEL-04`: Company tenant registration & onboarding
  5. `TC-SEL-05`: Company fleet dashboard & revenue KPIs
  6. `TC-SEL-06`: AI predictive demand forecasting & revenue trends
  7. `TC-SEL-07`: Station fleet management & charging ports
  8. `TC-SEL-08`: Live EV charging active sessions monitoring
  9. `TC-SEL-09`: EV driver dashboard home portal
  10. `TC-SEL-10`: Digital wallet management & balance top-up
  11. `TC-SEL-11`: Interactive Leaflet EV charger map & radius search
  12. `TC-SEL-12`: Driver charging session history & digital receipts

---

### 4. Load & Performance Testing — J.M. Asmal (`IT24610803`)
Executes Apache JMeter 5.6.3 load test targeting 10 critical microservice endpoints:

```powershell
# Run 5,000 requests load test and open JMeter Dashboard
pwsh ./tests/load-jmeter/run-jmeter.ps1 -OpenDashboard
```
- **Performance Benchmark Results:**
  - **Total Samples:** 5,000 transactions
  - **Concurrent Threads:** 50 virtual users with 5s ramp-up
  - **Mean Latency:** 20.24 ms (Well below the SLA ceiling of 200 ms)
  - **Median Latency:** 4.00 ms
  - **90th Percentile:** 50.10 ms
  - **Throughput:** 178.65 requests/sec
  - **Error Rate:** 0.00% (Zero HTTP failures)
  - **APDEX Score:** 1.000 (Satisfied threshold T=500ms, Tolerated F=1500ms)

---

## 📊 Summary of Generated Reports

All pipeline runs store their interactive HTML dashboards in `tests/reports/`:
- **Unified Pipeline Hub:** `tests/reports/index.html`
- **Code Coverage:** `tests/reports/coverage-report/index.html`
- **Mutation Dashboard:** `tests/reports/mutation/reports/mutation-report.html`
- **Selenium E2E Dashboard:** `tests/reports/selenium-report/index.html`
- **JMeter Load Dashboard:** `tests/reports/jmeter-dashboard/index.html`
