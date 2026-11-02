#!/usr/bin/env node
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditBrowser } from './browser-audit.mjs';
import { isMain } from './lib/project.mjs';
import { artifactPath, evidencePath, parseOptions, readJson, reportExit, reportStatus, writeReport } from './lib/runtime.mjs';
import { runVerify } from './verify.mjs';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { nodeCases } from './evals/node-cases.mjs';
import { importEvidence } from './review.mjs';
import { assertKeys, assertObject, fingerprint } from './lib/runtime.mjs';

const CASES_PATH = join(dirname(fileURLToPath(import.meta.url)), 'evals', 'cases.json');
export async function loadCases() { return [...(await readJson(CASES_PATH)).cases, ...nodeCases]; }

export function validateModelRun(run) {
  assertKeys(run, ['model', 'settings', 'condition', 'skillRevision', 'metrics'], 'Model run');
  if (typeof run.model !== 'string' || !run.model.trim() || !['without-skill', 'with-skill'].includes(run.condition)) throw new Error('Model run requires a model ID and without-skill/with-skill condition.');
  assertObject(run.settings, 'Model settings');
  if (run.condition === 'with-skill' && (typeof run.skillRevision !== 'string' || !run.skillRevision.trim())) throw new Error('Record the tested skill revision for a with-skill run.');
  if (run.metrics !== undefined) {
    assertKeys(run.metrics, ['durationMs', 'inputTokens', 'outputTokens', 'costUsd'], 'Model metrics');
    if (Object.values(run.metrics).some(value => typeof value !== 'number' || !Number.isFinite(value) || value < 0)) throw new Error('Model metrics must be observed nonnegative finite numbers.');
    if (['inputTokens', 'outputTokens'].some(key => run.metrics[key] !== undefined && !Number.isSafeInteger(run.metrics[key]))) throw new Error('Token counts must be safe integers.');
  }
  return run;
}

export async function prepareCase(id, destination, baseDir = process.cwd()) {
  const entry = (await loadCases()).find(entry => entry.id === id);
  if (!entry) throw new Error('Unknown evaluation case.');
  const root = await artifactPath(baseDir, destination);
  await mkdir(root, { recursive: true });
  if ((await readdir(root)).length) throw new Error('Evaluation destination must be empty; existing files are never overwritten.');
  for (const [path, content] of Object.entries(entry.files)) {
    const target = await artifactPath(root, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, { encoding: 'utf8', flag: 'wx' });
  }
  await writeFile(join(root, 'TASK.md'), entry.prompt + '\n', { encoding: 'utf8', flag: 'wx' });
  return { id, root, prompt: entry.prompt, review: entry.review };
}

export async function evaluateCase(id, project, url, options = {}) {
  const entry = (await loadCases()).find(entry => entry.id === id);
  if (!entry) throw new Error('Unknown evaluation case.');
  const modelRun = options.modelRun ? validateModelRun(options.modelRun) : null;
  const source = await runVerify(project, { strict: true, toolingRoot: options.toolingRoot });
  const checks = [{ id: 'source', status: source.passed ? 'passed' : 'failed', evidence: `${source.counts.total} source findings.` }];
  const scenarios = [];
  if (entry.runner === 'node') {
    const completion = randomUUID();
    // A separate pipe distinguishes assertion completion from candidate output or an early exit.
    const assertions = `import strict from 'node:assert/strict'; import {readFileSync,writeSync} from 'node:fs'; import {resolve} from 'node:path'; import {pathToFileURL} from 'node:url'; const assert = Object.freeze({...strict}); const finish = writeSync; const completion = readFileSync(0,'utf8'); const operation = await import(pathToFileURL(resolve('operation.mjs')).href);\n${entry.assertions}\nfinish(3, completion);`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', assertions], { cwd: resolve(project), encoding: 'utf8', shell: false, stdio: ['pipe', 'pipe', 'pipe', 'pipe'], input: completion, timeout: 15000, maxBuffer: 1024 * 1024 });
    const assertionsCompleted = result.output?.[3]?.toString() === completion;
    const status = result.status === 0 && !result.error && assertionsCompleted ? 'passed' : 'failed';
    const reason = result.error?.code === 'ETIMEDOUT' ? 'Candidate exceeded the 15-second limit.' : status === 'passed' ? 'Bundled assertions completed.' : result.status === 0 && !assertionsCompleted ? 'Candidate exited before bundled assertions completed.' : 'Candidate or bundled assertions failed. Output omitted to avoid leaking candidate data.';
    checks.push({ id: 'node-contract', status, exitCode: result.status, assertionsCompleted, reason });
    scenarios.push({ id: 'node-contract', report: { status, engine: { node: process.version } } });
  }
  for (const scenario of entry.scenarios) {
    const output = `.devmind/evals/${id}/${scenario.id}`;
    const report = await auditBrowser(project, url, { ...options, plan: scenario.plan, output });
    const file = await writeReport(project, `${output}/report.json`, report);
    scenarios.push({ id: scenario.id, report, file });
    checks.push({ id: scenario.id, status: report.status === 'incomplete' ? 'not-run' : report.status, evidence: file });
  }
  const behaviorStatus = reportStatus(checks);
  // A successful task behavior check and a fully reviewed skill evaluation are separate outcomes.
  if (options.review) {
    const review = await importEvidence(source.root, options.review, 'review', await fingerprint(project));
    checks.push({ id: 'reviewer-assessment', status: review.status === 'incomplete' ? 'not-run' : review.status, evidence: options.review });
  } else checks.push({ id: 'reviewer-assessment', status: 'not-run', reason: 'Use the task rubric and review.mjs to record observed visual, code-reuse, and interaction findings.' });
  return { version: 2, kind: 'evaluation', caseId: id, caseDigest: createHash('sha256').update(JSON.stringify(entry)).digest('hex'), root: resolve(project), createdAt: new Date().toISOString(), modelRun, checks, scenarios, source, behaviorStatus, status: reportStatus(checks), rubric: entry.review, limitations: ['Compare identical tasks, seed files, model/settings, viewport plans, and review criteria.', 'Model-run provenance and metrics are supplied by the runner; they are not independently verified by this tool.', 'This tool evaluates the candidate artifacts. It does not invoke an agent or establish a statistical improvement from one run.'] };
}

