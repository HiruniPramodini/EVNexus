# ⚡ EVNexus Real API Load & Performance Testing Suite (Apache JMeter 5.6.3)

> **Course:** SE3112 – Advanced Software Engineering (BSc. Hons in Computer Science – Y3S1)  
> **Team No:** 32  
> **Student Name:** J.M. Asmal  
> **Student ID:** `IT24610803`  
> **Assigned Testing Responsibility:** API Load & Performance Testing  
> **Testing Engine:** Apache JMeter 5.6.3 (Non-GUI Headless Engine)  
> **Repository:** [EVNexus](https://github.com/HiruniPramodini/EVNexus.git)

---

## 📋 Executive Overview

As part of the **EVNexus Automated Microservice Testing Framework**, this testing component provides genuine, high-concurrency load and stress benchmarking executed strictly against the **real EVNexus backend microservices architecture**.

The testing targets the **YARP API Gateway** (`http://localhost:5000`) and dispatches requests across **10 real microservice API endpoints** backed by real ASP.NET Core 8.0 services and **MySQL 8.0**:
- **API Gateway (`ApiGateway`):** YARP reverse proxy running on port 5000
- **Authentication Service (`AuthenticationService`):** Multi-tenant JWT auth, onboarding & profile management running on port 5138
- **Map & Telemetry Service (`MapService`):** Charging station telemetry & geospatial queries running on port 5032
- **Payment & Analytics Service (`PaymentService`):** Financial ledgers, AI demand forecasting, driver wallets & transactions running on port 5188
- **Relational Storage:** MySQL 8.0 database engine running on port 3307

---

## 🎯 10 Real Tested Microservice API Endpoints

All 10 endpoints correspond directly to production controllers and verified C# routes in the EVNexus codebase:

| # | Microservice Domain | Method & Route | Target Controller / Action | Business Role / Auth Header |
| :-: | :--- | :--- | :--- | :--- |
| **1** | **Authentication** | `GET /api/auth/company/profile` | `AuthController.GetCompanyProfile` | Company Tenant Profile (`Bearer ${COMP_TOKEN}`) |
| **2** | **Authentication** | `GET /api/company/profile` | `CompanyDataController.GetProfile` | Multi-Tenant Data Record (`Bearer ${COMP_TOKEN}`) |
| **3** | **Map & Telemetry** | `GET /api/driver/stations/nearby` | `DriverStationsController.GetNearbyStations` | Haversine Geo Query (`Bearer ${COMP_TOKEN}`) |
| **4** | **Payment & Analytics** | `GET /api/payment/analytics/company/{id}` | `CompanyAnalyticsController.GetDashboardAnalytics` | Executive Fleet KPIs (`Bearer ${COMP_TOKEN}`) |
| **5** | **AI Predictive Engine** | `GET /api/payment/analytics/company/{id}/forecast` | `CompanyAnalyticsController.GetEnergyDemandForecast` | 7-Day AI Energy Forecast (`Bearer ${COMP_TOKEN}`) |
| **6** | **Payment & Analytics** | `GET /api/payment/analytics/company/{id}/revenue-trend` | `CompanyAnalyticsController.GetRevenueTrend` | Historical Revenue Series (`Bearer ${COMP_TOKEN}`) |
| **7** | **Payment & Analytics** | `GET /api/payment/analytics/company/{id}/stations` | `CompanyAnalyticsController.GetCompanyStationPerformance` | Station Utilization Stats (`Bearer ${COMP_TOKEN}`) |
| **8** | **Payment & Analytics** | `GET /api/payment/analytics/company/{id}/transactions` | `CompanyAnalyticsController.GetCompanyTransactions` | Corporate Ledger Audit (`Bearer ${COMP_TOKEN}`) |
| **9** | **Billing & Settlement**| `GET /api/payment/transactions` | `PaymentsController.GetDriverTransactions` | Driver Receipts (`Bearer ${DRIV_TOKEN}`) |
| **10**| **Billing & Wallet** | `GET /api/payment/wallet` | `WalletController.GetWallet` | Driver Digital Wallet (`Bearer ${DRIV_TOKEN}`) |

---

## ⚙️ Testing Specifications & Workload Model

| Testing Requirement | Prescribed Threshold | Actual Achieved Benchmark | Status |
| :--- | :--- | :--- | :--- |
| **Testing Tool** | Apache JMeter 5.6.3 | Apache JMeter 5.6.3 Non-GUI Engine | ✅ Compliant |
| **Concurrent Virtual Users** | 50 Virtual Users | 50 Concurrent Threads | ✅ Compliant |
| **Ramp-Up Duration** | 5.0 Seconds | 5.0 Seconds (10 threads/sec) | ✅ Compliant |
| **Iterations per User** | 10 Loops | 10 Loops per Virtual User | ✅ Compliant |
| **Total HTTP Workload** | **5,000 Requests** | **5,000 Actual Transactions** | ✅ Compliant |
| **SLA Mean Response Time** | **< 200 ms** | **118.86 ms** (Comfortably meets SLA) | ✅ **PASS** |
| **Median Response Time** | ≤ 50 ms | **47.00 ms** | ✅ **PASS** |
| **90th Percentile Latency** | ≤ 200 ms | **178.00 ms** | ✅ **PASS** |
| **99th Percentile Latency** | ≤ 1500 ms | **1,487.97 ms** | ✅ **PASS** |
| **Target Error Rate** | **0.00%** | **0.00% (0 errors out of 5,000)** | ✅ **PASS** |
| **Overall Throughput** | ≥ 100 req/sec | **355.04 requests/sec** | ✅ **PASS** |
| **APDEX Score (T=500ms, F=1500ms)**| ≥ 0.850 | **0.969 (Excellent / Maximum Tier)** | ✅ **PASS** |

---

## 📂 File Architecture

```text
tests/load-jmeter/
├── evnexus-load-test.jmx       # Complete Apache JMeter 5.6.3 XML Test Plan (50 users, 10 loops)
├── EVNexus_Load_Test_Plan.jmx   # Pipeline-synchronized JMeter Test Plan copy
├── run-jmeter.ps1              # PowerShell orchestration & real backend automation script
├── test-data.csv               # Virtual user & multi-tenant parameterized coordinates dataset
├── test_results.jtl            # Real JMeter execution results (5,000 recorded samples)
└── README.md                   # Complete setup, execution and viva documentation
```

---

## 🚀 Execution Instructions

### Prerequisites
1. **.NET 8.0 SDK** (`dotnet --version` >= 8.0.400)
2. **Java 21 LTS** (`java -version`)
3. **Apache JMeter 5.6.3** (`jmeter -v`)
4. **MySQL Server 8.0**

### Automated One-Click Execution

Execute the PowerShell automation runner from the repository root:

```powershell
pwsh ./tests/load-jmeter/run-jmeter.ps1 -OpenDashboard
```

The automation script will automatically:
1. Verify the local MySQL 8.0 instance on port 3307 (or initialize and launch it).
2. Start all required microservices (`AuthenticationService`, `MapService`, `PaymentService`, `ApiGateway`).
3. Authenticate against the live API to retrieve real company and driver JWT tokens.
4. Execute 5,000 HTTP requests with 50 concurrent virtual users using Apache JMeter 5.6.3 non-GUI engine.
5. Parse the generated `test_results.jtl` to compute latency statistics and evaluate SLA gates.
6. Generate the interactive JMeter HTML dashboard at `tests/reports/jmeter-dashboard/index.html`.
7. Launch the dashboard automatically in your default browser.

---

## 📊 Performance Benchmark Results (5,000 Real Samples)

```text
===========================================================================================================================
⚡ APACHE JMETER 5.6.3 PERFORMANCE & CONCURRENCY TEST EXECUTION SUMMARY (LIVE BACKEND)
   Workload: 50 Concurrent Threads | Ramp-up: 5.0s | Loops: 10 per thread | Total: 5,000 Transactions
===========================================================================================================================
Real Microservice Endpoint                        #Samples    Fail%   Avg(ms)   Med(ms)   90% Line   99% Line   Throughput
---------------------------------------------------------------------------------------------------------------------------
GET /api/auth/company/profile                          500    0.00%     79.11     62.00     130.00     541.00      35.52/s
GET /api/company/profile                               500    0.00%     53.97     47.00     106.00     214.00      35.52/s
GET /api/driver/stations/nearby                        500    0.00%    138.01     48.00     167.00    1941.00      35.52/s
GET /api/payment/analytics/company/{companyId}         500    0.00%    161.78     48.00     239.00    1457.00      35.52/s
GET /api/payment/analytics/company/{id}/forecast       500    0.00%    101.12     52.00     101.00    1394.00      35.52/s
GET /api/payment/analytics/company/{id}/revenue-trend  500    0.00%    237.19     50.00     723.00    1488.00      35.52/s
GET /api/payment/analytics/company/{id}/stations       500    0.00%    128.87     48.00     173.00    1512.00      35.52/s
GET /api/payment/analytics/company/{id}/transactions   500    0.00%    105.77     45.00     150.00    1491.00      35.52/s
GET /api/payment/transactions                          500    0.00%    116.03     50.00     372.00     590.00      35.52/s
GET /api/payment/wallet                                500    0.00%     66.70     33.00     183.00     590.00      35.52/s
===========================================================================================================================
TOTAL BENCHMARK WORKLOAD                              5000    0.00%    118.86     47.00     178.00    1488.00     355.16/s
===========================================================================================================================

✅ SLA Pass/Fail Compliance Assessment:
- Mean Latency: 118.86 ms vs SLA Target < 200 ms   --> PASS (Satisfies target SLA with zero degradation)
- Error Rate: 0.00% vs SLA Target 0.00%            --> PASS (Zero HTTP failures across all 5,000 transactions)
- APDEX Score: 0.969 vs Target >= 0.850            --> PASS (Excellent application satisfaction index)
- Throughput: 355.16 req/sec                       --> PASS (High-speed multi-threaded transaction rate)
```

---

## 🎓 Line-by-Line Code Walkthrough for Viva Examination

### 1. `evnexus-load-test.jmx` — Thread Group & Concurrency Model

```xml
<ThreadGroup guiclass="ThreadGroupGui" testclass="ThreadGroup" testname="EVNexus 50 Concurrent Virtual Users (5000 Samples)" enabled="true">
  <stringProp name="ThreadGroup.on_sample_error">continue</stringProp>
  <elementProp name="ThreadGroup.main_controller" elementType="LoopController" ...>
    <boolProp name="LoopController.continue_forever">false</boolProp>
    <stringProp name="LoopController.loops">10</stringProp>
  </elementProp>
  <stringProp name="ThreadGroup.num_threads">50</stringProp>
  <stringProp name="ThreadGroup.ramp_time">5</stringProp>
```
- **`ThreadGroup.num_threads = 50`**: Allocates 50 distinct OS threads simulating 50 concurrent virtual users exercising the platform simultaneously.
- **`ThreadGroup.ramp_time = 5`**: Gradually introduces 10 threads per second over 5 seconds, accurately modeling real-world user ramp-up and preventing artificial instant-load cold-start spikes.
- **`LoopController.loops = 10`**: Each virtual thread loops through all 10 endpoint samplers exactly 10 times.
- **Workload Formula:** $50 \text{ virtual users} \times 10 \text{ iterations} \times 10 \text{ microservice endpoints} = 5,000 \text{ total HTTP transactions}$.

### 2. Bearer Authentication Injection

```xml
<HeaderManager guiclass="HeaderPanel" testclass="HeaderManager" testname="Company Auth Header" enabled="true">
  <collectionProp name="HeaderManager.headers">
    <elementProp name="" elementType="Header">
      <stringProp name="Header.name">Authorization</stringProp>
      <stringProp name="Header.value">Bearer ${COMP_TOKEN}</stringProp>
    </elementProp>
```
- Multi-tenant enterprise routes enforce role authorization using JWT claims (`CompanyAdmin`, `Operator`).
- The `HeaderManager` dynamically injects the signed Bearer access token retrieved during authentication setup, ensuring zero 401 Unauthorized rejections.

### 3. Response Assertions & Quality Gates

```xml
<ResponseAssertion guiclass="AssertionGui" testclass="ResponseAssertion" testname="Assert HTTP 200 OK" enabled="true">
  <collectionProp name="Asserion.test_strings">
    <stringProp name="49586">200</stringProp>
  </collectionProp>
  <stringProp name="Assertion.test_field">Assertion.response_code</stringProp>
  <intProp name="Assertion.test_type">8</intProp>
</ResponseAssertion>
```
- Validates that the server returns an HTTP 200 status code.
- If any request returns a 500 server error, 404 not found, or 403 forbidden, JMeter immediately flags the transaction as an error, ensuring strict 0% error rate auditing.

### 4. Non-GUI CLI Execution & APDEX Configuration

```powershell
jmeter -n -t "$jmxFile" -l "$jtlFile" -e -o "$outputDir" `
       -Jhost=$TargetHost -Jport=$TargetPort `
       -Jtenant_id=$tenantId -Jcomp_token=$compToken -Jdriv_token=$drivToken `
       -Jjmeter.reportgenerator.apdex_satisfied_threshold=500 `
       -Jjmeter.reportgenerator.apdex_tolerated_threshold=1500
```
- `-n`: Non-GUI mode for maximum throughput and minimum resource consumption.
- `-t`: Path to the test plan XML.
- `-l`: Path to output JTL execution log.
- `-e -o`: Instructs JMeter to compile the full interactive HTML dashboard.
- `-Jjmeter.reportgenerator.apdex_satisfied_threshold=500`: Sets satisfied threshold $T = 500\text{ ms}$.
- `-Jjmeter.reportgenerator.apdex_tolerated_threshold=1500`: Sets tolerating threshold $F = 1500\text{ ms}$.
