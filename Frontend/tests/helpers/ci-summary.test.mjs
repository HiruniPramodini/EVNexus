import test from 'node:test';
import assert from 'node:assert/strict';
import { expected, summarize, markdown, junit } from './ci-summary.js';

const execution = { exitCode: '0', outcome: 'success', cleanup: 'success' };
function fixture() {
  return { errors: [], stats: { expected: 60, unexpected: 0, flaky: 0, skipped: 0, duration: 1000 }, suites: [{ specs: Object.entries(expected).flatMap(([projectName, ids]) => ids.map(id => ({ title: `${id} scenario`, tests: [{ projectName, status: 'expected', expectedStatus: 'passed', results: [{ status: 'passed', duration: 10 }] }] }))) }] };
}
test('complete 53 UI and 7 E2E results pass with accurate duration', () => {
  const report = fixture(); const result = summarize(report, fixture(), execution);
  assert.equal(result.success, true); assert.equal(result.counts.ui.passed, 53); assert.equal(result.counts.e2e.passed, 7);
  assert.equal(result.passRate, 100); assert.equal(result.durationMs, 1000);
});
test('missing results, duplicate identities, global errors and setup failures never pass', () => {
  for (const mutation of [r => r.suites[0].specs.pop(), r => r.suites[0].specs.push(r.suites[0].specs[0]), r => r.errors.push({ message: 'secret' })]) {
    const report = fixture(); mutation(report); assert.equal(summarize(report, fixture(), execution).success, false);
  }
  const absent = summarize(null, null, {});
  assert.equal(absent.counts.total.missing, 60); assert.equal(absent.passRate, 0); assert.equal(absent.success, false);
  assert.equal(summarize(fixture(), fixture(), { ...execution, cleanup: 'failure' }).success, false);
  assert.equal(summarize(fixture(), fixture(), { ...execution, exitCode: '1' }).success, false);
});
test('skips, flakes, blocked failures and interruptions remain distinct and fail strict gate', () => {
  const report = fixture(); const specs = report.suites[0].specs;
  specs[0].tests[0].results = [{ status: 'skipped' }];
  specs[1].tests[0].results = [{ status: 'failed' }, { status: 'passed' }];
  specs[1].tests[0].status = 'flaky';
  specs[2].tests[0].results = [{ status: 'failed', error: { message: 'BLOCKED: secret-token' } }];
  specs[3].tests[0].results = [{ status: 'interrupted' }];
  const result = summarize(report, fixture(), execution);
  assert.equal(result.counts.total.skipped, 1); assert.equal(result.counts.total.flaky, 1);
  assert.equal(result.counts.total.failed, 1); assert.equal(result.counts.total.blocked, 1);
  assert.equal(result.counts.total.interrupted, 1); assert.equal(result.passRate, 93.33); assert.equal(result.success, false);
});
test('raw secrets, unknown titles, output, config and attachment paths cannot enter reports', () => {
  const report = fixture(); report.config = { password: 'SENSITIVE_SENTINEL' };
  const t = report.suites[0].specs[0].tests[0];
  report.suites[0].specs[0].title += ' SENSITIVE_SENTINEL';
  t.results[0].stdout = ['SENSITIVE_SENTINEL']; t.results[0].attachments = [{ path: 'SENSITIVE_SENTINEL' }];
  t.results[0].error = { message: 'SENSITIVE_SENTINEL' };
  const result = summarize(report, fixture(), execution);
  assert.ok(!JSON.stringify(result).includes('SENSITIVE_SENTINEL'));
  assert.ok(!markdown(result).includes('SENSITIVE_SENTINEL')); assert.ok(!junit(result).includes('SENSITIVE_SENTINEL'));
});
test('inventory changes and expected-failure annotations cannot disguise missing coverage', () => {
  const inventory = fixture(); inventory.suites[0].specs.pop();
  assert.equal(summarize(fixture(), inventory, execution).success, false);
  const report = fixture(); report.suites[0].specs[0].tests[0].expectedStatus = 'failed';
  assert.equal(summarize(report, fixture(), execution).success, false);
  const malformed = fixture(); delete malformed.stats.duration;
  assert.equal(summarize(malformed, fixture(), execution).success, false);
});
