# EVNexus - Sprint 4 QA Test Plan & Strategy Document (IEEE 829 Standard)

**Parent Epic / Feature:** `SCRUM-89: Dashboard & AI Analytics`  
**Target Sprint:** Sprint 4  
**QA Lead Engineer:** Mohamed Ashmal (Asmal J.M. - IT24610803)  
**Role:** Quality Assurance (QA) & Test Automation Lead  
**Document Version:** 1.0  
**Effective Date:** October 10, 2026  
**Status:** Approved & Implemented  

---

## 1. 📌 Introduction & Objectives

### 1.1 Purpose
This Test Plan and Strategy document outlines the formal quality assurance methodology, verification criteria, and test architecture for **Sprint 4** of the **EVNexus Multi-Tenant EV Charging Management Platform**. The primary deliverable under test is Epic **`SCRUM-89: Dashboard & AI Analytics`**, encompassing both EV Driver charging history analytics and EV Charging Company operational, financial, and AI-driven demand forecasting dashboards.

### 1.2 Objectives
The primary quality assurance objectives are:
1. **Functional Correctness:** Ensure 100% compliance of all mathematical models, revenue aggregations, and date-bounded metrics with user story acceptance criteria.
2. **Security & Multi-Tenancy:** Verify that strict Role-Based Access Control (RBAC) and tenant isolation prevent data leaks between independent charging companies and drivers.
3. **Resilience & Fault Tolerance:** Validate graceful degradation, empty states, and fallback recommendations when downstream services (e.g., Payment, Map) or AI data feeds are limited or unavailable.
4. **Performance & Scalability:** Guarantee that analytics endpoints meet non-functional requirements (NFRs) under concurrent load (50 concurrent virtual users, < 1,500 ms SLA latency, zero errors).
5. **Continuous Verification:** Integrate automated test suites into CI/CD pipelines to ensure regression-free releases.

---

## 2. 🎯 Scope of Testing

### 2.1 In-Scope Features (Sprint 4 Deliverables)
All 17 user stories and tasks linked to Epic `SCRUM-89`:
- **Driver Analytics:**
  - `SCRUM-127`: Driver Dashboard Charging History Summary (Sessions, Energy, Cost).
- **Company Core Dashboard & Reporting:**
  - `SCRUM-123`: Company Dashboard Home Overview KPIs (Total Stations, Active Sessions, Total Revenue).
  - `SCRUM-124`: Charging Point Traffic Table (Session count, energy delivered, sorting).
  - `SCRUM-125`: Charging Point Price List Table (Peak vs. off-peak rates, sync with Map Service).
  - `SCRUM-126`: Charging Point Location Table (GPS coordinates, address, detail links).
  - `SCRUM-128`: Basic Daily Usage Report (7-day default, session aggregation).
  - `SCRUM-130`: Filter Dashboard Data by Date Range (Custom range, boundary checks, inverted dates).
  - `SCRUM-131`: Export Usage Report as CSV (Headers, RFC-4180 escaping, date filter compliance).
  - `SCRUM-132`: Revenue Trend Chart (Daily/Weekly aggregation, zero-revenue handling).
  - `SCRUM-164`: Monthly Dynamic Report Generation (Historical months, station breakdown).
  - `SCRUM-168`: Highest Traffic Station Ranking (Descending session count sorting).
  - `SCRUM-169`: Busiest Time-of-Day Analytics (Hourly distribution aggregation).
- **AI Analytics & Decision Support:**
  - `SCRUM-165`: AI Peak-Hour Usage Prediction per Station (Confidence score, time windows).
  - `SCRUM-166`: AI Future Demand Forecast Analytics (7-day trend, upper/lower bounds, cold-start fallback).
  - `SCRUM-167`: Company View AI-Predicted Peak Hours on Dashboard Chart.
  - `SCRUM-171`: AI Dynamic Pricing Recommendation Insight (Utilization-based tariff suggestions).
- **Non-Functional & Scalability:**
  - `SCRUM-172`: Dashboard/Analytics Service Load Testing (Apache JMeter, 50 virtual users).

### 2.2 Out-of-Scope Features
- Hardware/firmware OCPP socket protocol emulation (mocked at service contract boundary).
- External third-party payment gateway banking settlements (mocked via internal wallet contracts).

