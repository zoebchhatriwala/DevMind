#!/usr/bin/env node
import { readdir, readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

import { runVerify, main as verifyMain } from '../scripts/verify.mjs';
import { main as inspectMain } from '../scripts/inspect.mjs';
import { main as contrastMain } from '../scripts/contrast.mjs';
import { main as browserMain } from '../scripts/browser-audit.mjs';
import { main as qualityMain } from '../scripts/quality.mjs';
import { main as reviewMain } from '../scripts/review.mjs';
import { main as evalMain } from '../scripts/eval.mjs';
import { HELPER_FILES } from '../scripts/lib/helpers.mjs';
import { buildStrataHtml } from '../scripts/strata.mjs';
import { initDevmind } from '../scripts/init.mjs';
import { generateHandover } from '../scripts/handover.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '..');
const DIST_DIR = join(ROOT_DIR, 'dist');
const SKILLS_DIR = join(ROOT_DIR, 'skills');

const VERSION = '1.0.0';

const BANNER = `
=============================================================
  ____                 __  __ _           _
 |  _ \\  _____   __   |  \\/  (_)_ __   __| |
 | | | |/ _ \\ \\ / /   | |\\/| | | '_ \\ / _\` |
 | |_| |  __/\\ V /    | |  | | | | | | (_| |
 |____/ \\___| \\_/     |_|  |_|_|_| |_|\\__,_|
 DevMind Engineering Baseline & AI Agent Skills
 v${VERSION}
=============================================================
`;

/**
 * Ensures distribution artifacts exist. If not, builds them.
 */
async function ensureBuilt() {
  if (!existsSync(DIST_DIR) || !existsSync(join(DIST_DIR, 'bundles', 'manifest.json'))) {
    console.log('Building DevMind distribution bundles...');
    const { build } = await import('../scripts/build.mjs');
    await build();
  }
}

/**
 * Installs DevMind locally into current project.
 */
async function installReferences(destination) {
  const entries = await readdir(SKILLS_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const source = join(SKILLS_DIR, entry.name, 'references');
    if (!existsSync(source)) continue;
    await mkdir(destination, { recursive: true });
    await cp(source, destination, { recursive: true });
  }
}

export async function installLocal(targetDir = '.', targets = ['all'], options = {}) {
  await ensureBuilt();
  const dest = resolve(targetDir);
  console.log(`\n📦 Installing DevMind (Local) into: ${dest}\n`);

  // 1. Initialize .devmind vault
  await initDevmind(dest, options);

  // 2. Install scripts into .devmind/scripts for AI agents
  const destScripts = join(dest, '.devmind', 'scripts');
  await mkdir(destScripts, { recursive: true });
  const scriptFiles = HELPER_FILES;
  for (const s of scriptFiles) {
    const src = join(ROOT_DIR, 'scripts', s);
    if (existsSync(src)) {
      await cp(src, join(destScripts, s), { recursive: true });
    }
  }
  console.log('  ✔ Installed DevMind helper scripts (.devmind/scripts/verify.mjs, strata.mjs, init.mjs, handover.mjs)');
  await installReferences(join(dest, '.devmind', 'references'));

  const targetSet = new Set(targets.map(t => t.toLowerCase()));
  const isAll = targetSet.has('all');

  // Universal AGENTS.md
  if (isAll || targetSet.has('agents') || targetSet.has('openskills')) {
    await cp(join(DIST_DIR, 'agents', 'AGENTS.md'), join(dest, 'AGENTS.md'));
    const agentsSkillDir = join(dest, '.agents', 'skills', 'devmind');
    await mkdir(agentsSkillDir, { recursive: true });
    await cp(join(DIST_DIR, 'antigravity', 'devmind'), agentsSkillDir, { recursive: true });
    // Also copy helper scripts into .agents/skills/devmind/scripts
    await mkdir(join(agentsSkillDir, 'scripts'), { recursive: true });
    for (const s of scriptFiles) {
      const src = join(ROOT_DIR, 'scripts', s);
      if (existsSync(src)) await cp(src, join(agentsSkillDir, 'scripts', s), { recursive: true });
    }
    console.log('  ✔ Installed Universal AGENTS.md & OpenSkills (.agents/skills/devmind/)');
  }

  // Cursor IDE
  if (isAll || targetSet.has('cursor')) {
    const cursorRulesDir = join(dest, '.cursor', 'rules');
    await mkdir(cursorRulesDir, { recursive: true });
    await cp(join(DIST_DIR, 'cursor', '.cursor', 'rules'), cursorRulesDir, { recursive: true });
    await cp(join(DIST_DIR, 'cursor', '.cursorrules'), join(dest, '.cursorrules'));
    console.log('  ✔ Installed Cursor IDE rules (.cursorrules & .cursor/rules/*.mdc)');
  }

  // Claude Code
  if (isAll || targetSet.has('claude') || targetSet.has('claude-code')) {
    await cp(join(DIST_DIR, 'claude-code', 'CLAUDE.md'), join(dest, 'CLAUDE.md'));
    const claudeSkillDir = join(dest, '.claude', 'skills', 'devmind');
    await mkdir(claudeSkillDir, { recursive: true });
    await cp(join(DIST_DIR, 'antigravity', 'devmind'), claudeSkillDir, { recursive: true });
    await mkdir(join(claudeSkillDir, 'scripts'), { recursive: true });
    for (const s of scriptFiles) {
      const src = join(ROOT_DIR, 'scripts', s);
      if (existsSync(src)) await cp(src, join(claudeSkillDir, 'scripts', s), { recursive: true });
    }
    console.log('  ✔ Installed Claude Code rules (CLAUDE.md & .claude/skills/devmind/)');
  }

  // Windsurf / Cascade
  if (isAll || targetSet.has('windsurf')) {
    const windsurfRulesDir = join(dest, '.windsurf', 'rules');
    await mkdir(windsurfRulesDir, { recursive: true });
    await cp(join(DIST_DIR, 'windsurf', '.windsurf', 'rules'), windsurfRulesDir, { recursive: true });
    await cp(join(DIST_DIR, 'windsurf', '.windsurfrules'), join(dest, '.windsurfrules'));
    console.log('  ✔ Installed Windsurf / Cascade rules (.windsurfrules & .windsurf/rules/)');
  }

  // GitHub Copilot
  if (isAll || targetSet.has('copilot') || targetSet.has('github-copilot')) {
    const copilotDir = join(dest, '.github');
    await mkdir(copilotDir, { recursive: true });
    await cp(join(DIST_DIR, 'github-copilot', '.github'), copilotDir, { recursive: true });
    console.log('  ✔ Installed GitHub Copilot instructions (.github/copilot-instructions.md)');
  }

  // Cline / Roo Code
  if (isAll || targetSet.has('cline') || targetSet.has('roo')) {
    await cp(join(DIST_DIR, 'cline', '.clinerules'), join(dest, '.clinerules'));
    console.log('  ✔ Installed Cline / Roo Code rules (.clinerules)');
  }

  console.log('\n✔ Local installation complete! DevMind is now active in this project.');
}

/**
 * Installs DevMind globally across user environment.
 */
export async function installGlobal(targets = ['all'], options = {}) {
  await ensureBuilt();
  const home = homedir();
  console.log(`\n🌐 Installing DevMind (Global) across user environment (${home})\n`);

  const targetSet = new Set(targets.map(t => t.toLowerCase()));
  const isAll = targetSet.has('all');
  const scriptFiles = HELPER_FILES;
  const sharedScripts = join(home, '.devmind', 'scripts');
  await mkdir(sharedScripts, { recursive: true });
  for (const file of scriptFiles) {
    await cp(join(ROOT_DIR, 'scripts', file), join(sharedScripts, file), { recursive: true });
  }
  console.log('  Installed shared helper tools in ~/.devmind/scripts/');
  await installReferences(join(home, '.devmind', 'references'));

  // Antigravity & Gemini CLI (~/.gemini/config/skills/devmind)
  if (isAll || targetSet.has('antigravity') || targetSet.has('gemini')) {
    const geminiSkillsDir = join(home, '.gemini', 'config', 'skills', 'devmind');
    await mkdir(geminiSkillsDir, { recursive: true });
    await cp(join(DIST_DIR, 'antigravity', 'devmind'), geminiSkillsDir, { recursive: true });
    // Bundle scripts into skill
    const gScripts = join(geminiSkillsDir, 'scripts');
    await mkdir(gScripts, { recursive: true });
    for (const s of scriptFiles) {
      const src = join(ROOT_DIR, 'scripts', s);
      if (existsSync(src)) await cp(src, join(gScripts, s), { recursive: true });
    }
    console.log(`  ✔ Google Antigravity & Gemini: ~/.gemini/config/skills/devmind/`);
  }

  // Claude Code (~/.claude/skills/devmind)
  if (isAll || targetSet.has('claude') || targetSet.has('claude-code')) {
    const claudeGlobalSkillsDir = join(home, '.claude', 'skills', 'devmind');
    await mkdir(claudeGlobalSkillsDir, { recursive: true });
    await cp(join(DIST_DIR, 'antigravity', 'devmind'), claudeGlobalSkillsDir, { recursive: true });
    const cScripts = join(claudeGlobalSkillsDir, 'scripts');
    await mkdir(cScripts, { recursive: true });
    for (const s of scriptFiles) {
      const src = join(ROOT_DIR, 'scripts', s);
      if (existsSync(src)) await cp(src, join(cScripts, s), { recursive: true });
    }
    console.log(`  ✔ Claude Code: ~/.claude/skills/devmind/`);
  }

  // Universal OpenSkills (~/.agents/skills/devmind)
  if (isAll || targetSet.has('agents') || targetSet.has('openskills')) {
    const agentsGlobalSkillsDir = join(home, '.agents', 'skills', 'devmind');
    await mkdir(agentsGlobalSkillsDir, { recursive: true });
    await cp(join(DIST_DIR, 'antigravity', 'devmind'), agentsGlobalSkillsDir, { recursive: true });
    const aScripts = join(agentsGlobalSkillsDir, 'scripts');
    await mkdir(aScripts, { recursive: true });
    for (const s of scriptFiles) {
      const src = join(ROOT_DIR, 'scripts', s);
      if (existsSync(src)) await cp(src, join(aScripts, s), { recursive: true });
    }
    console.log(`  ✔ Universal OpenSkills: ~/.agents/skills/devmind/`);
  }

  // Cursor IDE global rules (~/.cursor/rules/)
  if (isAll || targetSet.has('cursor')) {
    const cursorGlobalDir = join(home, '.cursor', 'rules');
    await mkdir(cursorGlobalDir, { recursive: true });
    await cp(join(DIST_DIR, 'cursor', '.cursor', 'rules'), cursorGlobalDir, { recursive: true });
    console.log(`  ✔ Cursor IDE: ~/.cursor/rules/`);
  }

  // Windsurf global rules (~/.windsurf/rules/)
  if (isAll || targetSet.has('windsurf')) {
    const windsurfGlobalDir = join(home, '.windsurf', 'rules');
    await mkdir(windsurfGlobalDir, { recursive: true });
    await cp(join(DIST_DIR, 'windsurf', '.windsurf', 'rules'), windsurfGlobalDir, { recursive: true });
    console.log(`  ✔ Windsurf / Cascade: ~/.windsurf/rules/`);
  }

  console.log('\n✔ Global installation complete! DevMind is now available to your AI agents across all workspaces.');
}

/**
 * Runs the interactive terminal wizard.
 */
async function runInteractiveWizard() {
  console.log(BANNER);

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log('Select action:');
    console.log('  1) Install DevMind Standards & Skills');
    console.log('  2) Initialize .devmind/ Memory Vault in current project');
    console.log('  3) Run Strata Visualizer (Generate .devmind/strata.html)');
    console.log('  4) Run DevMind Verify / Lint (10 Quality & Security Checks)');
    console.log('  5) Generate Session Handover (.devmind/handover.md)');
    console.log('  6) Build Distribution Artifacts (dist/)');
    console.log('  0) Exit\n');

    const action = (await rl.question('Enter choice [1]: ')).trim() || '1';

    if (action === '0') {
      console.log('Goodbye!');
      return;
    }

    if (action === '2') {
      await initDevmind('.');
      console.log('\n✔ Initialized .devmind/ memory vault.');
      return;
    }

    if (action === '3') {
      await buildStrataHtml('.');
      return;
    }

    if (action === '4') {
      await runVerify('.');
      return;
    }

    if (action === '5') {
      await generateHandover('.');
      return;
    }

    if (action === '6') {
      const { build } = await import('../scripts/build.mjs');
      await build();
      return;
    }

    // Install Action
    console.log('\nWhere do you want to install DevMind?');
    console.log('  1) Local  (Current project / workspace only - Recommended for repos)');
    console.log('  2) Global (User profile - Available across all projects on this machine)');
    console.log('  3) Both   (Install globally and equip current project)');
    const scopeChoice = (await rl.question('Enter choice [1]: ')).trim() || '1';

    console.log('\nWhich AI coding agents do you want to configure?');
    console.log('  1) All Supported Agents (Antigravity, Cursor, Claude Code, Windsurf, Copilot, Cline, OpenSkills) [Recommended]');
    console.log('  2) Google Antigravity & Gemini CLI');
    console.log('  3) Cursor IDE (.cursorrules & .cursor/rules/*.mdc)');
    console.log('  4) Claude Code (CLAUDE.md & skills)');
    console.log('  5) Windsurf / Cascade (.windsurfrules)');
    console.log('  6) GitHub Copilot (.github/copilot-instructions.md)');
    console.log('  7) Universal OpenSkills / AGENTS.md (.agents/skills/devmind)');
    const agentChoice = (await rl.question('Enter choice [1]: ')).trim() || '1';

    let targets = ['all'];
    if (agentChoice === '2') targets = ['antigravity'];
    else if (agentChoice === '3') targets = ['cursor'];
    else if (agentChoice === '4') targets = ['claude'];
    else if (agentChoice === '5') targets = ['windsurf'];
    else if (agentChoice === '6') targets = ['copilot'];
    else if (agentChoice === '7') targets = ['openskills'];

    if (scopeChoice === '1' || scopeChoice === '3') {
      await installLocal('.', targets);
    }
    if (scopeChoice === '2' || scopeChoice === '3') {
      await installGlobal(targets);
    }

    const runCheck = (await rl.question('\nRun initial DevMind quality check now? [Y/n]: ')).trim().toLowerCase();
    if (runCheck !== 'n') {
      await runVerify('.');
    }
  } finally {
    rl.close();
  }
}

