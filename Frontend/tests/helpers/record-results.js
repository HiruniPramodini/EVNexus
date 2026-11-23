import { readFile, writeFile, mkdir } from 'node:fs/promises';

const report = JSON.parse(await readFile('test-results/results.json', 'utf8'));
const rows = [];
function expectedOutcome(id) {
  if (/^(DA|CA)-0[1-4]$/.test(id)) return 'Correct required/format errors; no login request';
  if (/^(DA|CA)-05$/.test(id)) return '401 message; no token; stays on login';
  if (/^(DA|CA)-06$/.test(id)) return 'Dashboard reached; logout clears session; protected content absent';
  if (/^(DA|CA)-07$/.test(id)) return 'Network error displayed; submit re-enabled';
  if (id.startsWith('AX-')) return 'No selected WCAG A/AA violations; axe evidence attached';
  if (id.startsWith('RWD-')) return 'Usable controls/navigation at viewport; no document overflow';
  if (/^REAL-AUTH-.*-01$/.test(id)) return 'Real dashboard login; logout and refresh protection';
  if (/^REAL-AUTH-.*-02$/.test(id)) return 'Real service 401; visible error; no token';
  return {
    'AUTH-01': 'Keyboard order, password toggle and validation work',
    'NAV-01': 'All driver destinations show expected page content/URL',
    'NAV-02': 'Company KPIs and all destinations show expected content/URL',
    'NAV-03': 'Useful driver fallback; no company management controls',
    'NAV-04': 'Anonymous visitor sees landing; no company controls',
    'ERR-01': 'History empty message; no table',
    'ERR-02': 'History failure message instead of empty-success state',
    'ERR-03': 'Wallet error then successful Retry and transaction content',
    'ERR-04': 'Station service error; no fabricated station',
    'ERR-05': 'Understandable no-stations state',
    'ERR-06': 'Wallet error with enabled Retry',
    'ST-01': 'Search, station details and QR upload/cancel work',
    'ST-02': 'Required name validation; no POST',
    'ST-03': 'Coordinate validation; no POST',
    'ST-04': 'New station row; exactly one station and charger POST',
    'ST-05': 'Available charger details shown',
    'ST-06': 'Save failure displayed; form values retained; retry enabled',
    'CH-01': 'Foreign QR rejected locally; cannot start',
    'CH-02': 'Inactive station error; cannot start',
    'CH-03': 'Unavailable charger error; no active session; retry enabled',
    'REAL-RBAC-01': 'Real backend 403; no station management UI',
    'REAL-STATION-01': 'Real station/default charger created; only own station deactivated',
    'REAL-CHARGE-01': 'Real start/stop, completion receipt/history, settlement and exact wallet deduction',
  }[id] || 'All documented assertions succeed';
}
function collect(suite) {
  for (const spec of suite.specs || []) {
    for (const test of spec.tests) {
      const result = test.results.at(-1);
      const message = result?.error?.message?.replace(/\u001b\[[0-9;]*m/g, '') || '';
      const blocked = message.includes('BLOCKED:');
      rows.push({
        id: spec.title.split(' ')[0],
        description: spec.title.replace(/ @\w+/g, ''),
        type: test.projectName === 'e2e' ? 'Real E2E' : 'Mocked UI',
        classification: spec.title.includes('negative:') ? 'Negative' : spec.title.includes('quality:') ? 'Quality' : 'Positive',
        expected: expectedOutcome(spec.title.split(' ')[0]),
        status: blocked ? 'BLOCKED (runner failure, not skipped)' : result?.status === 'skipped' ? 'SKIPPED' : test.status === 'expected' && result?.status === 'passed' ? 'PASSED' : test.status === 'flaky' ? 'FLAKY' : result?.status?.toUpperCase() || test.status,
        message: message.split('\n').filter(Boolean).slice(0, 3).join(' ').replaceAll('|', '\\|'),
      });
    }
  }
  for (const child of suite.suites || []) collect(child);
}
collect(report);
const date = new Date(report.stats.startTime).toLocaleString('en-GB', { timeZone: 'Asia/Colombo', hour12: false });
const counts = rows.reduce((acc, row) => { acc[row.status] = (acc[row.status] || 0) + 1; return acc; }, {});
const totals = {
  total: rows.length,
  passed: counts.PASSED || 0,
  failed: rows.filter(row => !['PASSED', 'SKIPPED', 'FLAKY'].includes(row.status) && !row.status.startsWith('BLOCKED')).length,
  blocked: rows.filter(row => row.status.startsWith('BLOCKED')).length,
  skipped: counts.SKIPPED || 0,
  flaky: counts.FLAKY || 0,
};
await mkdir('docs', { recursive: true });
await writeFile('docs/VERIFIED_RESULTS.md', `# Verified browser execution\n\nStudent: Hiruni Pramodini (IT24610786)\n\nRun started: ${date} Asia/Colombo. Generated from Playwright JSON results; counts are actual observations.\n\nCommand: \`npm run test:all\` (unless overridden by the runner command recorded in the JSON report).\n\nResults: ${Object.entries(counts).map(([status, count]) => `${count} ${status}`).join('; ')}.\n\nNo failed or blocked tests are treated as passing. Missing E2E prerequisites produce failing tests rather than silent skips. These results are a local Windows Chromium execution. Real backend execution is established only by the Real E2E rows marked PASSED; blocked/failed rows establish no success. GitHub-hosted CI and other operating systems remain unverified.\n\n| Test ID | Feature / scenario | Type | Classification | Expected result | Execution status | Failure detail |\n|---|---|---|---|---|---|---|\n${rows.map(row => `| ${row.id} | ${row.description} | ${row.type} | ${row.classification} | ${row.expected} | ${row.status} | ${row.message} |`).join('\n')}\n`);
console.log(JSON.stringify(counts));
await writeFile('docs/VERIFIED_RESULTS.md', `\nExecution totals: **${totals.passed} passed, ${totals.failed} failed, ${totals.blocked} blocked, ${totals.skipped} skipped, ${totals.flaky} flaky; ${totals.total} cases total.**\n`, { flag: 'a' });