---

## 3. 🧪 Quality Strategy & Test Levels

EVNexus adopts the **Agile Test Automation Pyramid** to ensure broad coverage, early defect discovery, and rapid execution feedback.

```text
               /\
              /  \     Level 4: JMeter Concurrency & Load Testing (50 Users, 1,500 Reqs)
             /----\
            /      \   Level 3: Postman/Newman Automated API Contract & RBAC Tests
           /--------\
          /          \ Level 2: WebApplicationFactory In-Memory Integration Tests (80 Tests)
         /------------\
        /              \ Level 1: xUnit Algorithmic & Mathematical Unit Tests (14 Tests)
       ------------------
```

### 3.1 Test Levels Explained

| Level | Testing Layer | Framework / Tool | Focus & Purpose |
| :--- | :--- | :--- | :--- |
| **Level 1** | **Unit Testing** | xUnit v2.5.3 + FluentAssertions (.NET 8) | Mathematical aggregation formulas, date range boundary validation, AI heuristic fallback mechanisms, CSV formatting logic. |
| **Level 2** | **Integration Testing** | `WebApplicationFactory<Program>`, In-Memory Db | End-to-end HTTP pipeline, entity persistence, multi-tenant isolation, role authorization (401/403 responses), controller-to-service contracts. |
| **Level 3** | **API Verification** | Postman v10 + Newman CLI Runner | Automated JSON schema validation, HTTP response status codes, header compliance, regression test suites. |
| **Level 4** | **Performance & Load** | Apache JMeter 5.6.3 (Non-GUI CLI) | Concurrency validation, system throughput, response latency percentiles (p50, p90, p95, p99), error rate under heavy traffic. |

---

## 4. 📐 Test Design Techniques

To ensure comprehensive test cases, the following established test design techniques are applied:
1. **Equivalence Partitioning (EP):** Dividing input domains (e.g., date ranges, historical day windows) into valid and invalid partitions.
2. **Boundary Value Analysis (BVA):** Testing limits on date bounds (Start = End, future dates, epoch limits) and zero transaction thresholds.
3. **Negative & Error Guessing:** Testing inverted date ranges (End < Start), unauthorized driver access to company financial feeds, and token tampering.
4. **Multi-Tenant Partitioning:** Ensuring Company A's JWT token strictly cannot query Company B's station analytics under any permutation.

---

## 5. ⚙️ Test Environment & Tools

| Component | Specification / Version |
| :--- | :--- |
| **Runtime SDK** | Microsoft .NET 8.0 SDK (`net8.0`) |
| **Unit Test Runner** | VSTest 17.11.1 / xUnit 2.5.3 runner |
| **Integration Test Host** | `Microsoft.AspNetCore.Mvc.Testing` 8.0.0 |
| **Performance Testing Tool**| Apache JMeter 5.6.3 (Java 21 OpenJDK) |
| **API Test Automation** | Postman Desktop & Newman CLI 6.2.0 |
| **Operating Systems Tested**| Windows 11 Enterprise (Local) & Ubuntu 22.04 LTS (GitHub Actions CI) |
| **CI/CD Pipeline** | GitHub Actions (`.github/workflows/dashboard-ci.yml`) |

---

## 6. 🚪 Entry & Exit Criteria (Definition of Done)

### 6.1 Entry Criteria
- Sprint 4 user story implementations code-complete and merged into feature branch.
- Microservice assemblies build cleanly with 0 compilation errors.
- Test environments provisioned with test fixture datasets.

### 6.2 Exit Criteria (Pass Criteria)
- **100% Pass Rate:** All 14 Unit Tests and 80 Integration Tests execute with 0 failures and 0 skipped tests.
- **Performance SLA Compliance:**
  - HTTP Success Rate $\ge 99.0\%$ (Actual: **100.0%**)
  - HTTP Error Rate $\le 1.0\%$ (Actual: **0.00%**)
  - Mean Latency $< 1,500\text{ ms}$ (Actual: **21.88 ms**)
  - 95th Percentile Latency $< 2,500\text{ ms}$ (Actual: **105.95 ms**)
  - Throughput $\ge 30\text{ req/sec}$ (Actual: **163.04 req/sec**)