function printHelp() {
  console.log(BANNER);
  console.log(`Usage:
  npx devmind [command] [options]
  devmind [command] [options]

Commands:
  (no args)             Launch interactive installer wizard (TTY)
  install               Install DevMind standards & skills
  init                  Bootstrap .devmind/ memory vault (task, memory, rules, gitignore)
  strata                Generate interactive .devmind/strata.html architecture visualizer
  verify, check, lint   Run read-only source heuristics (--json, --strict)
  inspect               Discover existing components, tokens, packages, and quality tools
  contrast              Check solid hex color contrast (quote both colors)
  browser-audit         Capture local browser evidence and run explicit assertions
  quality               Discover project checks; --run executes existing scripts
  review                Combine current source, check, browser, and reviewer evidence
  eval                  Prepare and evaluate realistic skill tasks (--list)
  handover              Generate or update .devmind/handover.md from git status
  build                 Compile multi-agent distribution artifacts into dist/

Install Options:
  -l, --local           Install locally into current workspace
  -g, --global          Install globally into user home directory
  -t, --target <list>   Comma-separated target agents (all, antigravity, cursor, claude, windsurf, copilot, cline, openskills)
  -y, --yes             Skip confirmation prompts

General Options:
  --json                Machine-readable output (verify, inspect, contrast, strata)
  --strict              Fail on warnings as well as errors (verify)
  -h, --help            Show this help documentation
  -v, --version         Show DevMind version
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('-v') || args.includes('--version')) {
    console.log(`v${VERSION}`);
    return;
  }

  if (args.includes('-h') || args.includes('--help')) {
    printHelp();
    return;
  }

  const command = args[0] && !args[0].startsWith('-') ? args[0] : null;

  if (command === 'init') {
    await initDevmind(args[1] && !args[1].startsWith('-') ? args[1] : '.');
    return;
  }

  if (command === 'strata') {
    if (args.includes('--json')) {
      const { generateStrataData } = await import('../scripts/strata.mjs');
      const data = await generateStrataData(args[1] && !args[1].startsWith('-') ? args[1] : '.');
      console.log(JSON.stringify(data, null, 2));
    } else {
      await buildStrataHtml(args[1] && !args[1].startsWith('-') ? args[1] : '.');
      console.log(`\n✔ Strata map generated. Click to view: file:///${resolve('.devmind/strata.html').replace(/\\/g, '/')}`);
    }
    return;
  }

  if (command === 'verify' || command === 'check' || command === 'lint') {
    await verifyMain(args.slice(1));
    return;
  }
  if (command === 'inspect') {
    await inspectMain(args.slice(1));
    return;
  }
  if (command === 'contrast') {
    await contrastMain(args.slice(1));
    return;
  }
  if (command === 'browser-audit') { await browserMain(args.slice(1)); return; }
  if (command === 'quality') { await qualityMain(args.slice(1)); return; }
  if (command === 'review') { await reviewMain(args.slice(1)); return; }
  if (command === 'eval') { await evalMain(args.slice(1)); return; }

  if (command === 'handover') {
    await generateHandover(args[1] && !args[1].startsWith('-') ? args[1] : '.');
    return;
  }

  if (command === 'build') {
    const { build } = await import('../scripts/build.mjs');
    await build();
    return;
  }

  if (command === 'install') {
    const isGlobal = args.includes('-g') || args.includes('--global');
    const isLocal = args.includes('-l') || args.includes('--local') || !isGlobal;
    const targetIdx = args.findIndex(a => a === '-t' || a === '--target');
    const targetArg = targetIdx !== -1 && args[targetIdx + 1] ? args[targetIdx + 1] : 'all';
    const targets = targetArg.split(',').map(s => s.trim());

    if (isLocal) await installLocal('.', targets);
    if (isGlobal) await installGlobal(targets);
    return;
  }

  // If interactive terminal and no command provided, run interactive wizard
  if (process.stdin.isTTY && !command) {
    await runInteractiveWizard();
    return;
  }

  // Non-interactive default with no args
  if (command) throw new Error(`Unknown command: ${command}`);
  printHelp();
}

main().catch(err => {
  console.error('DevMind CLI error:', err);
  process.exitCode = 2;
});
