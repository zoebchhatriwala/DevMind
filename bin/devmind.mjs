#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { resolve, join, dirname, basename } from 'node:path';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

import { beginInstallation, copyInstalledFiles, finishInstallation, parseInstallArgs, parseUninstallArgs, removeDuplicateMaster, uninstallFromRoot, validateTargets } from '../scripts/lib/install.mjs';
import { COMMANDS, COMMAND_BY_NAME } from '../scripts/lib/commands.mjs';
import { artifactPath } from '../scripts/lib/runtime.mjs';
import { isMain } from '../scripts/lib/project.mjs';
import { initDevmind } from '../scripts/init.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '..');
const DIST_DIR = join(ROOT_DIR, 'dist');

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
async function installReferences(destination, state) {
  await copyInstalledFiles(join(DIST_DIR, 'agents', '.devmind', 'skills'), destination, state);
}

async function installCommandSkills(skillsSourceDir, skillsDestDir, state) {
  for (const cmd of COMMANDS) {
    await copyInstalledFiles(join(skillsSourceDir, cmd.slash), join(skillsDestDir, cmd.slash), state);
  }
}

export async function installLocal(targetDir = '.', targets = ['all']) {
  targets = validateTargets(targets, 'local');
  await ensureBuilt();
  const dest = resolve(targetDir);
  console.log(`\n📦 Installing DevMind (Local) into: ${dest}\n`);

  const state = await beginInstallation(dest);
  await artifactPath(dest, '.gitignore');
  for (const note of ['task', 'memory', 'rules']) await artifactPath(dest, `.devmind/${note}.md`);
  await initDevmind(dest);

  // 2. Install scripts into .devmind/scripts for AI agents
  const tools = join(DIST_DIR, 'antigravity', 'skills', 'devmind');
  await copyInstalledFiles(join(tools, 'scripts'), join(dest, '.devmind', 'scripts'), state);
  await copyInstalledFiles(join(tools, 'templates'), join(dest, '.devmind', 'templates'), state);
  console.log('  ✔ Installed DevMind helper scripts (.devmind/scripts/verify.mjs, score.mjs, strata.mjs, init.mjs, handover.mjs)');
  await installReferences(join(dest, '.devmind', 'skills'), state);

  const targetSet = new Set(targets.map(t => t.toLowerCase()));
  const isAll = targetSet.has('all');

  // Universal AGENTS.md & OpenSkills
  if (isAll || targetSet.has('agents') || targetSet.has('openskills') || targetSet.has('antigravity') || targetSet.has('gemini')) {
    await copyInstalledFiles(join(DIST_DIR, 'agents', 'AGENTS.md'), join(dest, 'AGENTS.md'), state);
    const agentsSkillDir = join(dest, '.agents', 'skills', 'devmind');
    await removeDuplicateMaster(tools, agentsSkillDir, state);
    await copyInstalledFiles(join(DIST_DIR, 'antigravity', 'skills', 'devmind'), agentsSkillDir, state);
    await installCommandSkills(join(DIST_DIR, 'agents', '.agents', 'skills'), join(dest, '.agents', 'skills'), state);
    console.log('  ✔ Installed Universal AGENTS.md & OpenSkills (.agents/skills/devmind*)');
  }

  // Cursor IDE
  if (isAll || targetSet.has('cursor')) {
    const cursorRulesDir = join(dest, '.cursor', 'rules');
    await copyInstalledFiles(join(DIST_DIR, 'cursor', '.cursor', 'rules'), cursorRulesDir, state);
    await copyInstalledFiles(join(DIST_DIR, 'cursor', '.cursor', 'commands'), join(dest, '.cursor', 'commands'), state);
    await copyInstalledFiles(join(DIST_DIR, 'cursor', '.cursorrules'), join(dest, '.cursorrules'), state);
    console.log('  ✔ Installed Cursor IDE rules & commands (.cursorrules, .cursor/rules/*.mdc, .cursor/commands/)');
  }

  // Claude Code
  if (isAll || targetSet.has('claude') || targetSet.has('claude-code')) {
    await copyInstalledFiles(join(DIST_DIR, 'claude-code', 'CLAUDE.md'), join(dest, 'CLAUDE.md'), state);
    const claudeSkillDir = join(dest, '.claude', 'skills', 'devmind');
    await removeDuplicateMaster(tools, claudeSkillDir, state);
    await copyInstalledFiles(join(DIST_DIR, 'antigravity', 'devmind'), claudeSkillDir, state);
    await installCommandSkills(join(DIST_DIR, 'claude-code', '.claude', 'skills'), join(dest, '.claude', 'skills'), state);
    console.log('  ✔ Installed Claude Code rules & slash skills (CLAUDE.md & .claude/skills/devmind*)');
  }

  // Windsurf / Cascade
  if (isAll || targetSet.has('windsurf')) {
    const windsurfRulesDir = join(dest, '.windsurf', 'rules');
    await copyInstalledFiles(join(DIST_DIR, 'windsurf', '.windsurf', 'rules'), windsurfRulesDir, state);
    await copyInstalledFiles(join(DIST_DIR, 'windsurf', '.windsurf', 'workflows'), join(dest, '.windsurf', 'workflows'), state);
    await copyInstalledFiles(join(DIST_DIR, 'windsurf', '.windsurfrules'), join(dest, '.windsurfrules'), state);
    console.log('  ✔ Installed Windsurf / Cascade rules & workflows (.windsurfrules, .windsurf/rules/, .windsurf/workflows/)');
  }

  // GitHub Copilot
  if (isAll || targetSet.has('copilot') || targetSet.has('github-copilot')) {
    const copilotDir = join(dest, '.github');
    await copyInstalledFiles(join(DIST_DIR, 'github-copilot', '.github'), copilotDir, state);
    console.log('  ✔ Installed GitHub Copilot instructions (.github/copilot-instructions.md)');
  }

  // Cline / Roo Code
  if (isAll || targetSet.has('cline') || targetSet.has('roo')) {
    await copyInstalledFiles(join(DIST_DIR, 'cline', '.clinerules'), join(dest, '.clinerules'), state);
    console.log('  ✔ Installed Cline / Roo Code rules (.clinerules)');
  }

  return finishInstallation(state);
}

