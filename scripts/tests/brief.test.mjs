import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir, symlink, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createBrief, inScope, reviewScope, validateBrief} from '../brief.mjs';
import {fixture} from './helpers.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const patch = {request: 'Rename Save to Save draft. Keep the existing behavior.', acceptance: ['The toolbar reads Save draft.'], scope: ['src/Toolbar.tsx']};

function cli(script, directory, args) {
  return spawnSync(process.execPath, [join(root, script), directory, ...args], {cwd: root, encoding: 'utf8', shell: false, timeout: 10000});
}

function git(directory, args) {
  const result = spawnSync('git', args, {cwd: directory, encoding: 'utf8', shell: false, timeout: 10000});
  assert.equal(result.status, 0, result.stderr);
  return result;
}

test('a clear patch produces a small read-only brief without repository inventory or invented requirements', async () => {
  await fixture({'package.json': 'malformed unrelated package', '.env': 'private', 'src/Toolbar.tsx': 'unread source'}, async directory => {
    const before = await readdir(directory);
    const report = await createBrief(directory, patch);
    assert.ok(report.text.includes(patch.request));
    assert.ok(report.text.includes(patch.acceptance[0]));
    assert.ok(report.metrics.briefBytes < 700);
    assert.equal(report.metrics.sourceBytes, 0);
    assert.equal(report.scopeReview, null);
    assert.doesNotMatch(report.text, /Open questions:|plan approval|malformed unrelated/);
    assert.deepEqual(await readdir(directory), before);
    assert.equal(await readFile(join(directory, 'src/Toolbar.tsx'), 'utf8'), 'unread source');
  });
});

test('source ranges preserve exact intent, boundaries, and Unicode while excluding unrelated file content', async () => {
  const lines = Array.from({length: 2000}, (_, index) => `line ${index + 1}: café 数据`);
  await fixture({'src/Toolbar.tsx': lines.join('\n')}, async directory => {
    const spec = {...patch, request: '保存草稿 👩🏽‍💻\nKeep “�” as written.', constraints: ['Keep keyboard shortcuts.'], assumptions: ['Only the label changes.'], questions: ['Which translation should be used?'], context: [{path: 'src/Toolbar.tsx', from: 91, to: 94}, {path: 'src/Toolbar.tsx', from: 501, to: 502}]};
    const report = await createBrief(directory, spec);
    for (const item of [...spec.request.split('\n'), ...spec.acceptance, ...spec.constraints, ...spec.assumptions, ...spec.questions]) assert.ok(report.text.includes(item));
    assert.ok(report.text.includes('line 91:'));
    assert.ok(report.text.includes('line 502:'));
    assert.doesNotMatch(report.text, /line 90:|line 95:|line 500:|line 503:/);
    assert.equal(report.metrics.sourceBytes, Buffer.byteLength(lines.join('\n')));
    assert.equal(report.metrics.excerptBytes, Buffer.byteLength(lines.slice(90, 94).join('\n')) + Buffer.byteLength(lines.slice(500, 502).join('\n')));
    assert.equal(report.metrics.briefBytes, Buffer.byteLength(report.text));
    assert.ok(report.metrics.briefBytes < report.metrics.sourceBytes / 20);
  });
});

test('a tight budget drops complete optional ranges and never silently truncates human constraints', async () => {
  await fixture({'long.txt': 'x'.repeat(5000)}, async directory => {
    const spec = {...patch, constraints: ['Keep all data.', 'Do not change existing shortcuts.'], context: [{path: 'long.txt', from: 1, to: 1}]};
    const report = await createBrief(directory, spec, {budget: 1200});
    assert.ok(report.metrics.briefBytes <= 1200);
    assert.equal(report.metrics.omittedRanges, 1);
    assert.equal(report.metrics.excerptBytes, 0);
    assert.match(report.text, /Context omitted: long.txt:1-1/);
    for (const constraint of spec.constraints) assert.ok(report.text.includes(constraint));
    await assert.rejects(createBrief(directory, {...patch, constraints: ['数据'.repeat(1000)]}, {budget: 1200}), /nothing was truncated/);
  });
});

test('feature briefs retain unresolved decisions and assumptions without claiming approval or success', async () => {
  await fixture({}, async directory => {
    const spec = {request: 'Add a shared document editor.', mode: 'feature', acceptance: ['An invited colleague can reopen saved edits.'], constraints: ['Retain existing authentication.'], assumptions: ['One document at a time.'], questions: ['Should simultaneous edits merge or show a conflict?']};
    const report = await createBrief(directory, spec);
    assert.ok(report.text.includes(spec.request));
    assert.ok(report.text.includes(spec.questions[0]));
    assert.match(report.text, /Assumptions \(not confirmed requirements\)/);
    assert.doesNotMatch(report.text, /approved|tests passed|automatically merge/i);
    assert.equal(report.metrics.sourceBytes, 0);
  });
});

