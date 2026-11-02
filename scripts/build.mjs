#!/usr/bin/env node
import { readdir, readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { HELPER_FILES } from './lib/helpers.mjs';

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
  'strata': '**/*',
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

function generateMasterSkillMd(skills) {
  const catalog = skills.map(skill => `| ${skill.name} | [Domain guide](./references/${skill.name}.md) |`).join('\n');
  return `---
name: devmind
description: >-
  MANDATORY TRIGGER: Build, modify, or review application code using existing project conventions, task-specific UI design, strict trust boundaries, and executable verification. Route to the relevant domain guide without loading unrelated manuals.
---

# DevMind

Deliver the smallest correct change that completes the user's task. Preserve their stack, brand, scope, and explicit choices. Read [AGENTS.md](./references/AGENTS.md) for the universal baseline; load only the relevant guide below.

## 🚨 Pre-Flight Gate

Read local project instructions and memory, then inspect git status and the existing implementation. Preserve unrelated edits. For a patch, infer existing decisions without a stack interview. For new architecture, resolve only consequential unknowns, with recommended defaults, before writing files.

Run the bundled tool against the actual project directory:

    node <skill>/scripts/inspect.mjs <project> --json

Inspect the returned components, tokens, helpers, quality scripts, and dependencies before creating alternatives. Stop at the first sufficient option: omit unnecessary work, reuse existing code, use the runtime, use framework primitives, use an installed dependency, then write a small typed function.

## Domain guides

| Area | Read when relevant |
| --- | --- |
${catalog}

For UI work, start with fe-standards. For a large domain guide, read its pre-flight gate and relevant topic slices rather than loading the entire file.
The frontend guide links annotated design examples and verification procedures. Load them for substantial UI work and skill evaluation; use only affected checks for small patches.

## ⚡ Golden Patterns

- Define the user-visible outcome and its failure/recovery path before implementation. UI work also needs task-specific hierarchy, content, visual direction, and functioning controls. Preserve an established design system.
- Reuse native controls and existing typed components. Avoid interchangeable hero/card templates, invented claims, fake progress, no-op handlers, and success before persistence.
- Keep authority on the server. Validate untrusted data, enforce access checks, parameterize queries, and redact secrets. Never infer that one matching string proves a route is protected.
- Use framework idioms. Do not introduce classes, repositories, wrappers, flags, packages, or duplicate state without an actual requirement. Keep changes focused on the shared root cause.
- Comments explain non-obvious constraints, not compliance with this skill. Product copy names the user's task rather than internal pipelines.

## Tools

All paths below are relative to this installed skill. Pass the project directory explicitly when running from elsewhere. Inspect, verify, and contrast are read-only. Browser audit runs the supplied local interaction plan and writes evidence. Quality executes existing project scripts only with --run. The remaining tools write requested local artifacts. Tools do not install packages automatically.

| Tool | Purpose |
| --- | --- |
| scripts/inspect.mjs <project> --json | Discover reuse candidates and existing quality tooling. |
| scripts/verify.mjs <project> --json | Source heuristics, file/line findings, coverage, and review gaps. Add --strict to fail on warnings. |
| scripts/contrast.mjs "#111827" "#ffffff" --json | Check solid color contrast. Large-text/non-text thresholds require --large/--non-text. |
| scripts/browser-audit.mjs <project> <loopback-url> --plan <plan.json> | Capture mobile/desktop browser evidence and execute explicit outcome assertions using existing Playwright. |
| scripts/quality.mjs <project> --run --json | Execute existing named project checks; omit --run for discovery only. |
| scripts/review.mjs <project> --quality <report> --browser <report> --assessment <assessment> | Combine current evidence; missing checks and observations remain unverified. |
| scripts/eval.mjs --list | Discover five seeded tasks for testing the skill's actual output. |
| scripts/strata.mjs <project> | Generate the requested architecture map. |
| scripts/init.mjs <project> | Initialize local task memory when needed. |
| scripts/handover.mjs <project> | Refresh session continuity notes. |

Source checks reuse installed TypeScript AST tooling where supported and otherwise report lexical fallback. They cannot establish visual quality, full accessibility, authorization correctness, database access policies, or framework reachability. Review evidence before changing code. The verifier does not support --fix; do not apply heuristic source rewrites.

## 🔍 Anti-Amnesia Receipt

Print once in the initial implementation update, using checks actually inspected:

🧠 [DevMind: <domain/tier> | Checked: <three concrete checks>]

## ✅ Post-Implementation Checklist

Run the project's existing formatter, linter, type checker, and relevant tests. Add a small runnable behavior check for changed non-trivial logic. Inspect the diff for dead code, unnecessary dependencies, duplicated logic, and weakened boundaries.

For UI changes, open the real page, inspect mobile and desktop screenshots, and exercise the main journey with keyboard and pointer. Check long content and applicable loading, empty, permission, failure, and success states. Fix concrete defects and repeat affected checks. If browser tooling is unavailable, report that visual and interaction review remain unverified.

Update local task/handover notes. Finish with the concrete change, actual verification results, and material gaps. Do not claim checks that did not run or add unrelated features to make the result appear complete.
`;
}

async function copyHelperScripts(destDir) {
  const destScripts = join(destDir, 'scripts');
  await mkdir(destScripts, { recursive: true });
  const scriptFiles = HELPER_FILES;
  const srcScriptsDir = join(ROOT_DIR, 'scripts');
  for (const s of scriptFiles) {
    const src = join(srcScriptsDir, s);
    if (existsSync(src)) {
      await cp(src, join(destScripts, s), { recursive: true });
    }
  }
  // Copy templates if present
  const srcTemplates = join(ROOT_DIR, 'templates');
  if (existsSync(srcTemplates)) {
    const destTemplates = join(destDir, 'templates');
    await mkdir(destTemplates, { recursive: true });
    await cp(srcTemplates, destTemplates, { recursive: true });
  }
}

async function copyReferences(skillName, destination) {
  const source = join(SKILLS_DIR, skillName, 'references');
  if (!existsSync(source)) return;
  await mkdir(destination, { recursive: true });
  await cp(source, destination, { recursive: true });
}

export async function build() {
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

  const masterSkillMd = generateMasterSkillMd(skills);

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
    await writeFile(join(devmindSkillRefsDir, `${s.name}.md`), s.content.replaceAll('(./references/', `(./${s.name}/`), 'utf8');
    await copyReferences(s.name, join(devmindSkillRefsDir, s.name));
  }
  await copyHelperScripts(devmindSkillDir);

  // 1A.2 Individual Domain Skills (dist/antigravity/skills/<skill-name>/)
  for (const s of skills) {
    const targetDir = join(agSkillsDir, s.name);
    await mkdir(targetDir, { recursive: true });
    await writeFile(join(targetDir, 'SKILL.md'), s.content, 'utf8');
    await copyHelperScripts(targetDir);
    await copyReferences(s.name, join(targetDir, 'references'));
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
  await copyHelperScripts(agUniversalDir);

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
    await copyReferences(s.name, join(cursorRulesDir, 'references'));
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
    windsurfRules += `## ${s.name}\n${s.body.replaceAll('(./references/', '(./.devmind/references/')}\n\n---\n\n`;
    await copyReferences(s.name, join(windsurfDir, '.devmind', 'references'));
  }
  await writeFile(join(windsurfDir, '.windsurfrules'), windsurfRules, 'utf8');

  await writeFile(join(windsurfModularDir, '00-agents-baseline.md'), agentsMd, 'utf8');
  for (const s of skills) {
    await writeFile(join(windsurfModularDir, `${s.name}.md`), `# ${s.name}\n\n${s.body}`, 'utf8');
    await copyReferences(s.name, join(windsurfModularDir, 'references'));
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
    claudeMd += snippet.replaceAll('(./references/', '(./.devmind/references/') + '\n\n...\n\n';
    await copyReferences(s.name, join(claudeDir, '.devmind', 'references'));
  }
  await writeFile(join(claudeDir, 'CLAUDE.md'), claudeMd, 'utf8');

  // Modular skills for Claude Code
  for (const s of skills) {
    const sDir = join(claudeSkillsDir, s.name);
    await mkdir(sDir, { recursive: true });
    await writeFile(join(sDir, 'SKILL.md'), s.content, 'utf8');
    await copyHelperScripts(sDir);
    await copyReferences(s.name, join(sDir, 'references'));
  }

  // Master devmind skill for Claude Code (.claude/skills/devmind/)
  const claudeDevmindDir = join(claudeSkillsDir, 'devmind');
  await cp(devmindSkillDir, claudeDevmindDir, { recursive: true });
  await copyHelperScripts(claudeDevmindDir);

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
    await copyReferences(s.name, join(copilotInstructionsDir, 'references'));
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
    clineRules += `## ${s.name}\n${s.body.replaceAll('(./references/', '(./.devmind/references/')}\n\n---\n\n`;
    await copyReferences(s.name, join(clineDir, '.devmind', 'references'));
  }
  await writeFile(join(clineDir, '.clinerules'), clineRules, 'utf8');

  // =========================================================================
  // 7. Universal Agent Baseline (dist/agents)
  // =========================================================================
  console.log('7. Building Universal Agent Baseline (dist/agents)...');
  const agentsOutDir = join(DIST_DIR, 'agents');
  await mkdir(agentsOutDir, { recursive: true });
  await writeFile(join(agentsOutDir, 'AGENTS.md'), agentsMd, 'utf8');

  // OpenSkills format (.agents/skills/devmind/)
  const agentsOpenSkillsDir = join(agentsOutDir, '.agents', 'skills', 'devmind');
  await mkdir(agentsOpenSkillsDir, { recursive: true });
  await cp(agUniversalDir, agentsOpenSkillsDir, { recursive: true });
  await copyHelperScripts(agentsOpenSkillsDir);

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

  const hooksDevmindDir = join(hooksDir, '.devmind');
  await mkdir(hooksDevmindDir, { recursive: true });
  await copyHelperScripts(hooksDevmindDir);

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
    await copyReferences(s.name, join(bundlesDir, 'references'));
    await copyReferences(s.name, join(hooksDir, '.devmind', 'references'));
    await copyReferences(s.name, join(agRulesDir, 'references'));
  }
  await writeFile(join(bundlesDir, 'devmind-full.md'), fullHandbook, 'utf8');

  for (const target of ['cursor', 'windsurf', 'claude-code', 'github-copilot', 'cline', 'hooks']) {
    await copyHelperScripts(join(DIST_DIR, target));
  }

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

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  build().catch(err => {
    console.error('Build failed:', err);
    process.exit(1);
  });
}