/**
 * Installs DevMind globally across user environment.
 */
export async function installGlobal(targets = ['all']) {
  targets = validateTargets(targets, 'global');
  await ensureBuilt();
  const home = homedir();
  console.log(`\n🌐 Installing DevMind (Global) across user environment (${home})\n`);

  const targetSet = new Set(targets.map(t => t.toLowerCase()));
  const isAll = targetSet.has('all');
  const state = await beginInstallation(home);
  const tools = join(DIST_DIR, 'antigravity', 'skills', 'devmind');
  await copyInstalledFiles(join(tools, 'scripts'), join(home, '.devmind', 'scripts'), state);
  await copyInstalledFiles(join(tools, 'templates'), join(home, '.devmind', 'templates'), state);
  console.log('  Installed shared helper tools in ~/.devmind/scripts/');
  await installReferences(join(home, '.devmind', 'skills'), state);

  // Antigravity & Gemini CLI (~/.gemini/config/skills/devmind*)
  if (isAll || targetSet.has('antigravity') || targetSet.has('gemini')) {
    const geminiSkillsRoot = join(home, '.gemini', 'config', 'skills');
    const geminiSkillsDir = join(geminiSkillsRoot, 'devmind');
    await removeDuplicateMaster(tools, geminiSkillsDir, state);
    await copyInstalledFiles(join(DIST_DIR, 'antigravity', 'devmind'), geminiSkillsDir, state);
    await installCommandSkills(join(DIST_DIR, 'antigravity', 'skills'), geminiSkillsRoot, state);
    console.log('  ✔ Google Antigravity & Gemini: ~/.gemini/config/skills/devmind*');
  }

  // Claude Code (~/.claude/skills/devmind*)
  if (isAll || targetSet.has('claude') || targetSet.has('claude-code')) {
    const claudeGlobalSkillsRoot = join(home, '.claude', 'skills');
    const claudeGlobalSkillsDir = join(claudeGlobalSkillsRoot, 'devmind');
    await removeDuplicateMaster(tools, claudeGlobalSkillsDir, state);
    await copyInstalledFiles(join(DIST_DIR, 'antigravity', 'devmind'), claudeGlobalSkillsDir, state);
    await installCommandSkills(join(DIST_DIR, 'claude-code', '.claude', 'skills'), claudeGlobalSkillsRoot, state);
    console.log('  ✔ Claude Code: ~/.claude/skills/devmind*');
  }

  // Universal OpenSkills (~/.agents/skills/devmind*)
  if (isAll || targetSet.has('agents') || targetSet.has('openskills')) {
    const agentsGlobalSkillsRoot = join(home, '.agents', 'skills');
    const agentsGlobalSkillsDir = join(agentsGlobalSkillsRoot, 'devmind');
    await removeDuplicateMaster(tools, agentsGlobalSkillsDir, state);
    await copyInstalledFiles(join(DIST_DIR, 'antigravity', 'devmind'), agentsGlobalSkillsDir, state);
    await installCommandSkills(join(DIST_DIR, 'agents', '.agents', 'skills'), agentsGlobalSkillsRoot, state);
    console.log('  ✔ Universal OpenSkills: ~/.agents/skills/devmind*');
  }

  // Cursor IDE global rules & commands (~/.cursor/rules/ & ~/.cursor/commands/)
  if (isAll || targetSet.has('cursor')) {
    const cursorGlobalDir = join(home, '.cursor', 'rules');
    await copyInstalledFiles(join(DIST_DIR, 'cursor', '.cursor', 'rules'), cursorGlobalDir, state);
    await copyInstalledFiles(join(DIST_DIR, 'cursor', '.cursor', 'commands'), join(home, '.cursor', 'commands'), state);
    console.log('  ✔ Cursor IDE: ~/.cursor/rules/ & ~/.cursor/commands/');
  }

  // Windsurf global rules & workflows (~/.windsurf/rules/ & ~/.windsurf/workflows/)
  if (isAll || targetSet.has('windsurf')) {
    const windsurfGlobalDir = join(home, '.windsurf', 'rules');
    await copyInstalledFiles(join(DIST_DIR, 'windsurf', '.windsurf', 'rules'), windsurfGlobalDir, state);
    await copyInstalledFiles(join(DIST_DIR, 'windsurf', '.windsurf', 'workflows'), join(home, '.windsurf', 'workflows'), state);
    console.log('  ✔ Windsurf / Cascade: ~/.windsurf/rules/ & ~/.windsurf/workflows/');
  }

  return finishInstallation(state);
}

