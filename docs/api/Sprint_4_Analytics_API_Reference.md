# 📡 EVNexus Sprint 4: Company Analytics & AI Forecasting API Reference

**Parent Epic:** `SCRUM-89: Dashboard & AI Analytics`  
**Base URL:** `http://localhost:5004/api/payment/analytics`  
**Authentication:** JWT Bearer Token (`Authorization: Bearer <TOKEN>`)  
**Authorization Roles:** `CompanyAdmin`, `Operator`  
**Tenant Enforcement:** Strict isolation via `tenant_id` claim in JWT  

---

## 📑 Table of Endpoints

1. [`GET /company/{companyId}`](#1-company-analytics-overview-kpis) — Dashboard Overview KPIs
2. [`GET /company/{companyId}/revenue-trend`](#2-historical-revenue-trend-aggregation) — Historical Revenue Chart Aggregations
3. [`GET /company/{companyId}/forecast`](#3-ai-7-day-revenue-demand-forecasting) — AI Machine Learning Revenue Forecast
4. [`GET /company/{companyId}/stations`](#4-charging-station-traffic--performance) — Charging Point Utilization & Traffic Breakdown
5. [`GET /company/{companyId}/transactions`](#5-company-transactions-audit-feed) — Paginated Financial Transactions Log (CSV Export Source)

---

## 1. Company Analytics Overview KPIs
Returns high-level aggregated operational metrics for the company dashboard home view.

* **Route:** `GET /api/payment/analytics/company/{companyId}`
* **Query Parameters:**
  * `startDate` *(optional, DateTime)*: Filter lower bound (e.g., `2026-10-01T00:00:00Z`).
  * `endDate` *(optional, DateTime)*: Filter upper bound (e.g., `2026-10-12T23:59:59Z`).
  * `stationId` *(optional, string)*: Filter to a specific charging station.
* **Sample Request:**
  ```bash
  curl -X GET "http://localhost:5004/api/payment/analytics/company/comp-101?startDate=2026-10-01&endDate=2026-10-12" \
       -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
       -H "Accept: application/json"
  ```
* **Sample Response (`200 OK`):**
  ```json
  {
    "companyId": "comp-101",
    "totalRevenue": 48250.75,
    "revenueGrowthPct": 14.8,
    "totalChargingSessions": 1284,
    "activeStationsCount": 18,
    "totalEnergyDeliveredKwh": 38450.2,
    "averageSessionCost": 37.58,
    "utilizationRatePct": 78.4
  }
  ```

---

## 2. Historical Revenue Trend Aggregation
Provides chronological daily/monthly revenue data points used by the frontend SVG line chart (`Recharts`).

* **Route:** `GET /api/payment/analytics/company/{companyId}/revenue-trend`
* **Query Parameters:**
  * `startDate` *(optional, DateTime)*
  * `endDate` *(optional, DateTime)*
  * `stationId` *(optional, string)*
* **Sample Request:**
  ```bash
  curl -X GET "http://localhost:5004/api/payment/analytics/company/comp-101/revenue-trend" \
       -H "Authorization: Bearer <TOKEN>"
  ```
* **Sample Response (`200 OK`):**
  ```json
  [
    { "date": "2026-10-05", "revenue": 4200.00, "sessionCount": 112 },
    { "date": "2026-10-06", "revenue": 4850.50, "sessionCount": 125 },
    { "date": "2026-10-07", "revenue": 5100.25, "sessionCount": 134 },
    { "date": "2026-10-08", "revenue": 4900.00, "sessionCount": 129 },
    { "date": "2026-10-09", "revenue": 5300.00, "sessionCount": 140 },
    { "date": "2026-10-10", "revenue": 5850.00, "sessionCount": 155 },
    { "date": "2026-10-11", "revenue": 6150.00, "sessionCount": 162 }
  ]
  ```

---

## 3. AI 7-Day Revenue Demand Forecasting
Executes the AI linear regression / ML forecasting model predicting revenue trajectory over the subsequent 7-day period.

* **Route:** `GET /api/payment/analytics/company/{companyId}/forecast`
* **Query Parameters:**
  * `historicalDays` *(integer, default: 30, range: 1–365)*: Number of past days to train the model.
* **Sample Request:**
  ```bash
  curl -X GET "http://localhost:5004/api/payment/analytics/company/comp-101/forecast?historicalDays=30" \
       -H "Authorization: Bearer <TOKEN>"
  ```
* **Sample Response (`200 OK`):**
  ```json
  {
    "companyId": "comp-101",
    "forecastHorizonDays": 7,
    "confidenceLevel": 0.95,
    "modelType": "LinearRegressionWithSeasonalWeights",
    "forecasts": [
      { "date": "2026-10-13", "predictedRevenue": 6320.00, "lowerBound": 5980.00, "upperBound": 6650.00 },
      { "date": "2026-10-14", "predictedRevenue": 6450.50, "lowerBound": 6050.00, "upperBound": 6820.00 },
      { "date": "2026-10-15", "predictedRevenue": 6580.00, "lowerBound": 6120.00, "upperBound": 7010.00 },
      { "date": "2026-10-16", "predictedRevenue": 6720.00, "lowerBound": 6250.00, "upperBound": 7180.00 },
      { "date": "2026-10-17", "predictedRevenue": 7100.00, "lowerBound": 6500.00, "upperBound": 7650.00 },
      { "date": "2026-10-18", "predictedRevenue": 7350.00, "lowerBound": 6700.00, "upperBound": 7950.00 },
      { "date": "2026-10-19", "predictedRevenue": 6900.00, "lowerBound": 6350.00, "upperBound": 7450.00 }
    ],
    "projected7DayTotal": 47420.50,
    "recommendation": "Projected high weekend demand; ensure station connector availability at high-traffic hubs."
  }
  ```

---

## 4. Charging Station Traffic & Performance
Returns operational and financial metrics per individual charging location.

* **Route:** `GET /api/payment/analytics/company/{companyId}/stations`
* **Query Parameters:**
  * `startDate` *(optional, DateTime)*
  * `endDate` *(optional, DateTime)*
* **Sample Request:**
  ```bash
  curl -X GET "http://localhost:5004/api/payment/analytics/company/comp-101/stations" \
       -H "Authorization: Bearer <TOKEN>"
  ```
* **Sample Response (`200 OK`):**
  ```json
  [
    {
      "stationId": "st-colombo-01",
      "stationName": "Colombo Central Supercharger",
      "totalSessions": 450,
      "totalRevenue": 19500.00,
      "utilizationRatePct": 91.2,
      "rank": 1
    },
    {
      "stationId": "st-kandy-02",
      "stationName": "Kandy Hub Fast Charger",
      "totalSessions": 320,
      "totalRevenue": 13200.00,
      "utilizationRatePct": 76.5,
      "rank": 2
    }
  ]
  ```

---

## 5. Company Transactions Audit Feed
Returns paginated raw charging session transactions formatted for data grid displays and CSV usage export.

* **Route:** `GET /api/payment/analytics/company/{companyId}/transactions`
* **Query Parameters:**
  * `limit` *(integer, default: 50)*
  * `startDate` *(optional, DateTime)*
  * `endDate` *(optional, DateTime)*
  * `stationId` *(optional, string)*
* **Sample Request:**
  ```bash
  curl -X GET "http://localhost:5004/api/payment/analytics/company/comp-101/transactions?limit=2" \
       -H "Authorization: Bearer <TOKEN>"
  ```
* **Sample Response (`200 OK`):**
  ```json
  [
    {
      "transactionId": "tx-99412",
      "sessionId": "sess-8821",
      "driverId": "drv-401",
      "stationId": "st-colombo-01",
      "amount": 42.50,
      "energyKwh": 35.2,
      "paymentMethod": "EVNexusWallet",
      "timestamp": "2026-10-12T09:14:22Z",
      "status": "Completed"
    }
  ]
  ```

---

## 🔒 Security & Access Control Enforcement

| Condition | Response Code | Description |
| :--- | :---: | :--- |
| **Missing JWT Header** | `401 Unauthorized` | Request must include valid bearer token. |
| **Driver Role Attempt** | `403 Forbidden` | Driver tokens are strictly blocked from analytics. |
| **Tenant Mismatch** | `403 Forbidden` | `tenant_id` claim must match the target `{companyId}`. |
| **Invalid Parameters** | `400 Bad Request` | e.g. `historicalDays` outside 1–365 range. |

---

## 🌐 Interactive Swagger UI Access
To test and inspect these endpoints interactively in your web browser:
1. Start the service: `dotnet run --project EVNexus/PaymentService/src/EVNexus.PaymentService/EVNexus.PaymentService.csproj`
2. Open in browser: `http://localhost:5004/swagger`
3. Click the **Authorize** button and paste your Bearer token.
