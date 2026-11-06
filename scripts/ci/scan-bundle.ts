/**
 * Production bundle leak scan (`bun run ci:security`).
 *
 * Builds the SPA (`bun run build:ui`; skip with `--no-build`) and fails if any file in `src/ui/dist` contains:
 * - mock-api source paths or messages in plain text (the in-browser mock API ships only in the prototype build, over
 *   the synthetic CSV fixtures; any other build calls the real API and must not carry it);
 * - in a prototype build, the demo-account e-mails (`@claimsiq.local`): the other builds list them on the sign-in page,
 *   a prototype build lists roles;
 * - `src/server` code (paths and messages unique to the server platform modules);
 * - a server-only environment variable name (the keys of src/server/lib/config plus the keys of the planned
 *   backend; the browser-safe `VITE_` names are allowed);
 * - the service-role key (the configured value, any `sb_secret_` key, or any JWT whose payload role is
 *   `service_role`);
 * - the local demo password (`LOCAL_DEMO_PASSWORD`): demo accounts sign in on the server, so no build holds a demo
 *   password. Only that committed local value is a rule: a deployed password is never written into the repository,
 *   not even into a scan.
 * With `--prototype` it builds (or, with `--no-build`, scans) a PROTOTYPE build instead (`VITE_AUTH_MODE=prototype`,
 * into `src/ui/dist-prototype`), applies the same rules and also fails on supabase-js: its code, a chunk named
 * after it, or a Supabase origin in the Content-Security-Policy. That is the proof that a prototype build needs no
 * Supabase at run time.
 * It also checks that `index.html` carries the production Content-Security-Policy and that its script-src
 * has none of the dev-only relaxations (`'unsafe-inline'`, `'unsafe-eval'`, `ws:`).
 *
 * Findings print the file, the rule and a short context with secrets masked.
 *
 * Usage: bun scripts/ci/scan-bundle.ts [--prototype] [--no-build] [--dist <dir>]
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { LOCAL_DEMO_PASSWORD } from '../../src/server/lib/config/demo-password.js';
import { SERVER_ENV_KEYS, tryGetConfig } from '../../src/server/lib/config/index.js';
import { directiveOf } from './csp.js';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
export const DEFAULT_DIST = join(repoRoot, 'src', 'ui', 'dist');
export const PROTOTYPE_DIST = join(repoRoot, 'src', 'ui', 'dist-prototype');

/** Server variables of the planned backend that must never reach the browser either. */
export const PLANNED_SERVER_KEYS = [
  'SUPABASE_DATABASE_URL',
  'SUPABASE_DIRECT_DATABASE_URL',
  'SUPABASE_JWT_SECRET',
  'CRON_SECRET',
  'INTERNAL_JOB_SECRET',
  'STORAGE_ADAPTER',
  'SMTP_PASSWORD',
  'SMTP_USER',
] as const;

export interface BundleRule {
  readonly id: string;
  readonly description: string;
  readonly pattern: RegExp;
}

