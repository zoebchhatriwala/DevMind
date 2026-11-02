import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile, symlink, rename, unlink } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fixture, serveProject } from './helpers.mjs';
import { runVerify } from '../verify.mjs';
import { runQuality } from '../quality.mjs';
import { auditBrowser, localUrl, validatePlan } from '../browser-audit.mjs';
import { reviewProject, VISUAL_CRITERIA } from '../review.mjs';
import { loadCases, prepareCase, evaluateCase, compareEvaluations } from '../eval.mjs';
import { artifactPath, fingerprint, optionalPackage, writeReport } from '../lib/runtime.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const toolingRoot = process.env.DEVMIND_TEST_TOOLING ?? join(root, '.devmind', 'tooling');
const browserOptions = { toolingRoot, channel: process.env.DEVMIND_TEST_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : undefined) };
const hasParser = Boolean(optionalPackage(toolingRoot, ['typescript']));
const hasBrowser = Boolean(optionalPackage(toolingRoot, ['playwright', '@playwright/test', 'playwright-core']));

test('required browser/parser tooling is present when the strict test gate is enabled', () => {
  if (process.env.DEVMIND_REQUIRE_TOOLING === '1') {
    assert.ok(hasParser, 'The strict test gate requires an existing supported TypeScript installation.');
    assert.ok(hasBrowser, 'The strict test gate requires an existing Playwright installation.');
  }
});

