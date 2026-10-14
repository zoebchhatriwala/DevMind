#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT_DIR = resolve('.');
const SKILLS_DIR = join(ROOT_DIR, 'skills');
const AGENTS_MD_PATH = join(ROOT_DIR, 'AGENTS.md');

let errorsCount = 0;

function reportError(skill, message) {
  console.error(`  ✖ [${skill}]: ${message}`);
  errorsCount++;
}

async function validate() {
  console.log('Validating devmind skills and standards...\n');

  // Check AGENTS.md
  if (!existsSync(AGENTS_MD_PATH)) {
    console.error('✖ AGENTS.md missing in root directory!');
    errorsCount++;
  } else {
    const agentsContent = await readFile(AGENTS_MD_PATH, 'utf8');
    if (!agentsContent.includes('Mandatory Pre-Coding Review')) {
      console.error('✖ AGENTS.md is missing Section 1: Mandatory Pre-Coding Review');
      errorsCount++;
    }
    console.log('✔ AGENTS.md validated.');
  }

  // Check skills
  const entries = await readdir(SKILLS_DIR, { withFileTypes: true });
  let verifiedSkills = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillName = entry.name;
    const skillDir = join(SKILLS_DIR, skillName);
    const skillFile = join(skillDir, 'SKILL.md');
    const readmeFile = join(skillDir, 'README.md');

    if (!existsSync(skillFile)) {
      reportError(skillName, 'Missing SKILL.md file');
      continue;
    }

    if (!existsSync(readmeFile)) {
      reportError(skillName, 'Missing README.md file');
    }

    let content = await readFile(skillFile, 'utf8');
    // Strip BOM if present
    content = content.replace(/^\uFEFF/, '');

    // Frontmatter check
    if (!content.startsWith('---')) {
      reportError(skillName, 'SKILL.md must start with YAML frontmatter (---)');
    } else {
      const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!match) {
        reportError(skillName, 'Malformed YAML frontmatter in SKILL.md');
      } else {
        const yaml = match[1];
        if (!yaml.includes('name:')) reportError(skillName, 'Frontmatter missing "name" field');
        if (!yaml.includes('description:')) reportError(skillName, 'Frontmatter missing "description" field');
        if (!yaml.includes('trigger:')) reportError(skillName, 'Frontmatter missing "trigger" field');
      }
    }

    // Section 0 Interview check
    if (!/## 0\s*[-–—]\s*Before You Write/i.test(content)) {
      reportError(skillName, 'SKILL.md missing "## 0 - Before You Write" section');
    }

    // Checklist check
    if (!content.includes('Checklist')) {
      reportError(skillName, 'SKILL.md missing an execution checklist');
    }

    console.log(`✔ [${skillName}] validated.`);
    verifiedSkills++;
  }

  console.log(`\nValidation complete: ${verifiedSkills} skills checked.`);

  if (errorsCount > 0) {
    console.error(`\nFound ${errorsCount} validation issue(s).`);
    process.exit(1);
  } else {
    console.log('All skills pass the quality bar!\n');
  }
}

validate().catch(err => {
  console.error('Validation script error:', err);
  process.exit(1);
});
