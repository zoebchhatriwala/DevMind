import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { initDevmind } from '../init.mjs';
import { fixture } from './helpers.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function answerWizard(directory, args, answers, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(root, 'bin/devmind.mjs'), ...args], { cwd: directory, env, shell: false });
    let stdout = '', stderr = '', cursor = 0, answered = 0;
    const timeout = setTimeout(() => { child.kill(); reject(new Error(`Wizard timed out after ${answered} answers: ${stdout}\n${stderr}`)); }, 15000);
    child.stdout.on('data', data => {
      stdout += data;
      while (answered < answers.length) {
        const [prompt, answer] = answers[answered];
        const index = stdout.indexOf(prompt, cursor);
        if (index === -1) break;
        cursor = index + prompt.length;
        answered++;
        child.stdin.write(answer + '\n');
      }
    });
    child.stderr.on('data', data => { stderr += data; });
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('close', status => { clearTimeout(timeout); resolve({ status, stdout, stderr, answered }); });
  });
}

async function checkLinks(file) {
  const source = (await readFile(file, 'utf8')).replace(/^```[^\n]*\n[\s\S]*?^```[^\n]*$/gm, '');
  for (const [, target] of source.matchAll(/\]\((\.[^)]+)\)/g)) {
    const path = resolve(dirname(file), target.split('#')[0]);
    assert.ok(existsSync(path), `${file}: missing ${target}`);
  }
}

async function checkTree(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await checkTree(path);
    else if (/\.(?:md|mdc)$/.test(entry.name) && entry.name !== 'README.md') await checkLinks(path);
  }
}

test('canonical domain entrypoints stay within budget and resolve topic references', async () => {
  const skills = await readdir(join(root, 'skills'), { withFileTypes: true });
  for (const entry of skills.filter(entry => entry.isDirectory())) {
    const file = join(root, 'skills', entry.name, 'SKILL.md');
    assert.ok(Buffer.byteLength(await readFile(file)) <= 12000, `${entry.name}: entrypoint exceeds 12 KB`);
    await checkLinks(file);
  }
});

test('built adapters have complete reference trees and one compact Cursor baseline', async () => {
  assert.ok(existsSync(join(root, 'dist', 'bundles', 'manifest.json')), 'Build distributions before testing.');
  await checkTree(join(root, 'dist'));
  const rules = join(root, 'dist', 'cursor', '.cursor', 'rules');
  const alwaysApplied = [];
  for (const entry of await readdir(rules)) {
    if (!entry.endsWith('.mdc')) continue;
    const source = await readFile(join(rules, entry), 'utf8');
    if (/^alwaysApply: true$/m.test(source)) alwaysApplied.push(entry);
  }
  assert.deepEqual(alwaysApplied, ['devmind.mdc']);
  for (const file of ['agents/AGENTS.md', 'claude-code/CLAUDE.md', 'windsurf/.windsurfrules', 'cline/.clinerules']) {
    assert.ok(Buffer.byteLength(await readFile(join(root, 'dist', file))) < 6500, `${file}: baseline exceeds 6.5 KB`);
  }
});

