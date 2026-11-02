#!/usr/bin/env node
import { stat, realpath, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { isMain, scanProject } from './lib/project.mjs';
import { runVerify } from './verify.mjs';
import { artifactPath, assertKeys, fingerprint, parseOptions, readJson, reportExit, reportStatus, writeReport } from './lib/runtime.mjs';

export const VISUAL_CRITERIA = ['task-fit', 'hierarchy', 'composition', 'content', 'responsive', 'keyboard', 'states'];

export async function importEvidence(root, path, kind, digest) {
  const report = await readJson(await artifactPath(root, path));
  if (report.version !== 1 || report.kind !== kind || !Array.isArray(report.checks) || !report.checks.length || !['passed', 'failed', 'incomplete'].includes(report.status)) throw new Error(`Invalid ${kind} evidence report.`);
  if (await realpath(resolve(report.root)) !== root || report.sourceDigest !== digest) throw new Error(`Stale or unrelated ${kind} evidence. Rerun against the current source.`);
  for (const check of report.checks) {
    if (!check.id || !['passed', 'failed', 'not-run'].includes(check.status)) throw new Error(`Invalid ${kind} check status.`);
  }
  if (report.status !== reportStatus(report.checks)) throw new Error(`Inconsistent ${kind} evidence status.`);
  if (kind === 'browser') {
    if (!Array.isArray(report.artifacts)) throw new Error('Browser evidence needs screenshot artifacts.');
    for (const artifact of report.artifacts) {
      if (artifact.type !== 'screenshot' || typeof artifact.file !== 'string') throw new Error('Invalid browser artifact.');
      const path = await artifactPath(root, artifact.file);
      if (!(await stat(path)).isFile()) throw new Error('Missing browser artifact.');
      const bytes = await readFile(path);
      if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || createHash('sha256').update(bytes).digest('hex') !== artifact.sha256) throw new Error('Invalid or changed screenshot artifact. Rerun browser audit.');
    }
    if (report.status === 'passed' && !report.artifacts.length) throw new Error('Passing browser evidence must include screenshots.');
  }
  return report;
}

export async function reviewProject(targetDir = '.', options = {}) {
  const root = await realpath(resolve(targetDir));
  const digest = await fingerprint(root);
  const source = await runVerify(root, { strict: true, toolingRoot: options.toolingRoot });
  const files = (await scanProject(root)).files;
  const scope = options.scope ?? (files.some(file => /\.(?:tsx|jsx|html|vue|svelte|css|scss)$/.test(file.relPath)) ? 'ui' : 'code');
  if (!['code', 'ui'].includes(scope)) throw new Error('Review scope must be code or ui.');
  const checks = [{ id: 'source', status: source.passed ? 'passed' : 'failed', evidence: `${source.counts.errors} errors and ${source.counts.warnings} warnings; ${source.engine.parser}.` }];
  const evidence = { source };
  for (const kind of ['quality', ...(scope === 'ui' ? ['browser'] : [])]) {
    if (!options[kind]) { checks.push({ id: kind, status: 'not-run', reason: `No ${kind} evidence supplied.` }); continue; }
    const report = await importEvidence(root, options[kind], kind, digest);
    evidence[kind] = report;
    checks.push({ id: kind, status: report.status === 'incomplete' ? 'not-run' : report.status, evidence: options[kind] });
  }
  if (scope === 'ui') {
    if (!options.assessment) checks.push({ id: 'visual-review', status: 'not-run', reason: 'No observation-based visual/interaction assessment supplied.' });
    else {
      const assessment = await readJson(await artifactPath(root, options.assessment));
      assertKeys(assessment, ['version', 'sourceDigest', 'reviewer', 'criteria'], 'Assessment');
      if (assessment.version !== 1 || assessment.sourceDigest !== digest || typeof assessment.reviewer !== 'string' || !assessment.reviewer.trim() || !Array.isArray(assessment.criteria)) throw new Error('Invalid or stale visual assessment.');
      const ids = assessment.criteria.map(criterion => criterion.id);
      if (new Set(ids).size !== ids.length || ids.some(id => !VISUAL_CRITERIA.includes(id))) throw new Error('Duplicate or unsupported assessment criteria.');
      for (const id of VISUAL_CRITERIA) {
        const criterion = assessment.criteria.find(item => item.id === id);
        if (!criterion) { checks.push({ id: `visual:${id}`, status: 'not-run', reason: 'Criterion not reviewed.' }); continue; }
        assertKeys(criterion, ['id', 'status', 'evidence', 'notes'], 'Assessment criterion');
        if (!['passed', 'failed', 'not-run'].includes(criterion.status)) throw new Error('Invalid assessment status.');
        if (criterion.status !== 'not-run' && (typeof criterion.notes !== 'string' || !criterion.notes.trim() || !Array.isArray(criterion.evidence) || !criterion.evidence.length)) throw new Error('Reviewed criteria need concrete notes and evidence paths.');
        for (const path of criterion.evidence ?? []) {
          if (typeof path !== 'string' || !(await stat(await artifactPath(root, path))).isFile()) throw new Error('Missing assessment evidence.');
        }
        if (criterion.status !== 'not-run' && ['task-fit', 'hierarchy', 'composition', 'content', 'responsive'].includes(id) && !criterion.evidence.some(path => evidence.browser?.artifacts.some(artifact => artifact.file === path))) throw new Error('Visual observations must reference a current browser screenshot.');
        checks.push({ ...criterion, id: `visual:${id}` });
      }
      evidence.assessment = assessment;
    }
  }
  return { version: 1, kind: 'review', root, createdAt: new Date().toISOString(), sourceDigest: digest, scope, checks, status: reportStatus(checks), evidence, limitations: ['Assessment observations are supplied by a reviewer; they are not machine-certified design quality.', 'A passed report reflects supplied checks and their configured coverage, not universal security or accessibility certification.'] };
}

export async function main(args = process.argv.slice(2)) {
  const { values, flags, positional } = parseOptions(args, ['--quality', '--browser', '--assessment', '--scope', '--out', '--tooling']);
  if (flags.has('--help')) { console.log('Usage: review.mjs [project] [--quality report.json] [--browser report.json] [--assessment assessment.json] [--scope code|ui] [--out .devmind/review.json] [--tooling directory] [--json]'); return; }
  if (positional.length > 1) throw new Error('Expected at most one project directory.');
  const result = await reviewProject(positional[0], { quality: values['--quality'], browser: values['--browser'], assessment: values['--assessment'], scope: values['--scope'], toolingRoot: values['--tooling'] });
  const file = await writeReport(result.root, values['--out'] ?? '.devmind/review.json', result);
  console.log(flags.has('--json') ? JSON.stringify(result, null, 2) : `${result.status}: ${file}`);
  process.exitCode = reportExit(result.status);
}
if (isMain(import.meta.url)) main().catch(error => { console.error(`Review: ${error.message}`); process.exitCode = 2; });
