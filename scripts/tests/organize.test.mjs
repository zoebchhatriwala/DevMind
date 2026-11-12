import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir, symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {organizeWorkspace} from '../organize.mjs';
import {WORKSPACE} from '../lib/layout.mjs';
import {fixture} from './helpers.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
function cli(command, project, args = []) {
  return spawnSync(process.execPath, [join(root, 'bin/devmind.mjs'), command, project, ...args], {encoding: 'utf8', shell: false, timeout: 15000});
}

test('organization previews loose artifacts without mutating active memory or creating folders', async () => {
  await fixture({'.devmind/task.md': 'active', '.devmind/review.md': 'assessment', '.devmind/test.log': 'log', '.devmind/quality.json': '{}'}, async directory => {
    const before = await readdir(join(directory, '.devmind'));
    const result = await organizeWorkspace(directory);
    assert.equal(result.applied, false);
    assert.equal(result.manifest, null);
    assert.deepEqual(result.moves.map(move => move.to).sort(), ['.devmind/logs/test.log', '.devmind/notes/review.md', WORKSPACE.quality]);
    assert.deepEqual(await readdir(join(directory, '.devmind')), before);
  });
});

test('apply preserves bytes, active files, tooling, and unknown folders while journaling every move', async () => {
  const kept = ['task.md', 'memory.md', 'rules.md', 'handover.md', 'install.json', 'AGENTS.md', 'CLAUDE.md', 'README.md'];
  const artifacts = {'review.md': 'notes\r\n日本', 'quality.json': '{ "historical": true }\n', 'test.log': 'private log contents', 'probe.mjs': 'import "../old-reference.mjs";', 'strata.html': '<html>map</html>', 'brief.json': '{"request":"keep"}'};
  const files = Object.fromEntries([...kept.map(name => [`.devmind/${name}`, `keep ${name}`]), ...Object.entries(artifacts).map(([name, value]) => [`.devmind/${name}`, value])]);
  Object.assign(files, {'.devmind/tooling/package.json': '{}', '.devmind/npm-cache/item': 'cache', '.devmind/custom-folder/file': 'custom', '.devmind/brief-fixture/source.txt': 'fixture'});
  await fixture(files, async directory => {
    const result = await organizeWorkspace(directory, {apply: true});
    assert.equal(result.moves.length, 7);
    assert.match(result.manifest, /^\.devmind\/reports\/organization\//);
    for (const move of result.moves) {
      const original = files[move.from] ?? 'fixture';
      assert.equal(await readFile(join(directory, move.to, move.from.endsWith('brief-fixture') ? 'source.txt' : ''), 'utf8'), original);
      await assert.rejects(readFile(join(directory, move.from)), error => error.code === 'ENOENT');
    }
    for (const name of kept) assert.equal(await readFile(join(directory, '.devmind', name), 'utf8'), `keep ${name}`);
    for (const path of ['tooling/package.json', 'npm-cache/item', 'custom-folder/file']) assert.equal(await readFile(join(directory, '.devmind', path), 'utf8'), files[`.devmind/${path}`]);
    const journal = JSON.parse(await readFile(join(directory, result.manifest), 'utf8'));
    assert.equal(journal.status, 'complete');
    assert.deepEqual(journal.moved, result.moves);
    assert.equal(journal.planned.length, 7);
    const second = await organizeWorkspace(directory, {apply: true});
    assert.deepEqual(second.moves, []);
    assert.equal(second.manifest, null);
    assert.equal((await readdir(join(directory, '.devmind/reports/organization'))).length, 1);
  });
});

test('collisions preserve both files and never merge or replace a destination directory', async () => {
  await fixture({'.devmind/quality.json': 'old report', '.devmind/reports/quality.json': 'new report', '.devmind/brief-fixture/old': 'old', '.devmind/scratch/brief-fixture/new': 'new'}, async directory => {
    const result = await organizeWorkspace(directory, {apply: true});
    assert.equal(result.moves.length, 0);
    assert.equal(result.skipped.length, 2);
    assert.ok(result.skipped.every(item => item.reason === 'destination-exists'));
    assert.equal(result.manifest, null);
    assert.equal(await readFile(join(directory, '.devmind/quality.json'), 'utf8'), 'old report');
    assert.equal(await readFile(join(directory, '.devmind/reports/quality.json'), 'utf8'), 'new report');
    assert.equal(await readFile(join(directory, '.devmind/brief-fixture/old'), 'utf8'), 'old');
    assert.equal(await readFile(join(directory, '.devmind/scratch/brief-fixture/new'), 'utf8'), 'new');
  });
});

test('symbolic-link destinations and vaults fail before writes; linked entries stay in place', async () => {
  await fixture({'project/.devmind/review.md': 'keep', 'outside/keep.txt': 'outside'}, async directory => {
    const project = join(directory, 'project');
    await symlink(join(directory, 'outside'), join(project, '.devmind/notes'), process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(organizeWorkspace(project, {apply: true}), /symbolic links/);
    assert.equal(await readFile(join(project, '.devmind/review.md'), 'utf8'), 'keep');
    assert.deepEqual(await readdir(join(directory, 'outside')), ['keep.txt']);
  });
  await fixture({'project/keep.txt': 'project', 'outside/review.md': 'outside'}, async directory => {
    await symlink(join(directory, 'outside'), join(directory, 'project/.devmind'), process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(organizeWorkspace(join(directory, 'project'), {apply: true}), /symbolic links/);
    assert.equal(await readFile(join(directory, 'outside/review.md'), 'utf8'), 'outside');
  });
  await fixture({'.devmind/task.md': 'keep', 'outside/file': 'outside'}, async directory => {
    await symlink(join(directory, 'outside'), join(directory, '.devmind/brief-fixture'), process.platform === 'win32' ? 'junction' : 'dir');
    const result = await organizeWorkspace(directory, {apply: true});
    assert.equal(result.moves.length, 0);
    assert.equal(result.skipped[0].reason, 'symbolic-link');
  });
});

test('an empty project stays empty and CLI preview/apply matches the library behavior', async () => {
  await fixture({}, async directory => {
    assert.deepEqual((await organizeWorkspace(directory, {apply: true})).moves, []);
    assert.deepEqual(await readdir(directory), []);
  });
  await fixture({'.devmind/review.md': 'notes'}, async directory => {
    const preview = cli('organize', directory, ['--json']);
    assert.equal(preview.status, 0, preview.stderr);
    assert.equal(JSON.parse(preview.stdout).applied, false);
    const bundled = spawnSync(process.execPath, [join(root, 'dist/antigravity/devmind/scripts/organize.mjs'), directory, '--json'], {encoding: 'utf8', shell: false});
    assert.equal(bundled.status, 0, bundled.stderr);
    assert.deepEqual(JSON.parse(bundled.stdout).moves, JSON.parse(preview.stdout).moves);
    assert.equal(await readFile(join(directory, '.devmind/review.md'), 'utf8'), 'notes');
    const applied = cli('organize', directory, ['--apply', '--json']);
    assert.equal(applied.status, 0, applied.stderr);
    assert.equal(JSON.parse(applied.stdout).moves.length, 1);
    assert.equal(await readFile(join(directory, '.devmind/notes/review.md'), 'utf8'), 'notes');
  });
});

test('quality, review, evaluation, and map defaults generate organized outputs and honor explicit paths', async () => {
  await fixture({'package.json': '{}', 'operation.mjs': 'export function canEditDocument() {return false;}'}, async directory => {
    assert.equal(cli('quality', directory, ['--json']).status, 2);
    assert.equal(cli('review', directory, ['--scope', 'code', '--json']).status, 2);
    assert.equal(cli('eval', directory, ['--case', 'tenant-authorization', '--json']).status, 1);
    assert.equal(cli('strata', directory).status, 0);
    for (const path of [WORKSPACE.quality, WORKSPACE.review, `${WORKSPACE.evals}/tenant-authorization/report.json`, WORKSPACE.strata]) assert.ok((await readFile(join(directory, path))).length);
    assert.deepEqual((await readdir(join(directory, '.devmind'))).sort(), ['maps', 'reports']);
    const legacy = cli('quality', directory, ['--out', '.devmind/legacy.json', '--json']);
    assert.equal(legacy.status, 2);
    assert.equal(JSON.parse(await readFile(join(directory, '.devmind/legacy.json'), 'utf8')).kind, 'quality');
  });
});

test('browser default output uses reports/browser even when browser tooling is unavailable', async () => {
  await fixture({'package.json': '{}'}, async directory => {
    const result = cli('browser-audit', directory, ['http://127.0.0.1:1', '--tooling', join(directory, 'missing'), '--json']);
    assert.equal(result.status, 2, result.stderr);
    const report = JSON.parse(await readFile(join(directory, `${WORKSPACE.browser}/report.json`), 'utf8'));
    assert.equal(report.kind, 'browser');
    assert.equal(report.status, 'incomplete');
    await assert.rejects(readFile(join(directory, '.devmind/browser/report.json')), error => error.code === 'ENOENT');
  });
});