- **Zero Critical / Blocker Defects:** No open Severity 1 (Blocker) or Severity 2 (Critical) defects in Jira.
- **Formal Sign-Off:** QA Test Execution Report authored, signed off, and published to documentation artifacts.

---

## 7. 🐞 Defect Management & Severity Matrix

Defects discovered during test execution are categorized according to the following severity classification:

| Severity Level | Definition | Target Resolution SLA |
| :--- | :--- | :--- |
| **S1: Blocker** | System crash, unhandled 500 error on critical path, tenant data leak, security vulnerability. | Immediate (< 4 hours) |
| **S2: Critical** | Calculation discrepancy in revenue or energy totals, broken date filter, broken CSV export. | Same sprint day (< 12 hours) |
| **S3: Major** | UI visualization misalignment, non-blocking sort order inconsistency, slow response time. | Before sprint close |
| **S4: Minor** | Cosmetic text typo, badge color inconsistency, minor spacing discrepancy. | Next sprint backlog |

---

## 8. 👥 Roles & Responsibilities

| Role | Assigned Personnel | Responsibilities |
| :--- | :--- | :--- |
| **QA Lead Engineer** | **Mohamed Ashmal (IT24610803)** | Test plan authoring, test case design, unit & integration test creation, JMeter load test execution, report sign-off. |
| **Backend Developer**| Keshika Pathirana | Analytics API implementation, bug fixes, algorithmic refactoring. |
| **Team Leader** | Hiruni Pramodini | Architecture review, PR approval, sprint alignment. |
| **Product Owner** | Sprint 4 Evaluation Committee | Acceptance criteria verification, final sprint acceptance. |

---

## 9. 📦 QA Deliverables & Documentation Traceability

The following QA deliverables are submitted and maintained in the project repository:
1. **QA Test Plan & Strategy:** [`EVNexus/docs/Sprint_4_QA_Test_Plan_and_Strategy.md`](file:///d:/OneDrive/Desktop/Nvexus/EVNexus/docs/Sprint_4_QA_Test_Plan_and_Strategy.md)
2. **Test Cases Specification:** [`EVNexus/docs/Sprint_4_QA_Test_Cases.md`](file:///d:/OneDrive/Desktop/Nvexus/EVNexus/docs/Sprint_4_QA_Test_Cases.md)
3. **Execution Report (PDF):** [`EVNexus/docs/Sprint_4_QA_Execution_Report.pdf`](file:///d:/OneDrive/Desktop/Nvexus/EVNexus/docs/Sprint_4_QA_Execution_Report.pdf)
4. **Execution Report (Markdown):** [`EVNexus/docs/Sprint_4_QA_Execution_Report.md`](file:///d:/OneDrive/Desktop/Nvexus/EVNexus/docs/Sprint_4_QA_Execution_Report.md)
5. **JMeter Test Plan Artifact:** [`EVNexus/docs/Sprint4_LoadTest_50Users.jmx`](file:///d:/OneDrive/Desktop/Nvexus/EVNexus/docs/Sprint4_LoadTest_50Users.jmx)
6. **Postman API Test Collection:** [`EVNexus/docs/Sprint4_Postman_Collection.json`](file:///d:/OneDrive/Desktop/Nvexus/EVNexus/docs/Sprint4_Postman_Collection.json)
7. **Automated CI/CD Workflow:** [`EVNexus/.github/workflows/dashboard-ci.yml`](file:///d:/OneDrive/Desktop/Nvexus/EVNexus/.github/workflows/dashboard-ci.yml)
8. **QA Quickstart Verification Guide:** [`EVNexus/docs/QA_QUICKSTART_GUIDE.md`](file:///d:/OneDrive/Desktop/Nvexus/EVNexus/docs/QA_QUICKSTART_GUIDE.md)

---

## 10. 📝 Formal Sign-Off

**QA Lead Engineer:** Mohamed Ashmal (Asmal J.M. - IT24610803)  
**Date:** October 11, 2026  
**Status:** **APPROVED & FULLY COMPLIANT WITH IEEE 829 QA STANDARDS**
