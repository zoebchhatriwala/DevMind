#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import { isMain } from './lib/project.mjs';
import { fingerprint, parseOptions, readJson, reportExit, reportStatus, writeReport } from './lib/runtime.mjs';

const GROUPS = {
  format: ['format:check', 'check:format'],
  lint: ['lint'],
  types: ['typecheck', 'type-check', 'check:types'],
  tests: ['test'],
};

export function npmInvocation() {
  const candidates = [process.env.npm_execpath, join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')];
  const path = candidates.find(path => path && /npm-cli\.js$/.test(path) && existsSync(path));
  if (path) return { command: process.execPath, args: [path] };
  if (process.platform !== 'win32') return { command: 'npm', args: [] };
  return null;
}

export async function runQuality(targetDir = '.', options = {}) {
  const root = await realpath(resolve(targetDir));
  const pkg = existsSync(join(root, 'package.json')) ? await readJson(join(root, 'package.json')) : {};
  const npm = npmInvocation();
  const checks = [];
  for (const [id, candidates] of Object.entries(GROUPS)) {
    const script = candidates.find(name => typeof pkg.scripts?.[name] === 'string');
    const command = script ? pkg.scripts[script] : '';
    const check = { id, status: 'not-run', script: script ?? null };
    if (!script) check.reason = 'No matching project script. Run the established equivalent and supply its evidence separately.';
    else if (!options.run) check.reason = 'Discovery only; --run is required to execute project scripts.';
    else if (!npm) check.reason = 'npm CLI could not be located.';
    else if (/\bdevmind\s+(?:quality|review)\b|(?:quality|review)\.mjs/.test(command)) check.reason = 'Recursive DevMind quality/review script refused.';
    else {
      const start = Date.now();
      const result = spawnSync(npm.command, [...npm.args, 'run', script], {
        cwd: root, shell: false, encoding: 'utf8', timeout: 120_000, maxBuffer: 4 * 1024 * 1024,
      });
      check.durationMs = Date.now() - start;
      check.exitCode = result.status;
      check.status = result.status === 0 && !result.error ? 'passed' : 'failed';
      if (result.error) check.reason = result.error.code === 'ETIMEDOUT' ? 'Command timed out.' : 'Command could not complete.';
      check.output = 'Output omitted from reports because project logs may contain sensitive data. Rerun this script locally for diagnostics.';
    }
    checks.push(check);
  }
  return {
    version: 1, kind: 'quality', root, createdAt: new Date().toISOString(),
    sourceDigest: await fingerprint(root), status: reportStatus(checks), checks,
    limitations: ['Executes only existing named npm scripts when --run is supplied. No dependencies are installed.', 'Script names do not prove semantic coverage; inspect the project configuration and results. Missing checks remain not-run.'],
  };
}

export async function main(args = process.argv.slice(2)) {
  const { values, flags, positional } = parseOptions(args, ['--out'], ['--run']);
  if (flags.has('--help')) {
    console.log('Usage: quality.mjs [project] [--run] [--out .devmind/quality.json] [--json]\n--run executes existing project scripts. Without it, only discover checks.'); return;
  }
  if (positional.length > 1) throw new Error('Expected at most one project directory.');
  const result = await runQuality(positional[0], { run: flags.has('--run') });
  const artifact = await writeReport(result.root, values['--out'] ?? '.devmind/quality.json', result);
  console.log(flags.has('--json') ? JSON.stringify(result, null, 2) : `${result.status}: ${artifact}`);
  process.exitCode = reportExit(result.status);
}
if (isMain(import.meta.url)) main().catch(error => { console.error(`Quality: ${error.message}`); process.exitCode = 2; });
