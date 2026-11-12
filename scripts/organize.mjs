#!/usr/bin/env node
import {lstat, mkdir, readdir, realpath, rename, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {artifactPath, parseOptions} from './lib/runtime.mjs';
import {organizedPath} from './lib/layout.mjs';
import {isMain} from './lib/project.mjs';

async function exists(path) {
  try { await lstat(path); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

export async function organizeWorkspace(project = '.', {apply = false} = {}) {
  const root = await realpath(resolve(project));
  const directory = await artifactPath(root, '.devmind');
  const result = {version: 1, kind: 'organization', root, applied: apply, moves: [], skipped: [], manifest: null};
  if (!await exists(directory)) return result;
  const entries = await readdir(directory, {withFileTypes: true});
  entries.sort((a, b) => a.name.localeCompare(b.name, 'en'));
  for (const entry of entries) {
    const from = `.devmind/${entry.name}`;
    if (entry.isSymbolicLink()) { result.skipped.push({path: from, reason: 'symbolic-link'}); continue; }
    const to = organizedPath(entry.name, entry.isDirectory());
    if (!to || (!entry.isDirectory() && !entry.isFile())) continue;
    await artifactPath(root, from);
    const destination = await artifactPath(root, to);
    if (await exists(destination)) result.skipped.push({path: from, destination: to, reason: 'destination-exists'});
    else result.moves.push({from, to});
  }
  if (!apply || !result.moves.length) return result;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  result.manifest = `.devmind/reports/organization/${stamp}-${randomUUID()}.json`;
  const manifest = await artifactPath(root, result.manifest);
  const journal = {version: 1, kind: 'organization-journal', root, status: 'running', planned: result.moves, moved: [], skipped: [...result.skipped], note: 'Historical artifact bytes are preserved. Relative imports and evidence paths may refer to their former locations; regenerate current evidence rather than changing fingerprints.'};
  await mkdir(dirname(manifest), {recursive: true});
  await writeFile(manifest, JSON.stringify(journal, null, 2) + '\n', {encoding: 'utf8', flag: 'wx'});
  try {
    for (const move of result.moves) {
      const from = await artifactPath(root, move.from);
      const to = await artifactPath(root, move.to);
      // Recheck immediately before moving; an earlier preview never authorizes replacing a destination.
      if (await exists(to)) {
        journal.skipped.push({path: move.from, destination: move.to, reason: 'destination-exists'});
        continue;
      }
      await mkdir(dirname(to), {recursive: true});
      await rename(from, to);
      journal.moved.push(move);
      await writeFile(manifest, JSON.stringify(journal, null, 2) + '\n', 'utf8');
    }
    journal.status = 'complete';
  } catch {
    journal.status = 'interrupted';
    throw new Error(`Organization stopped; preserved move details in ${result.manifest}.`);
  } finally {
    await writeFile(manifest, JSON.stringify(journal, null, 2) + '\n', 'utf8');
  }
  result.moves = journal.moved;
  result.skipped = journal.skipped;
  return result;
}

export async function main(args = process.argv.slice(2)) {
  const {flags, positional} = parseOptions(args, [], ['--apply']);
  if (flags.has('--help')) {
    console.log('Usage: organize.mjs [project] [--apply] [--json]\nPreview .devmind organization. --apply moves recognized loose files without replacing existing destinations; preserves active memory, install.json, tooling, caches, and unknown folders. No contents are deleted. Moves have a journal under reports/organization/. Historical scripts/reports may need updated references or regenerated evidence after relocation.');
    return;
  }
  if (positional.length > 1) throw new Error('Expected at most one project directory.');
  const result = await organizeWorkspace(positional[0], {apply: flags.has('--apply')});
  console.log(flags.has('--json') ? JSON.stringify(result, null, 2) : `${result.applied ? 'Moved' : 'Would move'} ${result.moves.length} artifacts; skipped ${result.skipped.length}.${result.manifest ? `\nMove journal: ${result.manifest}` : ''}`);
}

if (isMain(import.meta.url)) main().catch(error => {console.error(`Organize: ${error.message}`); process.exitCode = 2;});
