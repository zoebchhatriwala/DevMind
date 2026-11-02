import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, symlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { inspectProject } from '../inspect.mjs';
import { runVerify } from '../verify.mjs';
import { checkContrast } from '../contrast.mjs';
import { scanProject } from '../lib/project.mjs';
import { HELPER_FILES } from '../lib/helpers.mjs';
import { detectStack } from '../init.mjs';
import { generateStrataData, buildStrataHtml } from '../strata.mjs';
import { fixture } from './helpers.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
function cli(script, args, cwd = root) {
  const result = spawnSync(process.execPath, [join(root, script), ...args], { cwd, encoding: 'utf8', shell: false });
  if (result.error) throw result.error;
  return result;
}

test('inventory finds workspace reuse and tools without exposing script or dependency values', async () => {
  await fixture({
    'package.json': JSON.stringify({ scripts: { test: 'echo private-command-value' }, dependencies: { react: 'https://private-dependency-value' } }),
    'packages/app/package.json': JSON.stringify({ name: 'app' }),
    'src/components/Button.tsx': 'export const Button = () => null;',
    'src/styles/tokens.css': ':root { --ink: #111; }',
    'playwright.config.ts': 'export default {};',
    'node_modules/pkg/package.json': '{invalid}',
    '.env': 'PRIVATE_VALUE=not-for-output',
  }, async dir => {
    const result = await inspectProject(dir);
    assert.equal(result.packages.length, 2);
    assert.ok(result.reuseCandidates.includes('src/components/Button.tsx'));
    assert.deepEqual(result.designTokens, ['src/styles/tokens.css']);
    assert.ok(result.qualityConfigs.includes('playwright.config.ts'));
    assert.doesNotMatch(JSON.stringify(result), /private-command-value|private-dependency-value|not-for-output/);
  });
});

test('malformed package JSON fails with file evidence and no source echo', async () => {
  await fixture({ 'package.json': '{"secret":"sensitive-value", invalid}' }, async dir => {
    await assert.rejects(inspectProject(dir), error => /package.json/.test(error.message) && !/sensitive-value/.test(error.message));
    const result = cli('scripts/inspect.mjs', [dir, '--json']);
    assert.equal(result.status, 2);
    assert.doesNotMatch(result.stderr, /sensitive-value/);
    assert.equal((await detectStack(dir)).framework, 'Unknown: package.json could not be parsed');
  });
});

test('scanner includes scripts and excludes dependencies, generated output, and test fixtures', async () => {
  await fixture({
    'scripts/job.mjs': 'try { work(); } catch {}',
    'node_modules/broken.js': 'try {} catch {}',
    'dist/broken.js': 'try {} catch {}',
    'src/fixtures/broken.js': 'try {} catch {}',
    'src/job.test.js': 'try {} catch {}',
  }, async dir => {
    const result = await runVerify(dir);
    assert.equal(result.filesScanned, 1);
    assert.equal(result.counts.errors, 1);
    assert.equal(result.findings[0].file, 'scripts/job.mjs');
  });
});

