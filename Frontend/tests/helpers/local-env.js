import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';

export function saveLocalEnv(values) {
  const file = '.env.test';
  if (existsSync(file) && !existsSync('.env.test.before-isolated')) copyFileSync(file, '.env.test.before-isolated');
  const existing = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const remaining = { ...values };
  const lines = existing.split(/\r?\n/).map(line => {
    const key = line.match(/^([A-Z_]+)=/)?.[1];
    if (key && Object.hasOwn(remaining, key)) {
      const value = remaining[key];
      delete remaining[key];
      return `${key}=${value}`;
    }
    return line;
  });
  lines.push(...Object.entries(remaining).map(([key, value]) => `${key}=${value}`));
  writeFileSync(file, lines.join('\n').replace(/\n+$/, '') + '\n', { mode: 0o600 });
  Object.assign(process.env, values);
}
