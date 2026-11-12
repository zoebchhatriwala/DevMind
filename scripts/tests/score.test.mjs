import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, symlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { runScore } from '../score.mjs';
import { WORKSPACE } from '../lib/layout.mjs';
import { fixture } from './helpers.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

test('empty directory reports no-source instead of claiming 100/100', async () => {
  await fixture({ 'README.md': '# empty\n' }, async dir => {
    const result = await runScore(dir);
    assert.equal(result.record.status, 'no-source');
    assert.equal(result.record.overall, null);
    assert.equal(result.record.domains, null);
    assert.ok(existsSync(join(dir, WORKSPACE.score)));
  });
});

test('score weights verify rule IDs and severities by domain and tracks positive delta after fixes', async () => {
  await fixture({
    'client.jsx': `'use client';\nconst key = process.env.NEXT_PUBLIC_STRIPE_SECRET_KEY;\nexport function Page() { return <img src="/a.png" />; }\n`,
    'job.js': 'try { run(); } catch {}\n',
    'types.ts': 'export const val: any = 1;\n',
  }, async dir => {
    const before = await runScore(dir, { save: true });
    assert.equal(before.record.status, 'scored');
    assert.equal(before.record.totalErrors, 3); // SEC-001, FLOW-007, CODE-014
    assert.equal(before.record.totalWarnings, 1); // FE-012
    assert.ok(before.record.domains.security.score < 100);
    assert.ok(before.record.domains.reliability.score < 100);
    assert.ok(before.record.domains['fe-standards'].score < 100);
    assert.ok(before.record.domains['code-quality'].score < 100);
    assert.ok(before.record.overall < 100);
    assert.equal(before.record.hotspots.length, 3);

    // Fix two issues and compare with --diff
    await writeFile(join(dir, 'client.jsx'), 'export function Page() { return <img src="/a.png" alt="Logo" />; }\n');
    await writeFile(join(dir, 'job.js'), 'try { run(); } catch (err) { throw err; }\n');

    const after = await runScore(dir, { diff: true, save: true });
    assert.equal(after.previous.overall, before.record.overall);
    assert.ok(after.record.overall > before.record.overall);
    assert.equal(after.record.domains.security.score, 100);
    assert.equal(after.record.domains.reliability.score, 100);
    assert.equal(after.record.domains['fe-standards'].score, 100);

    const history = JSON.parse(await readFile(join(dir, WORKSPACE.scoreHistory), 'utf8'));
    assert.equal(history.length, 2);
  });
});

test('score rejects symbolic-link .devmind escapes before writing reports', async t => {
  await fixture({ 'outside/keep.txt': 'keep', 'project/index.js': 'export const x = 1;\n' }, async dir => {
    try {
      await symlink(join(dir, 'outside'), join(dir, 'project/.devmind'), process.platform === 'win32' ? 'junction' : 'dir');
    } catch (error) {
      if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) { t.skip('Host does not permit test symlinks.'); return; }
      throw error;
    }
    await assert.rejects(runScore(join(dir, 'project')), /symbolic links/);
    assert.equal(existsSync(join(dir, 'outside/reports')), false);
  });
});

test('CLI supports score, devmind-score, and /devmind-score invocations consistently', async () => {
  await fixture({ 'index.js': 'try { work(); } catch {}\n' }, async dir => {
    for (const arg of ['score', 'devmind-score', '/devmind-score']) {
      const res = spawnSync(process.execPath, [join(root, 'bin/devmind.mjs'), arg, dir, '--json'], {
        cwd: root, encoding: 'utf8', shell: false,
      });
      assert.equal(res.status, 0, res.stderr);
      const parsed = JSON.parse(res.stdout);
      assert.equal(parsed.record.totalErrors, 1);
      assert.equal(parsed.record.domains.reliability.errors, 1);
    }
  });
});

