# EVNexus individual UI/UX and E2E testing

## Standalone full-suite CI (24 November 2026)

`.github/workflows/playwright-tests.yml` is the individual full-suite workflow. It supports pushes only to `feature/playwright-full-ci` for pre-merge hosted validation, manual dispatch once available, relevant pull requests and `workflow_call` for later integration. It does not call or modify the group pipeline. The existing `.github/workflows/ui-tests.yml` remains the quick mocked UI check. A frontend PR can therefore run both checks intentionally.

The full workflow uses a fresh GitHub-hosted Ubuntu 24.04 runner and Node 22. It installs locked frontend dependencies and Chromium with OS dependencies, builds the frontend, discovers the complete test inventory, provisions the existing standalone Compose stack, waits for bounded readiness, prepares accounts and seeds data, then runs `npm run test:all -- --retries=0`. This executes 53 UI cases and 7 real backend cases with one worker and no retries. Existing assertions, mocks, axe scans, responsive viewports, real APIs and Kafka settlement polling are unchanged. The browser uses the managed Vite development server; the build step separately validates production compilation.

The first hosted attempt (`45372054905`, commit `f960c18`) failed in `actions/checkout@v4` credential removal: the existing unrelated `EVNexus` gitlink has no `.gitmodules` URL. No browser tests executed. The individual workflow therefore retrieves GitHub's source tarball for the exact `GITHUB_SHA` using the ephemeral read-only job token, extracts it on the fresh hosted runner and removes the temporary archive. No Git credentials persist, no gitlink or application files are changed, and no `.git` history is required by this suite. Setup failure was correctly reported as 60 missing cases and safe artifacts still uploaded.

No repository application secrets are required: the existing initializer generates disposable database/JWT/internal/SMTP values. Preparation creates disposable `@e2e.invalid` accounts, reads verification mail from isolated Mailpit, verifies through the actual API and funds the synthetic wallet. No external SMTP or payment provider is used. Real E2E is still restricted to the attested isolated gateway.

`Infrastructure/docker/e2e-ci.mjs` is a CI-only adapter. It refuses local and self-hosted execution, retains the local wrapper unchanged, claims run/attempt/job ownership before startup, and retries only read-only readiness probes for up to four minutes (individual Docker/HTTP commands also have time limits). It checks container health, the six existing HTTP probes and authenticated database readiness before account mutation. Startup/build has a twelve-minute subprocess limit; the workflow has a forty-minute job limit.

Diagnostics, cleanup, summary generation and artifact upload use `if: always()` so ordinary setup/test failures do not suppress them. A generated, ignored Compose override adds only run/attempt/job ownership labels to testing containers, volumes and network; the source Compose file stays unchanged. Cleanup validates that exact label-only override, resource labels and the effective base Compose configuration, rejects baseline resources and foreign attachments, accepts partial startup, removes only the dedicated project and declared volumes, then verifies no dedicated resources remain and baseline resources are preserved. It never prunes Docker, uses development Compose, removes images, or changes local teardown behavior. A missing ownership record causes cleanup to remove nothing. Abrupt runner loss/forced termination can prevent final steps; the hosted runner is disposable.

### Actual results and safe artifacts

`Frontend/tests/helpers/ci-summary.js` reads fresh `test-inventory.json` and `test-results/results.json`. It checks the approved 60 stable IDs and project membership, duplicates, unknown identities, missing execution results, runner errors/statistics, test exit outcome and cleanup outcome. The expected inventory is a completeness contract, not a fabricated result. Update it only when intentionally changing the authored test inventory.

The Actions summary contains per-suite and total passed/failed/skipped/flaky/interrupted/missing counts, blocked prerequisite failures, execution duration and strict pass rate (`passed / 60 expected`). Skips, flakes, expected-failure annotations and interrupted/missing tests do not meet the strict success gate. Blocked prerequisites are a subset of failures. Setup failure produces an incomplete report and never claims a successful test run. Duration is the Playwright-reported test execution duration, not total Docker setup/job time.

The artifact `playwright-individual-<run ID>-<attempt>` is retained for 14 days and contains only `Frontend/ci-report/`:

- `index.html`: readable per-case HTML generated from allowlisted actual results.
- `results.json`: safe normalized results, integrity issues and per-case durations/statuses.
- `results.xml`: safe JUnit XML; missing/interrupted/flaky cases fail, and infrastructure/integrity issues add a separate failing testcase.
- `summary.md`: the individual GitHub Actions summary.
- `services.json`: allowlisted service running/health states when Docker diagnostics succeed.

