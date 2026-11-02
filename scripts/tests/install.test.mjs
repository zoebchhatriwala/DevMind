import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, readFile, readdir, symlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { beginInstallation, copyInstalledFiles, finishInstallation, parseInstallArgs, removeDuplicateMaster } from '../lib/install.mjs';
import { generateHandover } from '../handover.mjs';
import { npmInvocation } from '../quality.mjs';
import { fixture } from './helpers.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cli = (directory, args) => spawnSync(process.execPath, [join(root, 'bin/devmind.mjs'), ...args], { cwd: directory, encoding: 'utf8', shell: false, timeout: 20000 });

test('installation updates unchanged managed files and preserves existing or edited instructions', async () => {
  await fixture({ 'source/rules.md': 'version one\n', 'project/AGENTS.md': 'User rules\n' }, async directory => {
    const project = join(directory, 'project'), source = join(directory, 'source/rules.md');
    let state = await beginInstallation(project);
    await copyInstalledFiles(source, join(project, 'AGENTS.md'), state);
    await copyInstalledFiles(source, join(project, 'managed.md'), state);
    let report = await finishInstallation(state);
    assert.deepEqual(report.preserved, ['AGENTS.md']);
    assert.equal(await readFile(join(project, 'AGENTS.md'), 'utf8'), 'User rules\n');
    await writeFile(source, 'version two\n');
    state = await beginInstallation(project);
    await copyInstalledFiles(source, join(project, 'managed.md'), state);
    report = await finishInstallation(state);
    assert.deepEqual(report.updated, ['managed.md']);
    assert.equal(await readFile(join(project, 'managed.md'), 'utf8'), 'version two\n');
    await writeFile(join(project, 'managed.md'), 'Local edits\n');
    await writeFile(source, 'version three\n');
    state = await beginInstallation(project);
    await copyInstalledFiles(source, join(project, 'managed.md'), state);
    report = await finishInstallation(state);
    assert.deepEqual(report.preserved, ['managed.md']);
    assert.equal(await readFile(join(project, 'managed.md'), 'utf8'), 'Local edits\n');
  });
});

test('upgrade removes an unchanged duplicate entrypoint and preserves a modified one', async () => {
  await fixture({ 'source/SKILL.md': 'master', 'project/skill/skills/devmind/SKILL.md': 'master' }, async directory => {
    let state = await beginInstallation(join(directory, 'project'));
    await removeDuplicateMaster(join(directory, 'source'), join(directory, 'project/skill'), state);
    assert.equal(existsSync(join(directory, 'project/skill/skills/devmind/SKILL.md')), false);
    await writeFile(join(directory, 'project/skill/skills/devmind/SKILL.md'), 'User edits');
    state = await beginInstallation(join(directory, 'project'));
    await removeDuplicateMaster(join(directory, 'source'), join(directory, 'project/skill'), state);
    assert.equal(await readFile(join(directory, 'project/skill/skills/devmind/SKILL.md'), 'utf8'), 'User edits');
    assert.deepEqual(state.preserved, ['skill/skills/devmind/SKILL.md']);
  });
});

test('real installer preserves project rules and creates a single discoverable master', async () => {
  await fixture({ 'AGENTS.md': '# User instructions\nKeep these rules.\n' }, async directory => {
    const result = cli(directory, ['install', '--local', '--target', 'openskills']);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(await readFile(join(directory, 'AGENTS.md'), 'utf8'), '# User instructions\nKeep these rules.\n');
    assert.match(result.stdout, /Preserved existing file: AGENTS.md/);
    assert.ok(existsSync(join(directory, '.agents/skills/devmind/SKILL.md')));
    assert.equal(existsSync(join(directory, '.agents/skills/devmind/skills/devmind/SKILL.md')), false);
    const second = cli(directory, ['install', '--local', '--target', 'openskills']);
    assert.equal(second.status, 0, second.stderr);
    assert.match(second.stdout, /0 created, 0 updated/);
  });
});