export async function uninstallLocal(targetDir = '.', targets = ['all'], options = {}) {
  const dest = resolve(targetDir);
  console.log(`\n🧹 Uninstalling DevMind (Local) from: ${dest}\n`);
  return uninstallFromRoot(dest, { targets, scope: 'local', dryRun: options.dryRun });
}

export async function uninstallGlobal(targets = ['all'], options = {}) {
  const home = homedir();
  console.log(`\n🧹 Uninstalling DevMind (Global) from: ${home}\n`);
  return uninstallFromRoot(home, { targets, scope: 'global', dryRun: options.dryRun });
}

async function runUninstallWizard() {
  console.log(BANNER);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const platforms = [
      ['all', 'All installed DevMind platforms'],
      ['antigravity', 'Google Antigravity & Gemini CLI'],
      ['cursor', 'Cursor IDE'],
      ['claude', 'Claude Code'],
      ['windsurf', 'Windsurf / Cascade'],
      ['openskills', 'Universal OpenSkills / AGENTS.md'],
      ['copilot', 'GitHub Copilot (local only)'],
      ['cline', 'Cline / Roo Code (local only)'],
      ['codex', 'OpenAI Codex'],
    ];
    console.log('\nWhich platform do you want to uninstall DevMind from?');
    platforms.forEach(([, label], index) => console.log(`  ${index + 1}) ${label}`));
    let platform;
    do {
      const choice = (await rl.question('Platform [1]: ')).trim() || '1';
      platform = platforms.find((_, index) => String(index + 1) === choice);
      if (!platform) console.log('Choose one of the listed platforms.');
    } while (!platform);
    const targets = [platform[0]];

    const supportsGlobal = !['copilot', 'cline'].includes(platform[0]);
    const scopes = supportsGlobal ? ['1', '2', '3'] : ['1'];
    console.log('\nWhere do you want to uninstall DevMind from?');
    console.log('  1) Local  (Current project / workspace only)');
    if (supportsGlobal) {
      console.log('  2) Global (User profile)');
      console.log('  3) Both   (Local and global)');
    }
    let scopeChoice;
    do {
      scopeChoice = (await rl.question('Uninstall scope [1]: ')).trim() || '1';
      if (!scopes.includes(scopeChoice)) {
        console.log(supportsGlobal ? 'Choose 1 (local), 2 (global), or 3 (both).' : 'This platform supports local installation only. Choose 1.');
      }
    } while (!scopes.includes(scopeChoice));

    if (scopeChoice === '1' || scopeChoice === '3') await uninstallLocal('.', targets);
    if (scopeChoice === '2' || scopeChoice === '3') await uninstallGlobal(targets);
  } finally {
    rl.close();
  }
}