These are explicitly safe derived reports, not the native interactive Playwright HTML bundle or raw Playwright JSON/XML. Native reporters still run unchanged locally and in the runner. Raw reports, errors, source snippets, stdout, network payloads, emails, screenshots and trace archives are **never uploaded** by the full workflow, since they can contain credentials/tokens and opaque archives cannot be safely sanitized by string replacement. Raw preparation/test output is redirected to ignored runner-only logs. Allowlisted artifacts retain case outcomes and safe service states; detailed authenticated network/visual debugging must be reproduced privately in the existing local isolated environment. The quick UI-only workflow's existing artifact policy remains unchanged.

### Validation and limitations

On 24 November 2026, the new worktree passed frontend build and all **53 mocked UI tests** (66.80 seconds), with no retries. Discovery found the approved **60 cases**. Nine Node helper tests passed, covering complete/missing/duplicate results, global errors, skipped/flaky/interrupted/blocked cases, secret exclusion, strict outcomes, hosted-runner guards, partial-stack ownership and bounded readiness. The summary CLI was also run against the actual 53-case report and correctly failed the completeness gate with seven missing E2E cases. Actionlint 1.7.12 validated the standalone workflow without errors (ShellCheck unavailable). Test fixtures exercise reporting logic only and are not presented as application E2E results.

