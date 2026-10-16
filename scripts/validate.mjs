#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT_DIR = resolve('.');
const SKILLS_DIR = join(ROOT_DIR, 'skills');
const DIST_DIR = join(ROOT_DIR, 'dist');
const AGENTS_MD_PATH = join(ROOT_DIR, 'AGENTS.md');

let errorsCount = 0;

function reportError(target, message) {
  console.error(`  ✖ [${target}]: ${message}`);
  errorsCount++;
}

async function validateSkillFile(skillName, skillFile) {
  if (!existsSync(skillFile)) {
    reportError(skillName, 'Missing SKILL.md file on root');
    return false;
  }

  let content = await readFile(skillFile, 'utf8');
  content = content.replace(/^\uFEFF/, '');

  if (!content.startsWith('---')) {
    reportError(skillName, 'SKILL.md must start with YAML frontmatter (---)');
    return false;
  }

  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    reportError(skillName, 'Malformed YAML frontmatter in SKILL.md');
    return false;
  }

  const yaml = match[1];
  if (!yaml.includes('name:')) reportError(skillName, 'Frontmatter missing "name" field');
  if (!yaml.includes('description:')) reportError(skillName, 'Frontmatter missing "description" field');
  if (!yaml.includes('trigger:')) reportError(skillName, 'Frontmatter missing "trigger" field');

  // 1. Mandatory Trigger Check
  const descMatch = yaml.match(/description:\s*(?:>-\s*)?["']?([^"'\r\n]+)/);
  if (!descMatch || !descMatch[1].trim().startsWith('MANDATORY TRIGGER:')) {
    reportError(skillName, 'Frontmatter description MUST begin with "MANDATORY TRIGGER:"');
  }

  // 2. Protocol Sections Check
  if (!/##\s*🚨?\s*Pre-Flight Gate/i.test(content)) {
    reportError(skillName, 'Missing "## 🚨 Pre-Flight Gate" section');
  }

  if (!/##\s*⚡?\s*Golden Patterns/i.test(content)) {
    reportError(skillName, 'Missing "## ⚡ Golden Patterns" section');
  }

  if (!/##\s*🔍?\s*Anti-Amnesia Receipt/i.test(content)) {
    reportError(skillName, 'Missing "## 🔍 Anti-Amnesia Receipt" section');
  }

  if (!/##\s*✅?\s*Post-Implementation Checklist/i.test(content) && !content.includes('Checklist')) {
    reportError(skillName, 'Missing "## ✅ Post-Implementation Checklist" section');
  }

  // 3. Receipt Badge Format Check
  if (!content.includes('🧠 [DevMind:')) {
    reportError(skillName, 'Missing Anti-Amnesia badge format: 🧠 [DevMind: <skill-name> applied...]');
  }

  // 4. Token & Scannability Check
  const words = content.split(/\s+/).length;
  if (words < 100) {
    reportError(skillName, 'SKILL.md content is empty or incomplete');
  }
  if (words > 15000) {
    reportError(skillName, `SKILL.md word count (${words}) is excessive; keep concise to avoid context exhaustion`);
  }

  return true;
}

async function validateDist() {
  console.log('\nValidating compiled distribution targets in dist/...\n');

  if (!existsSync(DIST_DIR)) {
    reportError('dist', 'dist/ directory does not exist. Run "npm run build" first.');
    return;
  }

  // 1. Antigravity Skills validation: Every directory under dist/antigravity/skills MUST have SKILL.md on root!
  const agSkillsDir = join(DIST_DIR, 'antigravity', 'skills');
  if (!existsSync(agSkillsDir)) {
    reportError('antigravity', 'dist/antigravity/skills is missing!');
  } else {
    const entries = await readdir(agSkillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillPath = join(agSkillsDir, entry.name, 'SKILL.md');
      if (!existsSync(skillPath)) {
        reportError(`antigravity:skills/${entry.name}`, 'Missing SKILL.md on the root of skill directory!');
      } else {
        console.log(`  ✔ [antigravity:skills/${entry.name}]: Root SKILL.md verified.`);
      }
    }
  }

  // 2. Antigravity Universal Drop-in validation
  const agDevmind = join(DIST_DIR, 'antigravity', 'devmind');
  if (!existsSync(join(agDevmind, 'SKILL.md'))) {
    reportError('antigravity:devmind', 'Missing SKILL.md on root of universal drop-in folder!');
  } else {
    console.log('  ✔ [antigravity:devmind]: Root SKILL.md verified for direct ~/.gemini/config/skills/ copy.');
  }
  if (!existsSync(join(agDevmind, 'plugin.json'))) {
    reportError('antigravity:devmind', 'Missing plugin.json on root of universal drop-in folder!');
  } else {
    console.log('  ✔ [antigravity:devmind]: Root plugin.json verified for direct plugins/ copy.');
  }

  // 3. Antigravity Plugin validation
  const agPlugin = join(DIST_DIR, 'antigravity', 'plugins', 'devmind', 'plugin.json');
  if (!existsSync(agPlugin)) {
    reportError('antigravity:plugins/devmind', 'Missing plugin.json manifest!');
  } else {
    console.log('  ✔ [antigravity:plugins/devmind]: Valid plugin manifest verified.');
  }

  // 4. Cursor validation
  if (!existsSync(join(DIST_DIR, 'cursor', '.cursorrules')) || 
      !existsSync(join(DIST_DIR, 'cursor', '.cursor', 'rules', 'devmind.mdc')) ||
      !existsSync(join(DIST_DIR, 'cursor', '.cursor', 'rules', '00-agents-baseline.mdc'))) {
    reportError('cursor', 'Missing Cursor .cursorrules or .cursor/rules/*.mdc');
  } else {
    console.log('  ✔ [cursor]: Rules and devmind.mdc verified.');
  }

  // 5. Windsurf validation
  if (!existsSync(join(DIST_DIR, 'windsurf', '.windsurfrules'))) {
    reportError('windsurf', 'Missing .windsurfrules');
  } else {
    console.log('  ✔ [windsurf]: .windsurfrules verified.');
  }

  // 6. Claude Code validation
  if (!existsSync(join(DIST_DIR, 'claude-code', 'CLAUDE.md'))) {
    reportError('claude-code', 'Missing CLAUDE.md');
  } else {
    console.log('  ✔ [claude-code]: CLAUDE.md verified.');
  }

  // 7. GitHub Copilot validation
  if (!existsSync(join(DIST_DIR, 'github-copilot', '.github', 'copilot-instructions.md'))) {
    reportError('github-copilot', 'Missing copilot-instructions.md');
  } else {
    console.log('  ✔ [github-copilot]: copilot-instructions.md verified.');
  }

  // 8. Cline validation
  if (!existsSync(join(DIST_DIR, 'cline', '.clinerules'))) {
    reportError('cline', 'Missing .clinerules');
  } else {
    console.log('  ✔ [cline]: .clinerules verified.');
  }

  // 9. Multi-Agent Hooks validation
  const hooksDir = join(DIST_DIR, 'hooks');
  if (!existsSync(join(hooksDir, 'AGENTS.md')) || 
      !existsSync(join(hooksDir, 'CLAUDE.md')) ||
      !existsSync(join(hooksDir, '.cursorrules')) ||
      !existsSync(join(hooksDir, '.cursor', 'rules', 'devmind.mdc'))) {
    reportError('hooks', 'Missing drop-in multi-agent hooks in dist/hooks');
  } else {
    console.log('  ✔ [hooks]: Multi-agent drop-in root hooks verified.');
  }

  // 10. Bundles validation
  if (!existsSync(join(DIST_DIR, 'bundles', 'manifest.json')) || !existsSync(join(DIST_DIR, 'bundles', 'devmind-full.md'))) {
    reportError('bundles', 'Missing bundle manifest or devmind-full.md');
  } else {
    console.log('  ✔ [bundles]: Distribution manifest and full handbook verified.');
  }
}

async function validate() {
  console.log('Validating devmind canonical skills and standards...\n');

  // Check AGENTS.md
  if (!existsSync(AGENTS_MD_PATH)) {
    console.error('✖ AGENTS.md missing in root directory!');
    errorsCount++;
  } else {
    const agentsContent = await readFile(AGENTS_MD_PATH, 'utf8');
    if (!agentsContent.includes('Mandatory Skill Routing Matrix')) {
      console.error('✖ AGENTS.md is missing Mandatory Skill Routing Matrix');
      errorsCount++;
    }
    if (!agentsContent.includes('<EXECUTION_RULE>')) {
      console.error('✖ AGENTS.md is missing <EXECUTION_RULE> block');
      errorsCount++;
    }
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

    if (!existsSync(readmeFile)) {
      reportError(skillName, 'Missing README.md file');
    }

    const valid = await validateSkillFile(skillName, skillFile);
    if (valid) {
      console.log(`✔ [${skillName}] canonical skill validated.`);
      verifiedSkills++;
    }
  }

  console.log(`\nCanonical validation complete: ${verifiedSkills} skills checked.`);

  // If dist exists, validate dist artifacts as well
  if (existsSync(DIST_DIR)) {
    await validateDist();
  }

  if (errorsCount > 0) {
    console.error(`\nFound ${errorsCount} validation issue(s).`);
    process.exit(1);
  } else {
    console.log('\nAll skills and distribution artifacts pass the quality bar!\n');
  }
}

validate().catch(err => {
  console.error('Validation script error:', err);
  process.exit(1);
});