export function compareEvaluations(baseline, candidate) {
  if (baseline.kind !== 'evaluation' || candidate.kind !== 'evaluation' || baseline.version !== candidate.version || baseline.caseId !== candidate.caseId || !baseline.caseDigest || baseline.caseDigest !== candidate.caseDigest) throw new Error('Compare reports from the same evaluation case/version, seed, prompt, and plans.');
  const environments = report => report.scenarios.map(scenario => scenario.report.engine ?? null);
  if (JSON.stringify(environments(baseline)) !== JSON.stringify(environments(candidate))) throw new Error('Execution environments differ between evaluation reports.');
  if (baseline.modelRun || candidate.modelRun) {
    const first = validateModelRun(baseline.modelRun), second = validateModelRun(candidate.modelRun);
    if (first.model !== second.model || !isDeepStrictEqual(first.settings, second.settings)) throw new Error('Model IDs/settings differ. Keep them fixed for a paired comparison.');
    if (first.condition !== 'without-skill' || second.condition !== 'with-skill') throw new Error('Compare a without-skill baseline with a with-skill candidate.');
  }
  const counts = report => ({ passed: report.checks.filter(check => check.status === 'passed').length, failed: report.checks.filter(check => check.status === 'failed').length, unverified: report.checks.filter(check => check.status === 'not-run').length });
  return { caseId: baseline.caseId, baseline: counts(baseline), candidate: counts(candidate), modelControl: baseline.modelRun && candidate.modelRun ? 'Declared model/settings match; provenance is runner-supplied.' : 'Unverified: artifact-only comparison without model-run provenance.', note: 'Counts describe this case only; visual quality and broad improvement require reviewed, repeated runs.' };
}

export async function main(args = process.argv.slice(2)) {
  const { values, flags, positional } = parseOptions(args, ['--case', '--prepare', '--url', '--channel', '--tooling', '--out', '--baseline', '--review', '--model-run'], ['--list']);
  if (flags.has('--help')) { console.log('Usage: eval.mjs --list | --case <id> --prepare <empty-child-directory> | <project> --case <id> [--url <loopback-url>] [--channel chrome|msedge] [--tooling directory] [--model-run run.json] [--baseline report.json] [--json]\nBrowser cases require --url; Node cases execute bundled assertions locally. Use isolated workspaces for candidate code.'); return; }
  if (flags.has('--list')) { console.log(JSON.stringify((await loadCases()).map(({ id, prompt, review, runner }) => ({ id, prompt, review, runner: runner ?? 'browser' })), null, 2)); return; }
  if (!values['--case']) throw new Error('--case is required.');
  if (values['--prepare']) {
    if (positional.length) throw new Error('--prepare takes its destination as an option value.');
    console.log(JSON.stringify(await prepareCase(values['--case'], values['--prepare']), null, 2)); return;
  }
  const entry = (await loadCases()).find(entry => entry.id === values['--case']);
  if (positional.length !== 1 || (entry?.runner !== 'node' && !values['--url'])) throw new Error('Expected project directory; browser cases also require --url.');
  if (values['--out']) await evidencePath(positional[0], values['--out']);
  const result = await evaluateCase(values['--case'], positional[0], values['--url'], { channel: values['--channel'], toolingRoot: values['--tooling'], review: values['--review'], modelRun: values['--model-run'] ? await readJson(values['--model-run']) : null });
  if (values['--baseline']) result.comparison = compareEvaluations(await readJson(values['--baseline']), result);
  const file = await writeReport(result.root, values['--out'] ?? `.devmind/evals/${result.caseId}/report.json`, result);
  console.log(flags.has('--json') ? JSON.stringify(result, null, 2) : `${result.status} (behavior: ${result.behaviorStatus}): ${file}`);
  process.exitCode = reportExit(result.status);
}
if (isMain(import.meta.url)) main().catch(error => { console.error(`Evaluation: ${error.message}`); process.exitCode = 2; });
