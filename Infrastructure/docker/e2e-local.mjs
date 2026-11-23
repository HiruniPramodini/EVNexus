import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import net from 'node:net';

const root = fileURLToPath(new URL('../../', import.meta.url));
export const project = 'evnexus-e2e-playwright';
const envFile = path.join(root, '.env.e2e-playwright.local');
const stateFile = path.join(root, '.e2e-playwright-state.json');
const composeFile = path.join(root, 'Infrastructure/docker/compose.e2e.yml');
const args = ['compose', '--project-name', project, '--env-file', envFile, '-f', composeFile];
const run = (...argv) => execFileSync('docker', argv, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const lines = value => value ? value.split(/\r?\n/).filter(Boolean) : [];
function resources() {
  return {
    containers: lines(run('ps', '-a', '--format', '{{json .}}')).map(JSON.parse).map(c => ({ id: c.ID, name: c.Names, state: c.State })),
    volumes: lines(run('volume', 'ls', '--format', '{{.Name}}')),
    networks: lines(run('network', 'ls', '--format', '{{.Name}}')),
  };
}
export function assertIsolatedStack() {
  if (!existsSync(stateFile)) throw new Error('BLOCKED: isolated Docker environment attestation is missing. Run e2e-local.mjs init/validate/up.');
  const state = JSON.parse(readFileSync(stateFile));
  const ids = lines(run('ps', '-a', '--filter', `label=com.docker.compose.project=${project}`, '-q'));
  if (ids.length !== 11) throw new Error('BLOCKED: expected exactly eleven isolated E2E services.');
  const containers = JSON.parse(run('inspect', ...ids));
  for (const c of containers) {
    if (!c.Name.startsWith(`/${project}-`) || !c.State.Running) throw new Error('BLOCKED: wrong container ownership or stopped E2E service.');
    if (!c.NetworkSettings.Networks[`${project}_isolated`]) throw new Error('BLOCKED: missing isolated E2E network.');
    for (const mount of c.Mounts) if (mount.Type !== 'volume' || !mount.Name.startsWith(`${project}_`)) throw new Error('BLOCKED: external or bind-mounted E2E storage.');
    if (c.Config.Labels['com.docker.compose.service'] === 'api-gateway') {
      const bound = c.NetworkSettings.Ports['8080/tcp'];
      if (bound?.length !== 1 || bound[0].HostIp !== '127.0.0.1' || bound[0].HostPort !== '15000') throw new Error('BLOCKED: unexpected gateway publishing.');
      if (state.gatewayId && state.gatewayId !== c.Id) throw new Error('BLOCKED: gateway changed since environment attestation.');
    }
  }
  return { project, apiURL: 'http://127.0.0.1:15000', mailURL: 'http://127.0.0.1:18025', state, containers };
}
function validate() {
  if (!existsSync(envFile) || !existsSync(stateFile)) throw new Error('Run init first.');
  const cfg = JSON.parse(run(...args, 'config', '--format', 'json'));
  if (cfg.name !== project || Object.keys(cfg.services).length !== 11) throw new Error('Unexpected Compose project/services.');
  for (const [name, s] of Object.entries(cfg.services)) {
    if (s.container_name || s.network_mode || s.privileged) throw new Error(`Unsafe service configuration: ${name}`);
    if (Object.keys(s.networks).join() !== 'isolated') throw new Error(`Unexpected service network: ${name}`);
    for (const port of s.ports || []) if (port.host_ip !== '127.0.0.1' || ![15000,15001,15002,15003,15004,18025].includes(Number(port.published))) throw new Error(`Unsafe publishing: ${name}`);
    for (const mount of s.volumes || []) if (mount.type !== 'volume' || !cfg.volumes[mount.source]) throw new Error(`Unsafe mount: ${name}`);
  }
  for (const v of Object.values(cfg.volumes)) if (v.external || !v.name.startsWith(`${project}_`)) throw new Error('Unsafe volume');
  for (const n of Object.values(cfg.networks)) if (n.external || n.name !== `${project}_isolated`) throw new Error('Unsafe network');
  console.log('Validated 11 project-scoped services, 6 isolated volumes, private DB/Kafka ports and loopback-only publishing. Secrets were not printed.');
  return cfg;
}

async function main(command) {
  if (command === 'init') {
    if (existsSync(envFile) || existsSync(stateFile)) throw new Error('Local configuration already exists; refusing to overwrite it. Use validate/status.');
    const baseline = resources();
    if ([...baseline.containers.map(c => c.name), ...baseline.volumes, ...baseline.networks].some(n => n.startsWith(project))) throw new Error('Project resources already exist; refusing to adopt or overwrite them.');
    for (const port of [15000,15001,15002,15003,15004,18025]) {
      await new Promise((resolve, reject) => { const s = net.createServer(); s.once('error', () => reject(new Error(`Port ${port} is not free; no resources changed.`))); s.listen(port, '127.0.0.1', () => s.close(resolve)); });
    }
    const secret = () => randomBytes(32).toString('hex');
    writeFileSync(envFile, ['E2E_DB_PASSWORD','E2E_DB_ROOT_PASSWORD','E2E_JWT_SECRET','E2E_INTERNAL_KEY','E2E_SMTP_PASSWORD'].map(key => `${key}=${secret()}`).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
    writeFileSync(stateFile, JSON.stringify({ project, createdAt: new Date().toISOString(), baseline }, null, 2), { flag: 'wx', mode: 0o600 });
    console.log('Created local-only random credentials and preserved the resource baseline; no existing Docker resource changed.');
    validate();
  } else if (command === 'validate') validate();
  else if (command === 'up') {
    validate();
    const state = JSON.parse(readFileSync(stateFile));
    if (lines(run('ps', '-a', '--filter', `label=com.docker.compose.project=${project}`, '-q')).length) throw new Error('E2E containers already exist. Use status; this command will not recreate/stop existing resources.');
    const result = spawnSync('docker', [...args, 'up', '-d', '--build', '--no-recreate'], { cwd: root, stdio: 'inherit' });
    if (result.status !== 0) throw new Error('Compose startup failed. Created resources are preserved for investigation.');
    state.gatewayId = run(...args, 'ps', '-q', 'api-gateway');
    writeFileSync(stateFile, JSON.stringify(state, null, 2));
  } else if (command === 'status') {
    const { state, containers } = assertIsolatedStack();
    const current = resources();
    for (const old of state.baseline.containers) if (!current.containers.some(c => c.id === old.id && c.name === old.name && c.state === old.state)) throw new Error(`Existing resource state changed: ${old.name}`);
    for (const type of ['volumes','networks']) if (!state.baseline[type].every(name => current[type].includes(name))) throw new Error(`Existing ${type} missing.`);
    for (const c of containers.filter(c => c.Config.Labels['com.docker.compose.service'].endsWith('-db'))) {
      const actual = run('exec', c.Id, 'sh', '-c', 'MYSQL_PWD="$MYSQL_PASSWORD" mysql -u "$MYSQL_USER" "$MYSQL_DATABASE" -N -e "SELECT DATABASE(),1"');
      const service = c.Config.Labels['com.docker.compose.service'];
      const expected = `evnexus_${service.replace('-db', '')}_e2e`;
      if (actual.split(/\s+/)[0] !== expected) throw new Error(`Wrong database for ${service}`);
      console.log(`${service}: authenticated SQL probe confirmed ${expected}`);
    }
    console.log(JSON.stringify(containers.map(c => ({ service: c.Config.Labels['com.docker.compose.service'], state: c.State.Status, health: c.State.Health?.Status || 'HTTP probe required' })), null, 2));
    console.log('Existing container IDs/names/states, volumes and networks remain preserved.');
  } else throw new Error('Usage: node Infrastructure/docker/e2e-local.mjs init|validate|up|status');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await main(process.argv[2]); } catch (error) {
    // Docker errors can embed the effective configuration: never dump stdout/stderr.
    console.error(error.status ? `Docker operation failed (exit ${error.status}); inspect the local environment without printing secrets.` : error.message);
    process.exitCode = 1;
  }
}
