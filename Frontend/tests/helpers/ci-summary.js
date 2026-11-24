import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const numbered = (prefix, count) => Array.from({ length: count }, (_, i) => `${prefix}-${String(i + 1).padStart(2, '0')}`);
export const expected = {
  ui: [...numbered('DA', 7), ...numbered('CA', 7), 'AUTH-01', ...numbered('NAV', 4), ...numbered('ERR', 6), ...numbered('ST', 6), ...numbered('CH', 3), ...numbered('AX', 7), ...['desktop', 'tablet', 'mobile'].flatMap(device => ['01', 'driver', 'company', 'map'].map(suffix => `RWD-${device}-${suffix}`))],
  e2e: ['REAL-AUTH-driver-01', 'REAL-AUTH-driver-02', 'REAL-AUTH-company-01', 'REAL-AUTH-company-02', 'REAL-RBAC-01', 'REAL-STATION-01', 'REAL-CHARGE-01'],
};
const expectedKeys = Object.entries(expected).flatMap(([project, ids]) => ids.map(id => `${project}/${id}`));
function flatten(report) {
  const rows = [];
  function visit(suite) {
    for (const spec of suite.specs || []) for (const test of spec.tests || []) rows.push({ spec, test, key: `${test.projectName}/${spec.title.split(' ')[0]}` });
    for (const child of suite.suites || []) visit(child);
  }
  if (report) visit(report);
  return rows;
}
const blank = () => ({ passed: 0, failed: 0, skipped: 0, flaky: 0, interrupted: 0, missing: 0, blocked: 0 });
const numeric = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;

