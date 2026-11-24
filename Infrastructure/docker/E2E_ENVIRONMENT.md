# Isolated Playwright backend

## Standalone hosted CI

The individual `.github/workflows/playwright-tests.yml` now automates this same environment on a fresh GitHub-hosted Ubuntu runner. The local safety wrapper and all local startup/preservation behavior below remain unchanged. CI-specific bounded readiness, run ownership, partial-start cleanup and safe diagnostics are implemented separately in `e2e-ci.mjs`. Its cleanup refuses local/self-hosted use and checks ownership/baseline preservation before removing the dedicated project. No development Compose resources are targeted.

The full workflow reuses `test:prepare`, private Mailpit verification and `test:seed`, then executes all 60 cases serially without retries. It uploads only allowlisted derived reports and service states, never raw authenticated traces/screenshots/logs or local secret/state files. See [the individual guide](../../Frontend/docs/UI_E2E_TESTING.md#standalone-full-suite-ci-24-november-2026) for the full artifact policy, validation results and first-run limitations. The original UI-only workflow remains unchanged. The hosted backend run is not yet verified; previous local results below do not establish CI success.

This is the supported local real-E2E environment. **Do not use the development `docker-compose.yml` for browser E2E**, even with a different `-p` value. Use the standalone `compose.e2e.yml` through the safety wrapper below.

## Original collision and isolation audit

The development file has ten global `container_name` values: `evnexus-api-gateway`, `evnexus-auth-service`, `evnexus-map-service`, `evnexus-payment-service`, `evnexus-dashboard-service`, `evnexus-auth-db`, `evnexus-map-db`, `evnexus-payment-db`, `evnexus-dashboard-db`, `evnexus-kafka`. Changing the Compose project does not scope these names, explaining the existing `/evnexus-kafka` conflict.

Its host mappings are 5000–5004 for APIs, 3307–3310 for databases, and 9092 for Kafka, bound to all interfaces. These conflict regardless of project name. Its network `evnexus-network` and five named volumes are normally project-scoped (not external or globally named), but the failed run already created `evnexus-e2e_*` resources. We do not adopt, delete, rename, stop, or overwrite those resources.

| Resource | New isolated configuration |
|---|---|
| Project | `evnexus-e2e-playwright` (separate from `docker` and the attempted `evnexus-e2e`) |
| Containers | Compose-generated `evnexus-e2e-playwright-<service>-1`; no `container_name` |
| Network | `evnexus-e2e-playwright_isolated`; service DNS resolves only within this network |
| Volumes | Project-prefixed `auth-data`, `map-data`, `payment-data`, `dashboard-data`, `kafka-data`, `mail-data` |
| Gateway | `127.0.0.1:15000` |
| Auth / Map / Payment / Dashboard | `127.0.0.1:15001` / `15002` / `15003` / `15004` |
| Databases / Kafka | No host publishing; only private service ports 3306 / 9092 |
| Mailpit inbox | `http://127.0.0.1:18025`; SMTP is private `mailpit:1025` |
| Database schemas | `evnexus_auth_e2e`, `evnexus_map_e2e`, `evnexus_payment_e2e`, `evnexus_dashboard_e2e` |
| Secrets | Randomly generated into ignored root `.env.e2e-playwright.local`; never printed |

The standalone file intentionally does not extend/merge the development file, avoiding inherited names, ports, mounts and secrets. It explicitly configures the same lowercase Kafka topic `charging-session-completed` for producer/consumer. SMTP uses the real sender against a private Mailpit inbox, with no Internet mail delivery. Mailpit's image and SMTP/UI roles follow its [official Docker documentation](https://mailpit.axllent.org/docs/install/docker/).

## First-time startup (Windows CMD)

Prerequisites: Docker Desktop running with Linux containers, Node/npm installed, and ports 15000–15004 / 18025 free. Run from the actual Git repository root:

```bat
cd /d "C:\Users\hirun\EVNexus (3)\EVNexus\EVNexus"
node Infrastructure\docker\e2e-local.mjs init
node Infrastructure\docker\e2e-local.mjs validate
node Infrastructure\docker\e2e-local.mjs up
node Infrastructure\docker\e2e-local.mjs status
cd Frontend
npm ci
npx playwright install chromium
npm run test:prepare
npm run test:seed
npm run test:e2e
npm run test:all
npm run test:record
npm run test:report
```

`init` is first-time only. It refuses existing local secret/state files or project-prefixed resources, checks ports before writing anything, records the old containers/volumes/networks, then generates secrets. `validate` parses the **effective** Compose JSON in memory and rejects global container names, external/bind mounts, wrong project/network/volume names, privileged mode and unexpected/non-loopback publishing. It never prints the effective secret-bearing configuration.

`up` validates again and refuses existing containers in this project; it does not recreate or stop resources. It uses `up -d --build --no-recreate`. If startup fails, resources remain for diagnosis; do not use a reset/prune/remove command. Ask for explicit approval before making a destructive repair. `status` verifies all eleven services' ownership/running state, authenticates read-only `SELECT DATABASE(),1` probes against the four new databases, and checks that baseline container IDs/names/states, volumes and networks are preserved.

## Account preparation and real verification

`npm run test:prepare` first verifies Docker ownership/mount/network/port attestation and HTTP readiness of the gateway, authentication Swagger document, map health, payment health/database probe, dashboard scaffold endpoint, and Mailpit. Docker health checks separately verify MySQL, Kafka and Mailpit. The current standalone Dashboard service implements only the weatherforecast scaffold; company financial analytics are implemented by Payment and reached through the existing gateway route. Do not mistake the scaffold probe for business analytics coverage.

The preparation script creates random dedicated company/driver credentials and unique `@e2e.invalid` addresses, writing them only into ignored `Frontend/.env.test`. The pre-existing `.env.test` is backed up once to ignored `.env.test.before-isolated`. It saves only non-secret environment/account metadata in ignored `.e2e-artifacts/accounts.json`.

Accounts are created through the actual `/api/auth/company/register` and `/api/auth/driver/register` endpoints. Verification codes are read from email actually delivered to the isolated Mailpit inbox and submitted to `/api/auth/verify-email`. No JWT is forged and no password hash, verification flag or approval status is edited in SQL. Login is then performed normally, verifying the actual `Driver`/`CompanyAdmin` roles and email verification state. Subsequent preparation runs reuse the same account credentials.

The inspected implementation creates a company with `Pending` status but currently permits its real login with the `CompanyAdmin` role; verification does not change that status. The E2E procedure follows that existing policy and does not claim to test an administrator approval workflow. If application policy later requires separate approval, the script must fail until a legitimate administrator completes it; do not bypass it.

The new driver's **Payment-service** wallet is funded with 2000 synthetic local units through its real authenticated top-up API, using a persisted idempotency key. Existing active sessions cause preparation to stop rather than terminate them. No real card/payment provider is involved. Preparation does not touch any development/production account.

## Seed and mutation safety

`requireLocalEnvironment` requires the explicit `local-test-only` acknowledgement **and** a matching Docker attestation: all eleven running containers on the isolated network, project-prefixed storage, gateway ID matching the startup manifest and gateway publishing only on `127.0.0.1:15000`. A loopback URL alone is not accepted. The seed helper and all real E2E tests run this guard before API requests.

`npm run test:seed` authenticates real verified accounts, checks no active driver session and sufficient wallet funds, and creates one `E2E-<UUID>` station and CCS2 charger. It records project, gateway ID, API URL and data IDs in ignored `.e2e-seed.json`, and saves actual IDs to `.env.test`. Repeating it validates and reuses exactly those IDs. A manifest from another environment, inactive/missing/busy data or an incomplete seed causes a failure without overwriting it. If charger creation fails, the recorded station ID remains available for manual diagnosis; nothing is deleted automatically.

The station-creation E2E test deactivates only the unique station it created itself. The charging journey stops only its own newly created session on failure and preserves completed session/payment/history records. No original Docker resource is removed or stopped.

## Subsequent runs

The existing isolated stack is deliberately left running. Do not repeat `init` or `up` while its resources exist:

```bat
cd /d "C:\Users\hirun\EVNexus (3)\EVNexus\EVNexus"
node Infrastructure\docker\e2e-local.mjs validate
node Infrastructure\docker\e2e-local.mjs status
cd Frontend
npm run test:prepare
npm run test:seed
npm run test:e2e
npm run test:all
npm run test:record
npm run test:report
```

Secrets/configuration files, account/seed manifests, Docker diagnostics, mail contents and Playwright traces are local artifacts, not source. Traces from real E2E can include authentication requests/tokens; do not commit them or upload them to a public location. The default GitHub UI workflow still runs only synthetic/mocked UI tests and does not launch this stack.

## Verified execution

The standalone environment passed effective configuration validation and startup; all four database SQL probes and Kafka/Mailpit health checks passed. HTTP application probes passed. Account preparation and initial seed succeeded, repeated seeding reused the same station/charger, and all **seven real E2E cases passed** in the first integrated run (including QR charging, Kafka settlement, payment amount, receipt/history and wallet deduction). The final combined run on **23 November 2026 at 16:15 Asia/Colombo** passed **all 60 tests**, with **0 failed, 0 blocked, 0 skipped, 0 flaky**, exit code 0, approximately 88 seconds. Per-case results are in [VERIFIED_RESULTS.md](../../Frontend/docs/VERIFIED_RESULTS.md).

No pre-existing container, database, volume or network was deleted, renamed, stopped or adopted. The wrapper's baseline checks verify preservation. No commit, push or deployment is part of this process.
