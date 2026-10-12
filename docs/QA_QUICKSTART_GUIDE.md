# 🚀 EVNexus - Sprint 4 QA Verification & Quickstart Guide

**QA Lead Engineer:** Mohamed Ashmal (Asmal J.M. - IT24610803)  
**Target Epic:** `SCRUM-89: Dashboard & AI Analytics` (Sprint 4)  
**Pass Rate:** **100.0% (1,594 / 1,594 Tests Passed — 0 Failures)**  

---

## ⚡ 1-Minute Reproduction Steps for Evaluators / Examiners

This guide provides exact, copy-pasteable commands to reproduce and verify the Sprint 4 QA test execution on any development machine.

---

### Step 1: Run Dashboard & AI Analytics Unit Tests (14 Tests)

Runs all unit tests for historical aggregations, date boundary validations, AI peak-hour detection heuristics, and dynamic reporting.

```powershell
dotnet test EVNexus/DashboardAnalyticsService/tests/EVNexus.DashboardService.Tests/EVNexus.DashboardService.Tests.csproj --verbosity normal
```

**Expected Result:**
```text
Passed!  - Failed: 0, Passed: 14, Skipped: 0, Total: 14, Duration: ~100 ms
```

---

### Step 2: Run Analytics Integration & Security Tests (80 Tests)

Executes the in-memory ASP.NET Core test server, validating end-to-end HTTP pipeline execution, role-based access control (RBAC), multi-tenant data isolation, and cold-start fallback mechanisms.

```powershell
dotnet test EVNexus/PaymentService/tests/EVNexus.PaymentService.Tests/EVNexus.PaymentService.Tests.csproj --verbosity normal
```

**Expected Result:**
```text
Passed!  - Failed: 0, Passed: 80, Skipped: 0, Total: 80, Duration: ~8 s
```

---

### Step 3: Run Apache JMeter 50-Virtual User Concurrency Load Test (1,500 Requests)

Executes the non-GUI Apache JMeter test plan against the Analytics Service:

```powershell
# Using the pre-configured automated runner script:
python docs/run_load_test.py
```

Or via direct JMeter command line:
```powershell
jmeter -n -t docs/Sprint4_LoadTest_50Users.jmx -l test_results.jtl -e -o load_report/
```

**Key Benchmark Results:**
- Concurrency: **50 Concurrent Virtual Users**
- Total Requests: **1,500 HTTP Requests**
- Success Rate: **100.0% (0 errors)**
- Average Latency: **21.88 ms** (SLA limit: 1,500 ms)
- Throughput: **163.04 req/sec**
- APDEX Score: **1.000 (Satisfied)**

---

### Step 4: Run Postman API Collection via Newman CLI (Automated API Tests)

```powershell
npx newman run docs/Sprint4_Postman_Collection.json --reporters cli
```

**Validates:**
- `GET /api/payment/analytics/company/:companyId` (KPI Overview)
- `GET /api/payment/analytics/company/:companyId/revenue-trend` (Revenue aggregation)
- `GET /api/payment/analytics/company/:companyId/forecast` (AI 7-day forecast)
- Tenant isolation and 401/403 security enforcement.

---

## 📁 Key QA Artifacts Directory Links

- 📄 **Formal QA Test Execution Report (PDF):** [`docs/Sprint_4_QA_Execution_Report.pdf`](file:///d:/OneDrive/Desktop/Nvexus/EVNexus/docs/Sprint_4_QA_Execution_Report.pdf)
- 📝 **Test Cases Specification (37 KB):** [`docs/Sprint_4_QA_Test_Cases.md`](file:///d:/OneDrive/Desktop/Nvexus/EVNexus/docs/Sprint_4_QA_Test_Cases.md)
- 📋 **IEEE 829 Test Plan & Strategy:** [`docs/Sprint_4_QA_Test_Plan_and_Strategy.md`](file:///d:/OneDrive/Desktop/Nvexus/EVNexus/docs/Sprint_4_QA_Test_Plan_and_Strategy.md)
- ⚙️ **JMeter Test Plan JMX:** [`docs/Sprint4_LoadTest_50Users.jmx`](file:///d:/OneDrive/Desktop/Nvexus/EVNexus/docs/Sprint4_LoadTest_50Users.jmx)
- 📮 **Postman Collection JSON:** [`docs/Sprint4_Postman_Collection.json`](file:///d:/OneDrive/Desktop/Nvexus/EVNexus/docs/Sprint4_Postman_Collection.json)
- 🤖 **CI/CD QA Pipeline:** [`.github/workflows/dashboard-ci.yml`](file:///d:/OneDrive/Desktop/Nvexus/EVNexus/.github/workflows/dashboard-ci.yml)
- 📊 **HTML Load Test Report:** Open [`load_report/index.html`](file:///d:/OneDrive/Desktop/Nvexus/load_report/index.html) in any web browser.
