#!/usr/bin/env node
import { readdir, readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT_DIR = resolve('.');
const SKILLS_DIR = join(ROOT_DIR, 'skills');
const DIST_DIR = join(ROOT_DIR, 'dist');
const AGENTS_MD_PATH = join(ROOT_DIR, 'AGENTS.md');

// Globs mapping for Cursor rules (.mdc)
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

async function build() {
  console.log('Building devmind skills for all coding agents and IDEs...\n');

  // Clean dist directory
  if (existsSync(DIST_DIR)) {
    await rm(DIST_DIR, { recursive: true, force: true });
  }
  await mkdir(DIST_DIR, { recursive: true });

  const agentsMd = existsSync(AGENTS_MD_PATH) ? await readFile(AGENTS_MD_PATH, 'utf8') : '';
  const skills = await loadSkills();
  console.log(`Loaded ${skills.length} skills: ${skills.map(s => s.name).join(', ')}\n`);

  // 1. Antigravity Build (dist/antigravity/devmind/* — copy 'devmind' directly)
  console.log('1. Building Antigravity bundle (dist/antigravity/devmind)...');
  const agDir = join(DIST_DIR, 'antigravity', 'devmind');
  await mkdir(agDir, { recursive: true });
  await cp(SKILLS_DIR, join(agDir, 'skills'), { recursive: true });
  if (agentsMd) {
    await writeFile(join(agDir, 'AGENTS.md'), agentsMd, 'utf8');
  }
  const readmeMd = existsSync(join(ROOT_DIR, 'README.md')) ? await readFile(join(ROOT_DIR, 'README.md'), 'utf8') : '';
  if (readmeMd) {
    await writeFile(join(agDir, 'README.md'), readmeMd, 'utf8');
  }
  const pluginJson = {
    name: 'devmind',
    version: '1.0.0',
    description: 'Curated Antigravity and AI coding agent skills.',
    skills: skills.map(s => `skills/${s.name}`),
  };
  await writeFile(join(agDir, 'plugin.json'), JSON.stringify(pluginJson, null, 2), 'utf8');

  // 2. Cursor IDE Build (.cursorrules & .cursor/rules/*.mdc)
  console.log('2. Building Cursor IDE rules (dist/cursor)...');
  const cursorDir = join(DIST_DIR, 'cursor');
  const cursorRulesDir = join(cursorDir, '.cursor', 'rules');
  await mkdir(cursorRulesDir, { recursive: true });

  // Unified .cursorrules
  let cursorRulesContent = `# devmind Cursor Rules\n\n`;
  cursorRulesContent += `> Automatically generated from devmind. Governed by AGENTS.md.\n\n`;
  cursorRulesContent += agentsMd + '\n\n---\n\n## Available Domain Skills\n\n';
  for (const s of skills) {
    cursorRulesContent += `### ${s.name}\n${s.description}\n\n`;
  }
  await writeFile(join(cursorDir, '.cursorrules'), cursorRulesContent, 'utf8');

  // Modular .cursor/rules/*.mdc
  await writeFile(
    join(cursorRulesDir, '00-agents-baseline.mdc'),
    `---\ndescription: Universal engineering baseline for all tasks (Simplicity, Security, Verification)\nglobs: *\nalwaysApply: true\n---\n\n${agentsMd}`,
    'utf8'
  );

  for (const s of skills) {
    const mdcContent = `---
description: ${s.name} - ${s.description.slice(0, 200).replace(/\r?\n/g, ' ')}
globs: ${s.globs}
alwaysApply: false
---

${s.body}
`;
    await writeFile(join(cursorRulesDir, `${s.name}.mdc`), mdcContent, 'utf8');
  }

  // 3. Windsurf / Cascade Build (.windsurfrules)
  console.log('3. Building Windsurf / Cascade rules (dist/windsurf)...');
  const windsurfDir = join(DIST_DIR, 'windsurf');
  await mkdir(windsurfDir, { recursive: true });
  let windsurfRules = `# Windsurf / Cascade Agent Rules\n\n`;
  windsurfRules += `You are an expert fullstack coding agent. You strictly adhere to the devmind engineering baseline:\n\n`;
  windsurfRules += agentsMd + '\n\n---\n\n# Domain Standards & Skills\n\n';
  for (const s of skills) {
    windsurfRules += `## ${s.name}\n${s.body}\n\n---\n\n`;
  }
  await writeFile(join(windsurfDir, '.windsurfrules'), windsurfRules, 'utf8');

  // 4. Claude Code Build (CLAUDE.md)
  console.log('4. Building Claude Code guidelines (dist/claude-code)...');
  const claudeDir = join(DIST_DIR, 'claude-code');
  await mkdir(claudeDir, { recursive: true });
  let claudeMd = `# CLAUDE.md — devmind Agent Guidelines\n\n`;
  claudeMd += `This repository uses devmind fullstack engineering standards.\n\n`;
  claudeMd += agentsMd + '\n\n---\n\n# Engineering Skills Catalog\n\n';
  for (const s of skills) {
    claudeMd += `## Skill: ${s.name}\n\n`;
    claudeMd += `**Description**: ${s.description}\n\n`;
    claudeMd += `### Core Directives\n\n`;
    // Extract first 150 lines or key headings
    const snippet = s.body.split(/\r?\n/).slice(0, 100).join('\n');
    claudeMd += snippet + '\n\n...\n\n';
  }
  await writeFile(join(claudeDir, 'CLAUDE.md'), claudeMd, 'utf8');

  // 5. GitHub Copilot Build (.github/copilot-instructions.md)
  console.log('5. Building GitHub Copilot instructions (dist/github-copilot)...');
  const copilotDir = join(DIST_DIR, 'github-copilot', '.github');
  await mkdir(copilotDir, { recursive: true });
  let copilotMd = `# GitHub Copilot Custom Instructions\n\n`;
  copilotMd += `Follow the devmind engineering baseline on all generated code and refactorings:\n\n`;
  copilotMd += agentsMd + '\n\n---\n\n## Standards By Domain\n\n';
  for (const s of skills) {
    copilotMd += `### ${s.name}\n${s.description}\n\n`;
  }
  await writeFile(join(copilotDir, 'copilot-instructions.md'), copilotMd, 'utf8');

  // 6. Distribution Bundles & Manifest
  console.log('6. Creating distribution bundles and manifest (dist/bundles)...');
  const bundlesDir = join(DIST_DIR, 'bundles');
  await mkdir(bundlesDir, { recursive: true });

  const manifest = {
    name: 'devmind',
    version: '1.0.0',
    description: 'Curated Antigravity and AI coding agent skills.',
    updatedAt: new Date().toISOString(),
    skillsCount: skills.length,
    targets: ['antigravity', 'cursor', 'windsurf', 'claude-code', 'github-copilot'],
    skills: skills.map(s => ({
      name: s.name,
      description: s.description,
      trigger: s.trigger,
      globs: s.globs,
    })),
  };

  await writeFile(join(bundlesDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  let fullHandbook = `# devmind: Complete Fullstack Engineering Handbook\n\n`;
  fullHandbook += agentsMd + '\n\n# Skills Compendium\n\n';
  for (const s of skills) {
    fullHandbook += `\n\n# Domain: ${s.name}\n\n${s.content}\n\n---`;
  }
  await writeFile(join(bundlesDir, 'devmind-full.md'), fullHandbook, 'utf8');

  console.log('Successfully built devmind skills for:');
  console.log('  ✔ Antigravity     -> dist/antigravity/devmind/ (copy "devmind" directly)');
  console.log('  ✔ Cursor IDE      -> dist/cursor/ (.cursorrules & .cursor/rules/*.mdc)');
  console.log('  ✔ Windsurf        -> dist/windsurf/ (.windsurfrules)');
  console.log('  ✔ Claude Code     -> dist/claude-code/ (CLAUDE.md)');
  console.log('  ✔ GitHub Copilot  -> dist/github-copilot/ (.github/copilot-instructions.md)');
  console.log('  ✔ Unified Bundles -> dist/bundles/ (manifest.json & devmind-full.md)\n');
}

build().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
