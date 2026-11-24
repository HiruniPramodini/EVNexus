import test from 'node:test';
import assert from 'node:assert/strict';
import { requireHostedCI, validateCleanupResources, waitUntilReady } from './e2e-ci.mjs';

const project = 'evnexus-e2e-playwright';
const saved = { identity: { run: '1', attempt: '1', job: 'playwright' }, baseline: { containers: [{ id: 'old123' }], volumes: ['development-data'], networks: ['development'] } };
const labels = { 'com.docker.compose.project': project, 'io.evnexus.playwright-ci': '1/1/playwright' };
const container = () => ({ Id: 'new123', Name: `/${project}-api-gateway-1`, Config: { Labels: { ...labels, 'com.docker.compose.service': 'api-gateway' } }, NetworkSettings: { Networks: { [`${project}_isolated`]: {} } }, Mounts: [] });
test('cleanup rejects local/self-hosted execution', () => {
  assert.throws(() => requireHostedCI({}));
  assert.throws(() => requireHostedCI({ GITHUB_ACTIONS: 'true', RUNNER_ENVIRONMENT: 'self-hosted' }));
  requireHostedCI({ GITHUB_ACTIONS: 'true', RUNNER_ENVIRONMENT: 'github-hosted', GITHUB_RUN_ID: '1', GITHUB_RUN_ATTEMPT: '1', GITHUB_JOB: 'playwright' });
});
test('cleanup accepts empty and partial owned stacks', () => {
  validateCleanupResources(saved, [], [], []);
  validateCleanupResources(saved, [container()], [], []);
  validateCleanupResources(saved, [container()], [{ Name: `${project}_auth-data`, Labels: labels }], [{ Name: `${project}_isolated`, Labels: labels, Containers: { new123: {} } }]);
});
test('cleanup refuses baseline, foreign mounts, foreign networks and unknown services', () => {
  for (const mutate of [c => c.Id = 'old123abcdef', c => c.Mounts.push({ Type: 'bind', Name: '/data' }), c => c.NetworkSettings.Networks.development = {}, c => c.Config.Labels['com.docker.compose.service'] = 'foreign', c => c.Config.Labels['io.evnexus.playwright-ci'] = 'another-run']) {
    const c = container(); mutate(c); assert.throws(() => validateCleanupResources(saved, [c], [], []));
  }
  assert.throws(() => validateCleanupResources(saved, [], [{ Name: 'development-data' }], []));
  assert.throws(() => validateCleanupResources(saved, [], [{ Name: `${project}_auth-data`, Labels: {} }], []));
  assert.throws(() => validateCleanupResources(saved, [], [{ Name: `${project}_unexpected`, Labels: { 'com.docker.compose.project': project } }], []));
  assert.throws(() => validateCleanupResources(saved, [], [], [{ Name: `${project}_isolated`, Labels: labels, Containers: { foreign: {} } }]));
});
test('readiness retries read-only failures and respects its deadline', async () => {
  let time = 0, attempts = 0;
  const timing = { timeoutMs: 10, intervalMs: 2, now: () => time, sleep: async ms => { time += ms; } };
  await waitUntilReady(async () => ++attempts === 3, timing);
  assert.equal(attempts, 3);
  await assert.rejects(waitUntilReady(async () => { throw new Error('not ready'); }, timing), /deadline/);
  assert.equal(time, 14);
});
