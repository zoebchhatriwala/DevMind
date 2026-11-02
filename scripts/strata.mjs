#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join, basename, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { runVerify } from './verify.mjs';
import { fileURLToPath } from 'node:url';
import { scanProject, SOURCE_EXTENSIONS } from './lib/project.mjs';

/**
 * Maps files and project structure into Strata nodes, journeys, and issues.
 */
export async function generateStrataData(targetDir = '.') {
  const root = resolve(targetDir);
  const verifyResults = await runVerify(root);
  const projectName = basename(root);

  // Scan files to build nodes
  const nodes = [];
  const connectionsMap = new Map();

  const addNode = (id, zone, kind, name, technicalName, plainLanguage, summary) => {
    // Collect issues matching this file
    const nodeIssues = verifyResults.findings
      .filter(f => f.file === technicalName || technicalName.endsWith(f.file) || f.file.endsWith(technicalName))
      .map(f => ({
        ruleId: f.rule.id,
        severity: f.rule.severity === 'error' ? 'CRITICAL' : f.rule.severity === 'warning' ? 'HIGH' : 'MEDIUM',
        confidence: 'Heuristic review',
        title: f.rule.name,
        file: f.file,
        line: f.line,
        snippet: f.snippet || '',
        evidence: f.message,
        threatModel: f.rule.description,
        blastRadius: 'Component / Route Scope',
        fixPrompt: `Fix ${f.rule.id} (${f.rule.name}) in ${f.file} at line ${f.line}:\n${f.fix}`,
      }));

    nodes.push({
      id,
      zone,
      kind,
      name,
      technicalName,
      plainLanguage,
      summary,
      trafficScore: null,
      connections: [],
      issues: nodeIssues,
    });
  };

  // Inspect package.json
  const pkgPath = join(root, 'package.json');
  let pkg = {};
  if (existsSync(pkgPath)) {
    try {
      pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
    } catch {
      pkg = { name: projectName };
    }
  }

  const project = await scanProject(root);
  for (const file of project.files) {
    const rel = file.relPath;
    if (!SOURCE_EXTENSIONS.has(file.ext) && !['.prisma', '.sql'].includes(file.ext)) continue;
    if (/(?:^|\/)(?:__tests__|fixtures)\/|\.(?:test|spec)\.[^.]+$/.test(rel)) continue;
    const label = basename(rel);
    if (/(?:^|\/)(?:api|routes|controllers|actions)\/|(?:^|\/)(?:route|actions?)\.[jt]s$/.test(rel)) {
      addNode(`route_${nodes.length + 1}`, 'server', 'route', label, rel, `Possible request handler: ${rel}`, 'Role inferred from filename; authentication and call paths need review.');
    } else if (/schema\.prisma$|(?:^|\/)(?:models|migrations|drizzle|db)\//.test(rel)) {
      addNode(`table_${nodes.length + 1}`, 'database', 'table', label, rel, `Persistence-related file: ${rel}`, 'File presence does not prove a deployed table or access policy.');
    } else if (/(?:^|\/)(?:page\.[jt]sx?|pages\/|index\.html$|App\.[jt]sx?$)/.test(rel)) {
      addNode(`screen_${nodes.length + 1}`, 'browser', 'screen', label, rel, `Possible screen entrypoint: ${rel}`, 'File presence does not prove a working route or user journey.');
    } else if (/(?:^|\/)(?:components|ui)\//.test(rel)) {
      addNode(`comp_${nodes.length + 1}`, 'browser', 'component', label, rel, `Presentation-related file: ${rel}`, 'Rendering context and interaction behavior need review.');
    }
  }

  // Detect common services from dependencies
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (deps['stripe']) {
    nodes.push({
      id: 'service_stripe',
      zone: 'database',
      kind: 'service',
      name: 'Stripe Payments',
      technicalName: 'api.stripe.com',
      plainLanguage: 'External service processing payments and cards',
      summary: 'Third-party payment gateway.',
      trafficScore: null,
      connections: [],
      issues: [],
    });
  }
  if (deps['@supabase/supabase-js'] || deps['@supabase/auth-helpers-nextjs']) {
    nodes.push({
      id: 'service_supabase',
      zone: 'database',
      kind: 'service',
      name: 'Supabase Cloud',
      technicalName: 'supabase.co',
      plainLanguage: 'External database and authentication service',
      summary: 'Managed Postgres and Auth provider.',
      trafficScore: null,
      connections: [],
      issues: [],
    });
  }
  if (deps['resend'] || deps['@sendgrid/mail']) {
    nodes.push({
      id: 'service_email',
      zone: 'database',
      kind: 'service',
      name: 'Email Delivery Service',
      technicalName: deps['resend'] ? 'api.resend.com' : 'api.sendgrid.com',
      plainLanguage: 'External transactional email service',
      summary: 'Delivers receipt and notification emails.',
      trafficScore: null,
      connections: [],
      issues: [],
    });
  }

  // Filename discovery cannot establish runtime edges or user journeys.
  const journeys = [];

  // Change Ledger via git log
  let gitLedger = [];
  try {
    const gitOutput = execFileSync('git', ['log', '-n', '5', '--pretty=format:%h|%an|%as|%s'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    gitLedger = gitOutput
      .split('\n')
      .filter(Boolean)
      .map((line, idx) => {
        const [id, author, date, subject] = line.split('|');
        return {
          id: id || 'git-head',
          author: author || 'Developer',
          date: date || new Date().toISOString().split('T')[0],
          subject: subject || 'Recent code change',
          consequence: 'Commit recorded in Git. Its file impact has not been analyzed.',
          badges: [idx === 0 ? '⚡ Latest Commit' : 'Commit'],
          isLatest: idx === 0,
          blastRadius: 'Not analyzed',
        };
      });
  } catch {
    gitLedger = [
      {
        id: 'init',
        author: 'Developer',
        date: new Date().toISOString().split('T')[0],
        subject: 'Current repository state',
        consequence: 'Initial visual code map generated.',
        badges: ['⚡ Active'],
        isLatest: true,
        blastRadius: `${nodes.length} components analyzed`,
      },
    ];
  }

  return {
    nodes,
    journeys,
    gitLedger,
    isDemo: false,
    scannedFilesCount: verifyResults.filesScanned,
    projectName,
    limitations: ['Roles are inferred from observed paths and installed dependency names.', 'Runtime edges, journeys, traffic, and commit blast radius are not measured.', ...verifyResults.limitations],
    checkCoverage: verifyResults.coverage,
  };
}

/**
 * Builds .devmind/strata.html
 */
export async function buildStrataHtml(targetDir = '.', outPath = null) {
  const root = resolve(targetDir);
  const data = await generateStrataData(root);

  // Locate strata.html template
  const possibleTemplates = [
    join(root, 'templates', '.devmind', 'strata.html'),
    join(root, '.devmind', 'strata.html'),
    join(dirname(fileURLToPath(import.meta.url)), '..', 'templates', '.devmind', 'strata.html'),
    join(dirname(fileURLToPath(import.meta.url)), '..', '.devmind', 'strata.html'),
  ];

  let templateHtml = null;
  for (const t of possibleTemplates) {
    if (existsSync(t)) {
      templateHtml = await readFile(t, 'utf8');
      break;
    }
  }

  if (!templateHtml) {
    throw new Error('Could not locate strata.html template. Ensure templates/.devmind/strata.html exists.');
  }

  // Inject STRATA_DATA
  const injected = templateHtml.replace(
    /const STRATA_DATA = [\s\S]*?;\r?\n/,
    () => `const STRATA_DATA = ${JSON.stringify(data).replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029')};\n`
  );

  const destFile = outPath ? resolve(outPath) : join(root, '.devmind', 'strata.html');
  await mkdir(dirname(destFile), { recursive: true });
  await writeFile(destFile, injected, 'utf8');

  return { destFile, data };
}

// CLI Execution
async function main() {
  const args = process.argv.slice(2);
  const jsonMode = args.includes('--json');
  const targetDir = args.find(a => !a.startsWith('-')) || '.';

  if (jsonMode) {
    const data = await generateStrataData(targetDir);
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  console.log('\n=============================================================');
  console.log('🗺️ DevMind Strata Architecture Visualizer');
  console.log('=============================================================');
  const { destFile, data } = await buildStrataHtml(targetDir);

  const fileUrl = `file:///${destFile.replace(/\\/g, '/')}`;
  console.log(`\n✔ Generated interactive code map at:`);
  console.log(`  ${fileUrl}\n`);
  console.log(`🧠 [DevMind: strata | Checked: ${data.nodes.length} nodes mapped, source heuristics evaluated, .devmind/strata.html generated]`);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  main().catch(err => {
    console.error('Strata script error:', err);
    process.exit(1);
  });
}
