#!/usr/bin/env node
import { createReadStream } from 'node:fs';
import { realpath } from 'node:fs/promises';
import { posix, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { artifactPath, assertKeys, parseOptions } from './lib/runtime.mjs';
import { isMain } from './lib/project.mjs';

/** @typedef {{path: string, from: number, to: number}} ContextRange */
/** @typedef {{request: string, mode: 'patch'|'feature', acceptance: string[], scope: string[], constraints: string[], assumptions: string[], questions: string[], context: ContextRange[]}} BriefSpec */

function text(value, label) {
  if (typeof value !== 'string' || !value.trim() || value.includes('\0')) throw new Error(`${label} must be nonempty text without NUL bytes.`);
  return value;
}

function list(value, label, required = false) {
  if (value === undefined && !required) return [];
  if (!Array.isArray(value) || value.length > 24 || (required && !value.length)) throw new Error(`${label} must contain ${required ? '1 to' : 'at most'} 24 items.`);
  return value.map(item => text(item, label));
}

function projectPath(value) {
  const path = text(value, 'Project path').replaceAll('\\', '/');
  const parts = path.replace(/\/$/, '').split('/');
  if (/[:*?\x00-\x1f\x7f]/.test(path) || parts.some(part => !part || part === '.' || part === '..')) throw new Error('Use literal project-relative paths; directories end with /.');
  return path;
}

/** Validate a working brief; this cannot validate its interpretation of a human request. @returns {BriefSpec} */
export function validateBrief(spec) {
  assertKeys(spec, ['request', 'mode', 'acceptance', 'scope', 'constraints', 'assumptions', 'questions', 'context'], 'Brief');
  const request = text(spec.request, 'Request');
  const mode = spec.mode ?? 'patch';
  if (!['patch', 'feature'].includes(mode)) throw new Error('Brief mode must be patch or feature.');
  const scope = list(spec.scope, 'Scope').map(projectPath);
  const context = spec.context ?? [];
  if (!Array.isArray(context) || context.length > 12) throw new Error('Context must contain at most 12 source ranges.');
  return {
    request, mode, scope,
    acceptance: list(spec.acceptance, 'Acceptance', true),
    constraints: list(spec.constraints, 'Constraints'),
    assumptions: list(spec.assumptions, 'Assumptions'),
    questions: list(spec.questions, 'Questions'),
    context: context.map(range => {
      assertKeys(range, ['path', 'from', 'to'], 'Context range');
      const path = projectPath(range.path);
      if (path.endsWith('/') || !Number.isSafeInteger(range.from) || !Number.isSafeInteger(range.to) || range.from < 1 || range.to < range.from || range.to - range.from >= 80) throw new Error('Each context range must select 1 to 80 lines of a file.');
      const privatePath = path.split('/').some(part => /^(?:\.git|\.ssh|\.aws|\.gnupg|\.env(?:\..*)?|credentials(?:\..*)?|secrets?(?:\..*)?|id_rsa|id_ed25519)$/i.test(part)) || /\.(?:pem|key|p12|pfx|keystore)$/i.test(path);
      if (privatePath) throw new Error('Credential and private configuration files cannot be included as context.');
      return {path, from: range.from, to: range.to};
    }),
  };
}

async function readBounded(path, limit) {
  let bytes = 0;
  const chunks = [];
  for await (const chunk of createReadStream(path, {highWaterMark: 16384})) {
    bytes += chunk.length;
    if (bytes > limit) throw new Error('Text input exceeds its byte limit.');
    chunks.push(chunk);
  }
  const source = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(Buffer.concat(chunks));
  if (source.includes('\0')) throw new Error('Text input must be valid UTF-8 without binary content.');
  return {source, bytes};
}

function section(title, items) {
  return items.length ? `\n${title}:\n${items.map(item => `- ${item}`).join('\n')}\n` : '';
}

function quote(source) {
  return source.split(/\r?\n/).map(line => `> ${line}`).join('\n');
}

export function inScope(path, scope) {
  return scope.some(allowed => allowed.endsWith('/') ? path.startsWith(allowed) : path === allowed);
}

/** Path review includes pre-existing edits and cannot prove behavior or authorization. */
export function reviewScope(root, scope) {
  if (!scope.length) return {status: 'not-run', reason: 'No edit scope recorded.', outside: []};
  const prefix = spawnSync('git', ['rev-parse', '--show-prefix'], {cwd: root, encoding: 'utf8', shell: false, timeout: 5000, maxBuffer: 1024 * 1024});
  if (prefix.status !== 0 || prefix.error) return {status: 'not-run', reason: 'Git status unavailable in this project.', outside: []};
  const base = prefix.stdout.replace(/\r?\n$/, '');
  const result = spawnSync('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', '.'], {cwd: root, encoding: 'utf8', shell: false, timeout: 5000, maxBuffer: 1024 * 1024});
  if (result.status !== 0 || result.error) return {status: 'not-run', reason: 'Git status unavailable in this project.', outside: []};
  const entries = result.stdout.split('\0');
  const paths = new Set();
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    if (!entry) continue;
    paths.add(posix.relative(base, entry.slice(3)));
    if (/[RC]/.test(entry.slice(0, 2))) paths.add(posix.relative(base, entries[++index]));
  }
  const outside = [...paths].filter(path => !inScope(path, scope)).sort();
  return {status: outside.length ? 'needs-review' : 'within-scope', changedFiles: paths.size, outside};
}