/**
 * Runs the interactive terminal wizard.
 */
async function runInteractiveWizard({ installOnly = false } = {}) {
  console.log(BANNER);

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    if (!installOnly) {
      console.log('Select action:');
      console.log('  1) Install DevMind Standards & Skills');
      console.log('  2) Initialize .devmind/ Memory Vault in current project');
      console.log('  3) Run Strata Visualizer (Generate .devmind/maps/strata.html)');
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
        const { buildStrataHtml } = await import('../scripts/strata.mjs');
        await buildStrataHtml('.');
        return;
      }

      if (action === '4') {
        const { runVerify } = await import('../scripts/verify.mjs');
        await runVerify('.');
        return;
      }

      if (action === '5') {
        const { generateHandover } = await import('../scripts/handover.mjs');
        await generateHandover('.');
        return;
      }

      if (action === '6') {
        const { build } = await import('../scripts/build.mjs');
        await build();
        return;
      }
      if (action !== '1') throw new Error('Choose a listed action.');
    }

    const platforms = [
      ['all', 'All supported platforms'],
      ['antigravity', 'Google Antigravity & Gemini CLI'],
      ['cursor', 'Cursor IDE'],
      ['claude', 'Claude Code'],
      ['windsurf', 'Windsurf / Cascade'],
      ['openskills', 'Universal OpenSkills / AGENTS.md'],
      ['copilot', 'GitHub Copilot (local only)'],
      ['cline', 'Cline / Roo Code (local only)'],
      ['codex', 'OpenAI Codex'],
    ];
    console.log('\nWhich platform do you want to install DevMind for?');
    platforms.forEach(([, label], index) => console.log(`  ${index + 1}) ${label}`));
    let platform;
    do {
      const choice = (await rl.question('Platform [1]: ')).trim() || '1';
      platform = platforms.find((_, index) => String(index + 1) === choice);
      if (!platform) console.log('Choose one of the listed platforms.');
    } while (!platform);
    const targets = [platform[0]];

    const supportsGlobal = !['copilot', 'cline'].includes(platform[0]);
    const scopes = supportsGlobal ? ['1', '2', '3'] : ['1'];
    console.log('\nWhere do you want to install DevMind?');
    console.log('  1) Local  (Current project / workspace only - Recommended for repos)');
    if (supportsGlobal) {
      console.log('  2) Global (User profile - Available across all projects on this machine)');
      console.log('  3) Both   (Install globally and equip current project)');
    }
    let scopeChoice;
    do {
      scopeChoice = (await rl.question('Installation scope [1]: ')).trim() || '1';
      if (!scopes.includes(scopeChoice)) {
        console.log(supportsGlobal ? 'Choose 1 (local), 2 (global), or 3 (both).' : 'This platform supports local installation only. Choose 1.');
      }
    } while (!scopes.includes(scopeChoice));

    if (scopeChoice === '1' || scopeChoice === '3') {
      await installLocal('.', targets);
    }
    if (scopeChoice === '2' || scopeChoice === '3') {
      await installGlobal(targets);
    }

    if (scopeChoice === '1' || scopeChoice === '3') {
      const runCheck = (await rl.question('\nRun initial DevMind quality check now? [Y/n]: ')).trim().toLowerCase();
      if (runCheck !== 'n') {
        const { runVerify } = await import('../scripts/verify.mjs');
        await runVerify('.');
      }
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
  devmind-<command> [options]      (CLI alias; in coding agents use /devmind-<command>)

Commands:
  (no args)             Launch interactive installer wizard (TTY)
  install               Install DevMind standards & skills
  uninstall             Remove unmodified DevMind-managed files (--local/--global, --dry-run)
  init                  Bootstrap .devmind/ memory vault (/devmind-init)
  score                 Benchmark the project: 0-100 score per domain (/devmind-score)
  strata                Generate interactive .devmind/maps/strata.html architecture map (/devmind-strata)
  verify, check, lint   Run read-only source heuristics (--json, --strict) (/devmind-verify)
  inspect               Discover existing components, tokens, packages, and quality tools (/devmind-inspect)
  brief                 Preserve task intent with bounded source context and scope review (/devmind-brief)
  organize              Preview .devmind cleanup; --apply safely moves loose artifacts (/devmind-organize)
  contrast              Check solid hex color contrast (quote both colors) (/devmind-contrast)
  browser-audit         Capture local browser evidence and run explicit assertions
  quality               Discover project checks; --run executes existing scripts (/devmind-quality)
  review                Combine current source, check, browser, and reviewer evidence (/devmind-review)
  eval                  Prepare and evaluate realistic skill tasks (--list) (/devmind-eval)
  handover              Generate or update .devmind/handover.md from git status (/devmind-handover)
  build                 Compile multi-agent distribution artifacts into dist/

Install / Uninstall Options:
  --interactive        Choose scope and platform in the wizard
  -l, --local           Operate on current workspace
  -g, --global          Operate on user home directory
  -t, --target <list>   Comma-separated target agents (all, antigravity, cursor, claude, codex, windsurf, copilot, cline, openskills)
  --dry-run             Preview files that uninstall would remove without deleting them
  -y, --yes             Skip confirmation prompts

General Options:
  --json                Machine-readable output (verify, score, inspect, contrast, strata)
  --diff                Compare score against last saved run (score)
  --save                Persist score run to history (score)
  --strict              Fail on warnings as well as errors (verify)
  -h, --help            Show this help documentation
  -v, --version         Show DevMind version
`);
}

function resolveCliInvocation(argv) {
  const invokedAs = basename(argv[1] || '').replace(/\.(?:m?js|cmd|ps1|exe)$/i, '').toLowerCase();
  const userArgs = argv.slice(2);
  const binMatch = invokedAs.match(/^devmind-([a-z-]+)$/);
  if (binMatch && Object.hasOwn(COMMAND_BY_NAME, binMatch[1])) {
    return { command: binMatch[1], commandArgs: userArgs };
  }
  const rawFirst = userArgs[0] && !userArgs[0].startsWith('-') ? userArgs[0] : null;
  if (!rawFirst) return { command: null, commandArgs: userArgs };
  const slashMatch = rawFirst.match(/^\/?devmind-([a-z-]+)$/);
  const command = slashMatch && Object.hasOwn(COMMAND_BY_NAME, slashMatch[1]) ? slashMatch[1] : rawFirst;
  return { command, commandArgs: userArgs.slice(1) };
}

async function main() {
  const { command, commandArgs } = resolveCliInvocation(process.argv);
  const args = process.argv.slice(2);
  const scripts = { verify: 'verify', check: 'verify', lint: 'verify', inspect: 'inspect', brief: 'brief', organize: 'organize', contrast: 'contrast', 'browser-audit': 'browser-audit', quality: 'quality', review: 'review', eval: 'eval', init: 'init', score: 'score' };

  if (!command && (args[0] === '-v' || args[0] === '--version')) {
    console.log(`v${VERSION}`);
    return;
  }

  if (Object.hasOwn(scripts, command)) {
    const { main: run } = await import(`../scripts/${scripts[command]}.mjs`);
    await run(commandArgs.map(arg => arg === '-h' ? '--help' : arg));
    return;
  }

  if (!command && (args.includes('-h') || args.includes('--help'))) {
    printHelp();
    return;
  }

  if (command === 'strata') {
    if (commandArgs.includes('-h') || commandArgs.includes('--help')) {
      console.log('Usage: node strata.mjs [directory] [--json]\nGenerates .devmind/maps/strata.html architecture map.');
      return;
    }
    const { generateStrataData, buildStrataHtml } = await import('../scripts/strata.mjs');
    const target = commandArgs.find(arg => !arg.startsWith('-')) ?? '.';
    if (commandArgs.includes('--json')) {
      const data = await generateStrataData(target);
      console.log(JSON.stringify(data, null, 2));
    } else {
      const { destFile } = await buildStrataHtml(target);
      console.log(`\n✔ Strata map generated. Click to view: file:///${destFile.replace(/\\/g, '/')}`);
    }
    return;
  }

  if (command === 'handover') {
    if (commandArgs.includes('-h') || commandArgs.includes('--help')) {
      console.log('Usage: node handover.mjs [directory]\nRefreshes .devmind/handover.md from git status and tracked shortcuts.');
      return;
    }
    const { generateHandover } = await import('../scripts/handover.mjs');
    const target = commandArgs.find(arg => !arg.startsWith('-')) ?? '.';
    await generateHandover(target);
    return;
  }

  if (command === 'build') {
    const { build } = await import('../scripts/build.mjs');
    await build();
    return;
  }

  if (command === 'install') {
    if (process.env.npm_lifecycle_event === 'install' && !['run', 'run-script'].includes(process.env.npm_command)) {
      console.log('Package installed. Run npm run install or devmind install --interactive to configure your coding platform.');
      return;
    }
    const selection = args.length === 1 && process.stdin.isTTY ? { interactive: true } : parseInstallArgs(args.slice(1));
    if (selection.interactive) {
      await runInteractiveWizard({ installOnly: true });
      return;
    }
    if (selection.local) await installLocal('.', selection.targets);
    if (selection.global) await installGlobal(selection.targets);
    return;
  }

  if (command === 'uninstall') {
    if (process.env.npm_lifecycle_event === 'uninstall' && !['run', 'run-script'].includes(process.env.npm_command)) {
      console.log('Run npm run uninstall or devmind uninstall --interactive to remove DevMind files.');
      return;
    }
    if (commandArgs.includes('-h') || commandArgs.includes('--help')) {
      printHelp();
      return;
    }
    const selection = commandArgs.length === 0 && process.stdin.isTTY ? { interactive: true } : parseUninstallArgs(commandArgs);
    if (selection.interactive) {
      await runUninstallWizard();
      return;
    }
    if (selection.local) await uninstallLocal('.', selection.targets, { dryRun: selection.dryRun });
    if (selection.global) await uninstallGlobal(selection.targets, { dryRun: selection.dryRun });
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

if (isMain(import.meta.url)) main().catch(err => {
  console.error('DevMind CLI error:', err);
  process.exitCode = 2;
});
