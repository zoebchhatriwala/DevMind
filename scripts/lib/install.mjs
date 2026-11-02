import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { artifactPath, parseOptions, readJson } from './runtime.mjs';

const TARGETS = new Map([
  ['all', 'all'], ['antigravity', 'antigravity'], ['gemini', 'antigravity'],
  ['cursor', 'cursor'], ['claude', 'claude'], ['claude-code', 'claude'],
  ['windsurf', 'windsurf'], ['agents', 'openskills'], ['openskills', 'openskills'],
  ['copilot', 'copilot'], ['github-copilot', 'copilot'], ['cline', 'cline'], ['roo', 'cline'],
]);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

export function validateTargets(targets, scope) {
  if (!Array.isArray(targets) || !targets.length) throw new Error('Choose at least one installation platform.');
  return [...new Set(targets.map(target => {
    const normalized = typeof target === 'string' ? TARGETS.get(target.trim().toLowerCase()) : undefined;
    if (!normalized) throw new Error(`Unknown installation platform: ${String(target)}. Use --help for supported platforms.`);
    if (scope === 'global' && ['copilot', 'cline'].includes(normalized)) throw new Error(`${target} supports local installation only.`);
    return normalized;
  }))];
}

export function parseInstallArgs(args) {
  const aliases = { '-l': '--local', '-g': '--global', '-t': '--target', '-y': '--yes' };
  const parsed = parseOptions(args.map(arg => Object.hasOwn(aliases, arg) ? aliases[arg] : arg), ['--target'], ['--local', '--global', '--interactive', '--yes']);
  if (parsed.positional.length) throw new Error('Unexpected installation argument. Use --target to choose platforms.');
  if (parsed.flags.has('--interactive')) {
    if (args.length !== 1) throw new Error('Use --interactive without other install options.');
    return { interactive: true };
  }
  const local = parsed.flags.has('--local'), global = parsed.flags.has('--global');
  if ((!local && !global) || !parsed.values['--target']) throw new Error('Choose --interactive, or specify --local/--global and --target for a non-interactive install.');
  const targets = parsed.values['--target'].split(',');
  if (local) validateTargets(targets, 'local');
  if (global) validateTargets(targets, 'global');
  return { local, global, targets };
}

export async function beginInstallation(directory) {
  const root = resolve(directory);
  await mkdir(root, { recursive: true });
  const manifest = await artifactPath(root, '.devmind/install.json');
  let previous = {};
  try {
    const parsed = await readJson(manifest);
    if (parsed.version !== 1 || !parsed.files || typeof parsed.files !== 'object' || Array.isArray(parsed.files)
      || Object.values(parsed.files).some(hash => typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash))) throw new Error('Invalid installation manifest. Preserve it and resolve the conflict before reinstalling.');
    previous = parsed.files;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return { root, manifest, previous, files: { ...previous }, created: [], updated: [], unchanged: [], preserved: [], removed: [] };
}

export async function removeDuplicateMaster(source, destination, state) {
  const key = relative(state.root, join(destination, 'skills/devmind/SKILL.md')).replaceAll('\\', '/');
  const target = await artifactPath(state.root, key);
  let existing;
  try { existing = await readFile(target); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  const current = await readFile(join(source, 'SKILL.md'));
  if (!existing.equals(current) && digest(existing) !== state.previous[key]) {
    state.preserved.push(key);
    return;
  }
  await unlink(target);
  delete state.files[key];
  state.removed.push(key);
}

// Only update a file when it still matches the bytes this installer last wrote.
export async function copyInstalledFiles(source, destination, state) {
  const key = relative(state.root, resolve(destination)).replaceAll('\\', '/');
  const target = await artifactPath(state.root, key);
  const sourceStat = await lstat(source);
  if (sourceStat.isSymbolicLink()) throw new Error('Installation sources must not be symbolic links.');
  if (sourceStat.isDirectory()) {
    await mkdir(target, { recursive: true });
    for (const entry of (await readdir(source)).sort()) await copyInstalledFiles(join(source, entry), join(target, entry), state);
    return;
  }
  const content = await readFile(source);
  const hash = digest(content);
  let existing;
  try { existing = await readFile(target); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (existing && digest(existing) === hash) {
    state.unchanged.push(key);
  } else if (existing && digest(existing) !== state.previous[key]) {
    state.preserved.push(key);
    return;
  } else {
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, { flag: existing ? 'w' : 'wx' });
    (existing ? state.updated : state.created).push(key);
  }
  state.files[key] = hash;
}

export async function finishInstallation(state) {
  await mkdir(dirname(state.manifest), { recursive: true });
  await writeFile(state.manifest, JSON.stringify({ version: 1, files: state.files }, null, 2) + '\n', 'utf8');
  console.log(`Installation complete: ${state.created.length} created, ${state.updated.length} updated, ${state.unchanged.length} unchanged.`);
  for (const path of state.removed) console.log(`Removed unchanged obsolete entrypoint: ${path}`);
  for (const path of state.preserved) console.log(`Preserved existing file: ${path}. Merge the relevant DevMind guidance manually if needed.`);
  return { created: state.created, updated: state.updated, unchanged: state.unchanged, preserved: state.preserved, removed: state.removed };
}
