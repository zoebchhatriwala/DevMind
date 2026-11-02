#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
import { isMain, parseArgs } from './lib/project.mjs';

/**
 * Detects repository facts and technology stack.
 */
export async function detectStack(targetDir = '.') {
  const root = resolve(targetDir);
  const facts = {
    runtime: 'Node.js',
    packageManager: 'npm',
    framework: 'Unknown / Vanilla',
    database: 'None detected',
    styling: 'Vanilla CSS',
    testing: 'None detected',
  };

  // Package manager detection via lockfiles
  if (existsSync(join(root, 'pnpm-lock.yaml'))) facts.packageManager = 'pnpm';
  else if (existsSync(join(root, 'yarn.lock'))) facts.packageManager = 'yarn';
  else if (existsSync(join(root, 'bun.lockb')) || existsSync(join(root, 'bun.lock'))) facts.packageManager = 'bun';
  else if (existsSync(join(root, 'package-lock.json'))) facts.packageManager = 'npm';

  // Package.json analysis
  const pkgPath = join(root, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      // Runtime / TypeScript
      if (deps['typescript']) facts.runtime = 'Node.js + TypeScript';

      // Framework
      if (deps['next']) facts.framework = `Next.js ${deps['next'].replace(/^[\^~]/, '')}`;
      else if (deps['vite']) facts.framework = 'Vite';
      else if (deps['@remix-run/node']) facts.framework = 'Remix';
      else if (deps['nuxt']) facts.framework = 'Nuxt';
      else if (deps['@sveltejs/kit']) facts.framework = 'SvelteKit';
      else if (deps['express']) facts.framework = 'Express';
      else if (deps['fastify']) facts.framework = 'Fastify';
      else if (deps['@nestjs/core']) facts.framework = 'NestJS';
      else if (deps['hono']) facts.framework = 'Hono';

      // Database
      if (deps['@prisma/client'] || deps['prisma']) facts.database = 'Prisma ORM';
      else if (deps['drizzle-orm']) facts.database = 'Drizzle ORM';
      else if (deps['@supabase/supabase-js']) facts.database = 'Supabase (PostgreSQL)';
      else if (deps['mongoose']) facts.database = 'Mongoose (MongoDB)';
      else if (deps['typeorm']) facts.database = 'TypeORM';

      // Styling
      if (deps['tailwindcss']) facts.styling = 'Tailwind CSS';
      else if (deps['styled-components']) facts.styling = 'Styled Components';

      // Testing
      if (deps['vitest']) facts.testing = 'Vitest';
      else if (deps['jest']) facts.testing = 'Jest';
      else if (deps['@playwright/test']) facts.testing = 'Playwright';
    } catch {
      facts.framework = 'Unknown: package.json could not be parsed';
    }
  } else if (existsSync(join(root, 'pyproject.toml')) || existsSync(join(root, 'requirements.txt'))) {
    facts.runtime = 'Python';
    facts.packageManager = existsSync(join(root, 'poetry.lock')) ? 'Poetry' : 'pip';
  } else if (existsSync(join(root, 'go.mod'))) {
    facts.runtime = 'Go';
    facts.packageManager = 'go modules';
  } else if (existsSync(join(root, 'Cargo.toml'))) {
    facts.runtime = 'Rust';
    facts.packageManager = 'Cargo';
  }

  return facts;
}

/**
 * Initializes the .devmind/ directory in target project.
 */
