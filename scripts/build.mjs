#!/usr/bin/env node
import { readdir, readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';

const ROOT_DIR = resolve('.');
const SKILLS_DIR = join(ROOT_DIR, 'skills');
const DIST_DIR = join(ROOT_DIR, 'dist');
const AGENTS_MD_PATH = join(ROOT_DIR, 'AGENTS.md');

// Globs mapping for Cursor rules (.mdc) and Copilot instructions
const SKILL_GLOBS = {
  'fe-standards': '**/*.{tsx,jsx,css,scss,html,vue,svelte}',
  'be-standards': '**/*.{ts,js,mjs,cjs,go,py,rs}',
  'security-standards': '**/*',
  'db-standards': '**/{schema,migrations,models,entities}/**,**/*.sql,**/prisma/**,**/drizzle/**',
  'auth-patterns': '**/{auth,middleware,session,security}/**',
  'deployment': '**/{.github,deploy,infra}/**,**/Dockerfile*,**/docker-compose*,**/*.tf',
  'api-design': '**/{api,routes,controllers,contracts}/**,**/*.openapi.*,**/*.swagger.*',
  'ai-standards': '**/{ai,rag,prompts,llm,embeddings,agents}/**',
};

/**
 * Parses simple YAML frontmatter from a markdown file.
 */
function parseFrontmatter(content) {
  content = content.replace(/^\uFEFF/, '');
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { metadata: {}, body: content };
  }

  const rawYaml = match[1];
  const body = match[2];
  const metadata = {};
  let currentKey = null;

  for (const line of rawYaml.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;

    // Indented continuation of previous key (e.g., multi-line description: >-)
    if (/^\s+/.test(line) && currentKey) {
      const continuation = line.trim();
      metadata[currentKey] = metadata[currentKey]
        ? `${metadata[currentKey]} ${continuation}`
        : continuation;
      continue;
    }

    const colonIdx = line.indexOf(':');
    if (colonIdx !== -1) {
      currentKey = line.slice(0, colonIdx).trim();
      let val = line.slice(colonIdx + 1).trim();
      val = val.replace(/^[>|]-?\s*/, '').replace(/^['"]+|['"]+$/g, '');
      metadata[currentKey] = val;
    } else {
      currentKey = null;
    }
  }

  return { metadata, body };
}

async function loadSkills() {
  const entries = await readdir(SKILLS_DIR, { withFileTypes: true });
  const skills = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillName = entry.name;
    const skillFile = join(SKILLS_DIR, skillName, 'SKILL.md');
    const readmeFile = join(SKILLS_DIR, skillName, 'README.md');

    if (!existsSync(skillFile)) continue;

    const rawContent = await readFile(skillFile, 'utf8');
    const { metadata, body } = parseFrontmatter(rawContent);

    let readmeContent = '';
    if (existsSync(readmeFile)) {
      readmeContent = await readFile(readmeFile, 'utf8');
    }

    skills.push({
      name: metadata.name || skillName,
      description: metadata.description || '',
      trigger: metadata.trigger || 'model_decision',
      content: rawContent,
      body,
      readme: readmeContent,
      globs: SKILL_GLOBS[skillName] || '**/*',
    });
  }

  return skills;
}

function generateMasterSkillMd(skills, agentsMd) {
  return `---
name: devmind
description: >-
  MANDATORY TRIGGER: Universal fullstack engineering standards, architecture reviewer, and quality baseline for AI coding agents. Governed by AGENTS.md. Activates when designing, implementing, refactoring, or auditing frontend, backend, security, databases, authentication, CI/CD, APIs, and AI/RAG systems.
trigger: model_decision
---

# devmind: Engineering Standards & Zero-Amnesia Protocol

You are operating under **DevMind**, an engineering baseline combining production-grade architecture with ruthless simplicity (YAGNI). Deliver the cleanest, smallest solution that meets real security, typing, and architectural baselines. The best code is code you didn't have to write.

---

## 🎯 Mandatory Skill Routing Matrix

When a user request touches any of the following file globs or task types, you **MUST** load and apply the corresponding DevMind skill(s) before authoring or modifying code:

| Domain & Skill | Triggering Task Types & Keywords | File Globs |
| :--- | :--- | :--- |
| **\`ai-standards\`** | LLM integration, prompt templates, agent workflows, RAG pipelines, embeddings, tool calls, model routing | \`**/{ai,rag,prompts,llm,embeddings,agents}/**\` |
| **\`api-design\`** | REST/GraphQL/RPC routes, OpenAPI spec, controllers, DTOs, endpoint pagination, error payloads, webhooks | \`**/{api,routes,controllers,contracts}/**\`, \`**/*.openapi.*\`, \`**/*.swagger.*\` |
| **\`auth-patterns\`** | Login, signup, JWT, OAuth, sessions, RBAC/ABAC permissions, guards, password hashing, CSRF, refresh tokens | \`**/{auth,middleware,session,security}/**\` |
| **\`be-standards\`** | Backend services, business logic, background jobs, queues, caching, logging, dependency injection, server errors | \`**/*.{ts,js,mjs,cjs,go,py,rs}\` |
| **\`db-standards\`** | Database schemas, migrations, ORM models (Prisma/Drizzle/TypeORM/SQL), indexes, transactions, queries | \`**/{schema,migrations,models,entities}/**\`, \`**/*.sql\`, \`**/prisma/**\`, \`**/drizzle/**\` |
| **\`deployment\`** | Dockerfiles, docker-compose, CI/CD workflows (.github/workflows), Kubernetes, Terraform, health probes | \`**/{.github,deploy,infra}/**\`, \`**/Dockerfile*\`, \`**/docker-compose*\`, \`**/*.tf\` |
| **\`fe-standards\`** | UI components, pages, client state, forms, data fetching hooks, CSS/Tailwind, accessibility, frontend performance | \`**/*.{tsx,jsx,css,scss,html,vue,svelte}\` |
| **\`security-standards\`** | User input validation, file uploads, secrets/env vars, rate limiting, CORS, CSP headers, encryption, PII/payments | \`**/*\` |

<EXECUTION_RULE>
### CRITICAL PROTOCOL FOR ALL CODING AGENTS:
1. **ASSESS TASK SCOPE & TIER**:
   - **Tier 1: Targeted Edits & Bug Fixes (Micro-Patches)**: For localized bug fixes, UI adjustments, or single-function changes in existing files, **DO NOT** dump entire 50KB domain skill files into context. The universal engineering baseline in AGENTS.md (Simplicity Ladder, Zod boundaries, zero \`any\`, Pino logging, WCAG 2.2 AA) is already active. Fix root causes directly with the shortest working diff.
   - **Tier 2: Macro-Features & Scaffolding (Architectural Work)**: For new endpoints, database migrations, auth flows, major UI subsystems, or new services:
     a. Identify primary domains via the Mandatory Skill Routing Matrix.
     b. Read the relevant \`skills/<domain>/SKILL.md\` Pre-Flight Gates and Golden Patterns.
     c. Use targeted slice-reading for deep topic references instead of loading full multi-thousand-line files blindly.
2. **PRINT RECEIPT**: Output a compact badge at the top of your initial plan or implementation response:
   \`🧠 [DevMind: <skill-name/tier> | Checked: <top 3 rules verified>]\`
3. **NO COMPROMISE ON QUALITY**: Tiered loading prevents token exhaustion and context amnesia, but never waives strict typing, runtime validation, accessibility, or security invariants.
</EXECUTION_RULE>

---

## 0 - Before You Write: The Simplicity Ladder

Before writing or editing code, climb this ladder and stop at the first rung that holds:

\`\`\`
[1. Does this need to exist at all? (YAGNI)]
  └── [2. Already in this codebase? (Reuse existing utils/types)]
        └── [3. Standard library or runtime does it?]
              └── [4. Native platform or framework feature covers it?]
                    └── [5. Existing installed dependency solves it?]
                          └── [6. Concise one-liner or simple pure function?]
                                └── [7. Only then: write minimum typed production code]
\`\`\`

1. **YAGNI First**: Speculative needs, premature config, and imaginary abstractions are bloat. Skip them.
2. **Reuse Existing Code**: Search the codebase before writing. Reusing existing helpers, components, and types stops duplicate slop.
3. **Standard Library First**: Use built-in JavaScript/TypeScript/Python/Go features (\`URL\`, \`fetch\`, \`Intl\`, \`crypto.randomUUID()\`, \`structuredClone\`, \`Array.prototype.*\`) before hand-rolling or adding libraries.
4. **Platform Native First**: Let the platform work: semantic HTML (\`<input type="date">\`, \`<dialog>\`), CSS over JS layout/animations, database \`CHECK\`/\`UNIQUE\` constraints over app validators.
5. **Installed Dependencies**: Use what's in \`package.json\`/\`pyproject.toml\`. Never add a package when an existing one or 5 lines of code does the job.
6. **Concise Functions**: Prefer straightforward expressions over heavy class hierarchies or speculative design patterns.
7. **Only Then Author New Code**: Smallest clean, typed implementation that meets security, accessibility, and correctness standards.

### Root-Cause Bug Fixing
- Fix the root cause, not just the symptom. Grep all callers of the function you're touching before editing. One fix at the shared source is smaller, cleaner, and prevents leaving sibling callers broken.

### Pragmatic Shortcut Markers
- Deliberate simplifications with known operational ceilings (e.g. in-memory cache, synchronous handler) must be marked with a tracked comment:
  \`// devmind: <ceiling>, <upgrade-path>\`
  *Example:* \`// devmind: in-memory cache per instance, migrate to Redis if horizontally scaled\`

### Natural Communication (Zero Fillers)
- Deliver code and concrete answers first.
- Zero AI boilerplate ("Certainly!", "I'd be glad to help!", "Below is the implementation...").
- Keep post-code commentary to at most 1–3 short lines:
  \`[What was done] → skipped: [X], add when: [Y].\`
- No unrequested essays or defensive lectures.

---

## Continuous Feedback Loop

$$\\text{Understand} \\longrightarrow \\text{Inspect} \\longrightarrow \\text{Evaluate} \\longrightarrow \\text{Implement} \\longrightarrow \\text{Verify} \\longrightarrow \\text{Review} \\longrightarrow \\text{Learn}$$

> **Crucial Rule:** A check or test must never be reported as successful unless it was actually executed and its result was verified.

---

## Domain Standards Catalog & Progressive Disclosure

DevMind provides 8 specialized domain guides. When working in any of these areas, consult the referenced guide:

| Skill | Domain | Standards & Baseline | Reference Guide |
| :--- | :--- | :--- | :--- |
${skills.map(s => `| **${s.name}** | ${s.description.split('.')[0]} | Governed by AGENTS.md | [${s.name}](./references/${s.name}.md) |`).join('\n')}

For universal engineering baseline directives, consult [AGENTS.md](./references/AGENTS.md).

---

## 8 - Token Optimization & The .devmind/ Memory Vault

AI coding agents burn excessive tokens by repeatedly re-reading large files, dumping full terminal logs into chat, re-printing verbose checklists in every response, and suffering mid-session amnesia. 

To slash token waste and preserve context across sessions, agents externalize active state into a lightweight \`.devmind/\` directory in the project root:
- \`.devmind/task.md\`: Active task & progress checklist (live scratchpad, avoids repeating checklists in chat).
- \`.devmind/memory.md\`: Persistent repository facts, stack choices & tracked shortcuts (\`// devmind:\`).
- \`.devmind/rules.md\`: Project-specific user rules, conventions & constraints.
- \`.devmind/handover.md\`: Session continuity summary for zero-loss resumption (fallback: root \`HANDOVER.md\`).

### The 4 Token Optimization Rules
1. **Slice, Don't Dump**: Never read entire 1,000-line files when 30 lines are relevant. Use targeted grep and line ranges.
2. **Externalize Progress**: Update \`.devmind/task.md\` instead of re-generating lengthy checklists in chat turns.
3. **Fast-Boot from Memory**: At the start of a turn or session, read \`.devmind/task.md\`, \`.devmind/memory.md\`, and \`.devmind/rules.md\` (~300 tokens) to immediately rehydrate context and user constraints instead of re-analyzing configs and directories (~3,000+ tokens).
4. **Zero Filler**: Lead directly with code or concrete answers. No conversational boilerplate.

### Git Tracking Protocol (Sensible Defaults & User Choice)

When creating \`.devmind/\` in a project for the first time:
- **Default (Local First)**: Automatically check \`.gitignore\`. If \`.devmind/\` is not tracked, add \`.devmind/\` to \`.gitignore\` to keep scratchpad and memory local to the machine, outputting a 1-line notice: \`[DevMind: Initialized local .devmind/ (added to .gitignore). Ask if you wish to track in git.]\`
- **Team / Shared Option**: If the user indicates they want to share task state, memory, or handover notes with their team and other agents in git, track \`.devmind/\` in Git alongside project code.

---

## 🔍 Anti-Amnesia Receipt

Every coding agent applying DevMind MUST output a receipt badge at the top of its response:
\`\`\`text
🧠 [DevMind: <skill-name/tier> | Checked: <top 3 rules verified>]
\`\`\`

---

## ✅ Post-Implementation Checklist

- [ ] Climbed the Simplicity Ladder (YAGNI → reuse → stdlib → native → minimal code).
- [ ] Fixed root cause at the shared source (grepped all callers).
- [ ] Identified all touched domains via the Mandatory Skill Routing Matrix.
- [ ] Read corresponding \`skills/<domain>/SKILL.md\` before authoring code (Tiered Precision Loading).
- [ ] Ensured \`.devmind/\` is local (gitignored) by default unless user opted to commit.
- [ ] Obeyed all project and user-defined constraints in \`.devmind/rules.md\`.
- [ ] Updated \`.devmind/task.md\` and \`.devmind/handover.md\` to conserve context tokens.
- [ ] Printed the Anti-Amnesia Receipt badge in response.
- [ ] Delivered code first with natural, filler-free commentary.
- [ ] Ran automated tests, linter, and type checks.
- [ ] Marked any intentional simplification with \`// devmind: <ceiling>, <upgrade-path>\`.
- [ ] Confirmed zero sensitive data leaks in logs, errors, or client payloads.
`;

}

async function build() {
  console.log('Building devmind skills for all coding agents and IDEs...\n');

  // Clean dist directory
  if (existsSync(DIST_DIR)) {
    await rm(DIST_DIR, { recursive: true, force: true });
  }
  await mkdir(DIST_DIR, { recursive: true });

  const agentsMd = existsSync(AGENTS_MD_PATH) ? await readFile(AGENTS_MD_PATH, 'utf8') : '';
  const readmeMd = existsSync(join(ROOT_DIR, 'README.md')) ? await readFile(join(ROOT_DIR, 'README.md'), 'utf8') : '';
  const skills = await loadSkills();
  console.log(`Loaded ${skills.length} skills: ${skills.map(s => s.name).join(', ')}\n`);

  const masterSkillMd = generateMasterSkillMd(skills, agentsMd);

  // =========================================================================
  // 1. Antigravity / Gemini Suite (dist/antigravity/...)
  // =========================================================================
  console.log('1. Building Antigravity / Gemini Suite (dist/antigravity)...');
  const agBaseDir = join(DIST_DIR, 'antigravity');
  await mkdir(agBaseDir, { recursive: true });

  // 1A. Direct Skills Format (dist/antigravity/skills/*)
  // Each directory in skills/ MUST have SKILL.md at its root per Antigravity spec.
  const agSkillsDir = join(agBaseDir, 'skills');
  await mkdir(agSkillsDir, { recursive: true });

  // 1A.1 Master devmind Skill (dist/antigravity/skills/devmind/)
  const devmindSkillDir = join(agSkillsDir, 'devmind');
  const devmindSkillRefsDir = join(devmindSkillDir, 'references');
  await mkdir(devmindSkillRefsDir, { recursive: true });
  await writeFile(join(devmindSkillDir, 'SKILL.md'), masterSkillMd, 'utf8');
  await writeFile(join(devmindSkillDir, 'README.md'), readmeMd, 'utf8');
  await writeFile(join(devmindSkillRefsDir, 'AGENTS.md'), agentsMd, 'utf8');
  for (const s of skills) {
    await writeFile(join(devmindSkillRefsDir, `${s.name}.md`), s.content, 'utf8');
  }

  // 1A.2 Individual Domain Skills (dist/antigravity/skills/<skill-name>/)
  for (const s of skills) {
    const targetDir = join(agSkillsDir, s.name);
    await mkdir(targetDir, { recursive: true });
    await writeFile(join(targetDir, 'SKILL.md'), s.content, 'utf8');
    if (s.readme) {
      await writeFile(join(targetDir, 'README.md'), s.readme, 'utf8');
    }
  }

  // 1B. Antigravity Plugin Format (dist/antigravity/plugins/devmind/)
  const agPluginDir = join(agBaseDir, 'plugins', 'devmind');
  const agPluginSkillsDir = join(agPluginDir, 'skills');
  const agPluginRulesDir = join(agPluginDir, 'rules');
  await mkdir(agPluginSkillsDir, { recursive: true });
  await mkdir(agPluginRulesDir, { recursive: true });

  const pluginJson = {
    name: 'devmind',
    version: '1.0.0',
    description: 'Curated Antigravity and AI coding agent skills and engineering baseline.',
    skills: ['skills/devmind', ...skills.map(s => `skills/${s.name}`)],
  };
  await writeFile(join(agPluginDir, 'plugin.json'), JSON.stringify(pluginJson, null, 2), 'utf8');
  await writeFile(join(agPluginDir, 'README.md'), readmeMd, 'utf8');
  await writeFile(join(agPluginRulesDir, 'AGENTS.md'), agentsMd, 'utf8');

  // Copy master devmind skill into plugin skills
  await cp(devmindSkillDir, join(agPluginSkillsDir, 'devmind'), { recursive: true });
  // Copy all domain skills into plugin skills
  for (const s of skills) {
    await cp(join(agSkillsDir, s.name), join(agPluginSkillsDir, s.name), { recursive: true });
  }

  // 1C. Antigravity Universal Drop-in Package (dist/antigravity/devmind/)
  // This hybrid package works whether copied into ~/.gemini/config/skills/devmind OR plugins/devmind!
  const agUniversalDir = join(agBaseDir, 'devmind');
  await cp(devmindSkillDir, agUniversalDir, { recursive: true });
  await writeFile(join(agUniversalDir, 'plugin.json'), JSON.stringify(pluginJson, null, 2), 'utf8');
  await cp(agPluginSkillsDir, join(agUniversalDir, 'skills'), { recursive: true });
  await mkdir(join(agUniversalDir, 'rules'), { recursive: true });
  await writeFile(join(agUniversalDir, 'rules', 'AGENTS.md'), agentsMd, 'utf8');
  await writeFile(join(agUniversalDir, 'AGENTS.md'), agentsMd, 'utf8');

  // 1D. Antigravity Rules Format (dist/antigravity/rules/)
  const agRulesDir = join(agBaseDir, 'rules');
  await mkdir(agRulesDir, { recursive: true });
  await writeFile(join(agRulesDir, 'AGENTS.md'), agentsMd, 'utf8');
  await writeFile(join(agRulesDir, 'GEMINI.md'), agentsMd, 'utf8');
  for (const s of skills) {
    await writeFile(join(agRulesDir, `${s.name}.md`), `# ${s.name}\n\n${s.body}`, 'utf8');
  }

  // 1E. Antigravity JSON Configs (dist/antigravity/skills.json & plugins.json)
  const skillsJson = {
    entries: [
      { path: '.agents/skills/devmind' },
      ...skills.map(s => ({ path: `.agents/skills/${s.name}` })),
    ],
  };
  const pluginsJson = {
    entries: [
      { path: '.agents/plugins/devmind' },
    ],
  };
  await writeFile(join(agBaseDir, 'skills.json'), JSON.stringify(skillsJson, null, 2), 'utf8');
  await writeFile(join(agBaseDir, 'plugins.json'), JSON.stringify(pluginsJson, null, 2), 'utf8');

  // =========================================================================
  // 2. Cursor IDE Build (.cursorrules & .cursor/rules/*.mdc)
  // =========================================================================
  console.log('2. Building Cursor IDE rules (dist/cursor)...');
  const cursorDir = join(DIST_DIR, 'cursor');
  const cursorRulesDir = join(cursorDir, '.cursor', 'rules');
  await mkdir(cursorRulesDir, { recursive: true });

  // Unified .cursorrules fallback
  let cursorRulesContent = `# devmind Cursor Rules\n\n`;
  cursorRulesContent += `> Automatically generated from devmind. Governed by AGENTS.md.\n\n`;
  cursorRulesContent += agentsMd + '\n\n---\n\n## Available Domain Skills\n\n';
  for (const s of skills) {
    cursorRulesContent += `### ${s.name}\n${s.description}\n\n`;
  }
  await writeFile(join(cursorDir, '.cursorrules'), cursorRulesContent, 'utf8');

  // Master baseline rule: devmind.mdc (and 00-agents-baseline.mdc for compatibility)
  const masterMdc = `---
description: DevMind Universal Engineering Baseline & Mandatory Skill Routing Matrix
globs: *
alwaysApply: true
---

${agentsMd}
`;
  await writeFile(join(cursorRulesDir, 'devmind.mdc'), masterMdc, 'utf8');
  await writeFile(join(cursorRulesDir, '00-agents-baseline.mdc'), masterMdc, 'utf8');

  for (const s of skills) {
    const mdcContent = `---
description: ${s.description.slice(0, 250).replace(/\r?\n/g, ' ')}
globs: ${s.globs}
alwaysApply: false
---

${s.body}
`;
    await writeFile(join(cursorRulesDir, `${s.name}.mdc`), mdcContent, 'utf8');
  }

  // =========================================================================
  // 3. Windsurf / Cascade Build (.windsurfrules & .windsurf/rules/*.md)
  // =========================================================================
  console.log('3. Building Windsurf / Cascade rules (dist/windsurf)...');
  const windsurfDir = join(DIST_DIR, 'windsurf');
  const windsurfModularDir = join(windsurfDir, '.windsurf', 'rules');
  await mkdir(windsurfModularDir, { recursive: true });

  let windsurfRules = `# Windsurf / Cascade Agent Rules\n\n`;
  windsurfRules += `You are an expert fullstack coding agent. You strictly adhere to the devmind engineering baseline:\n\n`;
  windsurfRules += agentsMd + '\n\n---\n\n# Domain Standards & Skills\n\n';
  for (const s of skills) {
    windsurfRules += `## ${s.name}\n${s.body}\n\n---\n\n`;
  }
  await writeFile(join(windsurfDir, '.windsurfrules'), windsurfRules, 'utf8');

  await writeFile(join(windsurfModularDir, '00-agents-baseline.md'), agentsMd, 'utf8');
  for (const s of skills) {
    await writeFile(join(windsurfModularDir, `${s.name}.md`), `# ${s.name}\n\n${s.body}`, 'utf8');
  }

  // =========================================================================
  // 4. Claude Code Build (CLAUDE.md & .claude/skills/*)
  // =========================================================================
  console.log('4. Building Claude Code guidelines (dist/claude-code)...');
  const claudeDir = join(DIST_DIR, 'claude-code');
  const claudeSkillsDir = join(claudeDir, '.claude', 'skills');
  await mkdir(claudeSkillsDir, { recursive: true });

  let claudeMd = `# CLAUDE.md — devmind Agent Guidelines\n\n`;
  claudeMd += `This repository uses devmind fullstack engineering standards.\n\n`;
  claudeMd += agentsMd + '\n\n---\n\n# Engineering Skills Catalog\n\n';
  for (const s of skills) {
    claudeMd += `## Skill: ${s.name}\n\n`;
    claudeMd += `**Description**: ${s.description}\n\n`;
    claudeMd += `### Core Directives\n\n`;
    const snippet = s.body.split(/\r?\n/).slice(0, 100).join('\n');
    claudeMd += snippet + '\n\n...\n\n';
  }
  await writeFile(join(claudeDir, 'CLAUDE.md'), claudeMd, 'utf8');

  // Modular skills for Claude Code
  for (const s of skills) {
    const sDir = join(claudeSkillsDir, s.name);
    await mkdir(sDir, { recursive: true });
    await writeFile(join(sDir, 'SKILL.md'), s.content, 'utf8');
  }

  // =========================================================================
  // 5. GitHub Copilot Build (.github/copilot-instructions.md & scoped instructions)
  // =========================================================================
  console.log('5. Building GitHub Copilot instructions (dist/github-copilot)...');
  const copilotDir = join(DIST_DIR, 'github-copilot', '.github');
  const copilotInstructionsDir = join(copilotDir, 'instructions');
  await mkdir(copilotInstructionsDir, { recursive: true });

  let copilotMd = `# GitHub Copilot Custom Instructions\n\n`;
  copilotMd += `Follow the devmind engineering baseline on all generated code and refactorings:\n\n`;
  copilotMd += agentsMd + '\n\n---\n\n## Standards By Domain\n\n';
  for (const s of skills) {
    copilotMd += `### ${s.name}\n${s.description}\n\n`;
  }
  await writeFile(join(copilotDir, 'copilot-instructions.md'), copilotMd, 'utf8');

  // Scoped instructions format (.github/instructions/*.instructions.md)
  for (const s of skills) {
    const scopedContent = `---
applyTo: "${s.globs}"
---

# ${s.name} Instructions

${s.body}
`;
    await writeFile(join(copilotInstructionsDir, `${s.name}.instructions.md`), scopedContent, 'utf8');
  }

  // =========================================================================
  // 6. Cline & Roo Code Build (dist/cline)
  // =========================================================================
  console.log('6. Building Cline / Roo Code rules (dist/cline)...');
  const clineDir = join(DIST_DIR, 'cline');
  await mkdir(clineDir, { recursive: true });
  let clineRules = `# Cline / Roo Code System Rules\n\n`;
  clineRules += agentsMd + '\n\n---\n\n# Domain Standards\n\n';
  for (const s of skills) {
    clineRules += `## ${s.name}\n${s.body}\n\n---\n\n`;
  }
  await writeFile(join(clineDir, '.clinerules'), clineRules, 'utf8');

  // =========================================================================
  // 7. Universal Agent Baseline (dist/agents)
  // =========================================================================
  console.log('7. Building Universal Agent Baseline (dist/agents)...');
  const agentsOutDir = join(DIST_DIR, 'agents');
  await mkdir(agentsOutDir, { recursive: true });
  await writeFile(join(agentsOutDir, 'AGENTS.md'), agentsMd, 'utf8');

  // =========================================================================
  // 8. Multi-Agent Drop-In Root Hooks (dist/hooks)
  // =========================================================================
  console.log('8. Building Multi-Agent Drop-In Root Hooks (dist/hooks)...');
  const hooksDir = join(DIST_DIR, 'hooks');
  const hooksCursorRulesDir = join(hooksDir, '.cursor', 'rules');
  const hooksGithubDir = join(hooksDir, '.github');
  await mkdir(hooksCursorRulesDir, { recursive: true });
  await mkdir(hooksGithubDir, { recursive: true });

  await writeFile(join(hooksDir, 'AGENTS.md'), agentsMd, 'utf8');
  await writeFile(join(hooksDir, 'CLAUDE.md'), claudeMd, 'utf8');
  await writeFile(join(hooksDir, '.cursorrules'), cursorRulesContent, 'utf8');
  await writeFile(join(hooksDir, '.windsurfrules'), windsurfRules, 'utf8');
  await writeFile(join(hooksDir, '.clinerules'), clineRules, 'utf8');
  await writeFile(join(hooksGithubDir, 'copilot-instructions.md'), copilotMd, 'utf8');
  await cp(cursorRulesDir, hooksCursorRulesDir, { recursive: true });

  const hooksReadme = `# DevMind Drop-In Multi-Agent Hooks

Copy these configuration files into any project's root directory to immediately equip AI coding agents with DevMind's Zero-Amnesia standards:

- **Universal / OpenSkills**: \`AGENTS.md\`
- **Claude Code**: \`CLAUDE.md\`
- **Cursor IDE**: \`.cursorrules\` and \`.cursor/rules/*.mdc\` (includes auto-injecting globs)
- **Windsurf / Cascade**: \`.windsurfrules\`
- **GitHub Copilot**: \`.github/copilot-instructions.md\`
- **Cline / Roo Code**: \`.clinerules\`
`;
  await writeFile(join(hooksDir, 'README.md'), hooksReadme, 'utf8');

  // =========================================================================
  // 9. Distribution Bundles & Manifest (dist/bundles)
  // =========================================================================
  console.log('9. Creating distribution bundles and manifest (dist/bundles)...');
  const bundlesDir = join(DIST_DIR, 'bundles');
  await mkdir(bundlesDir, { recursive: true });

  const manifest = {
    name: 'devmind',
    version: '1.0.0',
    description: 'Curated Antigravity and AI coding agent skills.',
    updatedAt: new Date().toISOString(),
    skillsCount: skills.length,
    targets: ['antigravity', 'cursor', 'windsurf', 'claude-code', 'github-copilot', 'cline', 'agents'],
    skills: [
      {
        name: 'devmind',
        description: 'Master fullstack engineering standards and architecture reviewer.',
        trigger: 'model_decision',
        globs: '**/*',
      },
      ...skills.map(s => ({
        name: s.name,
        description: s.description,
        trigger: s.trigger,
        globs: s.globs,
      })),
    ],
  };

  await writeFile(join(bundlesDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  let fullHandbook = `# devmind: Complete Fullstack Engineering Handbook\n\n`;
  fullHandbook += agentsMd + '\n\n# Skills Compendium\n\n';
  for (const s of skills) {
    fullHandbook += `\n\n# Domain: ${s.name}\n\n${s.content}\n\n---`;
  }
  await writeFile(join(bundlesDir, 'devmind-full.md'), fullHandbook, 'utf8');

  console.log('\n=============================================================');
  console.log('Successfully built devmind for all target AI agent standards:');
  console.log('=============================================================');
  console.log('  ✔ Antigravity Skills  -> dist/antigravity/skills/ (each folder has root SKILL.md)');
  console.log('  ✔ Antigravity Plugin  -> dist/antigravity/plugins/devmind/ (plugin.json bundle)');
  console.log('  ✔ Antigravity Drop-In -> dist/antigravity/devmind/ (universal skills/ or plugins/ copy)');
  console.log('  ✔ Antigravity Rules   -> dist/antigravity/rules/ (AGENTS.md & GEMINI.md)');
  console.log('  ✔ Cursor IDE          -> dist/cursor/ (.cursorrules & .cursor/rules/*.mdc)');
  console.log('  ✔ Windsurf            -> dist/windsurf/ (.windsurfrules & .windsurf/rules/)');
  console.log('  ✔ Claude Code         -> dist/claude-code/ (CLAUDE.md & .claude/skills/)');
  console.log('  ✔ GitHub Copilot      -> dist/github-copilot/ (.github/copilot-instructions.md & scoped)');
  console.log('  ✔ Cline / Roo Code    -> dist/cline/ (.clinerules)');
  console.log('  ✔ Universal AGENTS    -> dist/agents/ (AGENTS.md)');
  console.log('  ✔ Multi-Agent Hooks   -> dist/hooks/ (AGENTS.md, CLAUDE.md, .cursorrules, .cursor/rules/*.mdc, .windsurfrules, .github/)');
  console.log('  ✔ Unified Bundles     -> dist/bundles/ (manifest.json & devmind-full.md)\n');

  // Check for CLI flags
  const args = process.argv.slice(2);
  if (args.includes('--install-gemini') || args.includes('--install')) {
    await installToGemini(agUniversalDir, skills);
  }
  if (args.includes('--install-hooks')) {
    await installHooks(hooksDir);
  }
}

async function installHooks(hooksDir) {
  const targetDir = process.cwd();
  console.log(`\nInstalling multi-agent root hooks to current directory: ${targetDir}...`);
  await cp(hooksDir, targetDir, { recursive: true });
  console.log('  ✔ Copied AGENTS.md, CLAUDE.md, .cursorrules, .cursor/rules/, .windsurfrules, .clinerules, and .github/ into root.\n');
}

async function installToGemini(agUniversalDir, skills) {
  const geminiConfigDir = join(homedir(), '.gemini', 'config');
  const targetSkillsDir = join(geminiConfigDir, 'skills');

  if (!existsSync(targetSkillsDir)) {
    console.log(`Creating Gemini skills directory at: ${targetSkillsDir}`);
    await mkdir(targetSkillsDir, { recursive: true });
  }

  console.log(`\nInstalling DevMind to Gemini skills: ${targetSkillsDir}...`);

  // Proactively remove any loose direct domain skill folders from previous installs
  for (const s of skills) {
    const looseDir = join(targetSkillsDir, s.name);
    if (existsSync(looseDir)) {
      await rm(looseDir, { recursive: true, force: true });
      console.log(`  🧹 Removed loose domain folder: ${s.name}`);
    }
  }

  // Install DevMind under a single consolidated devmind/ directory
  const destDevmind = join(targetSkillsDir, 'devmind');
  if (existsSync(destDevmind)) {
    await rm(destDevmind, { recursive: true, force: true });
  }
  await cp(agUniversalDir, destDevmind, { recursive: true });
  console.log(`  ✔ Installed consolidated DevMind skill into: devmind/ (includes master SKILL.md, references/, and skills/)`);

  console.log('\nInstallation complete! DevMind is now installed cleanly under ~/.gemini/config/skills/devmind/\n');
}

build().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});

