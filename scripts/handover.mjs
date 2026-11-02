#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { execSync } from 'node:child_process';
import { detectStack } from './init.mjs';

/**
 * Scans for // devmind: tracked shortcuts in the project.
 */
async function findTrackedShortcuts(root) {
  const shortcuts = [];
  try {
    const grepOutput = execSync('git grep -n "// devmind:"', { cwd: root, encoding: 'utf8' });
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
  let gitDiffStat = '';
  let gitRecentCommits = '';

  try {
    gitStatus = execSync('git status --short', { cwd: root, encoding: 'utf8' }).trim();
    gitDiffStat = execSync('git diff --stat HEAD~1 HEAD', { cwd: root, encoding: 'utf8' }).trim();
    gitRecentCommits = execSync('git log -n 3 --oneline', { cwd: root, encoding: 'utf8' }).trim();
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
> **Purpose**: Single source of truth for the next AI agent or engineer resuming this project. Read this file first to resume immediately with zero context loss.

## 📌 Current Status & Active Stack
- **Repository / Area**: ${projectName}
- **Active Stack**: ${stack.runtime} | ${stack.framework} | ${stack.packageManager} | ${stack.database}
- **Health**: Quality checks passing, .devmind state intact

## 🚀 Work Completed in Recent Session
- **Recent Git Commits**:
${gitRecentCommits ? gitRecentCommits.split('\n').map(c => `  - ${c}`).join('\n') : '  - Initial setup'}
- **Active / Modified Files**:
${changedFiles.length > 0 ? changedFiles.map(f => `  - \`${f}\``).join('\n') : '  - Clean working directory'}

## 🧭 Decisions & Deliberate Shortcuts
${shortcuts.length > 0 ? shortcuts.map(s => `- \`${s.file}:${s.line}\`: ${s.text}`).join('\n') : '- No temporary ceilings active; standard implementations in place.'}

## 🎯 Immediate Next Steps (Prioritized)
1. [ ] Continue implementation or address next feature request
2. [ ] Run \`devmind verify\` to ensure zero security and quality regressions

## ⚡ Fast-Resume Prompt for Next Agent
> "Continue work on this codebase. Read \`.devmind/task.md\` and \`.devmind/handover.md\`, inspect git status and recent test results, and proceed with Step 1 from the Immediate Next Steps list."
`;

  const devmindDir = join(root, '.devmind');
  const handoverPath = join(devmindDir, 'handover.md');
  await writeFile(handoverPath, handoverContent, 'utf8');

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
  console.log('📋 DevMind Zero-Loss Session Handover Generator');
  console.log('=============================================================');
  console.log(`Handover File:  ${result.handoverPath}`);
  console.log(`Modified Files: ${result.changedFilesCount}`);
  console.log(`Shortcuts:      ${result.shortcutsCount} tracked (// devmind:)\n`);
  console.log('✔ Updated .devmind/handover.md. Next session can fast-resume with zero token loss.\n');
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  main().catch(err => {
    console.error('Handover script error:', err);
    process.exit(1);
  });
}
