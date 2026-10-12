# EVNexus - Sprint 4 QA Test Cases Specification
**Parent Epic / Feature:** `SCRUM-89: Dashboard & AI Analytics`  
**Target Sprint:** Sprint 4  
**Developer:** Keshika Pathirana  
**QA Engineer:** Asmal Jm (IT24610803)  
**Role:** Quality Assurance (QA) Engineer  
**Document Version:** 1.0  
**Date:** October 10, 2026  

---

## 📋 Executive QA Summary & Test Traceability Matrix

| Ticket ID | Feature / User Story / Task | Type | Priority | Test Cases Count | Status |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **SCRUM-127** | Driver: Dashboard Charging History Summary | Functional / UI | High | 4 | Done / Ready for QA |
| **SCRUM-130** | Filter Dashboard Data by Date Range | Functional / Boundary | High | 4 | Done / Ready for QA |
| **SCRUM-132** | Company: Revenue Trend Chart | Functional / Data | High | 4 | Done / Ready for QA |
| **SCRUM-131** | Export Usage Report as CSV | Functional / Export | Medium | 4 | Done / Ready for QA |
| **SCRUM-123** | Company Dashboard Home Overview | Functional / Integration | Highest | 4 | Done / Ready for QA |
| **SCRUM-124** | Company: Charging Point Traffic Table | Functional / UI | Highest | 3 | Done / Ready for QA |
| **SCRUM-125** | Company: Charging Point Price List Table | Functional / Integration | Highest | 3 | Done / Ready for QA |
| **SCRUM-126** | Company: Charging Point Location Table | Functional / Navigation | Highest | 3 | Done / Ready for QA |
| **SCRUM-128** | Company: Basic Daily Usage Report | Functional / Data | Highest | 3 | Done / Ready for QA |
| **SCRUM-164** | Monthly Dynamic Report Generation | Functional / Performance | Highest | 4 | In Progress |
| **SCRUM-165** | AI: Peak-Hour Usage Prediction per Station | AI / Algorithmic | Highest | 4 | In Progress |
| **SCRUM-166** | AI: Future Demand Forecast Analytics | AI / Analytics | Highest | 4 | In Progress |
| **SCRUM-167** | Company: View AI-Predicted Peak Hours on Chart | UI / AI Integration | High | 3 | In Progress |
| **SCRUM-168** | Company: Highest Traffic Station Ranking | Functional / UI | High | 3 | To Do / Sprint 4 |
| **SCRUM-169** | Company: Busiest Time-of-Day Analytics | Analytics / UI | High | 3 | To Do / Sprint 4 |
| **SCRUM-171** | AI: Pricing Recommendation Insight | AI / Decision Support | Low | 3 | To Do / Sprint 4 |
| **SCRUM-172** | Dashboard/Analytics Service Load Testing | Performance / Non-Functional | Medium | 3 | Passed / QA Verified |

---

## 1. SCRUM-127: Driver: Dashboard Charging History Summary
**Sprint:** Sprint 4 | **Priority:** High | **Story Points:** 3 | **Component:** Driver Dashboard / Analytics Service  
**Acceptance Criteria:**
1. Dashboard shows total number of completed sessions.
2. Dashboard shows total energy consumed across all sessions.
3. Dashboard shows total amount spent to date.
4. Widgets update after each completed session.