Hosted validation on 24 November 2026 subsequently passed on Ubuntu 24.04 / Node 22.23.5 at implementation commit `902876262ee7b88368a4d1f7c573e4ff6264e53e`: [run 45372434312](https://github.com/HiruniPramodini/EVNexus/actions/runs/45372434312). The downloaded actual results contain **60/60 passed: 53 UI and 7 real E2E; 0 failed, skipped, flaky, interrupted, blocked or missing; 100% strict pass rate**. Playwright execution took **78.517088 seconds**; the job ran from 10:11:51 to 10:15:34 UTC (15:41:51 to 15:45:34 Asia/Colombo), approximately 3 minutes 43 seconds including setup.

All installation/build, provisioning, readiness, account preparation, seeding, browser execution, summary, upload and cleanup steps succeeded. The artifact confirms eleven running services, all four databases plus Kafka and Mailpit healthy; application readiness uses HTTP/SQL probes rather than Docker health labels. `REAL-CHARGE-01` passed once, retaining its real Kafka completion, amount, history, receipt, wallet deduction and transaction assertions. JUnit reports 60 tests, zero failures and zero skips. The artifact contains exactly `index.html`, `results.json`, `results.xml`, `summary.md` and `services.json`, expires after fourteen days, and passed allowlist/sensitive-pattern checks. Cleanup logged that only dedicated CI resources were removed and the baseline was preserved.

Manual dispatch became available after workflow registration even though the workflow was absent from main: dispatch for `feature/playwright-full-ci` was accepted as [run 45373190142](https://github.com/HiruniPramodini/EVNexus/actions/runs/45373190142). This confirms pre-merge dispatch availability; the passing evidence above is from the completed push-triggered run. Only the feature branch has been committed/pushed; main and the group pipeline remain unchanged. Docker is still unavailable locally, and the retained safe reports intentionally omit raw authenticated traces, screenshots and payloads.

Run helper validation from the repository root:

```text
node --test Infrastructure/docker/e2e-ci.test.mjs Frontend/tests/helpers/ci-summary.test.mjs
```

For subsequent individual validation, dispatch the workflow on the feature branch or push to `feature/playwright-full-ci`, then inspect the actual 60-case results, readiness, artifact and cleanup. The workflow API initially returned 404 before registration; the narrowly scoped push trigger enabled pre-merge validation, and manual dispatch was subsequently confirmed. Group integration and Selenium replacement remain postponed and require separate authorization.

Student: **Hiruni Pramodini — IT24610786**

Module: SE3112 Advanced Software Engineering

Responsibility: automated browser UI, negative-path, responsive, accessibility and integrated E2E testing.

## Scope and architecture

The existing React 18/Vite JavaScript application is in `Frontend`. `App.jsx` implements view routing using browser history and role-dependent rendering. The driver uses `/driver-login`, `/driver-dashboard`, `/map`, `/wallet`, `/history`, `/account` and `/settings`. Company administrators use `/login`, `/dashboard`, `/stations`, `/live`, `/finance`, `/company` and `/settings`. The company dashboard is the Analytics destination; transactions are embedded in analytics/revenue, not a separate Transactions route.

`src/services/api.js` uses `VITE_API_GATEWAY_URL`, defaulting to port 5000. Auth, Map, Payment and Dashboard services are .NET services behind the gateway. Auth/session data use `evnexus_auth_token`, `evnexus_refresh_token` and `evnexus_auth_user` localStorage keys. Company station management requires the real backend role `CompanyAdmin`.

The existing Puppeteer login script, scratch API probes and root `test_charging_flow.js` informed the login, wallet and charging scenarios. They are preserved unchanged by this contribution and are not counted as Playwright results. Backend xUnit/Moq tests and existing service CI/CD files are also preserved. This contribution does not implement mutation, load, or backend unit tests.

```text
Playwright Chromium -> actual Vite React application
  UI project  -> controlled API responses (all /api requests intercepted)
  E2E project -> real gateway -> Auth / Map / Payment -> isolated MySQL + Kafka
                         -> bounded payment polling, history and wallet assertions
```

Playwright was selected for JavaScript support, accessible locators, isolated browser contexts, automatic waiting, retrying assertions, request support, HTML/JUnit/JSON reporting and failure traces. `@axe-core/playwright` checks selected WCAG A/AA rules. Automatic checks do not establish full WCAG compliance or overall usability.

## What each suite proves

- **Mocked UI** (`@mocked`): actual browser rendering, form validation, navigation, request handling, error recovery, QR decoding, responsive behavior and accessibility under explicitly controlled responses. Synthetic identities and tokens cannot authenticate to real services. The fixture fails unexpected API requests and never forwards `/api/` traffic to a backend.
- **Real E2E** (`@real`): actual UI login and integrated service behavior. API responses are never fulfilled with fixtures. Only unrelated external map/image services are blocked. Missing prerequisites fail with `BLOCKED:` rather than silently skipping or producing false success.
- **Quality**: accessibility tests deliberately fail on violations. No accessibility rules or elements are excluded. Responsive assertions examine actual viewports, navigation actions and document overflow.

## Prerequisites and installation (Windows CMD)

Use a current Node.js 22 release (22.20 or later), or Node 24.12 or later, with npm to satisfy the installed dependency engines. The verified local environment used Node 24.15.0. The committed lockfile pins the exact installed dependencies. Chromium is the primary browser; other browsers have not been verified.

```bat
cd /d "C:\Users\hirun\EVNexus (3)\EVNexus\EVNexus\Frontend"
npm ci
npx playwright install chromium
npm run build
npm run test:list
```

Playwright starts its own Vite server on `http://127.0.0.1:3100` with strict port checking. The existing development port 3000 is unchanged. Do not start a second server on 3100. For an externally started frontend set `PLAYWRIGHT_EXTERNAL_SERVER=1` and `PLAYWRIGHT_BASE_URL` to its actual URL; configure that server's `VITE_API_GATEWAY_URL` yourself. A managed server receives `E2E_API_URL` as its Vite API gateway URL.

## Environment configuration

```bat
copy .env.example .env.test
notepad .env.test
```

`.env.test` is ignored. Shell environment variables override values loaded from that file. Do not put real credentials into `.env.example`, test code or documentation.

| Variable | Meaning |
|---|---|
| `PLAYWRIGHT_BASE_URL` | Frontend, default `http://127.0.0.1:3100` |
| `PLAYWRIGHT_EXTERNAL_SERVER` | `1` disables managed Vite startup; default `0` |
| `E2E_API_URL` | Attested isolated gateway: `http://127.0.0.1:15000` |
| `E2E_ALLOW_MUTATIONS` | Set exactly `local-test-only` after preparing isolated test services |
| `E2E_DRIVER_EMAIL`, `E2E_DRIVER_PASSWORD` | Dedicated, verified driver |
| `E2E_COMPANY_EMAIL`, `E2E_COMPANY_PASSWORD` | Dedicated, verified/approved company administrator |
| `E2E_STATION_ID`, `E2E_CHARGER_ID` | IDs of the prepared station and available charger |

Real E2E is restricted to the attested isolated Docker gateway at http://127.0.0.1:15000. Loopback alone is insufficient: container identity, project ownership, network and storage are checked before any real API call.

## Preparing the real local environment

Use the validated standalone environment described in [E2E_ENVIRONMENT.md](../../Infrastructure/docker/E2E_ENVIRONMENT.md). The former development Compose instructions are superseded: changing only the project name does not isolate hardcoded container names or host ports. Never stop/remove the existing stack to resolve this collision.

The new project is evnexus-e2e-playwright. Its gateway is http://127.0.0.1:15000, its SMTP inbox is http://127.0.0.1:18025, and databases/Kafka have no published host ports. Docker ownership, volume/network scope and the gateway container identity are verified before real test mutations. Random local-only secrets, account credentials and actual seed IDs are written to ignored files without printing them.

First-time startup from the repository root: node Infrastructure/docker/e2e-local.mjs init, then validate, then up. On subsequent runs use validate/status only; up refuses to recreate existing containers. See the linked guide for exact Windows CMD commands and safe recovery constraints.

From Frontend, run npm run test:prepare to register dedicated Driver/CompanyAdmin accounts through the actual APIs, verify emails actually delivered to private Mailpit, and fund only the isolated test wallet through its real API. Run npm run test:seed to create or verify/reuse the attested station and charger. Both scripts configure .env.test automatically and preserve a backup of its original contents. Then run the real E2E or full suite.

The inspected application creates a Pending company but currently permits real CompanyAdmin login and station management after email verification. No approval flag is edited and no separate approval workflow is claimed tested. If policy later requires administrator approval, complete that legitimate workflow rather than bypassing it.

## Test-case inventory and expected outcomes

Every test title contains a stable ID and classification. [VERIFIED_RESULTS.md](VERIFIED_RESULTS.md) contains a row for every discovered/executed case, including its actual status; it is generated from the Playwright JSON report by `npm run test:record`.

The generated matrix is a local artifact and is intentionally ignored by Git, together with raw HTML/JUnit/JSON reports. Run the full suite and `npm run test:record` after checkout to create it. The authored verification summary in this guide records the reviewed result without committing generated reports or trace data.

Unless stated otherwise, UI cases start with a fresh browser context and deterministic synthetic data. Navigate through the actual application, perform the scenario below, and assert its expected outcome. Detailed executable steps are in the linked spec files.

| IDs | Preconditions / steps | Expected outcome | Type |
|---|---|---|---|
| DA-01 / CA-01 | Open driver/company login; submit both fields empty | Both required messages; no login request | Negative UI |
| DA-02 / CA-02 | Leave email empty, supply generated synthetic password; submit | Email-required error; no request | Negative UI |
| DA-03 / CA-03 | Supply syntactically valid email, leave password empty; submit | Password-required error; no request | Negative UI |
| DA-04 / CA-04 | Supply malformed email and password; submit | Email-format error; no request | Negative UI |
| DA-05 / CA-05 | Login API returns controlled 401 | Authentication message, no token, remains on login | Negative mocked UI |
| DA-06 / CA-06 | Login API returns synthetic role identity; submit, logout, revisit protected route, refresh | Correct dashboard/user shown, storage cleared, protected content absent | Positive mocked UI |
| DA-07 / CA-07 | Abort login network request; submit | Error and enabled retry/submit control | Negative mocked UI |
| AUTH-01 | Focus email; Tab through password/toggle/submit; use Enter | Logical keyboard order, password toggle works, validation shown | Positive UI |
| NAV-01 | Driver session; navigate every existing main destination | Actual page content and URL match each destination | Positive mocked UI |
| NAV-02 | Company session; inspect KPIs, navigate stations/live/revenue/profile/settings | KPI labels and actual destination headings shown | Positive mocked UI |
| NAV-03 | Driver opens company `/stations` directly, refreshes, then encounters a company route in browser history | Driver dashboard URL/content, no company management controls | Negative mocked UI |
| NAV-04 | Anonymous browser opens `/stations` | Landing view, no company management controls | Negative UI |
| ERR-01 | Empty charging-history response | Understandable empty state, no table | Negative mocked UI |
| ERR-02 | History response 503 | Error shown instead of empty-success message | Negative mocked UI |
| ERR-03 | Wallet 503, then successful response; press Retry | Error followed by balance/transaction content | Negative/recovery mocked UI |
| ERR-04 | Nearby-stations response 503 | Error shown, no fabricated station | Negative mocked UI |
| ERR-05 | Nearby-stations response empty | No-stations explanation | Negative mocked UI |
| ERR-06 | Wallet network abort | Error with enabled Retry | Negative mocked UI |
| ST-01 | Known station; filter/unfilter, select marker, inspect popup and QR upload, cancel | Search, metadata, connector/power and upload UI work | Positive mocked UI |
| ST-02 | Company opens Add Station and submits empty form | Browser required-field validation, no POST | Negative mocked UI |
| ST-03 | Valid station inputs except latitude 999 | Coordinate error, no POST | Negative mocked UI |
| ST-04 | Fill station form; mocked create/default-charger/QR endpoints | Success, new row, exactly one station and charger POST | Positive mocked UI |
| ST-05 | Company opens charger manager | Available charger and connector details appear | Positive mocked UI |
| ST-06 | Station save returns 503 | Error shown; entered data retained; Save enabled | Negative mocked UI |
| CH-01 | Upload QR rendered with foreign system marker | Client rejects QR before validate request; cannot start | Negative mocked UI |
| CH-02 | QR validation returns inactive-station 404 | Error; cannot start | Negative mocked UI |
| CH-03 | QR validation succeeds; start returns unavailable-charger 400 | Error; no active session; recoverable start action | Negative mocked UI |
| RWD-{desktop,tablet,mobile}-01 | Open both login forms at selected viewport and submit | Inputs usable, required validation, no document overflow | Responsive UI |
| RWD-{desktop,tablet,mobile}-{driver,company} | Open portal and navigate via sidebar/mobile menu | Destination usable; menu closes on small screens; no overflow | Responsive mocked UI |
| RWD-{desktop,tablet,mobile}-map | Open discovery and filter station list | Search/refresh fully inside viewport, empty-result state, no document overflow | Responsive mocked UI |
| AX-01–AX-06 | Open driver/company login, driver/company dashboard, discovery and station management; wait for content; scan | Zero automatically detectable violations of selected rules; full findings attached | Accessibility UI |
| AX-07 | Open Add Station form and scan | Inputs/controls meet selected rules; violations fail and attach evidence | Accessibility UI |
| REAL-AUTH-{driver,company}-01 | Dedicated real verified account; actual UI login, logout and protected-route refresh | Actual dashboard reached; authentication storage cleared; protected content absent | Positive real E2E |
| REAL-AUTH-{driver,company}-02 | Dedicated real email; submit generated incorrect password | Real service returns 401; visible failure; no token | Negative real E2E |
| REAL-RBAC-01 | Real driver login; request company stations; open company route | Backend 403 and no company-management button | Negative real E2E |
| REAL-STATION-01 | Real company account; create unique station through UI | New row and real available default charger; exact test-created station deactivated in cleanup | Positive real E2E |
| REAL-CHARGE-01 | Real accounts, available seeded charger, wallet >=1000, no active session | Actual QR from company canvas; driver login, discovery, QR upload, start, active-session assertion, stop, Completed state, settled payment, matching history receipt and exact wallet deduction | Positive real E2E |

The real charging test compares payment amount with completed-session cost, asserts the exact session in backend history and its displayed shortened receipt ID, checks wallet balance difference, and checks a negative `CHARGING_PAYMENT` transaction whose `referenceId` equals that session. No payment-completion endpoint is called to force success. Polling is bounded at 60 seconds for Kafka settlement and 15 seconds for wallet visibility. Arbitrary sleeps are not used in test code.

## Responsive, accessibility and visual strategy

Viewports: desktop 1440×900, tablet 768×1024, mobile 375×812. Tests exercise both portal menus and login forms, discovery controls, selected destination content and horizontal overflow. They do not claim every screen/overlay or physical mobile device has been verified.

Axe scans use `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`. Finite entrance animations finish before scanning so transient fade-in opacity does not produce false contrast failures; infinite status/loading animations are not awaited. No rules or nodes are excluded. Full JSON findings are attached before asserting no violations, so failures remain inspectable. Keyboard testing checks login field/toggle/submit order. Manual follow-up should cover screen-reader announcements, focus trapping/restoration in modals, touch target sizes and task completion with real users.

Visual baseline comparison is deliberately not enabled: no approved baseline set exists in this repository, and charts, timestamps/maps and external imagery need stabilization first. Failure screenshots are evidence, not approved visual baselines. A future visual suite should use reviewed, platform-specific stable login screenshots with fixed fonts/animations. Do not automatically update baselines to pass a changed UI.

## Running suites and interpreting results

Run from `Frontend` in Windows CMD:

```bat
npm run test:ui
npm run test:e2e
npm run test:a11y
npm run test:responsive
npm run test:headed
npm run test:all
npm run test:record
npm run test:report
```

`test:ui` includes accessibility/responsive checks and fails on any remaining/regressed issue. `test:e2e` uses one worker to avoid overlapping real driver sessions. `test:all` also uses one worker. Default local retry count is zero; UI tests have one CI retry, while real E2E has no retries to avoid repeated mutations. Tests and commands return non-zero on failures. No critical tests are marked skipped or expected-fail.

Outputs are ignored by Git:

- `playwright-report/index.html`: interactive report, screenshots, attachments and traces.
- `test-results/results.xml`: JUnit for CI aggregation.
- `test-results/results.json`: complete machine-readable results and actual runner command.
- `test-results/<case>/test-failed-*.png`, `trace.zip`, `error-context.md`: failure evidence.
- Axe attachments: all rule violations and affected selectors.

Each new run replaces the default output/report. Archive a run before running a subset if you need both. `test:record` overwrites only `docs/VERIFIED_RESULTS.md` using the most recent JSON; regenerate after a full `test:all` for a complete inventory. Never infer backend success from mocked UI results. E2E traces can contain authentication/network data; retain them only in the team's restricted test artifact location and never commit them.

## Actual verification and limitations

**Current isolated-environment result: 60 passed, 0 failed, 0 blocked, 0 skipped, 0 flaky.** The full suite started on **23 November 2026 at 16:15:00 Asia/Colombo** and finished in approximately **88 seconds**, exit code **0**. A separate real-E2E execution also passed all seven cases, exit code 0. Registration/email verification, real role authorization, station creation, QR charging, Kafka-driven settlement, receipts/history and exact wallet deductions were verified against the dedicated running services. Account preparation and station seeding were both successfully repeated without replacing their data. All original Docker resources remain preserved, confirmed by final baseline checks.

The local implementation target is now achieved. GitHub-hosted execution, other browsers/operating systems and a real card-payment provider are outside this verified result. Historical blocked/failing runs below are retained for context and do not describe the current environment. See the generated [VERIFIED_RESULTS.md](VERIFIED_RESULTS.md) and [isolated setup guide](../../Infrastructure/docker/E2E_ENVIRONMENT.md).

See [VERIFIED_RESULTS.md](VERIFIED_RESULTS.md) for actual per-case execution results. The frontend build succeeded, with an existing >500 kB bundle-size warning. Test discovery and browser installation succeeded. npm reported dependency advisories in the existing frontend dependency tree; no unrelated dependency upgrades were made.

Earlier pre-Docker run on **23 November 2026 at 13:38:58 Asia/Colombo**: **53 passed, 0 application failures, 7 blocked real E2E cases, 0 skipped, 0 flaky; 60 cases total**, approximately 72 seconds. All seven axe scans reported **zero violations** under the selected rules; all 12 responsive cases and the strengthened NAV-03 load/refresh/history assertions passed. `npm run test:all` exited **1** because prerequisite-blocked E2E cases deliberately fail. `npm run test:record` regenerated the per-case matrix with explicit zero/nonzero totals. Standard HTML, JUnit and JSON outputs were generated and inspected. Clean `npm ci`, the production build, package/lockfile compatibility, workflow YAML/contract checks and `git diff --check` passed. The UI-only CI-mode run separately returned **0** with all 53 cases passing.

At that earlier stage the status was **partially completed**. Docker isolation and real E2E have since been implemented; consult the current generated results and isolated environment guide. No database reset, authentication bypass, branch change, commit, push or deployment was performed.

Baseline before the fixes, **23 November 2026 at 12:46 Asia/Colombo**: **60 cases, 47 passed, 6 application-finding failures, 7 E2E prerequisite-blocked failures, 0 skipped and 0 flaky**. The baseline report/traces are preserved in ignored `.e2e-artifacts/before-frontend-fixes`. The latest results, including the unchanged real E2E prerequisite gates, are in [VERIFIED_RESULTS.md](VERIFIED_RESULTS.md).

| Axe case | Actual findings in the baseline before fixes |
|---|---|
| AX-01 Driver login | No violations detected by selected rules |
| AX-02 Company login | No violations detected by selected rules |
| AX-03 Driver dashboard | Serious `color-contrast`: 3 affected nodes |
| AX-04 Company dashboard | Serious `color-contrast`: 20 affected nodes |
| AX-05 Discovery | Serious `aria-command-name`: 2 nodes; serious `color-contrast`: 4 nodes; critical `label`: 1 node |
| AX-06 Station management | Serious `color-contrast`: 5 nodes |
| AX-07 Station creation form | Serious `color-contrast`: 5 nodes; critical `label`: 3 nodes; critical `select-name`: 1 node |

Node counts are per page scan and are not a count of unique defects across the application. Complete node selectors, rule details and remediation guidance are in the report's attached axe JSON. No violations were suppressed.

Baseline verification: dependency installation and Chromium installation succeeded; `npm run build` succeeded; `npm run test:list` discovered all 60 cases; the baseline `npm run test:all` returned exit code 1 with the findings above; `npm run test:record` generated the actual matrix successfully; `npm run test:seed` returned exit code 1 at its missing-environment guard before making API requests. `git diff --check` passed. npm audit reported 1 moderate and 2 high advisories in the existing Vite/esbuild/source-map-js dependency tree. GitHub execution was not attempted.

One earlier full execution was interrupted by a tooling/runtime timeout and timed out AX-01. Its evidence is retained in ignored `.e2e-artifacts/interrupted-run`. Later complete runs passed AX-01; it is not counted as an outstanding application defect.

Minimal frontend corrections made after inspecting the six failing cases, their trace action records, DOM snapshots and attached axe findings:

- Darkened the shared muted-text token from `#6f817c` to `#5d706a` for contrast on white and pale surfaces; the design/layout and business behavior are unchanged.
- Named interactive map markers and the search radius control. Search/clear actions now also have explicit accessible names.
- Associated station form labels with their actual inputs/select using `htmlFor`/`id`; station helpers now use these semantic labels.
- Normalize dashboard views for the current role on initial load and browser-history events, so a driver opening `/stations` reaches the driver dashboard rather than an empty main area. NAV-03 additionally verifies URL, refresh and history handling; no assertion was removed.

Environment follow-up:
- Docker Desktop is now available. The isolated evnexus-e2e-playwright stack is running; all four authenticated database probes, Kafka/Mailpit health checks and application HTTP probes passed. Dedicated real accounts, local SMTP verification, wallet funding and attested station/charger seeding succeeded. All seven real E2E tests passed in their dedicated run. Original Docker resources remain unchanged, as verified against the saved baseline.
- CI configuration has been added but was not executed on GitHub. Linux behavior and cross-browser behavior are not claimed verified.

No backend or business/payment logic was changed. No branch switch, commit, push or deployment was performed. Pre-existing edits in gateway configuration and legacy scripts were preserved. Reviewing the full diff identified legacy script fallback passwords and token/response logging; these existing probes are not invoked by the new workflow. The new browser tests generate synthetic fixture tokens at runtime, read real credentials only from the environment, and do not print authentication responses. Generated reports, trace data, local environment files and seed manifests remain ignored. Existing npm audit advisories were not addressed through unrelated dependency upgrades.

## CI integration

`.github/workflows/ui-tests.yml` is a focused addition: frontend pull requests or manual dispatch install Node/Chromium, build the frontend, run the UI project, and upload HTML/machine-readable/failure artifacts with `if: always()`. It does not replace or edit backend workflows. Failures propagate normally: no `continue-on-error` or shell success override is used.

Workflow verification: YAML parsed successfully using the temporary js-yaml CLI (no project dependency added). Contract checks verified triggers, read-only repository permission, `Frontend` working directory, lockfile-based npm cache, `npm ci`, browser/dependency installation, build/test order, normal exit-code propagation, and both report artifact paths with `always()`. The managed Playwright web server starts Vite on port 3100 and waits for its URL; UI fixtures prevent real API calls. Local clean installation/build and CI-mode browser execution were exercised. The Ubuntu system-dependency installation and GitHub artifact upload still require an actual GitHub runner; no remote execution is claimed.

The exact UI project command was also executed locally with `CI=true`: `npm run test:ui -- --reporter=list --output=.e2e-artifacts/ci-ui` completed with **53 passed, 0 failures**, exit code **0**, in approximately 44 seconds. The reporter/output overrides keep this workflow-scope check separate from the final full-suite HTML/JUnit/JSON reports. Its log is retained at ignored `.e2e-artifacts/ci-ui.log`. Missing prerequisites or failures still produce non-zero exit codes; no success override was introduced. No workflow change was necessary after validation.

The group's unified pipeline can call `npm ci`, `npx playwright install --with-deps chromium`, `npm run test:ui`, and archive `Frontend/playwright-report` / `Frontend/test-results`. For real E2E, first prepare isolated services/databases, legitimate test accounts, SMTP/approval and seed data, supply environment variables from CI secrets, then run `npm run test:e2e`. The real suite is loopback-only, so the services must run on that runner. There is no deployment step. Do not enable real E2E on a production-connected runner.

## Troubleshooting

| Symptom | Action |
|---|---|
| Chromium executable missing | Run `npx playwright install chromium`; on Linux use `--with-deps` |
| Port 3100 already in use | Stop the identified stale frontend or set a different loopback `PLAYWRIGHT_BASE_URL` port |
| Vite/esbuild access denied in restricted automation | Execute the authorized build/test process with required local process/filesystem permissions; do not edit Vite to bypass it |
| `BLOCKED: missing...` | Fill ignored `.env.test`, prepare dedicated services and rerun; this is not a pass |
| Login stays on form | Confirm gateway URL, real account password, email verification and company approval/role; inspect trace |
| Company station request 403 | Use a legitimate `CompanyAdmin` account, not driver/operator credentials |
| No seeded station found | Use seed IDs from this local test environment; verify station active and near Colombo |
| Driver already has active session | Investigate through local UI; test never stops a pre-existing session |
| Payment stays pending/not found | Inspect Map producer and Payment consumer logs, broker reachability and exact lowercase topic; do not invoke manual completion to hide failure |
| Wallet amount unexpected | Ensure dedicated driver is not used concurrently, funds exist in Payment service wallet and no duplicate settlement occurred |
| Accessibility assertion fails | Open attached axe JSON/trace; repair the application in a separate reviewed change and rerun; do not disable rules |
| UI fixture reports unknown endpoint | Inspect actual client endpoint and add the explicit correct contract; never forward to a real API |

## Two-minute individual demonstration

1. **0:00–0:15:** State ownership, Playwright choice and mocked UI versus real E2E boundaries.
2. **0:15–0:40:** Show DA-01 or CH-03: actual user actions, expected error and assertion preventing an incorrect transition.
3. **0:40–1:10:** Run a prepared small suite, e.g. `npx playwright test --project=ui tests/ui/auth.spec.js --headed`. Explain actual results. Show real charging only after local prerequisites are met and that journey has genuinely passed.
4. **1:10–1:40:** Open HTML report, inspect one useful screenshot/trace or axe finding. Explain discovered defects candidly.
5. **1:40–2:00:** Show CI command/artifact step and state verified limitations. Do not describe blocked E2E as successful.

The assignment requests a live demo; a recording is a rehearsal/backup unless the lecturer requests one. Prepare dependencies, browser, services and test data before recording, enlarge code/terminal text, narrate assertions rather than every click, and avoid showing passwords/tokens. A backup report is useful but must not be presented as a fresh live execution.

VIVA preparation: explain assertions, Arrange/Act/Assert, mocks and their limits, browser-context isolation, semantic locators, auto-waiting versus business-state polling, negative tests, flaky tests, eventual consistency, responsive checks, automated accessibility limits, HTTP 401 versus 403, pipeline exit codes and how a trace diagnoses failure.

## Contribution file manifest

Paths below are relative to the repository root. Existing application/service and legacy test files are not replaced.

| Path | Change / purpose |
|---|---|
| `.gitignore` | Ignore generated browser reports, artifacts and seed manifest |
| `.github/workflows/ui-tests.yml` | New focused UI CI job and retained reports |
| `Frontend/package.json` | Test dependencies and individual run commands |
| `Frontend/package-lock.json` | Reproducible dependency versions |
| `Frontend/.env.example` | Non-secret configuration template |
| `Frontend/playwright.config.js` | Chromium, projects, server, timeouts, retries, reporters and evidence |
| `Frontend/tests/fixtures/ui.js` | Isolated synthetic accounts, explicit API fixtures, navigation helper |
| `Frontend/tests/helpers/stations.js` | Reusable actual station form selectors and input steps |
| `Frontend/src/index.css` | Minimal shared text-contrast correction |
| `Frontend/src/App.jsx` | Normalize role-incompatible dashboard routes on load/history navigation |
| `Frontend/src/pages/driver/MapDashboardPage.jsx` | Accessible names for map markers, search and radius controls |
| `Frontend/src/pages/company/StationManagementPage.jsx` | Associate station form labels and controls |
| `Frontend/tests/helpers/real-api.js` | Loopback safety gate, real login/API and third-party blocking helpers |
| `Frontend/tests/helpers/seed-local.js` | Non-destructive dedicated station/charger setup |
| `Frontend/tests/helpers/prepare-local.js` | Attested real account registration, captured SMTP verification and idempotent test-wallet preparation |
| `Frontend/tests/helpers/local-env.js` | Preserve the original local environment backup and write actual test configuration without logging secrets |
| `Infrastructure/docker/compose.e2e.yml` | Standalone, project-scoped backend/database/Kafka/Mailpit environment |
| `Infrastructure/docker/e2e-local.mjs` | Safe initialization, effective-config validation, startup, attestation and resource-preservation checks |
| `Infrastructure/docker/E2E_ENVIRONMENT.md` | Isolation audit, repeatable safe setup and exact Windows commands |
| `Frontend/tests/helpers/record-results.js` | Generate actual per-case result matrix from JSON |
| `Frontend/tests/ui/auth.spec.js` | Driver/company validation, mocked auth, logout and keyboard tests |
| `Frontend/tests/ui/navigation.spec.js` | Actual role destinations and protected-route UX |
| `Frontend/tests/ui/errors.spec.js` | Empty states, API failures, network abort and recovery |
| `Frontend/tests/ui/stations.spec.js` | Discovery, details, station input, creation, charger and error tests |
| `Frontend/tests/ui/charging-errors.spec.js` | Actual QR decoding with controlled rejection/start failures |
| `Frontend/tests/ui/responsive.spec.js` | Desktop/tablet/mobile usability checks |
| `Frontend/tests/ui/accessibility.spec.js` | Axe scans and attached violation evidence |
| `Frontend/tests/e2e/authentication.spec.js` | Real authentication, logout and backend role authorization |
| `Frontend/tests/e2e/station-creation.spec.js` | Real station UI creation and scoped deactivation |
| `Frontend/tests/e2e/charging-journey.spec.js` | Genuine QR charging, history and wallet-settlement assertions |
| `Frontend/docs/UI_E2E_TESTING.md` | Setup, design, inventory, ownership, CI, troubleshooting and demo guide |
| `Frontend/docs/VERIFIED_RESULTS.md` | Generated actual results; never invented pass counts |
