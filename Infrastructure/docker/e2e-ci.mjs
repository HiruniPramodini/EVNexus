import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { project } from './e2e-local.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const ownerPath = path.join(root, '.e2e-artifacts/ci-owner.json');
const overridePath = path.join(root, '.e2e-artifacts/ci-compose.json');
const statePath = path.join(root, '.e2e-playwright-state.json');
const compose = ['compose', '--project-name', project, '--env-file', path.join(root, '.env.e2e-playwright.local'), '-f', path.join(root, 'Infrastructure/docker/compose.e2e.yml'), '-f', overridePath];
const services = ['api-gateway', 'authentication-service', 'map-service', 'payment-service', 'dashboard-service', 'auth-db', 'map-db', 'payment-db', 'dashboard-db', 'kafka', 'mailpit'];
const volumes = ['auth-data', 'map-data', 'payment-data', 'dashboard-data', 'kafka-data', 'mail-data'];
const run = (command, args, timeout = 20_000) => execFileSync(command, args, { cwd: root, encoding: 'utf8', timeout, maxBuffer: 20 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const docker = (...args) => run('docker', args);
const local = command => run(process.execPath, ['Infrastructure/docker/e2e-local.mjs', command], 30_000);
const lines = value => value.split(/\r?\n/).filter(Boolean);
const identity = () => ({ run: process.env.GITHUB_RUN_ID, attempt: process.env.GITHUB_RUN_ATTEMPT, job: process.env.GITHUB_JOB });
const ownershipLabel = 'io.evnexus.playwright-ci';
const ownershipValue = saved => `${saved.identity.run}/${saved.identity.attempt}/${saved.identity.job}`;
function override(saved) {
  const labels = { [ownershipLabel]: ownershipValue(saved) };
  return { services: Object.fromEntries(services.map(name => [name, { labels }])), volumes: Object.fromEntries(volumes.map(name => [name, { labels }])), networks: { isolated: { labels } } };
}

export function requireHostedCI(env = process.env) {
  if (env.GITHUB_ACTIONS !== 'true' || env.RUNNER_ENVIRONMENT !== 'github-hosted' || !env.GITHUB_RUN_ID || !env.GITHUB_RUN_ATTEMPT || !env.GITHUB_JOB) throw new Error('Dedicated GitHub-hosted CI required.');
}
function owner() {
  const saved = JSON.parse(readFileSync(ownerPath));
  if (saved.project !== project || JSON.stringify(saved.identity) !== JSON.stringify(identity())) throw new Error('CI ownership mismatch.');
  const state = JSON.parse(readFileSync(statePath));
  if (state.createdAt !== saved.createdAt || JSON.stringify(state.baseline) !== JSON.stringify(saved.baseline)) throw new Error('Startup manifest mismatch.');
  if (JSON.stringify(JSON.parse(readFileSync(overridePath))) !== JSON.stringify(override(saved))) throw new Error('CI label-only Compose override changed.');
  return saved;
}
function snapshot() {
  const ids = lines(docker('ps', '-aq', '--filter', `label=com.docker.compose.project=${project}`));
  return ids.length ? JSON.parse(docker('inspect', ...ids)) : [];
}

// This deliberately accepts stopped/partial stacks, but never baseline resources.
export function validateCleanupResources(saved, containers, volumeInfo, networkInfo) {
  for (const c of containers) {
    if (c.Config.Labels?.[ownershipLabel] !== ownershipValue(saved) || c.Config.Labels?.['com.docker.compose.project'] !== project || !services.includes(c.Config.Labels?.['com.docker.compose.service']) || !c.Name.startsWith(`/${project}-`) || saved.baseline.containers.some(old => c.Id.startsWith(old.id))) throw new Error('Unsafe cleanup container.');
    if (Object.keys(c.NetworkSettings.Networks).some(n => n !== `${project}_isolated`)) throw new Error('Unexpected attached network.');
    for (const m of c.Mounts) if (m.Type !== 'volume' || !volumes.some(v => m.Name === `${project}_${v}`)) throw new Error('Unexpected cleanup mount.');
  }
  for (const v of volumeInfo) if (v.Labels?.[ownershipLabel] !== ownershipValue(saved) || saved.baseline.volumes.includes(v.Name) || v.Labels?.['com.docker.compose.project'] !== project || !volumes.some(name => v.Name === `${project}_${name}`)) throw new Error('Unsafe cleanup volume.');
  for (const n of networkInfo) {
    if (n.Labels?.[ownershipLabel] !== ownershipValue(saved) || saved.baseline.networks.includes(n.Name) || n.Name !== `${project}_isolated` || n.Labels?.['com.docker.compose.project'] !== project) throw new Error('Unsafe cleanup network.');
    if (Object.keys(n.Containers || {}).some(id => !containers.some(c => c.Id === id))) throw new Error('Foreign container on testing network.');
  }
}
function baselinePreserved(saved) {
  const current = lines(docker('ps', '-a', '--format', '{{json .}}')).map(JSON.parse);
  for (const c of saved.baseline.containers) if (!current.some(now => now.ID === c.id && now.Names === c.name && now.State === c.state)) throw new Error('Baseline container changed.');
  for (const [type, command] of [['volumes', 'volume'], ['networks', 'network']]) {
    const names = lines(docker(command, 'ls', '--format', '{{.Name}}'));
    if (!saved.baseline[type].every(name => names.includes(name))) throw new Error('Baseline storage/network missing.');
  }
}
export async function waitUntilReady(probe, { timeoutMs = 240_000, intervalMs = 2000, now = Date.now, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  const deadline = now() + timeoutMs;
  while (now() < deadline) {
    try { if (await probe(deadline)) return; } catch { /* Only read-only probes are retried. */ }
    await sleep(Math.min(intervalMs, Math.max(0, deadline - now())));
  }
  throw new Error('Dedicated backend readiness deadline exceeded.');
}
async function main(command) {
  requireHostedCI();
  if (command === 'start') {
    if (existsSync(ownerPath)) throw new Error('Refusing existing CI ownership record.');
    local('init');
    const state = JSON.parse(readFileSync(statePath));
    mkdirSync(path.dirname(ownerPath), { recursive: true });
    const saved = { project, identity: identity(), createdAt: state.createdAt, baseline: state.baseline };
    // The generated override can only add per-run labels; the source stack stays unchanged.
    writeFileSync(overridePath, JSON.stringify(override(saved)), { flag: 'wx', mode: 0o600 });
    writeFileSync(ownerPath, JSON.stringify(saved), { flag: 'wx', mode: 0o600 });
    // Claim ownership before startup so partial build/start failures can be cleaned.
    local('validate');
    if (snapshot().length) throw new Error('Refusing existing project containers.');
    // Execute Compose directly so its timeout targets the actual startup process,
    // not a parent Node wrapper that could leave a startup child running.
    run('docker', [...compose, 'up', '-d', '--build', '--no-recreate'], 720_000);
    state.gatewayId = docker(...compose, 'ps', '-q', 'api-gateway');
    if (!/^[a-f0-9]{64}$/.test(state.gatewayId)) throw new Error('Missing gateway identity.');
    writeFileSync(statePath, JSON.stringify(state, null, 2), { mode: 0o600 });
    console.log('Dedicated backend provisioned.');
  } else if (command === 'wait') {
    owner();
    await waitUntilReady(async deadline => {
      // Run the existing attestation in a time-limited child; a stalled Docker
      // daemon must not turn the readiness loop into an unbounded wait.
      run(process.execPath, ['--input-type=module', '-e', "import { assertIsolatedStack } from './Infrastructure/docker/e2e-local.mjs'; assertIsolatedStack();"], Math.min(20_000, Math.max(1, deadline - Date.now())));
      if (snapshot().some(c => c.State.Health && c.State.Health.Status !== 'healthy')) return false;
      for (const url of [
        'http://127.0.0.1:15000/api/driver/stations/nearby?latitude=6.9271&longitude=79.8612&radiusKm=50',
        'http://127.0.0.1:15001/swagger/v1/swagger.json', 'http://127.0.0.1:15002/health',
        'http://127.0.0.1:15003/health', 'http://127.0.0.1:15004/weatherforecast', 'http://127.0.0.1:18025/readyz',
      ]) {
        if (Date.now() >= deadline) return false;
        const response = await fetch(url, { signal: AbortSignal.timeout(Math.min(5000, Math.max(1, deadline - Date.now()))) });
        if (!response.ok) return false;
        await response.body?.cancel();
      }
      local('status');
      return true;
    });
    console.log('All eleven services and authenticated database/application probes ready.');
  } else if (command === 'diagnostics') {
    mkdirSync(path.join(root, 'Frontend/ci-report'), { recursive: true });
    const data = [];
    if (existsSync(ownerPath)) {
      owner();
      for (const c of snapshot()) {
        const service = c.Config.Labels?.['com.docker.compose.service'];
        if (services.includes(service)) data.push({ service, running: c.State.Running === true, health: ['healthy', 'unhealthy', 'starting'].includes(c.State.Health?.Status) ? c.State.Health.Status : 'none' });
      }
    }
    writeFileSync(path.join(root, 'Frontend/ci-report/services.json'), JSON.stringify(data, null, 2));
    console.log('Allowlisted service state diagnostics recorded; no logs/environment exported.');
  } else if (command === 'cleanup') {
    if (!existsSync(ownerPath)) { console.log('No CI-owned stack claimed; nothing removed.'); return; }
    const saved = owner();
    local('validate');
    const containers = snapshot();
    // Inspect both labelled resources and matching names. An unlabelled volume
    // created after init must never be silently adopted by Compose teardown.
    const volumeNames = [...new Set([...lines(docker('volume', 'ls', '--format', '{{.Name}}')).filter(name => name.startsWith(`${project}_`)), ...lines(docker('volume', 'ls', '--filter', `label=com.docker.compose.project=${project}`, '--format', '{{.Name}}'))])];
    const networkNames = [...new Set([...lines(docker('network', 'ls', '--format', '{{.Name}}')).filter(name => name.startsWith(`${project}_`)), ...lines(docker('network', 'ls', '--filter', `label=com.docker.compose.project=${project}`, '--format', '{{.Name}}'))])];
    const volumeInfo = volumeNames.length ? JSON.parse(docker('volume', 'inspect', ...volumeNames)) : [];
    const networkInfo = networkNames.length ? JSON.parse(docker('network', 'inspect', ...networkNames)) : [];
    validateCleanupResources(saved, containers, volumeInfo, networkInfo);
    baselinePreserved(saved);
    run('docker', [...compose, 'down', '--volumes', '--timeout', '20'], 90_000);
    if (snapshot().length || lines(docker('volume', 'ls', '--filter', `label=com.docker.compose.project=${project}`, '-q')).length || lines(docker('network', 'ls', '--filter', `label=com.docker.compose.project=${project}`, '-q')).length) throw new Error('Dedicated resources remain after cleanup.');
    baselinePreserved(saved);
    console.log('Only dedicated CI resources removed; baseline preserved.');
  } else throw new Error('Expected start, wait, diagnostics or cleanup.');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv[2]).catch(() => { console.error('Playwright CI lifecycle failed; raw Docker output withheld to protect secrets.'); process.exitCode = 1; });
}