test('scanner does not follow symbolic links outside the selected project', async t => {
  await fixture({ 'outside/file.js': 'try {} catch {}', 'project/index.js': 'export {};' }, async dir => {
    try {
      await symlink(join(dir, 'outside'), join(dir, 'project', 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    } catch (error) {
      if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) { t.skip('Host does not permit test symlinks.'); return; }
      throw error;
    }
    const result = await scanProject(join(dir, 'project'));
    assert.deepEqual(result.files.map(file => file.relPath), ['index.js']);
    assert.deepEqual(result.skipped, [{ file: 'linked', reason: 'symbolic-link' }]);
  });
});

test('multiline empty catches, comments inside catches, and promise swallowing are found', async () => {
  await fixture({ 'job.js': 'try { run(); } catch (error) {\n /* ignored */\n}\njob().catch(() => {\n});' }, async dir => {
    const result = await runVerify(dir);
    assert.deepEqual(result.findings.map(finding => [finding.rule.id, finding.line]), [['FLOW-007', 1], ['FLOW-007', 4]]);
    assert.equal(result.passed, false);
  });
});

test('handled failures and code-like strings/comments do not fail source checks', async () => {
  await fixture({ 'job.ts': `const message = 'catch {}';\n// try {} catch {}\nconst example = ': any';\ntry { run(); } catch (error) { return recover(error); }` }, async dir => {
    const result = await runVerify(dir);
    assert.deepEqual(result.findings, []);
  });
});

test('dead links, multiline no-op interactions, missing alt, and clickable divs have evidence', async () => {
  await fixture({ 'View.tsx': `<a href="#">Save</a>\n<button onClick={() => {\n /* TODO */\n}}>Save</button>\n<img src="a" alt="" /><img src="b" />\n<div onClick={save}>Save</div>` }, async dir => {
    const result = await runVerify(dir);
    assert.equal(result.counts.warnings, 4);
    assert.equal(result.findings.filter(finding => finding.rule.id === 'FE-012').length, 1);
    assert.ok(result.findings.some(finding => finding.rule.id === 'FE-012' && finding.line === 5));
    assert.equal(result.passed, true);
    assert.equal((await runVerify(dir, { strict: true })).passed, false);
  });
});

test('working native form actions, real anchors, and deliberate palettes are not banned', async () => {
  await fixture({
    'View.tsx': '<form action={save}><button type="submit">Save invoice</button></form><a href="/invoices">Invoices</a><img src="a" alt="Invoice preview" />',
    'brand.css': '.hero { background: linear-gradient(purple, indigo); }',
  }, async dir => assert.deepEqual((await runVerify(dir)).findings, []));
});

test('publicly prefixed secrets are flagged without leaking values into reports', async () => {
  await fixture({ 'View.tsx': `'use client';\nconst a = process.env.NEXT_PUBLIC_STRIPE_SECRET_KEY;\nconst b = import.meta.env.VITE_PRIVATE_TOKEN;\nconst c = process.env.TOKEN; // actual-private-value` }, async dir => {
    const result = await runVerify(dir);
    assert.equal(result.findings.filter(finding => finding.rule.id === 'SEC-001').length, 3);
    assert.doesNotMatch(JSON.stringify(result), /actual-private-value/);
  });
});

test('runtime validation and parameterized query patterns are distinguished from review gaps', async () => {
  await fixture({
    'app/api/bad/route.ts': 'const body = await request.json();\ndb.query(`SELECT * FROM people WHERE id = ${body.id}`);',
    'app/api/good/route.ts': 'const body = schema.parse(await request.json());\ndb.query("SELECT * FROM people WHERE id = $1", [body.id]);',
    'api/webhook.js': 'const stripe = client;\nexport async function POST(request) { return processEvent(request); }',
  }, async dir => {
    const result = await runVerify(dir);
    assert.ok(result.findings.some(finding => finding.rule.id === 'SEC-009'));
    assert.ok(result.findings.some(finding => finding.rule.id === 'SEC-004'));
    assert.ok(result.findings.some(finding => finding.rule.id === 'SEC-005'));
    assert.ok(result.findings.every(finding => !finding.file.includes('/good/')));
    assert.equal(result.coverage.manual.length, 4);
  });
});

test('type bypasses, removed focus, and compliance comments are flagged', async () => {
  await fixture({
    'index.ts': 'const value: any = input;\n// @ts-ignore\nrun();\n// DevMind 2.1: enforcing prompt compliance',
    'style.css': 'button:focus { outline: none; }',
  }, async dir => {
    const result = await runVerify(dir);
    assert.equal(result.findings.filter(finding => finding.rule.id === 'CODE-014').length, 2);
    assert.ok(result.findings.some(finding => finding.rule.id === 'CODE-015'));
    assert.ok(result.findings.some(finding => finding.rule.id === 'FE-016'));
  });
});

test('contrast calculates known ratios, rejects alpha, and does not round failing thresholds up', () => {
  assert.equal(checkContrast('#000', '#fff').ratio, 21);
  assert.equal(checkContrast('#fff', '#fff').ratio, 1);
  assert.equal(checkContrast('#777', '#fff').normalTextAA, false);
  assert.equal(checkContrast('#777', '#fff').largeTextAA, true);
  assert.equal(checkContrast('#767676', '#ffffff').normalTextAA, true);
  assert.deepEqual(checkContrast('#000', '#fff'), { ...checkContrast('#000', '#fff'), ratio: checkContrast('#fff', '#000').ratio });
  for (const color of ['red', '#0000', '#000000ff', '#ggg', null]) assert.throws(() => checkContrast(color, '#fff'));
});

test('direct and unified CLI agree on strict JSON, failures, and invalid options', async () => {
  await fixture({ 'View.html': '<a href="#">Save</a>' }, async dir => {
    for (const script of ['scripts/verify.mjs', 'bin/devmind.mjs']) {
      const prefix = script.startsWith('bin/') ? ['verify'] : [];
      const result = cli(script, [...prefix, '--json', dir, '--strict']);
      assert.equal(result.status, 1, result.stderr);
      assert.equal(JSON.parse(result.stdout).passed, false);
      assert.equal(cli(script, [...prefix, dir, '--typo']).status, 2);
      assert.notEqual(cli(script, [...prefix, dir, '--fix']).status, 0);
    }
    const passing = cli('scripts/verify.mjs', [dir, '--json']);
    assert.equal(passing.status, 0);
    assert.equal(JSON.parse(passing.stdout).counts.warnings, 1);
    assert.equal(cli('scripts/contrast.mjs', ['#fff', '#fff']).status, 1);
    assert.equal(cli('scripts/contrast.mjs', ['#000', '#fff']).status, 0);
    assert.equal(cli('bin/devmind.mjs', ['contrast', '#000', '#fff', '--json']).status, 0);
    assert.equal(cli('scripts/contrast.mjs', ['#bad-color', '#fff']).status, 2);
    assert.equal(cli('bin/devmind.mjs', ['unknown-command']).status, 2);
  });
});

test('read-only checks leave sources and local preferences unchanged', async () => {
  await fixture({ 'index.js': 'try {} catch {}', '.gitignore': '# team chooses tracked memory\n', 'package.json': '{}' }, async dir => {
    const before = await readFile(join(dir, '.gitignore'), 'utf8');
    await runVerify(dir);
    await inspectProject(dir);
    assert.equal(await readFile(join(dir, '.gitignore'), 'utf8'), before);
    assert.equal(await readFile(join(dir, 'index.js'), 'utf8'), 'try {} catch {}');
    assert.deepEqual((await readdir(dir)).sort(), ['.gitignore', 'index.js', 'package.json']);
  });
});

test('architecture inventory does not invent files, edges, traffic, journeys, or confidence', async () => {
  await fixture({ 'package.json': '{}', 'src/components/Card.tsx': '<button onClick={() => {}}>Save</button>' }, async dir => {
    const data = await generateStrataData(dir);
    assert.equal(data.nodes.length, 1);
    assert.equal(data.nodes[0].technicalName, 'src/components/Card.tsx');
    assert.equal(data.nodes[0].trafficScore, null);
    assert.equal(data.nodes[0].issues[0].confidence, 'Heuristic review');
    assert.deepEqual(data.nodes[0].connections, []);
    assert.deepEqual(data.journeys, []);
    assert.equal((await generateStrataData(join(dir, 'src', 'components'))).nodes.length, 0);
  });
});

test('map generation encodes inline script data and preserves git tracking preferences', async () => {
  await fixture({
    'package.json': '{}',
    '.gitignore': '# deliberately shared memory\n',
    'src/components/safe.tsx': '<button>Save</button>',
    'templates/.devmind/strata.html': '<script>const STRATA_DATA = {};\n</script>',
  }, async dir => {
    for (const args of [
      ['init', '--quiet'],
      ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--allow-empty', '--quiet', '-m', '</script><script>private()</script> $&'],
    ]) {
      const result = spawnSync('git', args, { cwd: dir, encoding: 'utf8', shell: false });
      assert.equal(result.status, 0, result.stderr);
    }
    await mkdir(join(dir, 'src/components/dollar$&'), { recursive: true });
    await writeFile(join(dir, 'src/components/dollar$&/Card.tsx'), '<button>Save</button>');
    const { destFile, data } = await buildStrataHtml(dir);
    const html = await readFile(destFile, 'utf8');
    const injected = html.match(/const STRATA_DATA = (.*);\n/)[1];
    assert.deepEqual(JSON.parse(injected), data);
    assert.match(data.gitLedger[0].subject, /<\/script>/);
    assert.doesNotMatch(injected, /<\/script>/);
    assert.equal(await readFile(join(dir, '.gitignore'), 'utf8'), '# deliberately shared memory\n');
  });
});

test('bundled master and individual skills can execute tools away from repository cwd', async t => {
  const { existsSync } = await import('node:fs');
  if (!existsSync(join(root, 'dist'))) { t.skip('Run npm run build to verify distribution behavior.'); return; }
  const skills = [
    'dist/antigravity/devmind',
    'dist/antigravity/skills/fe-standards',
    'dist/claude-code/.claude/skills/fe-standards',
    'dist/agents/.agents/skills/devmind',
    'dist/cursor',
    'dist/windsurf',
    'dist/github-copilot',
    'dist/cline',
  ];
  await fixture({ 'View.html': '<a href="#">Save</a>', 'package.json': '{}' }, async dir => {
    for (const skill of skills) {
      for (const file of HELPER_FILES) assert.ok(existsSync(join(root, skill, 'scripts', file)), `${skill}: ${file}`);
      const result = cli(`${skill}/scripts/verify.mjs`, [dir, '--json', '--strict'], dir);
      assert.equal(result.status, 1, result.stderr);
      assert.equal(JSON.parse(result.stdout).findings[0].rule.id, 'FLOW-008');
      const inventory = cli(`${skill}/scripts/inspect.mjs`, [dir, '--json'], dir);
      assert.equal(inventory.status, 0, inventory.stderr);
      assert.equal(JSON.parse(inventory.stdout).packages[0].file, 'package.json');
    }
  });
});
