import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, readFile, readdir, symlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { beginInstallation, copyInstalledFiles, finishInstallation, parseInstallArgs, parseUninstallArgs, removeDuplicateMaster, uninstallFromRoot } from '../lib/install.mjs';
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

test('uninstall removes unchanged managed files, supports target scoping and dry-run, and preserves edited or user files', async () => {
  await fixture({ '.devmind/task.md': 'User task\n', 'AGENTS.md': 'User agents\n' }, async directory => {
    const installed = cli(directory, ['install', '--local', '--target', 'cursor,claude']);
    assert.equal(installed.status, 0, installed.stderr);
    assert.ok(existsSync(join(directory, '.cursor/rules/devmind.mdc')));
    assert.ok(existsSync(join(directory, '.cursor/commands/devmind-score.md')));
    assert.ok(existsSync(join(directory, 'CLAUDE.md')));
    assert.ok(existsSync(join(directory, '.devmind/scripts/score.mjs')));

    await writeFile(join(directory, 'CLAUDE.md'), '# Custom Claude instructions\n');

    const dryRun = cli(directory, ['uninstall', '--local', '--target', 'cursor', '--dry-run']);
    assert.equal(dryRun.status, 0, dryRun.stderr);
    assert.match(dryRun.stdout, /Dry-run uninstall: \d+ removed/);
    assert.ok(existsSync(join(directory, '.cursor/rules/devmind.mdc')));

    const cursorOnly = cli(directory, ['uninstall', '--local', '--target', 'cursor']);
    assert.equal(cursorOnly.status, 0, cursorOnly.stderr);
    assert.equal(existsSync(join(directory, '.cursor/rules/devmind.mdc')), false);
    assert.equal(existsSync(join(directory, '.cursor/commands/devmind-score.md')), false);
    assert.ok(existsSync(join(directory, 'CLAUDE.md')));
    assert.ok(existsSync(join(directory, '.devmind/scripts/score.mjs')));
    assert.ok(existsSync(join(directory, '.devmind/install.json')));

    const claudeLast = cli(directory, ['uninstall', '--local', '--target', 'claude']);
    assert.equal(claudeLast.status, 0, claudeLast.stderr);
    assert.match(claudeLast.stdout, /Preserved modified file: CLAUDE\.md/);
    assert.equal(await readFile(join(directory, 'CLAUDE.md'), 'utf8'), '# Custom Claude instructions\n');
    assert.equal(existsSync(join(directory, '.claude/skills/devmind-score/SKILL.md')), false);
    assert.equal(existsSync(join(directory, '.claude/skills/devmind/SKILL.md')), false);
    assert.equal(existsSync(join(directory, '.devmind/scripts')), false);
    assert.equal(existsSync(join(directory, '.devmind/install.json')), false);
    assert.equal(await readFile(join(directory, '.devmind/task.md'), 'utf8'), 'User task\n');
    assert.equal(await readFile(join(directory, 'AGENTS.md'), 'utf8'), 'User agents\n');
  });
});

