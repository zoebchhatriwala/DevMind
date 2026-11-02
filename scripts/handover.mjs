#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { execSync } from 'node:child_process';
import { detectStack } from './init.mjs';
import { artifactPath } from './lib/runtime.mjs';
import { isMain } from './lib/project.mjs';

/**
 * Scans for // devmind: tracked shortcuts in the project.
 */
async function findTrackedShortcuts(root) {
  const shortcuts = [];
  try {
    const grepOutput = execSync('git grep -n "// devmind:"', { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    for (const line of grepOutput.split('\n')) {
      if (!line.trim()) continue;
      const [file, lineNum, ...rest] = line.split(':');
      shortcuts.push({
        file,
        line: lineNum,
        text: rest.join(':').trim(),
      });
    }
  } catch {
    return shortcuts;
  }
  return shortcuts;
}

/**
 * Generates or updates .devmind/handover.md
 */
export async function generateHandover(targetDir = '.') {
  const root = resolve(targetDir);
  const stack = await detectStack(root);
  const projectName = basename(root);

  let gitStatus = '';
  let gitRecentCommits = '';

  try {
    gitStatus = execSync('git status --short', { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    gitRecentCommits = execSync('git log -n 3 --oneline', { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    gitStatus = 'Not a git repository or no commits yet.';
  }

  const shortcuts = await findTrackedShortcuts(root);

  const changedFiles = gitStatus
    .split('\n')
    .filter(Boolean)
    .map(line => line.trim().split(/\s+/).slice(1).join(' '))
    .filter(Boolean);

  const handoverContent = `# Session Handover

> **File**: \`.devmind/handover.md\`
> **Purpose**: Repository snapshot for the next session. Preserve manual decisions and verification evidence alongside this summary.

Snapshot generated: ${new Date().toISOString()}

## 📌 Current Status & Active Stack
- **Repository / Area**: ${projectName}
- **Active Stack**: ${stack.runtime} | ${stack.framework} | ${stack.packageManager} | ${stack.database}
- **Health**: Unverified. This command does not run quality checks or infer their results.

## 🚀 Work Completed in Recent Session
- **Recent Git Commits**:
${gitRecentCommits ? gitRecentCommits.split('\n').map(c => `  - ${c}`).join('\n') : '  - Initial setup'}
- **Active / Modified Files**:
${changedFiles.length > 0 ? changedFiles.map(f => `  - \`${f}\``).join('\n') : '  - Clean working directory'}

## 🧭 Decisions & Deliberate Shortcuts
${shortcuts.length > 0 ? shortcuts.map(s => `- \`${s.file}:${s.line}\`: ${s.text}`).join('\n') : '- No shortcuts found in tracked files. Untracked files were not inspected.'}

## 🎯 Immediate Next Steps (Prioritized)
1. [ ] Continue implementation or address next feature request
2. [ ] Run existing project checks and record their actual results. Source heuristics do not establish security or correctness.

## ⚡ Fast-Resume Prompt for Next Agent
> "Continue work on this codebase. Read \`.devmind/task.md\` and \`.devmind/handover.md\`, inspect git status and recent test results, and proceed with Step 1 from the Immediate Next Steps list."
`;

  const devmindDir = join(root, '.devmind');
  const handoverPath = await artifactPath(root, '.devmind/handover.md');
  await mkdir(devmindDir, { recursive: true });
  const begin = '<!-- devmind:snapshot:start -->';
  const end = '<!-- devmind:snapshot:end -->';
  const snapshot = `${begin}\n${handoverContent}\n${end}`;
  let previous = '';
  try { previous = await readFile(handoverPath, 'utf8'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const start = previous.indexOf(begin), finish = previous.indexOf(end);
  if ((start === -1) !== (finish === -1) || (start !== -1 && finish < start)) throw new Error('Incomplete handover snapshot markers. Preserve the file and resolve them before updating.');
  const content = start === -1 ? `${previous.trimEnd()}${previous ? '\n\n' : ''}${snapshot}\n` : previous.slice(0, start) + snapshot + previous.slice(finish + end.length);
  await writeFile(handoverPath, content, 'utf8');

  return {
    handoverPath,
    changedFilesCount: changedFiles.length,
    shortcutsCount: shortcuts.length,
  };
}

// CLI Execution
async function main() {
  const args = process.argv.slice(2);
  const targetDir = args.find(a => !a.startsWith('-')) || '.';

  const result = await generateHandover(targetDir);

  console.log('\n=============================================================');
  console.log('DevMind Session Handover Generator');
  console.log('=============================================================');
  console.log(`Handover File:  ${result.handoverPath}`);
  console.log(`Modified Files: ${result.changedFilesCount}`);
  console.log(`Shortcuts:      ${result.shortcutsCount} tracked (// devmind:)\n`);
  console.log('Updated .devmind/handover.md. Manual notes preserved; quality status remains unverified.\n');
}

if (isMain(import.meta.url)) {
  main().catch(err => {
    console.error('Handover script error:', err);
    process.exit(1);
  });
}
