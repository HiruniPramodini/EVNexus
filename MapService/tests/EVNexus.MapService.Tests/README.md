# MapService integration tests and CI database

The suite contains 38 xUnit cases (13 unit/domain and 25 HTTP/database integration cases). Integration cases use the real Map application in `WebApplicationFactory<Program>` and real MySQL; responses and repositories are not replaced.

## Configuration

Connection settings are chosen in this order:

1. `MAP_TEST_CONNECTION_STRING` (preferred; scoped to Map tests).
2. `ConnectionStrings__DefaultConnection` (compatible with existing .NET configuration).
3. Explicit `MAP_DB_PASSWORD` plus optional `MAP_TEST_DB_HOST`, `MAP_TEST_DB_PORT`, `MAP_TEST_DB_NAME`, `MAP_TEST_DB_USER`. Defaults are loopback, 3306, `map_db_test`, `evnexus_ci`; there is no default password.

The fixture does not read application `.env` files. It requires a loopback host, an explicit username/nonempty password, and a database name ending `_test` or `_e2e`. The connection-string builder handles escaping. Invalid connection-string values are not echoed in configuration errors. These guards reduce accidental targeting; the operator must still ensure the database belongs exclusively to this test run.

## CI behavior

The Map-only workflow and proposed full-pipeline update use a fresh `mysql:8.0` Actions service with database `map_db_test`, user `evnexus_ci`, password `ci_map_only_password`, and root password `ci_map_root_only_password`. These are intentionally public, disposable CI-only values, not application secrets. The runner chooses a free mapped host port; the workflow supplies that port explicitly to the test connection string. No production/Azure/shared database is contacted.

The container health check is followed by an authenticated `SELECT 1` readiness loop for the actual test user/database. Only then are tests started. Application startup calls the existing `IDatabaseInitializer.InitializeAsync()` in Map `Program.cs`, creating the supported schema. No duplicate SQL schema, destructive reset, test skipping, or response mocking is added. Tests generate unique tenant/user/station IDs and do not require an existing development dataset.

AuthenticationService and PaymentService commands/suites are preserved. The full-pipeline draft scopes `MAP_TEST_CONNECTION_STRING` to the Map command only. Raw TRX/coverage under `TestResults/` is now included in the existing always-upload artifact step, so an early backend failure still produces evidence. Triggers remain push/PR to main/develop plus manual dispatch, and repository permission is read-only. Node 22 replaces Node 20 to match the frontend dependency engines.

## Local Windows PowerShell verification

Use a new MySQL 8 container on a confirmed unused loopback port. Do not use or stop the existing EVNexus database containers. This task created `evnexus-map-ci-validation-20261123` on port 13386, with fresh container storage and the disposable CI values above. It was left running; no existing resources were replaced or removed.

After an authenticated readiness check succeeds:

```powershell
$env:MAP_TEST_CONNECTION_STRING = 'Server=127.0.0.1;Port=13386;Database=map_db_test;User=evnexus_ci;Password=ci_map_only_password;'
dotnet test MapService/tests/EVNexus.MapService.Tests/EVNexus.MapService.Tests.csproj --configuration Release --logger 'trx;LogFileName=map-tests.trx' --results-directory Frontend/.e2e-artifacts/map-ci-results
```

Schema verification used a read-only `SHOW TABLES` query and confirmed `stations`, `chargers`, `charging_sessions`. Starting tests before MySQL finishes initialization initially produced stream errors locally; after the authenticated readiness gate all 38 cases passed. No application/schema fix or assertion change was needed.

## Verified results and outstanding integration

Local verification on 23 November 2026: Map **38 passed / 0 failed / 0 skipped**; Authentication **192 passed / 0 failed / 0 skipped**; Payment **63 passed / 0 failed / 0 skipped**. The standard connection-string key was also verified with a real station-creation case. Reports are ignored local artifacts under `Frontend/.e2e-artifacts`. The Dashboard test project is unchanged and currently contains an empty scaffold test; its result does not establish analytics behavior.

The unchanged Dashboard scaffold case passed (1/1). All **60 Playwright cases passed**, including the seven real integrated E2E journeys, against the existing isolated Playwright stack. Both workflow YAML files parsed and passed local service/readiness/permission/artifact contract checks. No GitHub run has been triggered or observed for this fix.

The full `testing-pipeline.yml` is inherited from main in PR #30's merge configuration; it does not exist in this feature branch's original 18 commits. This update is based on that effective main version and preserves the other test stages. Integrate it with main before pushing: adding a differently modified workflow on both branches can otherwise produce an add/add conflict. Do not rewrite the original testing commits to integrate it.

GitHub-hosted execution, Stryker, the inherited Selenium runner and JMeter stages have not been verified by this local database test. The inherited Stryker `|| true` behavior is unchanged and is not evidence of an enforced mutation gate. Do not describe the full GitHub pipeline as green until an actual remote run confirms it.

## Separate submodule warning

`git ls-files --stage EVNexus` shows a mode-160000 gitlink, but there is no `.gitmodules` mapping. `git submodule status` reproduces the warning. This is distinct from the missing database configuration. Checkout explicitly leaves submodule fetching disabled, but credential cleanup may still traverse gitlinks in [checkout's implementation](https://github.com/actions/checkout/blob/v4/src/git-auth-helper.ts). No gitlink, directory or `.gitmodules` structure was removed/changed. Repairing the repository's intended submodule structure requires a separate decision; cleanup warning removal has not been claimed verified.