export interface BundleScanInputs {
  /** The configured service-role key, when available. */
  readonly serviceRoleKey: string | null;
  /** True for a prototype build, which must not contain supabase-js. */
  readonly prototype?: boolean;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The rules for one scan. */
export function bundleRules(inputs: BundleScanInputs): BundleRule[] {
  const serverKeys = [...new Set<string>([...SERVER_ENV_KEYS, ...PLANNED_SERVER_KEYS])];
  const rules: BundleRule[] = [
    { id: 'mock-code', description: 'mock-api source paths or messages', pattern: /mock-api[\\/]|handler module skipped|No fixture persona|fixture drift/g },
    {
      id: 'server-code',
      description: 'src/server code',
      pattern: /src[\\/]server[\\/]|Invalid server configuration|Token kid is not in the signing key set|JWKS response has no keys array/g,
    },
    {
      id: 'server-env-name',
      description: 'server-only environment variable name',
      pattern: new RegExp(`(?<![A-Za-z0-9_])(?<!VITE_)(?:${serverKeys.map(escapeRegExp).join('|')})(?![A-Za-z0-9_])`, 'g'),
    },
    { id: 'service-role-literal', description: 'Supabase secret key', pattern: /sb_secret_[A-Za-z0-9_-]{6,}|service_role_key/g },
    { id: 'demo-password', description: 'the local demo password', pattern: new RegExp(escapeRegExp(LOCAL_DEMO_PASSWORD), 'g') },
  ];
  if (inputs.serviceRoleKey !== null && inputs.serviceRoleKey.length >= 16) {
    rules.push({ id: 'service-role-key', description: 'the configured service-role key', pattern: new RegExp(escapeRegExp(inputs.serviceRoleKey), 'g') });
  }
  if (inputs.prototype === true) {
    rules.push({ id: 'demo-account-email', description: 'a demo-account e-mail in a prototype build', pattern: /@claimsiq\.local\b/g });
    rules.push({
      id: 'supabase-js',
      description: 'supabase-js in a prototype build',
      pattern: /GoTrueClient|supabase-js|gotrue-js|@supabase\/|PASSWORD_RECOVERY/g,
    });
  }
  if (inputs.prototype !== true) {
    rules.push({
      id: 'mock-api-in-api-build',
      description: 'the in-browser mock API in a build that calls the real API',
      pattern: /The mock API failed on this request/g,
    });
  }
  return rules;
}

export interface BundleFinding {
  readonly file: string;
  readonly rule: string;
  readonly description: string;
  readonly context: string;
}

const JWT = /eyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}/g;

function jwtRole(payloadSegment: string): string | null {
  try {
    const json = Buffer.from(payloadSegment, 'base64url').toString('utf8');
    const payload = JSON.parse(json) as { role?: unknown };
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

function contextOf(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 30);
  const end = Math.min(text.length, index + length + 30);
  return text.slice(start, end).replace(/\s+/g, ' ').replace(JWT, '[JWT]').replace(/sb_secret_[A-Za-z0-9_-]+/g, 'sb_secret_[MASKED]');
}

/** Scans one bundle file's text. */
export function scanBundleText(file: string, text: string, rules: readonly BundleRule[]): BundleFinding[] {
  const findings: BundleFinding[] = [];
  for (const rule of rules) {
    rule.pattern.lastIndex = 0;
    for (const match of text.matchAll(rule.pattern)) {
      const masked = rule.id === 'service-role-key' ? '[service-role key]' : rule.id === 'demo-password' ? '[demo password]' : contextOf(text, match.index, match[0].length);
      findings.push({ file, rule: rule.id, description: rule.description, context: masked });
    }
  }
  JWT.lastIndex = 0;
  for (const match of text.matchAll(JWT)) {
    if (jwtRole(match[1] ?? '') === 'service_role') {
      findings.push({ file, rule: 'service-role-jwt', description: 'a service_role JWT', context: '[JWT]' });
    }
  }
  return findings;
}

/** Every file under a directory. */
export function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFiles(path));
    } else if (entry.isFile()) {
      out.push(path);
    }
  }
  return out;
}

/** Scans a dist directory. */
export function scanBundle(dist: string, inputs: BundleScanInputs): BundleFinding[] {
  const rules = bundleRules(inputs);
  const findings: BundleFinding[] = [];
  for (const file of listFiles(dist)) {
    if (inputs.prototype === true && /supabase/i.test(relative(dist, file))) {
      findings.push({
        file: relative(dist, file),
        rule: 'supabase-js',
        description: 'a supabase chunk in a prototype build',
        context: relative(dist, file),
      });
    }
    if (statSync(file).size > 20 * 1024 * 1024 || /\.(png|jpe?g|gif|webp|ico|woff2?|ttf)$/i.test(file)) {
      continue;
    }
    findings.push(...scanBundleText(relative(dist, file), readFileSync(file, 'utf8'), rules));
  }
  return findings;
}

const CSP_META = /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"/i;

