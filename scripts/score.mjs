#!/usr/bin/env node
/**
 * score.mjs — DevMind Benchmark Report
 *
 * Runs read-only source verification against a project, weights findings by
 * domain and severity relative to project size, checks existing local evidence,
 * and saves a reproducible 0-100 score report to .devmind/reports/score.json.
 */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { isMain } from './lib/project.mjs';
import { WORKSPACE } from './lib/layout.mjs';
import { evidencePath, fingerprint, parseOptions, readJson, writeReport } from './lib/runtime.mjs';
import { runVerify } from './verify.mjs';

const DOMAIN_RULES = Object.freeze({
  security: ['SEC-001', 'SEC-004', 'SEC-005', 'SEC-009'],
  'fe-standards': ['FE-011', 'FE-012', 'FE-013', 'FE-016'],
  reliability: ['FLOW-007', 'FLOW-008'],
  'code-quality': ['CODE-014', 'CODE-015', 'CODE-017'],
});

const DISPLAY_ORDER = ['security', 'fe-standards', 'reliability', 'code-quality'];
const DOMAIN_WEIGHTS = Object.freeze({ security: 2, 'fe-standards': 1, reliability: 1.5, 'code-quality': 1 });
const SEVERITY_PENALTY = Object.freeze({ error: 18, warning: 7 });
const MAX_HISTORY = 50;

function normalizeFindings(rawFindings = []) {
  return rawFindings.map(finding => ({
    ruleId: finding.rule?.id ?? finding.ruleId ?? finding.id ?? 'UNKNOWN',
    file: finding.file ?? finding.relPath ?? 'unknown',
    line: finding.line ?? finding.startLine ?? 0,
    severity: finding.rule?.severity ?? finding.severity ?? 'warning',
    message: finding.message ?? finding.rule?.name ?? '',
  }));
}

function domainForRule(ruleId) {
  for (const [domain, rules] of Object.entries(DOMAIN_RULES)) {
    if (rules.includes(ruleId)) return domain;
  }
  return 'code-quality';
}

export function scoreFindings(findings, filesScanned) {
  if (!filesScanned) {
    return { overall: null, domains: null, totalErrors: 0, totalWarnings: 0, hotspots: [] };
  }

  const byDomain = Object.fromEntries(DISPLAY_ORDER.map(domain => [domain, []]));
  const byFile = new Map();

  for (const finding of findings) {
    const domain = domainForRule(finding.ruleId);
    byDomain[domain].push(finding);

    const penalty = SEVERITY_PENALTY[finding.severity] ?? SEVERITY_PENALTY.warning;
    const entry = byFile.get(finding.file) ?? { file: finding.file, errors: 0, warnings: 0, weight: 0 };
    if (finding.severity === 'error') entry.errors += 1;
    else entry.warnings += 1;
    entry.weight += penalty;
    byFile.set(finding.file, entry);
  }

  // Smooth density adjustment so larger projects still show monotonic progress when findings are fixed.
  const scale = Math.max(1, Math.sqrt(filesScanned / 5));
  const domains = {};
  for (const domain of DISPLAY_ORDER) {
    const domainFindings = byDomain[domain];
    const errors = domainFindings.filter(f => f.severity === 'error').length;
    const warnings = domainFindings.filter(f => f.severity !== 'error').length;
    const rawPenalty = errors * SEVERITY_PENALTY.error + warnings * SEVERITY_PENALTY.warning;
    const score = rawPenalty === 0 ? 100 : Math.max(0, Math.round(100 * Math.exp(-(rawPenalty / scale) / 65)));
    domains[domain] = { score, errors, warnings };
  }

  const totalWeight = Object.values(DOMAIN_WEIGHTS).reduce((a, b) => a + b, 0);
  const overall = Math.round(
    DISPLAY_ORDER.reduce((sum, domain) => sum + domains[domain].score * DOMAIN_WEIGHTS[domain], 0) / totalWeight
  );

  const totalErrors = findings.filter(f => f.severity === 'error').length;
  const totalWarnings = findings.filter(f => f.severity !== 'error').length;
  const hotspots = [...byFile.values()]
    .sort((a, b) => b.weight - a.weight || b.errors - a.errors || a.file.localeCompare(b.file, 'en'))
    .slice(0, 3);

  return { overall, domains, totalErrors, totalWarnings, hotspots };
}