test('invalid platforms, scopes, and flags fail before any project mutation', async () => {
  for (const args of [
    ['--local', '--target', 'not-a-platform'], ['--local', '--global', '--target', 'copilot'],
    ['--local', '--target'], ['--local', '--target', 'cursor', '--unknown'],
    ['--interactive', '--local'], ['--local', '--target', 'cursor,'],
  ]) {
    await fixture({}, async directory => {
      const result = cli(directory, ['install', ...args]);
      assert.equal(result.status, 2, `${args}: ${result.stderr}`);
      assert.deepEqual(await readdir(directory), [], String(args));
    });
  }
  assert.deepEqual(parseInstallArgs(['-l', '-t', 'gemini,claude-code']).targets, ['gemini', 'claude-code']);
});

test('installer rejects symbolic-link escapes without changing the outside file', async () => {
  await fixture({ 'source.md': 'replacement', 'outside/AGENTS.md': 'keep', 'project/keep.txt': 'keep' }, async directory => {
    await symlink(join(directory, 'outside'), join(directory, 'project', 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    const state = await beginInstallation(join(directory, 'project'));
    await assert.rejects(copyInstalledFiles(join(directory, 'source.md'), join(directory, 'project/linked/AGENTS.md'), state), /symbolic/);
    assert.equal(await readFile(join(directory, 'outside/AGENTS.md'), 'utf8'), 'keep');
  });
});

test('invalid ownership manifests fail safely and do not expose their contents', async () => {
  for (const content of ['{"private-value": broken}', '{"version":2,"files":{}}', '{"version":1,"files":{"AGENTS.md":"not-a-hash"}}']) {
    await fixture({ '.devmind/install.json': content, 'AGENTS.md': 'Keep user rules' }, async directory => {
      await assert.rejects(beginInstallation(directory), error => /Invalid (?:JSON file|installation manifest)/.test(error.message) && !error.message.includes('private-value'));
      assert.equal(await readFile(join(directory, 'AGENTS.md'), 'utf8'), 'Keep user rules');
      assert.equal(await readFile(join(directory, '.devmind/install.json'), 'utf8'), content);
    });
  }
});

test('npm package installation skips configuration while npm run install opens the wizard', async () => {
  const npm = npmInvocation();
  assert.ok(npm, 'Existing npm is required for lifecycle regression coverage.');
  await fixture({}, async directory => {
    for (const path of ['package.json', 'bin', 'scripts']) await cp(join(root, path), join(directory, path), { recursive: true });
    // npm test exports CLI configuration; its allow-scripts flag is invalid in a nested project install.
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^npm_config_allow[-_]scripts$/i.test(key)));
    env.npm_config_cache = join(directory, 'cache');
    const run = args => spawnSync(npm.command, [...npm.args, ...args], { cwd: directory, encoding: 'utf8', shell: false, input: '', timeout: 20000, env });
    const installed = run(['install', '--offline', '--ignore-scripts=false', '--package-lock=false', '--audit=false', '--fund=false', '--foreground-scripts']);
    assert.equal(installed.status, 0, installed.stderr);
    assert.doesNotMatch(installed.stdout, /Which platform|Platform \[1\]/);
    assert.match(installed.stdout, /Package installed\. Run npm run install/);
    assert.equal(existsSync(join(directory, '.devmind')), false);
    const explicit = run(['run', 'install']);
    assert.equal(explicit.status, 0, explicit.stderr);
    assert.match(explicit.stdout, /Which platform/);
    assert.equal(existsSync(join(directory, '.devmind')), false, 'No files before choosing platform and scope.');
  });
});

test('handover preserves manual evidence and never claims failing or unrun checks passed', async () => {
  await fixture({ '.devmind/handover.md': '# Manual decisions\nTests failed. Keep these notes.\n', 'package.json': JSON.stringify({ scripts: { test: 'node -e "process.exit(1)"' } }) }, async directory => {
    const npm = npmInvocation();
    const failed = spawnSync(npm.command, [...npm.args, 'test'], { cwd: directory, encoding: 'utf8', shell: false });
    assert.equal(failed.status, 1);
    await generateHandover(directory);
    await generateHandover(directory);
    const content = await readFile(join(directory, '.devmind/handover.md'), 'utf8');
    assert.match(content, /Tests failed. Keep these notes./);
    assert.match(content, /Health\*\*: Unverified/);
    assert.doesNotMatch(content, /Quality checks passing|zero security/);
    assert.equal(content.split('<!-- devmind:snapshot:start -->').length, 2);
  });
  await fixture({}, async directory => {
    await generateHandover(directory);
    assert.ok(existsSync(join(directory, '.devmind/handover.md')));
  });
});