### Test Cases:
| Test ID | Test Scenario | Preconditions | Steps | Test Data | Expected Result | Severity |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-127-01** | Verify summary metrics display for active driver with completed sessions | Driver account with 5 completed charging sessions (e.g., 120 kWh, $45.50 total) | 1. Log in as authenticated driver.<br>2. Navigate to Driver Dashboard / History Summary page.<br>3. Inspect the metrics cards. | User: `driver_active@evnexus.com`<br>Sessions: 5, kWh: 120, Cost: $45.50 | Total Completed Sessions = 5, Total Energy = 120 kWh, Total Amount Spent = $45.50 are displayed accurately. | Critical |
| **TC-127-02** | Verify empty state for brand new driver with zero charging history | Newly registered driver with 0 charging sessions | 1. Log in as new driver.<br>2. Open Dashboard charging summary. | User: `new_driver@evnexus.com`<br>Sessions: 0 | Displays zero-state gracefully (0 Sessions, 0.00 kWh, $0.00) without crashes or undefined/NaN values. Empty state banner shown. | High |
| **TC-127-03** | Verify dynamic widget update immediately after a new completed charging session | Authenticated driver currently viewing dashboard metrics | 1. Note existing stats (e.g. 5 sessions, 120 kWh, $45.50).<br>2. Complete a new charging session (10 kWh, $5.00).<br>3. Refresh or observe live poll/websocket on dashboard. | Added Session: 10 kWh, $5.00 | Dashboard immediately updates to 6 sessions, 130 kWh, and $50.50 without requiring re-login or clearing cache. | High |
| **TC-127-04** | Verify tenant/user isolation (Driver cannot view another driver's charging history) | Two registered driver accounts (Driver A and Driver B) | 1. Log in as Driver A.<br>2. Inspect API request payload/token.<br>3. Attempt to fetch Driver B's stats using Driver B's ID via API request. | Token: Driver A<br>Target Request: `GET /api/driver/summary?driverId=DriverB_UUID` | API returns `403 Forbidden` or `401 Unauthorized`. Driver A can only ever access their own session statistics. | Critical |

---

## 2. SCRUM-130: Filter Dashboard Data by Date Range
**Sprint:** Sprint 4 | **Priority:** High | **Story Points:** 3 | **Component:** Dashboard Date Filter  
**Acceptance Criteria:**
1. Company admin / driver can select a custom start and end date.
2. All dashboard widgets/tables refresh based on the selected range.
3. Invalid ranges (end before start) are rejected with a message.
4. Default range remains last 7 days when no custom range is set.

### Test Cases:
| Test ID | Test Scenario | Preconditions | Steps | Test Data | Expected Result | Severity |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-130-01** | Verify default date range is set to the last 7 days on initial load | Logged in as Company Admin / Driver | 1. Open dashboard overview page.<br>2. Check initial date picker inputs and displayed data. | Current Date: `2026-10-10` | Date range selector defaults to `2026-10-03` to `2026-10-10` (last 7 days). All metrics reflect this 7-day period. | High |
| **TC-130-02** | Verify custom valid date range filtering and dashboard refresh | Multiple charging sessions spread across past 30 days | 1. Select Start Date: `2026-09-01`, End Date: `2026-09-30`.<br>2. Click 'Apply Filter'.<br>3. Observe cards, charts, and tables. | Range: `2026-09-01` to `2026-09-30` | All widgets, revenue charts, and usage tables refresh with data strictly belonging to September 2026. | High |
| **TC-130-03** | Verify validation error when End Date is earlier than Start Date | Logged in user on dashboard page | 1. Select Start Date: `2026-10-10`.<br>2. Select End Date: `2026-10-05`.<br>3. Click 'Apply' or trigger validation. | Start: `2026-10-10`<br>End: `2026-10-05` | System rejects selection, displays clear validation error ("End date cannot be earlier than start date"), and suppresses API call. | High |
| **TC-130-04** | Verify date range boundary and future date handling | Dashboard active | 1. Select today as start date and a future date as end date.<br>2. Or select single day (Start = End). | Start: `2026-10-10`<br>End: `2026-10-10` | For single day, shows only 24-hour transactions for that date. Future dates either disabled in datepicker or return valid data up to current timestamp. | Medium |

---

## 3. SCRUM-132: Company: Revenue Trend Chart
**Sprint:** Sprint 4 | **Priority:** High | **Story Points:** 5 | **Component:** Company Analytics / Recharts  
**Acceptance Criteria:**
1. Chart plots total revenue per day or week over the selected range.
2. Chart updates when the date filter changes.
3. Chart clearly labels axis and units (currency/dates).
4. Chart handles periods with zero revenue gracefully.

### Test Cases:
| Test ID | Test Scenario | Preconditions | Steps | Test Data | Expected Result | Severity |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-132-01** | Verify revenue trend chart rendering with historical transaction data | Company has completed paid charging sessions across past 14 days | 1. Log in as Company Admin.<br>2. Navigate to Company Analytics / Dashboard.<br>3. View Revenue Trend Chart. | Daily revenue ranging from $50.00 to $320.00 | Chart displays continuous trend line/bar graph with X-axis showing dates and Y-axis showing currency ($/LKR). Tooltips show date and exact amount. | High |
| **TC-132-02** | Verify chart updates automatically upon changing date filter | Revenue trend chart visible | 1. Change date filter from 7 days to 30 days.<br>2. Toggle aggregation from Daily to Weekly (if available). | Filter: `Last 30 Days` | Chart smoothly animates/re-renders with 30 data points matching the backend aggregation. | High |
| **TC-132-03** | Verify chart behavior during zero-revenue periods | Company had 0 sessions between Oct 1 and Oct 5 | 1. Set date filter to period with no revenue (or new company).<br>2. Observe chart rendering. | Dates with $0.00 transactions | Chart plots $0 value points or baseline flat line without broken lines, negative values, or UI crashes. | Medium |
| **TC-132-04** | Verify tenant isolation for financial data in revenue chart | Two companies: Company A (EVCo) and Company B (ChargePoint) | 1. Log in as Company A.<br>2. Inspect API response `GET /api/analytics/revenue-trend`. | Token: Company A Admin | API response payload contains ONLY revenue generated from stations owned by Company A. No Company B revenue is leaked. | Critical |

---

## 4. SCRUM-131: Export Usage Report as CSV
**Sprint:** Sprint 4 | **Priority:** Medium | **Story Points:** 3 | **Component:** Reports / Data Export  
**Acceptance Criteria:**
1. Company admin can export the current usage report as a CSV file.
2. Exported file includes date, station, sessions and energy delivered.
3. Export respects the currently applied date filter.
4. Export completes without errors for reports with zero rows.

### Test Cases:
| Test ID | Test Scenario | Preconditions | Steps | Test Data | Expected Result | Severity |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-131-01** | Verify CSV export generation and file download | Company with active charging usage data | 1. Navigate to Usage Reports page.<br>2. Click 'Export as CSV' button. | Filter: Default (Last 7 Days) | Browser triggers `.csv` file download with appropriate filename (e.g. `Usage_Report_2026-10-10.csv`). MIME type is `text/csv`. | High |
| **TC-131-02** | Verify CSV column headers and data accuracy | Downloaded CSV from TC-131-01 | 1. Open downloaded CSV in Excel/text editor.<br>2. Verify header row and data rows. | Columns: `Date`, `Station Name`, `Sessions Count`, `Energy Delivered (kWh)` | Header row strictly contains required columns. Values match on-screen table and database records exactly. | High |
| **TC-131-03** | Verify CSV export respects applied date filter | Date filter set to `2026-10-01` to `2026-10-05` | 1. Set custom filter.<br>2. Click 'Export as CSV'.<br>3. Verify dates inside downloaded CSV. | Custom Range | Only rows within `2026-10-01` to `2026-10-05` are included in the file. | Medium |
| **TC-131-04** | Verify CSV export handles zero rows gracefully | Brand new company with 0 sessions in date range | 1. Select date range with no charging sessions.<br>2. Click 'Export as CSV'. | 0 records | Export completes successfully with status 200 OK. CSV contains valid headers with 0 data rows (empty table). No 500 error thrown. | Medium |

---

## 5. SCRUM-123: Company Dashboard Home Overview
**Sprint:** Sprint 4 | **Priority:** Highest | **Story Points:** 5 | **Component:** Company Dashboard Core  
**Acceptance Criteria:**
1. Dashboard shows total number of stations owned by the company.
2. Dashboard shows number of currently active sessions.
3. Dashboard shows total revenue to date.
4. Widgets load correctly for a company with zero stations/sessions.

### Test Cases:
| Test ID | Test Scenario | Preconditions | Steps | Test Data | Expected Result | Severity |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-123-01** | Verify KPI overview cards display correct aggregated metrics | Company has 4 stations, 2 ongoing sessions, and $1,250.00 total revenue | 1. Log in as Company Admin.<br>2. Navigate to Dashboard Home (`/company/dashboard`).<br>3. Verify overview summary cards. | Stations: 4, Active: 2, Revenue: $1,250.00 | KPI cards display "Total Stations: 4", "Active Sessions: 2", "Total Revenue: $1,250.00" accurately. | Critical |
| **TC-123-02** | Verify dashboard loading for company with zero stations or sessions | Brand new registered company account | 1. Log in as new Company Admin.<br>2. Load dashboard home page. | New Company account | All widgets render with 0 values ("0 Stations", "0 Active Sessions", "$0.00 Revenue"). Helpful onboarding CTA ("Add your first station") is displayed. | High |
| **TC-123-03** | Verify graceful degradation when downstream service is temporarily unavailable | Map Service or Payment Service down | 1. Simulate Payment Service timeout/down.<br>2. Load company dashboard. | Injected 503 from Payment Service | Dashboard shows warning banner for revenue card ("Unable to load revenue data") while Station & Session cards load independently. Page does not crash. | High |
| **TC-123-04** | Verify role-based access control (Driver cannot access company dashboard overview) | Authenticated Driver user | 1. Log in as Driver.<br>2. Manually enter URL `/company/dashboard`. | Driver JWT token | System redirects to Driver dashboard or `/unauthorized` with 403 Forbidden. | Critical |

---

## 6. SCRUM-124: Company: Charging Point Traffic Table
**Sprint:** Sprint 4 | **Priority:** Highest | **Story Points:** 5 | **Component:** Company Traffic Analytics  
**Acceptance Criteria:**
1. Table lists every station owned by the company with its usage count.
2. Table shows total energy delivered per station.
3. Table can be sorted by usage count.
4. Table only includes the logged-in company's own stations.

### Test Cases:
| Test ID | Test Scenario | Preconditions | Steps | Test Data | Expected Result | Severity |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-124-01** | Verify traffic table lists all company stations with session count and energy delivered | Company with 3 stations with varying usage (Station A: 50 sessions/500 kWh, Station B: 20 sessions/180 kWh, Station C: 0 sessions/0 kWh) | 1. Open Station Traffic Table view.<br>2. Verify rows and columns. | Stations A, B, C | Table contains rows for Station A, B, and C. Columns for Station Name, Usage Count, and Total Energy (kWh) are populated with matching database values. | High |
| **TC-124-02** | Verify sorting table by usage count (Ascending & Descending) | Table populated with stations | 1. Click 'Usage Count' column header once.<br>2. Verify sorting order.<br>3. Click 'Usage Count' header again. | Sort toggle | First click sorts descending (Station A: 50 -> Station B: 20 -> Station C: 0). Second click sorts ascending (Station C: 0 -> Station B: 20 -> Station A: 50). Sort arrow icon indicates direction. | Medium |
| **TC-124-03** | Verify multi-tenant isolation in traffic table | Company 1 and Company 2 have configured stations | 1. Log in as Company 1 Admin.<br>2. Check traffic table.<br>3. Inspect API response. | Company 1 ID | Only Company 1 stations appear. No stations or energy usage from Company 2 are shown in the DOM or API response. | Critical |

---

## 7. SCRUM-125: Company: Charging Point Price List Table
**Sprint:** Sprint 4 | **Priority:** Highest | **Story Points:** 3 | **Component:** Pricing Table / Map Service Integration  
**Acceptance Criteria:**
1. Table lists all stations with their current price(s).
2. Table clearly distinguishes peak vs off-peak pricing where applicable.
3. Table updates immediately after a price change on the Map service.
4. Table is scoped to the logged-in company's own stations.

### Test Cases:
| Test ID | Test Scenario | Preconditions | Steps | Test Data | Expected Result | Severity |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-125-01** | Verify price table shows current pricing and peak vs off-peak distinction | Stations configured with Standard ($0.35/kWh), Peak ($0.55/kWh), Off-Peak ($0.25/kWh) | 1. Navigate to Pricing Table page.<br>2. Review columns: Station Name, Connector Type, Base Rate, Peak Rate, Off-Peak Rate. | Rates: $0.35, $0.55, $0.25 | All prices are displayed with proper currency symbol. Peak and off-peak badges or separate columns clearly distinguish the rates. | High |
| **TC-125-02** | Verify price table synchronization after price update in Map Service | Station Management permission available | 1. Update Station 1 Peak Rate from $0.55 to $0.65 in Map Service.<br>2. Navigate back to Price List Table.<br>3. Verify displayed price. | Station 1 rate update: $0.65/kWh | Price list table immediately displays new price of $0.65/kWh without stale caching. | High |
| **TC-125-03** | Verify pricing table tenant scoping | Two different companies with distinct pricing tariffs | 1. Check pricing table for Company A.<br>2. Verify station ownership IDs. | Company A session | Only stations belonging to Company A are visible. Competitor pricing is strictly protected. | Critical |

---

## 8. SCRUM-126: Company: Charging Point Location Table
**Sprint:** Sprint 4 | **Priority:** Highest | **Story Points:** 3 | **Component:** Station Locations / Navigation  
**Acceptance Criteria:**
1. Table lists all stations with name, address and coordinates.
2. Table links each row to the station's detail/edit page.
3. Table is scoped to the logged-in company's own stations.
4. Table handles a company with zero stations gracefully.

### Test Cases:
| Test ID | Test Scenario | Preconditions | Steps | Test Data | Expected Result | Severity |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-126-01** | Verify location table data attributes (Name, Address, Coordinates) | Company with registered stations with GPS coordinates | 1. Open Charging Point Location Table.<br>2. Check station details displayed. | Station: "Colombo Central Hub", Address: "123 Galle Rd", Lat: 6.9271, Lon: 79.8612 | Name, formatted address, and valid latitude/longitude coordinates are clearly visible for each station. | High |
| **TC-126-02** | Verify action link navigation to Station Detail / Edit page | Station row visible in table | 1. Click 'View / Edit' link or station name in row.<br>2. Verify URL and page loaded. | Row: Station ID `st-101` | Browser navigates directly to `/company/stations/st-101` (Station Edit/Detail page) with correct station parameters pre-filled. | High |
| **TC-126-03** | Verify zero stations empty state in location table | New company with no stations created | 1. Log in as new company.<br>2. Open Location Table. | 0 stations | Table displays friendly empty state ("No stations found. Click 'Add Station' to register your first location.") without rendering broken table headers. | Medium |

---

## 9. SCRUM-128: Company: Basic Daily Usage Report
**Sprint:** Sprint 4 | **Priority:** Highest | **Story Points:** 5 | **Component:** Daily Reporting / Aggregation  
**Acceptance Criteria:**
1. Report shows session count and energy delivered per day.
2. Report covers at least the last 7 days by default.
3. Report data matches underlying session records.
4. Report is scoped to the logged-in company's own stations.

### Test Cases:
| Test ID | Test Scenario | Preconditions | Steps | Test Data | Expected Result | Severity |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-128-01** | Verify basic daily usage report default 7-day range and metric breakdown | Completed sessions on each of the last 7 days | 1. Open Daily Usage Report page.<br>2. Verify date list and columns. | Range: Last 7 calendar days | Report displays each day row (Date, Total Sessions, Energy Delivered in kWh, Daily Revenue). Default view shows exactly past 7 days. | High |
| **TC-128-02** | Verify data consistency between daily report and raw session records | Known raw database sessions for Oct 8 (3 sessions: 25 kWh, 30 kWh, 15 kWh = 70 kWh total) | 1. Filter report to Oct 8.<br>2. Compare report total with sum of individual session logs. | Expected Total: 3 sessions, 70 kWh | Report shows exactly 3 sessions and 70.00 kWh delivered for Oct 8. No rounding discrepancy or missing transactions. | Critical |
| **TC-128-03** | Verify daily report handling for days with zero charging activity | Days with 0 completed sessions | 1. Review 7-day report where Oct 6 had 0 sessions. | Inactive date: `2026-10-06` | Oct 6 row displays 0 sessions, 0.00 kWh, $0.00 without skipping the date or throwing null pointer exceptions. | Medium |

---

## 10. SCRUM-164: Monthly Dynamic Report Generation
**Sprint:** Sprint 4 | **Priority:** Highest | **Story Points:** 5 | **Component:** Dynamic Monthly Reporting  
**Acceptance Criteria:**
1. Company admin can generate a report for any completed month.
2. Report includes total sessions, energy delivered and revenue per station.
3. Report generation completes within a reasonable time for typical data volumes.
4. Report can be viewed on-screen and exported.

### Test Cases:
| Test ID | Test Scenario | Preconditions | Steps | Test Data | Expected Result | Severity |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-164-01** | Verify dynamic monthly report generation for a completed month | Historical transactions present for September 2026 | 1. Navigate to Monthly Reports.<br>2. Select Month: "September 2026".<br>3. Click 'Generate Report'. | Month: `2026-09` | System aggregates data and displays monthly summary table grouped by Station with Total Sessions, Energy (kWh), and Revenue ($). | High |
| **TC-164-02** | Verify on-screen viewing and PDF/CSV export of monthly report | Monthly report generated on-screen | 1. Verify on-screen report layout.<br>2. Click 'Export Report' (CSV/PDF).<br>3. Check downloaded file. | Month: September 2026 | On-screen view is formatted cleanly with pagination. Exported file contains identical station-by-station totals. | High |
| **TC-164-03** | Verify report generation response time under typical data volume | Company with 10 stations and ~5,000 monthly transactions | 1. Trigger monthly report generation.<br>2. Measure backend response latency. | 5,000 records | API response and UI report render within < 3 seconds with loading indicator displayed during computation. | Medium |
| **TC-164-04** | Verify month with zero transactions | Selected month has no activity (e.g. January 2026) | 1. Select month with 0 sessions.<br>2. Generate report. | Inactive Month | Displays message "No transactions recorded for January 2026". Summary counters show 0. No application crash. | Medium |

---

## 11. SCRUM-165: AI: Peak-Hour Usage Prediction per Station
**Sprint:** Sprint 4 | **Priority:** Highest | **Story Points:** 8 | **Component:** AI Engine / Peak Hour Prediction  
**Acceptance Criteria:**
1. Prediction logic analyzes historical session start times per station.
2. System outputs predicted peak hour(s) per station.
3. Predictions are recalculated as new session data accumulates.
4. Predictions are returned via an API consumed by the dashboard.

### Test Cases:
| Test ID | Test Scenario | Preconditions | Steps | Test Data | Expected Result | Severity |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-165-01** | Verify AI peak-hour prediction output for station with dense historical data | Station with 300+ historical sessions predominantly starting between 17:00 and 19:00 | 1. Call API `GET /api/analytics/ai/peak-hours?stationId=st-01`.<br>2. Check returned payload. | Station ID `st-01` | Response returns status 200 with JSON: `{ stationId: "st-01", predictedPeakHours: [17, 18, 19], confidenceScore: 0.88, timeBand: "5:00 PM - 7:00 PM" }`. | High |
| **TC-165-02** | Verify fallback behavior when station has insufficient historical data (< 5 sessions) | Newly added station with only 2 recorded sessions | 1. Call peak-hours API for new station.<br>2. Inspect response. | Station ID `st-new` | API returns fallback response: `{ stationId: "st-new", status: "INSUFFICIENT_DATA", fallbackRecommendation: "Default peak: 08:00 - 10:00, 17:00 - 19:00" }` without 500 error. | High |
| **TC-165-03** | Verify dynamic recalculation when new session batches are ingested | Station baseline peak is 14:00 | 1. Ingest 50 new consecutive sessions at 09:00.<br>2. Trigger model re-evaluation or wait for cron batch update.<br>3. Check updated peak prediction. | Ingested morning sessions | Prediction model adapts and reflects the morning surge in updated peak hours. | Medium |
| **TC-165-04** | Verify API integration with company frontend dashboard | Dashboard logged in | 1. Open AI Station Insights tab.<br>2. Select station from dropdown.<br>3. Observe displayed peak hour badge. | Frontend component | Frontend displays "Predicted Peak Hours: 5:00 PM - 7:00 PM" directly consumed from the AI API. | High |

---

## 12. SCRUM-166: AI: Future Demand Forecast Analytics
**Sprint:** Sprint 4 | **Priority:** Highest | **Story Points:** 8 | **Component:** AI Demand Forecasting  
**Acceptance Criteria:**
1. Forecast predicts expected sessions or energy demand for the next period.
2. Forecast is available at both per-station and company-wide level.
3. Forecast accuracy/assumptions are documented.
4. Forecast is refreshed as new data is added.

### Test Cases:
| Test ID | Test Scenario | Preconditions | Steps | Test Data | Expected Result | Severity |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-166-01** | Verify future demand forecast at company-wide level for next 7 days | Historical company data available for past 60 days | 1. Request company-level forecast via API or UI.<br>2. Inspect projected energy demand and session counts. | Scope: Company-wide, Next 7 days | Returns forecasted sessions and total kWh per day for next 7 days with upper/lower prediction bounds. | High |
| **TC-166-02** | Verify future demand forecast at individual station level | Select specific station `st-01` | 1. Switch forecast filter from 'All Stations' to `st-01`.<br>2. Verify forecasted metrics. | Scope: Station `st-01` | Forecast narrows down strictly to `st-01`'s historical trends and outputs station-specific demand projections. | High |
| **TC-166-03** | Verify documentation of forecast model assumptions and disclaimer | Company dashboard Forecast section | 1. Inspect tooltip / 'About Forecast' info icon on forecast card. | UI Info icon | Explains model assumptions (e.g., "Forecast based on moving average & seasonality over past 30 days. External factors like holidays may vary."). | Low |
| **TC-166-04** | Verify forecast error handling on empty or corrupted dataset | Corrupted session timestamps or zero company history | 1. Request forecast for company with no records.<br>2. Check API status and UI state. | 0 sessions | System displays "Forecast unavailable due to lack of historical data" instead of infinite spinner or mathematical NaN errors. | Medium |

---

## 13. SCRUM-167: Company: View AI-Predicted Peak Hours on Dashboard Chart
**Sprint:** Sprint 4 | **Priority:** High | **Story Points:** 5 | **Component:** Dashboard AI Visualization  
**Acceptance Criteria:**
1. Chart visually highlights the predicted peak hour(s) for a selected station.
2. Chart is easy to read with clear hour-of-day labeling.
3. Chart updates when a different station is selected.
4. Chart gracefully handles stations with insufficient history.

### Test Cases:
| Test ID | Test Scenario | Preconditions | Steps | Test Data | Expected Result | Severity |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-167-01** | Verify visual highlight (color/badge) of predicted peak hours on 24-hour chart | Station `st-01` has peak hours 17:00 - 19:00 | 1. Open Station Peak Hours Chart.<br>2. Select `st-01`.<br>3. Inspect chart bars/zones. | Station `st-01` | 24-hour axis (00:00 to 23:00) displayed. Hours 17:00, 18:00, 19:00 are visually highlighted with distinct accent color (e.g., Amber/Neon Orange) and peak icon. | High |
| **TC-167-02** | Verify chart updates reactively when selecting another station | Multiple stations in dropdown | 1. Change station selector from `st-01` (peak: 18:00) to `st-02` (peak: 08:00).<br>2. Observe chart update. | Switch to `st-02` | Chart transitions smoothly; highlighted hours shift from 18:00 to 08:00 to match `st-02`. | High |
| **TC-167-03** | Verify handling when selected station has insufficient history | Selected station has no historical sessions | 1. Select new station from dropdown.<br>2. View chart area. | Station with 0 history | Chart displays informational banner: "Insufficient historical data to predict peak hours for this station" with a neutral baseline chart. | Medium |

---

## 14. SCRUM-168: Company: Highest Traffic Station Ranking
**Sprint:** Sprint 4 | **Priority:** High | **Story Points:** 3 | **Component:** Station Ranking  
**Acceptance Criteria:**
1. Stations are ranked by total sessions (or energy delivered) descending.
2. Ranking can be filtered by date range.
3. Top station is clearly highlighted in the UI.
4. Ranking is scoped to the logged-in company's own stations.

### Test Cases:
| Test ID | Test Scenario | Preconditions | Steps | Test Data | Expected Result | Severity |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-168-01** | Verify descending ranking order and top station badge | Station A (80 sessions), Station B (45 sessions), Station C (15 sessions) | 1. Open Highest Traffic Station Ranking card.<br>2. Check ordering. | 3 stations | Stations listed in order: #1 Station A, #2 Station B, #3 Station C. Rank #1 station features a distinct 'Top Performer' badge/trophy icon. | High |
| **TC-168-02** | Verify ranking changes dynamically according to selected date range | In August, Station B was #1; in September, Station A was #1 | 1. Change date filter from September to August.<br>2. Verify updated ranking list. | Filter: August 2026 | Ranking recalculates according to August data, promoting Station B to #1. | High |
| **TC-168-03** | Verify tenant isolation in station ranking | Multi-company environment | 1. Check ranking for Company X.<br>2. Verify station company IDs. | Company X | Only Company X stations are ranked. No competitors' stations ever appear in the leaderboard. | Critical |

---

## 15. SCRUM-169: Company: Busiest Time-of-Day Analytics
**Sprint:** Sprint 4 | **Priority:** High | **Story Points:** 5 | **Component:** Time-of-Day Heatmap / Analytics  
**Acceptance Criteria:**
1. Analytics group session counts into hourly buckets across a selected period.
2. Busiest hour(s) are clearly highlighted.
3. Data can be filtered per station or across all stations.
4. Chart/table updates when the date filter changes.

### Test Cases:
| Test ID | Test Scenario | Preconditions | Steps | Test Data | Expected Result | Severity |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-169-01** | Verify hourly bucket aggregation across 24-hour spectrum | Charging sessions occurring across various hours of the day | 1. Open Time-of-Day Analytics view.<br>2. Inspect hourly distribution buckets (0-23 hours). | Aggregate for Last 14 days | Sessions are grouped into 24 one-hour blocks. Busiest blocks display highest bar or warmest heatmap color. | High |
| **TC-169-02** | Verify filtering between All Stations and Individual Station | 2 stations with different peak patterns | 1. View default 'All Stations' view.<br>2. Filter by 'Station East'.<br>3. Compare graphs. | Filter: 'Station East' | Chart updates to reflect hourly usage distribution exclusively for 'Station East'. | Medium |
| **TC-169-03** | Verify reactivity to date range filter | Set date filter to single weekend vs weekday | 1. Set filter to Saturday & Sunday.<br>2. Check hourly distribution. | Weekend filter | Data updates to reflect weekend charging patterns accurately. | Medium |

---

## 16. SCRUM-171: AI: Pricing Recommendation Insight
**Sprint:** Sprint 4 | **Priority:** Low | **Story Points:** 5 | **Component:** AI Pricing Insights  
**Acceptance Criteria:**
1. System generates at least one actionable pricing/demand recommendation per station with sufficient data.
2. Recommendation text is clear and based on the underlying analytics data.
3. Recommendation updates as new analytics data is processed.
4. Recommendation is displayed on the company dashboard.

### Test Cases:
| Test ID | Test Scenario | Preconditions | Steps | Test Data | Expected Result | Severity |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-171-01** | Verify pricing recommendation card display and advisory text clarity | Station experiences consistent 95% utilization between 18:00 - 20:00 | 1. Navigate to Dashboard AI Recommendations.<br>2. Inspect pricing insight card. | High peak demand station | Displays actionable recommendation (e.g., "Consider introducing a peak tariff of +15% between 6:00 PM and 8:00 PM to optimize charger turnover"). Marked clearly as "AI Recommendation (Advisory Only)". | High |
| **TC-171-02** | Verify no automated price change without Admin confirmation | Recommendation is generated | 1. Verify actual station price in Map Service.<br>2. Confirm price has not altered automatically. | Tariff in Map Service | Configured tariff remains strictly unchanged until Company Admin manually accepts/edits it. | Critical |
| **TC-171-03** | Verify tenant scoping of AI recommendations | Two separate companies | 1. Log in as Company A.<br>2. Inspect recommendation text. | Company A | Recommendation only references Company A's stations and demand patterns. | Critical |

---

## 17. SCRUM-172: Dashboard/Analytics Service Load Testing & Performance Tuning
**Sprint:** Sprint 4 | **Priority:** Medium | **Story Points:** 3 | **Component:** Performance & Scalability / JMeter  
**Acceptance Criteria:**
1. JMeter test simulates at least 50 concurrent report/analytics requests.
2. Response time and error rate are documented.
3. AI prediction endpoints are included in the load test.
4. At least one identified bottleneck is fixed or documented.

### Test Cases:
| Test ID | Test Scenario | Preconditions | Steps | Test Data | Expected Result | Severity |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-172-01** | Execute 50 concurrent user load test on Dashboard & Analytics endpoints | Staging / Test environment running DashboardAnalyticsService | 1. Configure JMeter thread group with 50 concurrent users (ramp-up 10s, loop count 10).<br>2. Target endpoints: `/api/dashboard/overview`, `/api/analytics/daily-usage`, `/api/analytics/revenue-trend`.<br>3. Run test and collect metrics. | 50 concurrent threads, 500 total requests | - HTTP 200 Success Rate >= 99%<br>- Average response time < 1500 ms<br>- 95th percentile latency < 2500 ms<br>- 0 server crashes (HTTP 500/502). | High |
| **TC-172-02** | Execute stress test on AI prediction endpoint `/api/analytics/ai/peak-hours` | AI prediction service deployed | 1. JMeter test targeting peak-hours prediction with 25 concurrent requests.<br>2. Monitor CPU, memory, and latency. | 25 concurrent AI requests | Model responds without thread starvation or out-of-memory errors. Error rate < 1%. Latency documented. | High |
| **TC-172-03** | Verify database connection pool and bottleneck reporting | Database connection pool configured | 1. Observe database active connections and slow query log during 50-user load test.<br>2. Log slow queries (> 500ms). | DB profiling active | Connection pool does not exhaust. Bottlenecks (e.g., missing index on `session_date` or `company_id`) are documented in the performance report. | Medium |

### 📊 Load Test Execution Report & Verification Results (JMeter 50 Virtual Users)
- **Execution Date:** October 10-11, 2026
- **Test Artifact:** `Sprint4_LoadTest_50Users.jmx` | Report Directory: `load_report/index.html`
- **Total Samples Executed:** 1,500 requests across 50 concurrent virtual threads
- **Error Rate:** **0.00% (0 errors)** — **100% PASS**
- **Average Latency:** **21.88 ms** (Target SLA < 1500 ms: **PASSED**)
- **90th Percentile Latency:** **52.90 ms**
- **95th Percentile Latency:** **105.95 ms** (Target SLA < 2500 ms: **PASSED**)
- **99th Percentile Latency:** **229.96 ms**
- **Throughput:** **163.04 requests/second**
- **APDEX Score:** **1.000 (Satisfied)**

#### JMeter Dashboard Screenshots:
1. **Overview & Requests Summary (100% Pass Pie Chart):**  
   ![JMeter Dashboard Overview](jmeter_dashboard_overview.png)

2. **Detailed Statistics & Latency Breakdown Table (0.00% Error Rate):**  
   ![JMeter Statistics Table](jmeter_statistics_table.png)

3. **Throughput (Hits Per Second):**  
   ![JMeter Throughput](jmeter_throughput.png)

---

## 💡 QA Execution Guidelines & Test Sign-off Checklist

1. **Test Environment:** Run all functional and API tests against the Staging / Docker Compose local cluster (`Infrastructure/docker/docker-compose.yml`).
2. **Postman / Swagger Collection:** Validate all underlying endpoints under `DashboardAnalyticsService` (`http://localhost:5004/swagger` or configured port).
3. **Multi-Tenancy Check:** Always execute paired test cases with `Company A` and `Company B` credentials to verify strict tenant isolation.
4. **Bug Reporting Convention:** Title format: `[Sprint 4][Component][SCRUM-ID] Brief bug summary` (e.g. `[Sprint 4][Dashboard][SCRUM-130] Date filter allows end date earlier than start date`).