test('brief validation rejects ambiguous paths, malformed ranges, unknown fields, and unsafe budgets', async () => {
  for (const spec of [null, [], {}, {...patch, acceptance: []}, {...patch, mode: 'automatic'}, {...patch, commands: ['echo unsafe']}, {...patch, constraints: [null]}]) assert.throws(() => validateBrief(spec));
  for (const path of ['../outside', '/absolute', 'C:\\private', 'src/../private', 'src//file', '.', 'src/*.tsx', 'src/file\nsecret']) assert.throws(() => validateBrief({...patch, scope: [path]}));
  for (const range of [{path: 'a', from: 0, to: 1}, {path: 'a', from: 5, to: 4}, {path: 'a', from: 1, to: 81}, {path: 'a', from: 1.5, to: 2}, {path: 'src/', from: 1, to: 1}]) assert.throws(() => validateBrief({...patch, context: [range]}));
  for (const path of ['.env', '.env.local', '.aws/config', '.git/config', 'credentials.json', 'private.pem', 'private.key']) assert.throws(() => validateBrief({...patch, context: [{path, from: 1, to: 1}]}), /cannot be included/);
  await fixture({}, async directory => {
    for (const budget of [NaN, Infinity, 1.5, 0, 511, 32769]) await assert.rejects(createBrief(directory, patch, {budget}), /Budget/);
  });
  assert.equal(inScope('src/file.ts', ['src/']), true);
  assert.equal(inScope('src-sibling/file.ts', ['src/']), false);
  assert.equal(inScope('src/file.ts.bak', ['src/file.ts']), false);
  assert.deepEqual(validateBrief({...patch, scope: ['app/[id]/page.tsx']}).scope, ['app/[id]/page.tsx']);
});

test('context cannot escape through a symlink, consume unbounded/binary input, or hide a missing range', async () => {
  await fixture({'project/file.txt': 'one\ntwo', 'outside/private.txt': 'private value', 'project/binary.txt': Buffer.from([0xff, 0x00]), 'project/large.txt': 'a'.repeat(1024 * 1024 + 1)}, async directory => {
    const project = join(directory, 'project');
    await symlink(join(directory, 'outside'), join(project, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(createBrief(project, {...patch, context: [{path: 'linked/private.txt', from: 1, to: 1}]}), /symbolic links/);
    for (const path of ['binary.txt', 'large.txt', 'missing.txt']) await assert.rejects(createBrief(project, {...patch, context: [{path, from: 1, to: 1}]}), /Selected context must/);
    await assert.rejects(createBrief(project, {...patch, context: [{path: 'file.txt', from: 3, to: 4}]}), /exceeds the file length/);
    assert.equal(await readFile(join(directory, 'outside/private.txt'), 'utf8'), 'private value');
  });
});

test('scope review handles unstaged, staged, untracked, renamed, and space/Unicode filenames without editing them', async () => {
  await fixture({'allowed/file.txt': 'one', 'allowed-sibling.txt': 'one', 'space 日本.txt': 'one'}, async directory => {
    git(directory, ['init', '-q']); git(directory, ['add', '.']);
    git(directory, ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'seed']);
    await writeFile(join(directory, 'allowed/file.txt'), 'two');
    await writeFile(join(directory, 'allowed-sibling.txt'), 'two');
    await writeFile(join(directory, 'space 日本.txt'), 'two');
    await writeFile(join(directory, 'new file.txt'), 'new');
    git(directory, ['mv', 'allowed/file.txt', 'moved.txt']);
    const before = git(directory, ['status', '--porcelain=v1', '-z']).stdout;
    const review = reviewScope(directory, ['allowed/']);
    assert.equal(review.status, 'needs-review');
    assert.deepEqual(review.outside, ['allowed-sibling.txt', 'moved.txt', 'new file.txt', 'space 日本.txt']);
    assert.equal(git(directory, ['status', '--porcelain=v1', '-z']).stdout, before);
  });
});

test('scope paths stay project-relative in nested Git workspaces and unavailable review stays not-run', async () => {
  await fixture({'apps/web/src/Button.tsx': 'one', 'apps/other/file.txt': 'one'}, async directory => {
    assert.equal(reviewScope(directory, ['apps/']).status, 'not-run');
    git(directory, ['init', '-q']);
    const project = join(directory, 'apps/web');
    const report = await createBrief(project, {...patch, scope: ['src/']}, {review: true});
    assert.equal(report.scopeReview.status, 'within-scope');
    assert.equal(report.scopeReview.changedFiles, 1);
    assert.deepEqual(report.scopeReview.outside, []);
    assert.equal(reviewScope(directory, []).status, 'not-run');
  });
});

test('direct, unified, and packaged CLI generate the same brief without running project commands', async () => {
  const specPath = '.devmind/brief.json';
  await fixture({[specPath]: JSON.stringify(patch), 'package.json': JSON.stringify({scripts: {test: 'this must never execute'}})}, async directory => {
    const args = ['--spec', specPath, '--json'];
    const direct = cli('scripts/brief.mjs', directory, args);
    const unified = spawnSync(process.execPath, [join(root, 'bin/devmind.mjs'), 'brief', directory, ...args], {cwd: resolve(directory), encoding: 'utf8', shell: false});
    const packaged = cli('dist/antigravity/devmind/scripts/brief.mjs', directory, args);
    for (const result of [direct, unified, packaged]) assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(unified.stdout), JSON.parse(direct.stdout));
    assert.deepEqual(JSON.parse(packaged.stdout), JSON.parse(direct.stdout));
    assert.deepEqual(await readdir(join(directory, '.devmind')), ['brief.json']);
    assert.equal(cli('scripts/brief.mjs', directory, [...args, '--review']).status, 2);
    git(directory, ['init', '-q']);
    assert.equal(cli('scripts/brief.mjs', directory, [...args, '--review']).status, 1);
  });
});

test('CLI rejects escaped, oversized, or malformed specs without leaking their values or creating files', async () => {
  await fixture({'bad.json': '{"secret":"never-print-this", broken', 'large.json': JSON.stringify({...patch, request: 'private'.repeat(6000)})}, async directory => {
    for (const path of ['bad.json', 'large.json', '../outside.json']) {
      const result = cli('scripts/brief.mjs', directory, ['--spec', path, '--json']);
      assert.equal(result.status, 2);
      assert.doesNotMatch(result.stdout + result.stderr, /never-print-this|privateprivate/);
    }
    assert.deepEqual((await readdir(directory)).sort(), ['bad.json', 'large.json']);
  });
});