// Allowlist output fields; never serialize raw errors, stdout, attachments, titles,
// source snippets, config, environment, requests, tokens or absolute paths.
export function summarize(report, inventory, execution = {}) {
  const issues = [];
  let actual = [], discovered = [];
  try { actual = flatten(report); discovered = flatten(inventory); } catch { issues.push('Malformed test structure'); }
  const inventoryKeys = discovered.map(row => row.key);
  if (inventoryKeys.length !== 60 || new Set(inventoryKeys).size !== 60 || expectedKeys.some(key => !inventoryKeys.includes(key))) issues.push('Inventory does not match the approved 53 UI and 7 E2E cases');
  if (!report || !report.stats || !Array.isArray(report.suites)) issues.push('Missing or malformed execution report');
  if ((report?.errors?.length || 0) > 0) issues.push('Runner reported global errors');
  if (actual.length !== new Set(actual.map(row => row.key)).size) issues.push('Duplicate executed test identities');
  if (actual.some(row => !expectedKeys.includes(row.key))) issues.push('Unexpected test identities');
  if (execution.outcome !== 'success' || execution.exitCode !== '0') issues.push('Playwright execution did not exit successfully');
  if (execution.cleanup !== 'success') issues.push('CI cleanup did not succeed');
  const counts = { ui: blank(), e2e: blank(), total: blank() };
  const rows = [];
  for (const key of expectedKeys) {
    const [project, id] = key.split('/');
    const found = actual.find(row => row.key === key);
    const attempts = Array.isArray(found?.test.results) ? found.test.results : [];
    const last = attempts.at(-1);
    let status = 'missing';
    if (last) {
      if (last.status === 'skipped') status = 'skipped';
      else if (last.status === 'interrupted') status = 'interrupted';
      else if (last.status === 'passed' && (found.test.status === 'flaky' || attempts.some(r => r.status !== 'passed'))) status = 'flaky';
      else if (last.status === 'passed' && found.test.status === 'expected' && found.test.expectedStatus === 'passed') status = 'passed';
      else status = 'failed';
    }
    const blocked = status === 'failed' && attempts.some(r => [r.error, ...(r.errors || [])].some(error => String(error?.message || '').includes('BLOCKED:')));
    counts[project][status]++; counts.total[status]++;
    if (blocked) { counts[project].blocked++; counts.total.blocked++; }
    rows.push({ project, id, status, blocked, attempts: attempts.length, durationMs: attempts.reduce((sum, r) => sum + numeric(r.duration), 0) });
  }
  if (counts.total.missing) issues.push('Expected cases have no execution result');
  if (report?.stats) {
    if (!['expected', 'unexpected', 'skipped', 'flaky'].every(field => Number.isInteger(report.stats[field]) && report.stats[field] >= 0) || typeof report.stats.duration !== 'number' || !Number.isFinite(report.stats.duration) || report.stats.duration < 0) issues.push('Malformed runner statistics');
    const statsCount = ['expected', 'unexpected', 'skipped', 'flaky'].reduce((sum, field) => sum + numeric(report.stats[field]), 0);
    if (statsCount !== actual.length) issues.push('Runner statistics do not match result inventory');
  }
  const total = counts.total;
  return {
    schemaVersion: 1, expectedTests: 60, observedTests: actual.length,
    durationMs: numeric(report?.stats?.duration),
    passRate: Number((total.passed / 60 * 100).toFixed(2)),
    complete: issues.length === 0 && total.missing === 0 && total.interrupted === 0,
    success: issues.length === 0 && total.passed === 60,
    counts, issues: [...new Set(issues)], rows,
  };
}
export function markdown(summary) {
  const row = (label, c) => `| ${label} | ${c.passed} | ${c.failed} | ${c.skipped} | ${c.flaky} | ${c.interrupted} | ${c.missing} |`;
  return `# Individual Playwright UI/UX and real E2E\n\nResult: **${summary.success ? 'PASS' : 'FAIL / INCOMPLETE'}**\n\nExpected: **60** (53 UI, 7 real E2E). Observed result entries: **${summary.observedTests}**.\nDuration: **${(summary.durationMs / 1000).toFixed(2)} seconds**. Pass rate: **${summary.passRate}%** (strict passes / 60 expected cases).\n\n| Suite | Passed | Failed | Skipped | Flaky | Interrupted | Missing |\n|---|---:|---:|---:|---:|---:|---:|\n${row('UI/UX', summary.counts.ui)}\n${row('Real E2E', summary.counts.e2e)}\n${row('Total', summary.counts.total)}\n\nBlocked prerequisite failures: **${summary.counts.total.blocked}** (included in failed). Retries are disabled in this full CI job.\n\n${summary.issues.map(issue => `- ${issue}`).join('\n')}\n\nArtifacts: download the individual Playwright artifact from this run for index.html, results.json, results.xml and allowlisted service states. Raw errors, traces, screenshots and network payloads are withheld because they can contain credentials.\n`;
}
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
export function junit(summary) {
  const cases = summary.rows.map(row => `<testcase classname="${row.project}" name="${row.id}" time="${(row.durationMs / 1000).toFixed(3)}">${row.status === 'skipped' ? '<skipped/>' : row.status === 'passed' ? '' : `<failure message="${row.status}">${row.blocked ? 'Dedicated environment prerequisite blocked' : 'See safe JSON case status'}</failure>`}</testcase>`);
  if (summary.issues.length) cases.push(`<testcase classname="infrastructure" name="report-integrity"><failure message="Incomplete or unsuccessful CI run">${escape(summary.issues.join('; '))}</failure></testcase>`);
  const failures = summary.rows.filter(row => !['passed', 'skipped'].includes(row.status)).length + (summary.issues.length ? 1 : 0);
  return `<?xml version="1.0" encoding="UTF-8"?><testsuites><testsuite name="Individual Playwright" tests="${cases.length}" failures="${failures}" skipped="${summary.counts.total.skipped}" time="${(summary.durationMs / 1000).toFixed(3)}">${cases.join('')}</testsuite></testsuites>\n`;
}
function main() {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const frontend = path.join(root, 'Frontend');
  const read = file => { try { return JSON.parse(readFileSync(path.join(frontend, file), 'utf8')); } catch { return null; } };
  const summary = summarize(read('test-results/results.json'), read('test-inventory.json'), {
    exitCode: process.env.PLAYWRIGHT_EXIT_CODE, outcome: process.env.PLAYWRIGHT_STEP_OUTCOME, cleanup: process.env.E2E_CLEANUP_OUTCOME,
  });
  const sha = process.env.GITHUB_SHA || '';
  if (/^[a-f0-9]{40}$/.test(sha)) summary.commit = sha;
  const text = markdown(summary);
  const dir = path.join(frontend, 'ci-report');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'results.json'), JSON.stringify(summary, null, 2));
  writeFileSync(path.join(dir, 'results.xml'), junit(summary));
  writeFileSync(path.join(dir, 'summary.md'), text);
  writeFileSync(path.join(dir, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Individual Playwright results</title><style>body{font:16px system-ui;max-width:1100px;margin:2rem auto;padding:1rem}table{border-collapse:collapse;width:100%}td,th{padding:.5rem;border:1px solid #aaa;text-align:left}pre{white-space:pre-wrap}</style><h1>Individual Playwright results</h1><p>Allowlisted report generated from actual Playwright JSON; raw native reports are not published.</p><pre>${escape(text)}</pre><table><caption>Actual per-case outcomes</caption><tr><th>Suite</th><th>Case</th><th>Outcome</th><th>Seconds</th></tr>${summary.rows.map(row => `<tr><td>${row.project}</td><td>${row.id}</td><td>${row.status}</td><td>${(row.durationMs / 1000).toFixed(3)}</td></tr>`).join('')}</table></html>`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
  console.log(`Individual report: ${summary.counts.total.passed}/60 strict passes; ${summary.success ? 'PASS' : 'FAIL / INCOMPLETE'}.`);
  if (!summary.success) process.exitCode = 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