export async function initDevmind(targetDir = '.', options = {}) {
  const root = resolve(targetDir);
  const devmindDir = join(root, '.devmind');
  const stack = await detectStack(root);
  const projectName = basename(root);

  await mkdir(devmindDir, { recursive: true });

  // 1. .devmind/task.md
  const taskPath = join(devmindDir, 'task.md');
  if (!existsSync(taskPath) || options.force) {
    const taskContent = `# Active Task Progress

> **File**: \`.devmind/task.md\`
> **Purpose**: Lightweight live progress tracker. Update this file instead of re-printing checklists in chat turns.

## 🎯 Active Goal
[Concise 1-sentence description of the current task or user request]

## 📋 Progress Checklist
- [ ] Step 1: Inspect repository conventions and context <!-- CURRENT -->
- [ ] Step 2: Implement minimal, strictly typed solution
- [ ] Step 3: Run quality gate and pre-flight verification
- [ ] Step 4: Update task.md and session handover

## ⚡ Active State
- **Current File(s)**: \`README.md\`
- **Last Verification**: Pending initial check
`;
    await writeFile(taskPath, taskContent, 'utf8');
  }

  // 2. .devmind/memory.md
  const memoryPath = join(devmindDir, 'memory.md');
  if (!existsSync(memoryPath) || options.force) {
    const memoryContent = `# Repository Memory & Architectural Invariants

> **File**: \`.devmind/memory.md\`
> **Purpose**: Persistent facts, stack choices, conventions, and intentional shortcuts. Agents read this on session boot (~150 tokens) instead of re-analyzing the entire codebase.

## 📌 Verified Stack & Environment
- **Project**: ${projectName}
- **Runtime & Language**: ${stack.runtime}
- **Package Manager**: ${stack.packageManager}
- **Framework**: ${stack.framework}
- **Database / Storage**: ${stack.database}
- **Styling**: ${stack.styling}
- **Testing**: ${stack.testing}

## 🧭 Project Conventions & Invariants
- Strict Zod validation on all API and external boundaries
- Standard library first (avoid unneeded utility packages)
- Intent-driven UI with responsive layouts and accessible typography
- Zero unhandled errors in critical authentication and payment flows

## 🏷️ Tracked Shortcuts (\`// devmind:\`)
- \`// devmind: <ceiling>, <upgrade-path>\`: [Document deliberate simplifications here]

## 🚫 Anti-Patterns in this Repo
- Do not store secrets or tokens in localStorage or client bundles
- Preserve the established design system; use concrete, truthful UI copy
`;
    await writeFile(memoryPath, memoryContent, 'utf8');
  }

  // 3. .devmind/rules.md
  const rulesPath = join(devmindDir, 'rules.md');
  if (!existsSync(rulesPath) || options.force) {
    const rulesContent = `# Project & User Rules

> **File**: \`.devmind/rules.md\`
> **Purpose**: Custom project constraints, team conventions, and developer preferences that override or extend default AI coding behaviors. Agents MUST adhere to these rules on every turn.

## 🎯 High-Priority Directives
- Follow the Simplicity Ladder (YAGNI -> reuse -> stdlib -> native -> minimum code)
- Fix root causes at the shared source; grep all callers before editing
- Separate plumbing from product: zero AI theater, sci-fi buzzwords, or performative comments

## 🛠️ Code Style & Conventions
- **Typing**: Strict TypeScript, zero unrequested \`any\`
- **Error Handling**: Log failures with structured loggers; never silently swallow in empty catch blocks
- **Validation**: Validate untrusted input at boundaries with Zod schemas

## 🚫 Hard Constraints (What NEVER to do)
- Never expose private environment keys to the browser
- Never construct raw SQL queries via template string interpolation
- Never commit unreviewed sensitive credentials or secrets
`;
    await writeFile(rulesPath, rulesContent, 'utf8');
  }

  // 4. Update .gitignore
  const gitignorePath = join(root, '.gitignore');
  let addedToGitignore = false;
  const tracked = spawnSync('git', ['ls-files', '--', '.devmind'], { cwd: root, encoding: 'utf8', shell: false });
  const ignoreContent = existsSync(gitignorePath) ? await readFile(gitignorePath, 'utf8') : '';
  const shared = (tracked.status === 0 && Boolean(tracked.stdout.trim())) || /^!\/?\.devmind\/?\s*$/m.test(ignoreContent);
  if (!shared && existsSync(gitignorePath)) {
    let gi = await readFile(gitignorePath, 'utf8');
    if (!/^\/?\.devmind\/?\s*$/m.test(gi)) {
      gi = gi.trimEnd() + '\n\n# DevMind Local Memory & Scratchpad\n.devmind/\n';
      await writeFile(gitignorePath, gi, 'utf8');
      addedToGitignore = true;
    }
  } else if (!shared) {
    await writeFile(gitignorePath, '# DevMind Local Memory & Scratchpad\n.devmind/\n', 'utf8');
    addedToGitignore = true;
  }

  return {
    devmindDir,
    stack,
    addedToGitignore,
    shared,
  };
}

// CLI Execution
export async function main(args = process.argv.slice(2)) {
  const { options, positional } = parseArgs(args, ['--force', '-f']);
  if (options.has('--help')) {
    console.log('Usage: node init.mjs [directory] [--force]\nInitialize local memory without scanning source or generating a map. Existing notes and shared tracking choices are preserved unless --force resets notes.');
    return;
  }
  if (positional.length > 1) throw new Error('Expected at most one directory.');
  const targetDir = positional[0] ?? '.';
  const force = options.has('--force') || options.has('-f');

  const result = await initDevmind(targetDir, { force });

  console.log('\n=============================================================');
  console.log('🧠 DevMind Token Optimization & Memory Vault Initializer');
  console.log('=============================================================');
  console.log(`Directory:       ${resolve(targetDir)}`);
  console.log(`Detected Stack:  ${result.stack.runtime} | ${result.stack.framework} | ${result.stack.packageManager}`);
  console.log(`Vault Files:     .devmind/task.md, .devmind/memory.md, .devmind/rules.md`);
  console.log(`Git Tracking:    ${result.shared ? 'Preserved shared memory' : result.addedToGitignore ? 'Added .devmind/ to .gitignore' : 'Already in .gitignore'}\n`);
  if (result.addedToGitignore) console.log('[DevMind: Initialized local .devmind/ (added to .gitignore). Ask if you wish to track in git.]\n');
}

if (isMain(import.meta.url)) {
  main().catch(err => {
    console.error('Init script error:', err);
    process.exit(1);
  });
}