/**
 * Checks the production Content-Security-Policy of the built index.html: the meta tag is present and filled
 * in, and script-src allows neither inline scripts nor eval (the dev-only relaxations must not ship).
 */
export function checkProductionCsp(indexHtml: string, prototype = false): BundleFinding[] {
  const finding = (context: string): BundleFinding => ({
    file: 'index.html',
    rule: 'production-csp',
    description: 'the production Content-Security-Policy',
    context,
  });
  const match = CSP_META.exec(indexHtml);
  if (match?.[1] === undefined || match[1] === '') {
    return [finding('no Content-Security-Policy meta tag')];
  }
  const policy = match[1].replace(/&#39;|&apos;/g, "'");
  if (policy.includes('__CLAIMSIQ_CONTENT_SECURITY_POLICY__')) {
    return [finding('the policy token was not replaced')];
  }
  const scriptSrc = directiveOf(policy, 'script-src');
  if (scriptSrc === undefined) {
    return [finding('no script-src directive')];
  }
  const sources = scriptSrc.split(/\s+/);
  const relaxed = ["'unsafe-inline'", "'unsafe-eval'", 'ws:'].filter((source) => sources.includes(source));
  const findings = relaxed.map((source) => finding(`script-src allows ${source}`));
  const connectSrc = directiveOf(policy, 'connect-src');
  if (prototype && connectSrc !== "connect-src 'self'") {
    findings.push(finding(`a prototype build may connect to its own origin only, got "${connectSrc ?? 'no connect-src'}"`));
  }
  return findings;
}

function parseArgs(argv: readonly string[]): { build: boolean; dist: string; prototype: boolean } {
  let build = true;
  let prototype = false;
  let dist: string | null = null;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--no-build') {
      build = false;
    } else if (arg === '--prototype') {
      prototype = true;
    } else if (arg === '--dist') {
      const value = argv[index + 1];
      if (value === undefined) {
        throw new Error('--dist needs a directory.');
      }
      dist = resolve(value);
      index += 1;
    } else {
      throw new Error(`Unknown argument "${arg ?? ''}". Usage: scan-bundle.ts [--prototype] [--no-build] [--dist <dir>]`);
    }
  }
  return { build, dist: dist ?? (prototype ? PROTOTYPE_DIST : DEFAULT_DIST), prototype };
}

function main(): void {
  const { build, dist, prototype } = parseArgs(process.argv.slice(2));
  if (build) {
    const command = prototype
      ? ['run', '--cwd', 'src/ui', 'build:prototype', '--outDir', dist]
      : ['run', 'build:ui'];
    process.stdout.write(`scan-bundle: building the SPA (bun ${command.join(' ')})...\n`);
    const result = spawnSync('bun', command, { cwd: repoRoot, stdio: 'inherit' });
    if (result.status !== 0) {
      process.stderr.write('scan-bundle: the SPA build failed.\n');
      process.exitCode = 1;
      return;
    }
  }
  if (!existsSync(dist)) {
    process.stderr.write(`scan-bundle: ${dist} does not exist. Build the SPA first (bun run build:ui).\n`);
    process.exitCode = 1;
    return;
  }
  const configured = tryGetConfig();
  const indexHtml = join(dist, 'index.html');
  const findings = [
    ...scanBundle(dist, {
      serviceRoleKey: configured.ok ? configured.config.supabase.serviceRoleKey : null,
      prototype,
    }),
    ...checkProductionCsp(existsSync(indexHtml) ? readFileSync(indexHtml, 'utf8') : '', prototype),
  ];
  if (findings.length > 0) {
    process.stderr.write(`scan-bundle: ${findings.length} finding(s) in ${dist}:\n`);
    for (const finding of findings) {
      process.stderr.write(`  ${finding.file}  ${finding.rule}  (${finding.description})  …${finding.context}…\n`);
    }
    process.exitCode = 1;
    return;
  }
  process.stdout.write(
    `scan-bundle: ${dist} is clean (no demo password, server code, server variables or secrets${prototype ? ', no supabase-js' : ''}).\n`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`scan-bundle failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
