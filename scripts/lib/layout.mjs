// Shared defaults; explicit caller-supplied output paths remain supported.
export const WORKSPACE = Object.freeze({
  quality: '.devmind/reports/quality.json',
  review: '.devmind/reports/review.json',
  score: '.devmind/reports/score.json',
  scoreHistory: '.devmind/reports/score-history.json',
  browser: '.devmind/reports/browser',
  evals: '.devmind/reports/evals',
  brief: '.devmind/tasks/brief.json',
  strata: '.devmind/maps/strata.html',
});

const ROOT_FILES = new Set(['task.md', 'memory.md', 'rules.md', 'handover.md', 'install.json', 'agents.md', 'claude.md', 'readme.md']);

export function organizedPath(name, directory = false) {
  if (directory) return ['brief-evals', 'brief-fixture'].includes(name) ? `.devmind/scratch/${name}` : null;
  const lower = name.toLowerCase();
  if (ROOT_FILES.has(lower)) return null;
  if (lower === 'brief.json') return WORKSPACE.brief;
  if (lower === 'strata.html') return WORKSPACE.strata;
  const folder = /\.log$/i.test(name) ? 'logs' : /\.md$/i.test(name) ? 'notes' : /\.(?:json|html)$/i.test(name) ? 'reports' : /\.(?:mjs|cjs|js|py|ps1|sh)$/i.test(name) ? 'scratch' : null;
  return folder ? `.devmind/${folder}/${name}` : null;
}
