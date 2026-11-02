#!/usr/bin/env node
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditBrowser } from './browser-audit.mjs';
import { isMain } from './lib/project.mjs';
import { artifactPath, parseOptions, readJson, reportExit, reportStatus, writeReport } from './lib/runtime.mjs';
import { runVerify } from './verify.mjs';
import { createHash } from 'node:crypto';
import { importEvidence } from './review.mjs';
import { fingerprint } from './lib/runtime.mjs';

const CASES_PATH = join(dirname(fileURLToPath(import.meta.url)), 'evals', 'cases.json');
export async function loadCases() { return (await readJson(CASES_PATH)).cases; }

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
  const source = await runVerify(project, { strict: true, toolingRoot: options.toolingRoot });
  const checks = [{ id: 'source', status: source.passed ? 'passed' : 'failed', evidence: `${source.counts.total} source findings.` }];
  const scenarios = [];
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
  return { version: 1, kind: 'evaluation', caseId: id, caseDigest: createHash('sha256').update(JSON.stringify(entry)).digest('hex'), root: resolve(project), createdAt: new Date().toISOString(), checks, scenarios, source, behaviorStatus, status: reportStatus(checks), rubric: entry.review, limitations: ['Compare identical tasks, seed files, model/settings, viewport plans, and review criteria.', 'This tool evaluates the candidate artifacts. It does not invoke an agent or establish a statistical improvement from one run.'] };
}

export function compareEvaluations(baseline, candidate) {
  if (baseline.kind !== 'evaluation' || candidate.kind !== 'evaluation' || baseline.version !== candidate.version || baseline.caseId !== candidate.caseId || !baseline.caseDigest || baseline.caseDigest !== candidate.caseDigest) throw new Error('Compare reports from the same evaluation case/version, seed, prompt, and plans.');
  const environments = report => report.scenarios.map(scenario => scenario.report.engine ?? null);
  if (JSON.stringify(environments(baseline)) !== JSON.stringify(environments(candidate))) throw new Error('Browser environments differ between evaluation reports.');
  const counts = report => ({ passed: report.checks.filter(check => check.status === 'passed').length, failed: report.checks.filter(check => check.status === 'failed').length, unverified: report.checks.filter(check => check.status === 'not-run').length });
  return { caseId: baseline.caseId, baseline: counts(baseline), candidate: counts(candidate), note: 'Counts describe this case only; visual quality and broad improvement require reviewed, repeated runs.' };
}

export async function main(args = process.argv.slice(2)) {
  const { values, flags, positional } = parseOptions(args, ['--case', '--prepare', '--url', '--channel', '--tooling', '--out', '--baseline', '--review'], ['--list']);
  if (flags.has('--help')) { console.log('Usage: eval.mjs --list | --case <id> --prepare <empty-child-directory> | <project> --case <id> --url <loopback-url> [--channel chrome|msedge] [--tooling directory] [--baseline report.json] [--json]'); return; }
  if (flags.has('--list')) { console.log(JSON.stringify((await loadCases()).map(({ id, prompt, review }) => ({ id, prompt, review })), null, 2)); return; }
  if (!values['--case']) throw new Error('--case is required.');
  if (values['--prepare']) {
    if (positional.length) throw new Error('--prepare takes its destination as an option value.');
    console.log(JSON.stringify(await prepareCase(values['--case'], values['--prepare']), null, 2)); return;
  }
  if (positional.length !== 1 || !values['--url']) throw new Error('Expected project directory and --url for evaluation.');
  const result = await evaluateCase(values['--case'], positional[0], values['--url'], { channel: values['--channel'], toolingRoot: values['--tooling'], review: values['--review'] });
  if (values['--baseline']) result.comparison = compareEvaluations(await readJson(values['--baseline']), result);
  const file = await writeReport(result.root, values['--out'] ?? `.devmind/evals/${result.caseId}/report.json`, result);
  console.log(flags.has('--json') ? JSON.stringify(result, null, 2) : `${result.status} (behavior: ${result.behaviorStatus}): ${file}`);
  process.exitCode = reportExit(result.status);
}
if (isMain(import.meta.url)) main().catch(error => { console.error(`Evaluation: ${error.message}`); process.exitCode = 2; });
