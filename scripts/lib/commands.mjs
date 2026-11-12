export const COMMANDS = Object.freeze([
  {
    name: 'score',
    slash: 'devmind-score',
    script: 'score.mjs',
    args: '<project> --diff',
    description: 'Score code quality (0-100) by domain with delta vs last run.',
    instructions: [
      'Run `score.mjs` immediately against the target project directory (default `.`) with `--diff` so the run is scored, compared against the last saved baseline, and recorded in `.devmind/reports/score.json`.',
      'Present the overall score, domain scores (`security`, `fe-standards`, `reliability`, `code-quality`), trend delta when history exists, top files to fix, and stated limitations.',
      'Never claim a score of 100 guarantees runtime security, visual quality, or passing tests.',
    ],
  },
  {
    name: 'strata',
    slash: 'devmind-strata',
    script: 'strata.mjs',
    args: '<project>',
    description: 'Generate the interactive Strata architecture and security map.',
    instructions: [
      'Run `strata.mjs` against the target project directory (default `.`). Do not ask the user to run an npm script.',
      'Return the direct clickable `file://` link to `.devmind/maps/strata.html`, and note heuristic check coverage vs checks that still require manual source review.',
    ],
  },
  {
    name: 'verify',
    slash: 'devmind-verify',
    script: 'verify.mjs',
    args: '<project> --json',
    description: 'Run read-only security, reliability, and accessibility checks.',
    instructions: [
      'Run `verify.mjs` with `--json` (add `--strict` when strict gating is requested) against the target project directory (default `.`).',
      'Summarize findings by severity with exact `file:line`, rule ID, and coverage/limitations. Never apply automatic heuristic rewrites.',
    ],
  },
  {
    name: 'inspect',
    slash: 'devmind-inspect',
    script: 'inspect.mjs',
    args: '<project> --json',
    description: 'Inventory packages, reusable components, tokens, and tooling.',
    instructions: [
      'Run `inspect.mjs` with `--json` against the target project directory (default `.`).',
      'Report detected packages, script names, reuse candidates, design tokens, and quality configs. Remind the user this is read-only discovery.',
    ],
  },
  {
    name: 'brief',
    slash: 'devmind-brief',
    script: 'brief.mjs',
    args: '<project> --spec .devmind/tasks/brief.json --review',
    description: 'Render bounded task brief and review git scope outliers.',
    instructions: [
      'Run `brief.mjs` against the target project directory using `--spec .devmind/tasks/brief.json` (and `--review` when checking git diff scope outliers).',
      'If `.devmind/tasks/brief.json` does not exist yet, help draft it from the user request before running. `--review` flags scope outliers only and does not prove acceptance.',
    ],
  },
  {
    name: 'quality',
    slash: 'devmind-quality',
    script: 'quality.mjs',
    args: '<project> --run --json',
    description: 'Discover or run project format, lint, typecheck, and test scripts.',
    instructions: [
      'Run `quality.mjs` with `--run --json` against the target project directory (or omit `--run` for read-only discovery).',
      'Report each check status (`passed`, `failed`, `not-run`), exit codes, and whether source files remained stable during execution.',
    ],
  },
  {
    name: 'review',
    slash: 'devmind-review',
    script: 'review.mjs',
    args: '<project> --quality .devmind/reports/quality.json',
    description: 'Combine source checks, quality, browser, and review evidence.',
    instructions: [
      'Run `review.mjs` with the project directory and available evidence reports (`--quality`, `--browser`, `--assessment`).',
      'Report stale fingerprints, missing checks, and unverified areas explicitly.',
    ],
  },
  {
    name: 'handover',
    slash: 'devmind-handover',
    script: 'handover.mjs',
    args: '<project>',
    description: 'Refresh .devmind/handover.md with git status and shortcuts.',
    instructions: [
      'Run `handover.mjs` against the target project directory (default `.`).',
      'Report modified file count, tracked shortcuts, and path to `.devmind/handover.md`. Preserve manual notes and state clearly that quality checks remain unverified unless separately run.',
    ],
  },
  {
    name: 'init',
    slash: 'devmind-init',
    script: 'init.mjs',
    args: '<project>',
    description: 'Initialize the .devmind/ memory vault and .gitignore rules.',
    instructions: [
      'Run `init.mjs` against the target project directory (default `.`).',
      'Report initialized files and `.gitignore` status while preserving any existing notes or explicit team tracking choices.',
    ],
  },
  {
    name: 'organize',
    slash: 'devmind-organize',
    script: 'organize.mjs',
    args: '<project>',
    description: 'Preview or organize loose .devmind/ artifacts cleanly.',
    instructions: [
      'Run `organize.mjs` in preview mode first; pass `--apply` only when the user wants to move files.',
      'Report planned or completed moves, skipped collisions, and the move journal path.',
    ],
  },
  {
    name: 'eval',
    slash: 'devmind-eval',
    script: 'eval.mjs',
    args: '--list',
    description: 'List and run seeded DevMind benchmark evaluations.',
    instructions: [
      'Run `eval.mjs --list` to show available seeded evaluation cases, or run with `--case <id> --prepare <dir>` / `--evaluate` as requested.',
      'Report behavior status separately from reviewer assessment and never claim cross-model gains without comparable provenance.',
    ],
  },
  {
    name: 'contrast',
    slash: 'devmind-contrast',
    script: 'contrast.mjs',
    args: '"#111827" "#ffffff" --json',
    description: 'Check WCAG contrast ratio for two opaque hex colors.',
    instructions: [
      'Run `contrast.mjs` with both quoted hex colors and `--json` (add `--large` or `--non-text` when testing 3:1 thresholds).',
      'Report the exact computed ratio, threshold, and pass/fail status.',
    ],
  },
]);

export const COMMAND_NAMES = Object.freeze(COMMANDS.map(cmd => cmd.name));
export const COMMAND_BY_NAME = Object.freeze(Object.fromEntries(COMMANDS.map(cmd => [cmd.name, cmd])));

function runnerBlock(cmd) {
  return [
    'Locate and run the bundled script for the target project (replace `<project>` with the workspace path or `.`):',
    '',
    '```bash',
    `# Project-local install`,
    `node .devmind/scripts/${cmd.script} ${cmd.args}`,
    '',
    `# Installed skill sibling or global scripts`,
    `node ~/.devmind/scripts/${cmd.script} ${cmd.args}`,
    '',
    `# Or via DevMind CLI`,
    `npx devmind ${cmd.name} ${cmd.args}`,
    '```',
  ].join('\n');
}

export function renderCommandSkill(cmd) {
  return [
    '---',
    `name: ${cmd.slash}`,
    `description: ${cmd.description}`,
    '---',
    '',
    `# /${cmd.slash}`,
    '',
    cmd.description,
    '',
    runnerBlock(cmd),
    '',
    '## Execution Rules',
    '',
    ...cmd.instructions.map(line => `- ${line}`),
    '- Do not ask the user to run the command manually when you have terminal access; run it and report actual output.',
    '',
  ].join('\n');
}

export function renderEditorCommand(cmd) {
  return [
    '---',
    `description: ${cmd.description}`,
    '---',
    '',
    `# /${cmd.slash}`,
    '',
    runnerBlock(cmd),
    '',
    '## Execution Rules',
    '',
    ...cmd.instructions.map(line => `- ${line}`),
    '',
  ].join('\n');
}