async function readHistory(root) {
  const path = await evidencePath(root, WORKSPACE.scoreHistory);
  let raw;
  try {
    raw = await readFile(path, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  const parsed = JSON.parse(raw.replace(/^\uFEFF/, ''));
  if (!Array.isArray(parsed)) throw new Error(`Invalid score history format: ${WORKSPACE.scoreHistory}`);
  return parsed;
}

async function inspectEvidence(root, currentDigest) {
  let qualityStatus = 'not-run';
  const qualityPath = join(root, WORKSPACE.quality);
  if (existsSync(qualityPath)) {
    try {
      const report = await readJson(qualityPath);
      if (report.sourceDigest && report.sourceDigest !== currentDigest) qualityStatus = 'stale';
      else if (typeof report.status === 'string') qualityStatus = report.status;
    } catch {
      qualityStatus = 'invalid';
    }
  }
  return {
    memoryInitialized: existsSync(join(root, '.devmind', 'task.md')),
    qualityReport: qualityStatus,
  };
}

export async function runScore(targetDir = '.', options = {}) {
  const root = resolve(targetDir);
  const sourceDigest = await fingerprint(root);
  const verifyResult = await runVerify(root, { toolingRoot: options.toolingRoot });
  const findings = normalizeFindings(verifyResult.findings);
  const scored = scoreFindings(findings, verifyResult.filesScanned);
  const evidence = await inspectEvidence(root, sourceDigest);

  const record = {
    version: 1,
    timestamp: new Date().toISOString(),
    project: root,
    sourceDigest,
    status: verifyResult.filesScanned === 0 ? 'no-source' : 'scored',
    filesScanned: verifyResult.filesScanned,
    parser: verifyResult.engine.parser,
    overall: scored.overall,
    domains: scored.domains,
    totalErrors: scored.totalErrors,
    totalWarnings: scored.totalWarnings,
    findingCount: findings.length,
    hotspots: scored.hotspots,
    evidence,
    limitations: [
      'Scores reflect static source heuristics and optional AST checks, weighted by project file count.',
      'A 100 score means no static findings matched; it does not prove authorization correctness, visual quality, or passing runtime tests.',
      ...verifyResult.limitations,
    ],
  };

  let previous = null;
  if (options.diff) {
    const history = await readHistory(root);
    previous = history.at(-1) ?? null;
  }

  await writeReport(root, WORKSPACE.score, record);
  if (options.save) {
    const history = await readHistory(root);
    history.push(record);
    await writeReport(root, WORKSPACE.scoreHistory, history.slice(-MAX_HISTORY));
  }

  return { record, previous, saved: Boolean(options.save) };
}

function bar(score, width = 10) {
  const filled = Math.round((score / 100) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function delta(now, prev) {
  if (prev === undefined || prev === null || now === null) return '';
  const diff = now - prev;
  if (diff === 0) return '  (no change)';
  return diff > 0 ? `  (+${diff})` : `  (${diff})`;
}

export function renderScoreReport({ record, previous }) {
  const lines = [];
  const proj = basename(record.project);
  const date = record.timestamp.slice(0, 10);

  lines.push('');
  lines.push(`  DevMind Score · ${proj} · ${date}`);
  lines.push('  ' + '─'.repeat(46));

  if (record.status === 'no-source') {
    lines.push('  No supported source files found to score.');
    lines.push(`  Saved to ${WORKSPACE.score}`);
    lines.push('');
    return lines.join('\n');
  }

  const prevOverall = previous?.overall ?? null;
  lines.push(`  Overall        ${String(record.overall).padStart(3)} / 100  ${bar(record.overall)}${delta(record.overall, prevOverall)}`);
  lines.push('');

  for (const domain of DISPLAY_ORDER) {
    const { score } = record.domains[domain];
    const prevScore = previous?.domains?.[domain]?.score ?? null;
    lines.push(`  ${domain.padEnd(14)} ${String(score).padStart(3)} / 100  ${bar(score)}${delta(score, prevScore)}`);
  }

  lines.push('  ' + '─'.repeat(46));
  lines.push(`  Files scanned  ${record.filesScanned} (parser: ${record.parser})`);
  lines.push(`  Findings       ${record.totalErrors} error${record.totalErrors === 1 ? '' : 's'} · ${record.totalWarnings} warning${record.totalWarnings === 1 ? '' : 's'}`);

  if (previous && previous.overall !== null) {
    lines.push(`                 (was ${previous.totalErrors} error${previous.totalErrors === 1 ? '' : 's'} · ${previous.totalWarnings} warning${previous.totalWarnings === 1 ? '' : 's'})`);
    const diff = record.overall - previous.overall;
    const trend = diff > 0 ? `↑ +${diff} pts` : diff < 0 ? `↓ ${diff} pts` : '→ no change';
    lines.push(`  Trend          ${trend} since ${previous.timestamp.slice(0, 10)}`);
  }

  lines.push(`  Evidence       memory=${record.evidence.memoryInitialized ? 'ready' : 'none'} · quality=${record.evidence.qualityReport}`);

  if (record.hotspots.length) {
    lines.push('');
    lines.push('  Top files to fix:');
    for (const spot of record.hotspots) {
      lines.push(`    • ${spot.file} (${spot.errors}e, ${spot.warnings}w)`);
    }
  }

  lines.push('');
  lines.push(`  Saved to ${WORKSPACE.score}`);
  if (!previous) lines.push('  Run with --save (or --diff) to track progress over time.');
  lines.push('');

  return lines.join('\n');
}

export async function main(args = process.argv.slice(2)) {
  const { flags, values, positional } = parseOptions(args, ['--tooling'], ['--diff', '--save']);
  if (flags.has('--help')) {
    console.log('Usage: node score.mjs [project] [--diff] [--save] [--json] [--tooling directory]\nScores source checks (0-100) by domain and saves .devmind/reports/score.json.\n  --diff   Compare against last saved run in score-history.json (also saves this run)\n  --save   Append this run to score-history.json\n  --json   Machine-readable JSON output');
    return;
  }
  if (positional.length > 1) throw new Error('Expected at most one directory.');

  const diff = flags.has('--diff');
  const save = flags.has('--save') || diff;
  const result = await runScore(positional[0] ?? '.', { diff, save, toolingRoot: values['--tooling'] });

  if (flags.has('--json')) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(renderScoreReport(result));
  }
}

if (isMain(import.meta.url)) {
  main().catch(error => {
    console.error(`Score: ${error.message}`);
    process.exitCode = 2;
  });
}