const page = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Notes</title><style>body{margin:1rem;font:16px system-ui}main{max-width:40rem}textarea{box-sizing:border-box;max-width:100%}button:focus-visible,textarea:focus-visible{outline:3px solid #174c8f}</style><main><h1>Notes</h1><label for="notes">Notes</label><textarea id="notes"></textarea><button type="button" id="save">Save notes</button><p role="status"></p><p role="alert" hidden></p></main><script>document.querySelector('#save').addEventListener('click',async()=>{const button=document.querySelector('#save');button.disabled=true;try{const response=await fetch('/api/notes',{method:'POST'});if(!response.ok)throw new Error('save failed');document.querySelector('[role=status]').textContent='Saved';}catch{const error=document.querySelector('[role=alert]');error.hidden=false;error.textContent='Could not save notes';}finally{button.disabled=false;}});</script></html>`;
const keyboardPlan = {
  viewports: [{ width: 390, height: 844 }, { width: 1440, height: 900 }],
  responses: [{ path: '/api/notes', status: 201, body: { saved: true } }],
  steps: [{ action: 'press', key: 'Tab' }, { action: 'expectFocused', label: 'Notes' }, { action: 'fill', label: 'Notes', value: 'Call the client' }, { action: 'press', key: 'Tab' }, { action: 'expectFocused', role: 'button', name: 'Save notes' }, { action: 'press', key: 'Enter' }, { action: 'expectText', role: 'status', value: 'Saved' }],
};

test('unrelated parsing never suppresses an unsafe request read in another handler', async () => {
  await fixture({ 'api/route.ts': `const unrelated = schema.parse(value);\nexport async function POST(request) { const body = await request.json(); return save(body); }\nexport async function PUT(request) { return save(schema.parse(await request.json())); }` }, async dir => {
    const report = await runVerify(dir);
    assert.equal(report.findings.filter(finding => finding.rule.id === 'SEC-009').length, 1);
    assert.equal(report.findings.find(finding => finding.rule.id === 'SEC-009').line, 2);
  });
});

test('AST checks distinguish regex/template text from real catches and typed bypasses', { skip: !hasParser && 'Install a supported TypeScript package in the test tooling workspace.' }, async () => {
  await fixture({ 'component.tsx': 'const example = /catch\\s*\\{\\}/;\nconst text = `: any catch {}`;\nconst value = input as any;\nconst view = <button onClick={() => {}}>Save</button>;\ntry { work(); } catch (error) {}' }, async dir => {
    const report = await runVerify(dir, { toolingRoot });
    assert.match(report.engine.parser, /^typescript /);
    assert.equal(report.findings.filter(finding => finding.rule.id === 'FLOW-007').length, 1);
    assert.equal(report.findings.filter(finding => finding.rule.id === 'CODE-014').length, 1);
    assert.equal(report.findings.filter(finding => finding.rule.id === 'FLOW-008').length, 1);
    assert.equal(report.findings.some(finding => finding.rule.id === 'CODE-017'), false);
  });
});

test('AST parser diagnostics fail malformed candidate code', { skip: !hasParser && 'TypeScript unavailable.' }, async () => {
  await fixture({ 'broken.ts': 'const value: = ;' }, async dir => assert.ok((await runVerify(dir, { toolingRoot })).findings.some(finding => finding.rule.id === 'CODE-017')));
});

test('quality discovery executes nothing and missing checks remain unverified', async () => {
  await fixture({}, async dir => {
    const report = await runQuality(dir, { run: true });
    assert.equal(report.status, 'incomplete');
    assert.ok(report.checks.every(check => check.status === 'not-run'));
  });
  await fixture({ 'package.json': JSON.stringify({ scripts: { lint: 'node -e "require(\'fs\').writeFileSync(\'unexpected\',\'ran\')"' } }) }, async dir => {
    const report = await runQuality(dir);
    assert.equal(report.status, 'incomplete');
    assert.ok(report.checks.every(check => check.status === 'not-run'));
    assert.equal(existsSync(join(dir, 'unexpected')), false);
  });
});

test('quality executes existing checks and retains nonzero exits without leaking output', async () => {
  const scripts = Object.fromEntries(['format:check', 'lint', 'typecheck', 'test'].map(name => [name, `node -e "console.log('private-test-value');process.exit(${name === 'test' ? 3 : 0})"`]));
  await fixture({ 'package.json': JSON.stringify({ scripts }) }, async dir => {
    const report = await runQuality(dir, { run: true });
    assert.equal(report.status, 'failed');
    assert.equal(report.checks.find(check => check.id === 'tests').exitCode, 3);
    assert.equal(report.checks.filter(check => check.status === 'passed').length, 3);
    assert.doesNotMatch(JSON.stringify(report), /private-test-value/);
  });
});

test('quality fails when a passing project script changes checked source and a stable rerun recovers', async () => {
  const command = 'node check.mjs';
  await fixture({
    'value.mjs': 'export const value = 1;\n',
    'check.mjs': `import assert from 'node:assert/strict'; import {value} from './value.mjs'; assert.equal(value, 1);`,
    'mutate.mjs': `await import('./check.mjs'); const {writeFileSync} = await import('node:fs'); writeFileSync('value.mjs', 'export const value = 0;');`,
    'package.json': JSON.stringify({ scripts: { 'format:check': command, lint: command, typecheck: command, test: 'node mutate.mjs' } }),
  }, async dir => {
    const originalDigest = await fingerprint(dir);
    const report = await runQuality(dir, { run: true });
    assert.ok(report.checks.filter(check => check.script).every(check => check.exitCode === 0));
    assert.equal(report.sourceDigest, originalDigest);
    assert.notEqual(await fingerprint(dir), originalDigest);
    assert.equal(report.checks.find(check => check.id === 'stable-source').status, 'failed');
    assert.equal(report.status, 'failed');
    await writeReport(dir, '.devmind/quality.json', report);
    await assert.rejects(reviewProject(dir, { quality: '.devmind/quality.json', scope: 'code' }), /Stale/);
    await writeFile(join(dir, 'value.mjs'), 'export const value = 1;\n');
    await writeFile(join(dir, 'mutate.mjs'), `await import('./check.mjs');`);
    const stable = await runQuality(dir, { run: true });
    assert.equal(stable.status, 'passed');
    assert.equal(stable.sourceDigest, await fingerprint(dir));
    await writeReport(dir, '.devmind/quality.json', stable);
    assert.equal((await reviewProject(dir, { quality: '.devmind/quality.json', scope: 'code' })).status, 'passed');
  });
});

test('quality allows generated vault files while detecting configuration changes', async () => {
  const command = `node -e "require('node:fs').mkdirSync('.devmind',{recursive:true});require('node:fs').writeFileSync('.devmind/run.txt','generated')"`;
  await fixture({
    'tsconfig.json': '{"compilerOptions":{"strict":true}}',
    'package.json': JSON.stringify({ scripts: Object.fromEntries(['format:check', 'lint', 'typecheck', 'test'].map(name => [name, command])) }),
  }, async dir => {
    assert.equal((await runQuality(dir, { run: true })).status, 'passed');
    await writeFile(join(dir, 'package.json'), JSON.stringify({ scripts: { test: `node -e "require('node:fs').writeFileSync('tsconfig.json','{}')"` } }));
    const changed = await runQuality(dir, { run: true });
    assert.equal(changed.status, 'failed');
    assert.equal(changed.checks.find(check => check.id === 'stable-source').status, 'failed');
  });
});

test('browser plans reject remote URLs, unknown steps, and malformed assertions', () => {
  for (const url of ['https://example.com', 'file:///tmp/index.html', 'http://user:password@localhost:3000']) assert.throws(() => localUrl(url));
  assert.equal(localUrl('http://127.0.0.1:3000').hostname, '127.0.0.1');
  for (const plan of [{ typo: true }, { steps: [{ action: 'evaluate', selector: 'body' }] }, { steps: [{ action: 'expectCount', selector: 'tr', count: -1 }] }, { allowMutations: 'true' }, { viewports: [] }]) assert.throws(() => validatePlan(plan));
});

test('browser tooling absence produces not-run evidence without silently passing', async () => {
  await fixture({ 'index.html': page }, async dir => {
    const report = await auditBrowser(dir, 'http://127.0.0.1:1', { plan: keyboardPlan });
    assert.equal(report.status, 'incomplete');
    assert.equal(report.checks[0].status, 'not-run');
  });
});

test('real browser executes keyboard save at mobile/desktop and writes valid screenshots', { skip: !hasBrowser && 'Playwright unavailable.' }, async () => {
  await fixture({ 'index.html': page }, async dir => serveProject(dir, async url => {
    const report = await auditBrowser(dir, url, { ...browserOptions, plan: keyboardPlan });
    assert.equal(report.status, 'passed', JSON.stringify(report.checks.filter(check => check.status !== 'passed')));
    assert.equal(report.artifacts.length, 4);
    for (const artifact of report.artifacts) assert.equal((await readFile(join(dir, artifact.file))).subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  }));
});

test('real browser verifies a handled provider failure and preserved form value', { skip: !hasBrowser && 'Playwright unavailable.' }, async () => {
  await fixture({ 'index.html': page }, async dir => serveProject(dir, async url => {
    const plan = { viewports: [{ width: 390, height: 844 }], responses: [{ path: '/api/notes', status: 503, body: {} }], steps: [{ action: 'fill', label: 'Notes', value: 'Keep these notes' }, { action: 'click', role: 'button', name: 'Save notes' }, { action: 'expectText', role: 'alert', value: 'Could not save notes' }, { action: 'expectValue', label: 'Notes', value: 'Keep these notes' }] };
    const report = await auditBrowser(dir, url, { ...browserOptions, plan });
    assert.equal(report.status, 'passed', JSON.stringify(report.checks.filter(check => check.status !== 'passed')));
  }));
});

test('browser blocks unspecified writes and off-origin HTTP requests', { skip: !hasBrowser && 'Playwright unavailable.' }, async () => {
  await fixture({ 'index.html': page.replace('</main>', '<img alt="Test image" src="http://127.0.0.1:1/private"></main>') }, async dir => serveProject(dir, async url => {
    const report = await auditBrowser(dir, url, { ...browserOptions, plan: { viewports: [{ width: 390, height: 844 }], steps: [{ action: 'click', role: 'button', name: 'Save notes' }, { action: 'expectText', role: 'alert', value: 'Could not save notes' }] } });
    assert.equal(report.status, 'failed');
    assert.ok(report.checks.some(check => check.id.endsWith('blockedRequests') && check.count >= 2));
  }));
});

test('real browser catches overflow, unnamed controls, missing alt, and a false outcome', { skip: !hasBrowser && 'Playwright unavailable.' }, async () => {
  await fixture({ 'index.html': '<!doctype html><meta name="viewport" content="width=device-width"><div style="width:2400px">Wide</div><button></button><img src="missing.png"><p role="status">Not Saved</p>' }, async dir => serveProject(dir, async url => {
    const report = await auditBrowser(dir, url, { ...browserOptions, plan: { viewports: [{ width: 390, height: 844 }], steps: [{ action: 'expectText', role: 'status', value: 'Saved' }] } });
    assert.equal(report.status, 'failed');
    for (const name of ['overflow', 'unnamedControls', 'missingAlt']) assert.ok(report.checks.some(check => check.id.endsWith(name) && check.status === 'failed'));
    assert.ok(report.checks.some(check => check.action === 'expectText' && check.status === 'failed'));
  }));
});

test('review requires evidence, rejects stale reports, and accepts observed criteria with current artifacts', async () => {
  await fixture({ 'index.html': '<main><h1>Notes</h1></main>' }, async dir => {
    assert.equal((await reviewProject(dir)).status, 'incomplete');
    const digest = await fingerprint(dir);
    await mkdir(join(dir, '.devmind'), { recursive: true });
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j0ioAAAAASUVORK5CYII=', 'base64');
    await writeFile(join(dir, '.devmind', 'capture.png'), png);
    for (const kind of ['quality', 'browser']) {
      await writeReport(dir, `.devmind/${kind}.json`, { version: 1, kind, root: dir, sourceDigest: digest, status: 'passed', checks: [{ id: 'fixture-check', status: 'passed' }], artifacts: [{ type: 'screenshot', file: '.devmind/capture.png', sha256: createHash('sha256').update(png).digest('hex') }] });
    }
    const assessment = { version: 1, sourceDigest: digest, reviewer: 'Test reviewer', criteria: VISUAL_CRITERIA.map(id => ({ id, status: 'passed', notes: `Observed ${id} in the fixture.`, evidence: ['.devmind/capture.png'] })) };
    await writeReport(dir, '.devmind/assessment.json', assessment);
    const options = { quality: '.devmind/quality.json', browser: '.devmind/browser.json', assessment: '.devmind/assessment.json' };
    assert.equal((await reviewProject(dir, options)).status, 'passed');
    await writeFile(join(dir, '.devmind/capture.png'), 'changed');
    await assert.rejects(reviewProject(dir, options), /changed screenshot/);
    await writeFile(join(dir, '.devmind/capture.png'), png);
    assessment.criteria[0].evidence = [];
    await writeReport(dir, '.devmind/assessment.json', assessment);
    await assert.rejects(reviewProject(dir, options), /notes and evidence/);
    await writeFile(join(dir, 'index.html'), '<main><h1>Changed</h1></main>');
    await assert.rejects(reviewProject(dir, options), /Stale/);
  });
});

test('review rejects old passing checks after a SQL change makes current checks fail', async () => {
  const command = 'node check-schema.mjs';
  await fixture({
    'schema.sql': 'CREATE TABLE accounts (id INTEGER PRIMARY KEY);\n',
    'check-schema.mjs': `import assert from 'node:assert/strict'; import {readFileSync} from 'node:fs'; assert.match(readFileSync('schema.sql','utf8'), /PRIMARY KEY/);`,
    'package.json': JSON.stringify({ scripts: { 'format:check': command, lint: command, typecheck: command, test: command } }),
  }, async dir => {
    const passing = await runQuality(dir, { run: true });
    assert.equal(passing.status, 'passed');
    await writeReport(dir, '.devmind/quality.json', passing);
    assert.equal((await reviewProject(dir, { quality: '.devmind/quality.json', scope: 'code' })).status, 'passed');
    await writeFile(join(dir, 'schema.sql'), 'CREATE TABLE accounts (id INTEGER);\n');
    assert.equal((await runQuality(dir, { run: true })).status, 'failed');
    await assert.rejects(reviewProject(dir, { quality: '.devmind/quality.json', scope: 'code' }), /Stale/);
  });
});

test('evidence fingerprints bind configuration, non-JS code, assets, additions, deletions, and names', async () => {
  const versions = {
    'tsconfig.json': ['{"compilerOptions":{"strict":true}}', '{"compilerOptions":{"strict":false}}'],
    'app.py': ['value = 1', 'value = 2'],
    'app.go': ['package app\nconst Value = 1', 'package app\nconst Value = 2'],
    'app.rs': ['const VALUE: i32 = 1;', 'const VALUE: i32 = 2;'],
    'deploy.yaml': ['replicas: 1', 'replicas: 2'],
    'settings.toml': ['name = "first"', 'name = "second"'],
    'assets/logo.svg': ['<svg/>', '<svg><title>Changed</title></svg>'],
    'assets/payload.bin': [Buffer.from([0, 1, 2]), Buffer.from([0, 1, 3])],
  };
  await fixture(Object.fromEntries(Object.entries(versions).map(([path, pair]) => [path, pair[0]])), async dir => {
    const digest = await fingerprint(dir);
    await writeReport(dir, '.devmind/quality.json', { version: 1, kind: 'quality', root: dir, sourceDigest: digest, status: 'passed', checks: [{ id: 'fixture', status: 'passed' }] });
    assert.equal(await fingerprint(dir), digest, 'Generated evidence must not invalidate itself.');
    for (const [path, [before, after]] of Object.entries(versions)) {
      await writeFile(join(dir, path), after);
      assert.notEqual(await fingerprint(dir), digest, path);
      await assert.rejects(reviewProject(dir, { quality: '.devmind/quality.json', scope: 'code' }), /Stale/, path);
      await writeFile(join(dir, path), before);
      assert.equal(await fingerprint(dir), digest, path);
    }
    await writeFile(join(dir, 'new.sql'), 'SELECT 1;');
    assert.notEqual(await fingerprint(dir), digest);
    await unlink(join(dir, 'new.sql'));
    assert.equal(await fingerprint(dir), digest);
    await rename(join(dir, 'app.py'), join(dir, 'renamed.py'));
    assert.notEqual(await fingerprint(dir), digest);
    await rename(join(dir, 'renamed.py'), join(dir, 'app.py'));
    assert.equal(await fingerprint(dir), digest);
  });
});

test('evidence output locations are rejected before running project checks or candidate code', async () => {
  await fixture({
    'package.json': JSON.stringify({ scripts: { test: `node -e "require('node:fs').writeFileSync('ran.txt','ran')"` } }),
    'operation.mjs': `import {writeFileSync} from 'node:fs'; writeFileSync('ran.txt', 'ran'); process.exit(0);`,
  }, async dir => {
    await assert.rejects(writeReport(dir, 'quality.json', {}), /under \.devmind/);
    await assert.rejects(auditBrowser(dir, 'http://127.0.0.1:12345', { output: 'captures' }), /under \.devmind/);
    for (const args of [
      ['scripts/quality.mjs', dir, '--run', '--out', 'quality.json'],
      ['scripts/eval.mjs', dir, '--case', 'tenant-authorization', '--out', 'evaluation.json'],
    ]) {
      const result = spawnSync(process.execPath, [join(root, args[0]), ...args.slice(1)], { cwd: dir, encoding: 'utf8', shell: false });
      assert.equal(result.status, 2, result.stderr);
      assert.match(result.stderr, /under \.devmind/);
    }
    assert.equal(existsSync(join(dir, 'ran.txt')), false);
    assert.equal(existsSync(join(dir, 'quality.json')), false);
    assert.equal(existsSync(join(dir, 'captures')), false);
  });
});

test('artifact writes cannot traverse a symlink outside the project', async t => {
  await fixture({ 'project/index.js': 'export {};', 'outside/keep.txt': 'unchanged' }, async dir => {
    try { await symlink(join(dir, 'outside'), join(dir, 'project', 'linked'), process.platform === 'win32' ? 'junction' : 'dir'); }
    catch (error) { if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) { t.skip('Symlinks unavailable.'); return; } throw error; }
    await assert.rejects(writeReport(join(dir, 'project'), 'linked/report.json', {}), /symbolic links/);
    await assert.rejects(artifactPath(join(dir, 'project'), '../outside/keep.txt'), /inside/);
    assert.equal(await readFile(join(dir, 'outside', 'keep.txt'), 'utf8'), 'unchanged');
  });
});

test('frontend and server cases prepare isolated seeds without overwriting work', async () => {
  const cases = await loadCases();
  assert.equal(cases.length, 8);
  await fixture({}, async dir => {
    for (const entry of cases) {
      const prepared = await prepareCase(entry.id, entry.id, dir);
      assert.equal(await readFile(join(prepared.root, 'TASK.md'), 'utf8'), entry.prompt + '\n');
      assert.ok(entry.runner === 'node' ? entry.assertions.includes('assert.') : entry.scenarios.every(scenario => validatePlan(scenario.plan).steps.some(step => step.action.startsWith('expect'))));
      await assert.rejects(prepareCase(entry.id, entry.id, dir), /must be empty/);
    }
    await assert.rejects(prepareCase('accessibility-fix', '../outside', dir), /inside/);
  });
});

test('evaluation runner distinguishes a broken seed from a working keyboard candidate', { skip: !hasBrowser && 'Playwright unavailable.' }, async () => {
  await fixture({}, async dir => {
    const candidate = (await prepareCase('accessibility-fix', 'candidate', dir)).root;
    await serveProject(candidate, async url => {
      const baseline = await evaluateCase('accessibility-fix', candidate, url, browserOptions);
      assert.equal(baseline.status, 'failed');
      await writeFile(join(candidate, 'index.html'), page.replace("await fetch('/api/notes',{method:'POST'})", "await Promise.resolve({ok:true})"));
      const revised = await evaluateCase('accessibility-fix', candidate, url, browserOptions);
      assert.equal(revised.status, 'incomplete');
      assert.equal(revised.behaviorStatus, 'passed');
      assert.ok(revised.scenarios.every(scenario => scenario.report.status === 'passed'));
      const comparison = compareEvaluations(baseline, revised);
      assert.ok(comparison.candidate.failed < comparison.baseline.failed);
      assert.equal(comparison.candidate.unverified, 1);
      assert.throws(() => compareEvaluations(baseline, { ...revised, caseId: 'another-case' }));
      assert.throws(() => compareEvaluations(baseline, { ...revised, caseDigest: 'changed-task' }));
    });
  });
});

test('built frontend and adapter references resolve and bundled eval data is executable', async t => {
  if (!existsSync(join(root, 'dist'))) { t.skip('Build distributions first.'); return; }
  for (const path of ['dist/antigravity/skills/fe-standards/SKILL.md', 'dist/antigravity/skills/devmind/references/fe-standards.md', 'dist/cursor/.cursor/rules/fe-standards.mdc', 'dist/claude-code/.claude/skills/fe-standards/SKILL.md', 'dist/windsurf/.devmind/skills/fe-standards.md', 'dist/github-copilot/.github/instructions/fe-standards.instructions.md', 'dist/cline/.devmind/skills/fe-standards.md']) {
    const source = await readFile(join(root, path), 'utf8');
    const links = [...source.matchAll(/\]\((\.[^)]*fe-(?:design-examples|verification)\.md)\)/g)];
    assert.equal(links.length, 2, path);
    for (const link of links) assert.ok(existsSync(resolve(root, dirname(path), link[1])), `${path}: ${link[1]}`);
  }
  const result = spawnSync(process.execPath, [join(root, 'dist/antigravity/skills/fe-standards/scripts/eval.mjs'), '--list'], { cwd: dirname(root), encoding: 'utf8', shell: false });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).length, 8);
});