test('fresh-package install builds away from cwd without touching caller dist and resolves installed guides', async () => {
  await fixture({
    'project/dist/keep.txt': 'caller output must survive',
    'project/package.json': '{"name":"consumer"}',
  }, async directory => {
    const packageRoot = join(directory, 'package');
    await mkdir(packageRoot);
    for (const path of ['bin', 'scripts', 'skills', 'templates', 'package.json', 'AGENTS.md', 'README.md']) {
      await cp(join(root, path), join(packageRoot, path), { recursive: true });
    }
    const project = join(directory, 'project');
    const result = spawnSync(process.execPath, [join(packageRoot, 'bin/devmind.mjs'), 'install', '--local', '--target', 'all'], {
      cwd: project, encoding: 'utf8', shell: false, timeout: 60000,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(await readFile(join(project, 'dist/keep.txt'), 'utf8'), 'caller output must survive');
    assert.ok(existsSync(join(packageRoot, 'dist/bundles/manifest.json')));
    for (const file of ['AGENTS.md', 'CLAUDE.md', '.cursorrules', '.windsurfrules', '.clinerules', '.github/copilot-instructions.md']) {
      await checkLinks(join(project, file));
    }
    for (const directory of ['.devmind/skills', '.cursor/rules', '.windsurf/rules', '.github/instructions', '.agents/skills/devmind', '.claude/skills/devmind']) {
      await checkTree(join(project, directory));
    }
    const check = spawnSync(process.execPath, [join(project, '.devmind/scripts/inspect.mjs'), project, '--json'], {
      cwd: directory, encoding: 'utf8', shell: false,
    });
    assert.equal(check.status, 0, check.stderr);
    assert.equal(JSON.parse(check.stdout).packages[0].name, 'consumer');
    assert.equal(existsSync(join(project, '.devmind/strata.html')), false, 'Memory initialization must not scan/render an unrequested map.');
    const map = spawnSync(process.execPath, [join(project, '.devmind/scripts/strata.mjs'), project], {
      cwd: directory, encoding: 'utf8', shell: false,
    });
    assert.equal(map.status, 0, map.stderr);
    assert.ok(existsSync(join(project, '.devmind/strata.html')), 'An explicitly requested map must work using installed templates.');
  });
});

test('memory initialization is idempotent, preserves notes, and handles misleading ignore comments', async () => {
  await fixture({ '.gitignore': '# .devmind is discussed here, but not ignored\n' }, async directory => {
    const first = await initDevmind(directory);
    assert.equal(first.addedToGitignore, true);
    await writeFile(join(directory, '.devmind/task.md'), 'Keep this task\n');
    const before = await readFile(join(directory, '.gitignore'), 'utf8');
    const second = await initDevmind(directory);
    assert.equal(second.addedToGitignore, false);
    assert.equal(await readFile(join(directory, '.gitignore'), 'utf8'), before);
    assert.equal(await readFile(join(directory, '.devmind/task.md'), 'utf8'), 'Keep this task\n');
    assert.equal(existsSync(join(directory, '.devmind/strata.html')), false);
  });
});

test('CLI routes command help and rejects unknown command/module names without writing files', async () => {
  await fixture({}, async directory => {
    for (const command of ['verify', 'inspect', 'contrast', 'browser-audit', 'quality', 'review', 'eval', 'init']) {
      const result = spawnSync(process.execPath, [join(root, 'bin/devmind.mjs'), command, '--help'], {
        cwd: directory, encoding: 'utf8', shell: false,
      });
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, new RegExp(`Usage: (?:node )?${command === 'verify' ? 'verify' : command}\\.mjs`));
    }
    for (const command of ['__proto__', '../scripts/init']) {
      const result = spawnSync(process.execPath, [join(root, 'bin/devmind.mjs'), command], {
        cwd: directory, encoding: 'utf8', shell: false,
      });
      assert.equal(result.status, 2, result.stderr);
      assert.match(result.stderr, /Unknown command/);
    }
    assert.deepEqual(await readdir(directory), []);
  });
});

test('memory initialization preserves explicit shared tracking choices', async () => {
  await fixture({ '.gitignore': '# shared memory\n!/.devmind/\n' }, async directory => {
    const result = await initDevmind(directory);
    assert.equal(result.shared, true);
    assert.equal(result.addedToGitignore, false);
    assert.equal(await readFile(join(directory, '.gitignore'), 'utf8'), '# shared memory\n!/.devmind/\n');
  });
  await fixture({ '.devmind/task.md': 'Shared task\n' }, async directory => {
    for (const args of [['init', '--quiet'], ['add', '.devmind/task.md']]) {
      const git = spawnSync('git', args, { cwd: directory, encoding: 'utf8', shell: false });
      assert.equal(git.status, 0, git.stderr);
    }
    const result = await initDevmind(directory);
    assert.equal(result.shared, true);
    assert.equal(result.addedToGitignore, false);
    assert.equal(existsSync(join(directory, '.gitignore')), false);
  });
});

test('install script asks platform before scope, retries invalid selections, and installs only the selected local platform', async () => {
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  const command = pkg.scripts.install.split(' ');
  assert.equal(command[0], 'node');
  assert.equal(command[1], 'bin/devmind.mjs');
  await fixture({}, async directory => {
    const result = await answerWizard(directory, command.slice(2), [
      ['Platform [1]: ', '99'],
      ['Platform [1]: ', '3'],
      ['Installation scope [1]: ', '9'],
      ['Installation scope [1]: ', '1'],
      ['Run initial DevMind quality check now? [Y/n]: ', 'n'],
    ]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.answered, 5);
    assert.ok(result.stdout.indexOf('Platform [1]: ') < result.stdout.indexOf('Installation scope [1]: '));
    assert.match(result.stdout, /Choose 1 \(local\), 2 \(global\), or 3 \(both\)/);
    assert.match(result.stdout, /Choose one of the listed platforms/);
    assert.ok(existsSync(join(directory, '.cursor/rules/devmind.mdc')));
    for (const path of ['AGENTS.md', 'CLAUDE.md', '.windsurfrules', '.clinerules', '.github/copilot-instructions.md']) {
      assert.equal(existsSync(join(directory, path)), false, `Unselected platform created ${path}`);
    }
  });
});

test('global wizard installs in an isolated home without configuring the current project', async () => {
  await fixture({ 'project/keep.txt': 'untouched' }, async directory => {
    const home = join(directory, 'home');
    await mkdir(home);
    const env = { ...process.env, USERPROFILE: home, HOME: home };
    const probe = spawnSync(process.execPath, ['-e', 'process.stdout.write(require("node:os").homedir())'], { env, encoding: 'utf8', shell: false });
    assert.equal(probe.status, 0, probe.stderr);
    assert.equal(resolve(probe.stdout), resolve(home), 'Global test must never write to the real user profile.');
    const result = await answerWizard(join(directory, 'project'), ['install', '--interactive'], [
      ['Platform [1]: ', '3'],
      ['Installation scope [1]: ', '2'],
    ], env);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.answered, 2);
    assert.ok(existsSync(join(home, '.cursor/rules/devmind.mdc')));
    assert.deepEqual(await readdir(join(directory, 'project')), ['keep.txt']);
    assert.doesNotMatch(result.stdout, /quality check now/);
  });
});

test('local-only platform choices reject unsupported global installation', async () => {
  await fixture({}, async directory => {
    const result = await answerWizard(directory, ['install', '--interactive'], [
      ['Platform [1]: ', '8'],
      ['Installation scope [1]: ', '2'],
      ['Installation scope [1]: ', '1'],
      ['Run initial DevMind quality check now? [Y/n]: ', 'n'],
    ]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.answered, 4);
    assert.match(result.stdout, /supports local installation only/);
    assert.ok(existsSync(join(directory, '.clinerules')));
    assert.equal(existsSync(join(directory, '.cursor')), false);
  });
});

test('install without choices refuses unattended installation and creates no files', async () => {
  await fixture({}, async directory => {
    const result = spawnSync(process.execPath, [join(root, 'bin/devmind.mjs'), 'install'], {
      cwd: directory, encoding: 'utf8', shell: false,
    });
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /--interactive/);
    assert.deepEqual(await readdir(directory), []);
  });
});