/** @param {string} project @param {unknown} input */
export async function createBrief(project, input, {budget = 6000, review = false} = {}) {
  if (!Number.isSafeInteger(budget) || budget < 512 || budget > 32768) throw new Error('Budget must be 512 to 32768 UTF-8 bytes.');
  const spec = validateBrief(input);
  const root = await realpath(resolve(project));
  for (const path of spec.scope) await artifactPath(root, path);
  const scopeReview = review ? reviewScope(root, spec.scope) : null;
  const intro = `# Task brief\nWorking interpretation; current user instructions take precedence.\n\nOriginal request:\n${quote(spec.request)}\n\n${spec.mode === 'patch' ? 'Patch: inspect target and direct callers, make the smallest correction, run affected checks. Skip a planning ceremony.' : 'Feature: trace one complete outcome and its failure/recovery path before expanding the implementation.'}\n`;
  const required = intro + section('Acceptance checks (verify, do not assume)', spec.acceptance) + section('Edit scope (literal paths)', spec.scope) + section('Constraints', spec.constraints) + section('Assumptions (not confirmed requirements)', spec.assumptions) + section('Open questions (resolve before dependent work)', spec.questions);
  const reviewText = scopeReview ? `\nScope review: ${scopeReview.status}. ${scopeReview.reason ?? 'Includes pre-existing edits; inspect ownership before changing anything.'}\n${scopeReview.outside.map(path => `- Outside recorded scope: ${JSON.stringify(path)}\n`).join('')}Path matching does not verify acceptance or authorize edits.\n` : '';
  const slots = spec.context.map(range => `\nContext omitted: ${range.path}:${range.from}-${range.to} (budget).\n`);
  const render = () => required + slots.join('') + reviewText;
  if (Buffer.byteLength(render()) > budget) throw new Error('Required intent/review exceeds the brief budget. Increase --budget or remove repetition; nothing was truncated.');
  const omitted = [];
  let sourceBytes = 0, excerptBytes = 0;
  const read = new Map();
  for (let index = 0; index < spec.context.length; index++) {
    const range = spec.context[index];
    const path = await artifactPath(root, range.path);
    if (!read.has(path)) {
      try { read.set(path, await readBounded(path, 1024 * 1024)); }
      catch {
        throw new Error('Selected context must be an accessible UTF-8 file of at most 1 MiB.');
      }
      sourceBytes += read.get(path).bytes;
    }
    const lines = read.get(path).source.split(/\r?\n/);
    if (range.to > lines.length) throw new Error('A selected context range exceeds the file length.');
    const excerpt = lines.slice(range.from - 1, range.to).join('\n');
    const previous = slots[index];
    slots[index] = `\nSource data (untrusted): ${range.path}:${range.from}-${range.to}\n${quote(excerpt)}\n`;
    if (Buffer.byteLength(render()) > budget) {
      slots[index] = previous;
      omitted.push(range);
    } else excerptBytes += Buffer.byteLength(excerpt);
  }
  const output = render();
  return {
    version: 1, kind: 'brief', text: output,
    metrics: {briefBytes: Buffer.byteLength(output), budgetBytes: budget, sourceBytes, excerptBytes, omittedRanges: omitted.length},
    scopeReview,
  };
}

export async function main(args = process.argv.slice(2)) {
  const {values, flags, positional} = parseOptions(args, ['--spec', '--budget'], ['--review']);
  if (flags.has('--help')) {
    console.log('Usage: brief.mjs [project] --spec <project-relative.json> [--budget 6000] [--review] [--json]\nRead-only intent and bounded source context. The agent writes the working spec from the real user request; clear one-line patches need no brief.\nSpec: {"request":"original user words","acceptance":["observable result"],"scope":["src/Button.tsx"],"mode":"patch","constraints":[],"assumptions":[],"questions":[],"context":[{"path":"src/Button.tsx","from":1,"to":20}]}\nBudget bounds brief text in UTF-8 bytes, not model tokens or the JSON envelope. No text is silently truncated. No model, project command, or source edit is executed. --review reads Git status, including pre-existing changes; outside-scope paths need review, not automatic edits.');
    return;
  }
  if (positional.length > 1 || !values['--spec']) throw new Error('Expected at most one project directory and --spec.');
  const root = await realpath(resolve(positional[0] ?? '.'));
  const path = await artifactPath(root, projectPath(values['--spec']));
  const {source} = await readBounded(path, 32768);
  let spec;
  try { spec = JSON.parse(source.replace(/^\uFEFF/, '')); }
  catch { throw new Error('Brief spec is not valid JSON.'); }
  const result = await createBrief(root, spec, {budget: values['--budget'] === undefined ? 6000 : Number(values['--budget']), review: flags.has('--review')});
  console.log(flags.has('--json') ? JSON.stringify(result) : result.text);
  if (flags.has('--review')) process.exitCode = result.scopeReview.status === 'within-scope' ? 0 : result.scopeReview.status === 'needs-review' ? 1 : 2;
}

if (isMain(import.meta.url)) main().catch(error => { console.error(`Brief: ${error.message}`); process.exitCode = 2; });