test('uninstall never deletes other existing skills, commands, or rules across local and global skill folders', async () => {
  await fixture({
    'project/.agents/skills/other-skill/SKILL.md': '# Other Agent Skill\n',
    'project/.agents/skills/devmind-custom/SKILL.md': '# Custom DevMind Addon\n',
    'project/.claude/skills/team-skill/SKILL.md': '# Team Claude Skill\n',
    'project/.cursor/rules/team-rule.mdc': '# Team Cursor Rule\n',
    'project/.cursor/commands/team-cmd.md': '# Team Cursor Command\n',
    'project/.windsurf/rules/team-rule.md': '# Team Windsurf Rule\n',
    'project/.windsurf/workflows/team-flow.md': '# Team Windsurf Workflow\n',
    'project/.github/instructions/team.instructions.md': '# Team Copilot Instructions\n',
    'home/.gemini/config/skills/other-skill/SKILL.md': '# Other Gemini Skill\n',
    'home/.gemini/config/skills/devmind-personal/SKILL.md': '# Personal Skill\n',
    'home/.claude/skills/other-skill/SKILL.md': '# Other Global Claude Skill\n',
    'home/.agents/skills/other-skill/SKILL.md': '# Other Global OpenSkill\n',
  }, async directory => {
    const project = join(directory, 'project');
    const home = join(directory, 'home');
    const env = { ...process.env, USERPROFILE: home, HOME: home };

    const localInstall = cli(project, ['install', '--local', '--target', 'all']);
    assert.equal(localInstall.status, 0, localInstall.stderr);
    const globalInstall = spawnSync(process.execPath, [join(root, 'bin/devmind.mjs'), 'install', '--global', '--target', 'all'], {
      cwd: project, encoding: 'utf8', shell: false, timeout: 20000, env,
    });
    assert.equal(globalInstall.status, 0, globalInstall.stderr);

    assert.ok(existsSync(join(project, '.agents/skills/devmind-score/SKILL.md')));
    assert.ok(existsSync(join(home, '.gemini/config/skills/devmind-score/SKILL.md')));

    const localUninstall = cli(project, ['uninstall', '--local', '--target', 'all']);
    assert.equal(localUninstall.status, 0, localUninstall.stderr);
    const globalUninstall = spawnSync(process.execPath, [join(root, 'bin/devmind.mjs'), 'uninstall', '--global', '--target', 'all'], {
      cwd: project, encoding: 'utf8', shell: false, timeout: 20000, env,
    });
    assert.equal(globalUninstall.status, 0, globalUninstall.stderr);

    assert.equal(existsSync(join(project, '.agents/skills/devmind/SKILL.md')), false);
    assert.equal(existsSync(join(project, '.agents/skills/devmind-score/SKILL.md')), false);
    assert.equal(existsSync(join(home, '.gemini/config/skills/devmind/SKILL.md')), false);
    assert.equal(existsSync(join(home, '.gemini/config/skills/devmind-score/SKILL.md')), false);

    assert.equal(await readFile(join(project, '.agents/skills/other-skill/SKILL.md'), 'utf8'), '# Other Agent Skill\n');
    assert.equal(await readFile(join(project, '.agents/skills/devmind-custom/SKILL.md'), 'utf8'), '# Custom DevMind Addon\n');
    assert.equal(await readFile(join(project, '.claude/skills/team-skill/SKILL.md'), 'utf8'), '# Team Claude Skill\n');
    assert.equal(await readFile(join(project, '.cursor/rules/team-rule.mdc'), 'utf8'), '# Team Cursor Rule\n');
    assert.equal(await readFile(join(project, '.cursor/commands/team-cmd.md'), 'utf8'), '# Team Cursor Command\n');
    assert.equal(await readFile(join(project, '.windsurf/rules/team-rule.md'), 'utf8'), '# Team Windsurf Rule\n');
    assert.equal(await readFile(join(project, '.windsurf/workflows/team-flow.md'), 'utf8'), '# Team Windsurf Workflow\n');
    assert.equal(await readFile(join(project, '.github/instructions/team.instructions.md'), 'utf8'), '# Team Copilot Instructions\n');
    assert.equal(await readFile(join(home, '.gemini/config/skills/other-skill/SKILL.md'), 'utf8'), '# Other Gemini Skill\n');
    assert.equal(await readFile(join(home, '.gemini/config/skills/devmind-personal/SKILL.md'), 'utf8'), '# Personal Skill\n');
    assert.equal(await readFile(join(home, '.claude/skills/other-skill/SKILL.md'), 'utf8'), '# Other Global Claude Skill\n');
    assert.equal(await readFile(join(home, '.agents/skills/other-skill/SKILL.md'), 'utf8'), '# Other Global OpenSkill\n');
  });
});

test('uninstall validates flags and rejects symlink escapes before deleting files', async () => {
  for (const args of [
    [], ['--local', '--target', 'not-a-platform'], ['--local', '--global', '--target', 'copilot'],
    ['--local', '--target'], ['--local', '--target', 'cursor', '--unknown'], ['--interactive', '--local'],
  ]) {
    await fixture({ '.cursor/rules/devmind.mdc': 'keep\n' }, async directory => {
      const result = cli(directory, ['uninstall', ...args]);
      assert.equal(result.status, 2, `${args}: ${result.stderr}`);
      assert.equal(await readFile(join(directory, '.cursor/rules/devmind.mdc'), 'utf8'), 'keep\n');
    });
  }
  assert.deepEqual(parseUninstallArgs(['-l', '-t', 'cursor', '--dry-run']), {
    local: true, global: false, targets: ['cursor'], dryRun: true,
  });

  await fixture({ 'outside/CLAUDE.md': 'keep' }, async directory => {
    const project = join(directory, 'project');
    await mkdir(project);
    const installed = cli(project, ['install', '--local', '--target', 'cursor']);
    assert.equal(installed.status, 0, installed.stderr);
    await symlink(join(directory, 'outside'), join(project, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    const manifestPath = join(project, '.devmind/install.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    manifest.files['linked/CLAUDE.md'] = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    await assert.rejects(uninstallFromRoot(project, { targets: ['all'], scope: 'local' }), /symbolic/);
    assert.equal(await readFile(join(directory, 'outside/CLAUDE.md'), 'utf8'), 'keep');
  });
});

test('npm run uninstall opens the interactive uninstall wizard', async () => {
  const npm = npmInvocation();
  assert.ok(npm, 'Existing npm is required for uninstall lifecycle coverage.');
  await fixture({}, async directory => {
    for (const path of ['package.json', 'bin', 'scripts']) await cp(join(root, path), join(directory, path), { recursive: true });
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^npm_config_allow[-_]scripts$/i.test(key)));
    const result = spawnSync(npm.command, [...npm.args, 'run', 'uninstall'], { cwd: directory, encoding: 'utf8', shell: false, input: '', timeout: 20000, env });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Which platform do you want to uninstall DevMind from\?/);
  });
});
