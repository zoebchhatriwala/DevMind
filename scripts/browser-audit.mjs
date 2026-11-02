#!/usr/bin/env node
import { mkdir, realpath, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, relative, resolve } from 'node:path';
import { isMain } from './lib/project.mjs';
import { artifactPath, assertKeys, evidencePath, fingerprint, optionalPackage, parseOptions, readJson, reportExit, reportStatus, writeReport } from './lib/runtime.mjs';

const ACTIONS = new Set(['click', 'fill', 'press', 'select', 'check', 'expectVisible', 'expectHidden', 'expectText', 'expectValue', 'expectCount', 'expectFocused']);
export function validatePlan(plan = {}) {
  assertKeys(plan, ['version', 'viewports', 'steps', 'allowMutations', 'responses'], 'Browser plan');
  if (plan.version !== undefined && plan.version !== 1) throw new Error('Unsupported browser plan version.');
  if (plan.allowMutations !== undefined && typeof plan.allowMutations !== 'boolean') throw new Error('allowMutations must be boolean.');
  const viewports = plan.viewports ?? [{ width: 390, height: 844 }, { width: 1440, height: 900 }];
  if (!Array.isArray(viewports) || !viewports.length || viewports.length > 8) throw new Error('Expected 1 to 8 viewports.');
  for (const viewport of viewports) {
    assertKeys(viewport, ['width', 'height'], 'Viewport');
    if (!Number.isInteger(viewport.width) || viewport.width < 256 || viewport.width > 4096 || !Number.isInteger(viewport.height) || viewport.height < 240 || viewport.height > 2160) throw new Error('Invalid viewport dimensions.');
  }
  const steps = plan.steps ?? [];
  if (!Array.isArray(steps) || steps.length > 80) throw new Error('Expected at most 80 browser steps.');
  for (const step of steps) {
    assertKeys(step, ['action', 'selector', 'role', 'name', 'label', 'value', 'key', 'count'], 'Browser step');
    if (!ACTIONS.has(step.action)) throw new Error('Unsupported browser action.');
    const locators = ['selector', 'role', 'label'].filter(key => step[key] !== undefined);
    if (locators.length !== 1 && !(step.action === 'press' && locators.length === 0)) throw new Error('Each step needs exactly one locator (selector, role/name, or label).');
    for (const field of ['selector', 'role', 'name', 'label', 'value', 'key']) {
      if (step[field] !== undefined && (typeof step[field] !== 'string' || step[field].length > 4000)) throw new Error(`Invalid browser step ${field}.`);
    }
    if (['fill', 'select', 'expectText', 'expectValue'].includes(step.action) && typeof step.value !== 'string') throw new Error('This action requires a string value.');
    if (step.action === 'press' && !step.key) throw new Error('press requires a key.');
    if (step.action === 'expectCount' && (!Number.isInteger(step.count) || step.count < 0)) throw new Error('expectCount requires a non-negative count.');
  }
  const responses = plan.responses ?? [];
  if (!Array.isArray(responses) || responses.length > 20) throw new Error('Expected at most 20 mock responses.');
  for (const response of responses) {
    assertKeys(response, ['path', 'status', 'body'], 'Mock response');
    if (typeof response.path !== 'string' || !response.path.startsWith('/') || !Number.isInteger(response.status) || response.status < 200 || response.status > 599) throw new Error('Invalid mock response.');
  }
  return { version: 1, viewports, steps, responses, allowMutations: plan.allowMutations ?? false };
}

export function localUrl(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.username || url.password) {
    throw new Error('Use an HTTP(S) loopback URL without credentials. Audit isolated local test environments.');
  }
  return url;
}

async function runStep(page, step) {
  const target = step.selector ? page.locator(step.selector) : step.role ? page.getByRole(step.role, { name: step.name, exact: true }) : step.label ? page.getByLabel(step.label, { exact: true }) : null;
  switch (step.action) {
    case 'click': await target.click(); break;
    case 'fill': await target.fill(step.value); break;
    case 'press': await (target ?? page.keyboard).press(step.key); break;
    case 'select': await target.selectOption(step.value); break;
    case 'check': await target.check(); break;
    case 'expectVisible': await target.waitFor({ state: 'visible' }); break;
    case 'expectHidden': await target.waitFor({ state: 'hidden' }); break;
    case 'expectText': {
      const expected = step.value.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
      await target.filter({ hasText: new RegExp(`^\\s*${expected}\\s*$`) }).waitFor({ state: 'visible' }); break;
    }
    case 'expectValue':
      if (await target.inputValue() !== step.value) throw new Error('Value assertion failed.'); break;
    case 'expectCount':
      if (await target.count() !== step.count) throw new Error('Count assertion failed.'); break;
    case 'expectFocused':
      if (!await target.evaluate(element => element === document.activeElement)) throw new Error('Focus assertion failed.'); break;
    default: throw new Error('Unsupported action.');
  }
}

function inspectDom() {
  const visible = element => {
    const style = getComputedStyle(element);
    return element.getClientRects().length > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  };
  const name = element => Boolean(element.getAttribute('aria-label')?.trim() || element.getAttribute('title')?.trim() || element.labels?.length || element.textContent?.trim() || element.getAttribute('alt')?.trim() || (['submit', 'button', 'reset'].includes(element.type) && element.value));
  const controls = [...document.querySelectorAll('button, input:not([type=hidden]), select, textarea, a[href]')].filter(visible);
  return {
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    unnamedControls: controls.filter(element => !name(element) && !element.getAttribute('aria-labelledby')?.split(/\s+/).some(id => document.getElementById(id)?.textContent?.trim())).length,
    missingAlt: [...document.querySelectorAll('img')].filter(element => visible(element) && !element.hasAttribute('alt')).length,
    brokenImages: [...document.querySelectorAll('img')].filter(element => visible(element) && element.complete && element.naturalWidth === 0).length,
    placeholderLinks: [...document.querySelectorAll('a[href]')].filter(element => visible(element) && ['#', 'javascript:void(0)'].includes(element.getAttribute('href'))).length,
  };
}

export async function auditBrowser(targetDir, value, options = {}) {
  const root = await realpath(resolve(targetDir));
  const url = localUrl(value);
  const plan = validatePlan(options.plan);
  const output = options.output ?? '.devmind/browser';
  const directory = await evidencePath(root, output);
  const sourceDigest = await fingerprint(root);
  const checks = [];
  const artifacts = [];
  const installed = optionalPackage(options.toolingRoot ?? root, ['playwright', '@playwright/test', 'playwright-core']);
  const result = { version: 1, kind: 'browser', root, createdAt: new Date().toISOString(), sourceDigest, url: url.origin + url.pathname, checks, artifacts, status: 'incomplete', limitations: ['DOM checks are limited hints, not a full accessibility audit.', 'Screenshots require human review for hierarchy, composition, content, and brand fit.', 'New isolated browser contexts do not reuse personal browser sessions. Screenshot masking covers password fields and [data-private] only.'] };
  if (!installed?.module.chromium) {
    checks.push({ id: 'browser', status: 'not-run', reason: 'No installed Playwright package. Reuse project tooling or supply --tooling; no package is installed automatically.' });
    return result;
  }
  await mkdir(directory, { recursive: true });
  let browser;
  try {
    browser = await installed.module.chromium.launch({ headless: true, ...(options.channel ? { channel: options.channel } : {}) });
  } catch {
    checks.push({ id: 'browser', status: 'not-run', reason: 'Browser could not launch. Check the installed browser or specify --channel chrome/msedge.' });
    return result;
  }
  result.engine = { package: installed.name, browserVersion: browser.version(), channel: options.channel ?? 'bundled' };
  try {
    for (let index = 0; index < plan.viewports.length; index++) {
      const viewport = plan.viewports[index];
      const prefix = `${index + 1}-${viewport.width}x${viewport.height}`;
      const context = await browser.newContext({ viewport, serviceWorkers: 'block', reducedMotion: 'reduce' });
      const page = await context.newPage();
      page.setDefaultTimeout(5000);
      const counts = { consoleErrors: 0, pageErrors: 0, failedResponses: 0, blockedRequests: 0 };
      page.on('console', message => {
        if (message.type() !== 'error') return;
        const location = message.location().url;
        let expected = false;
        try {
          const source = new URL(location);
          expected = plan.responses.some(mock => mock.status >= 400 && source.origin === url.origin && source.pathname === mock.path);
        } catch {
          expected = false;
        }
        if (!(expected && message.text().startsWith('Failed to load resource:'))) counts.consoleErrors++;
      });
      page.on('pageerror', () => { counts.pageErrors++; });
      page.on('response', response => {
        if (response.status() >= 400 && !plan.responses.some(mock => mock.status === response.status() && new URL(response.url()).pathname === mock.path)) counts.failedResponses++;
      });
      await context.route('**/*', route => {
        const request = route.request();
        const target = new URL(request.url());
        if (target.origin !== url.origin) { counts.blockedRequests++; return route.abort(); }
        const mock = plan.responses.find(response => response.path === target.pathname);
        if (mock) return route.fulfill({ status: mock.status, contentType: 'application/json', body: JSON.stringify(mock.body ?? {}) });
        if (!plan.allowMutations && !['GET', 'HEAD'].includes(request.method())) { counts.blockedRequests++; return route.abort(); }
        return route.continue();
      });
      try {
        const response = await page.goto(url.href, { waitUntil: 'load', timeout: 15000 });
        checks.push({ id: `${prefix}:navigation`, status: response?.ok() ? 'passed' : 'failed', evidence: 'HTTP navigation completed; query/fragment and response content omitted.' });
        for (const phase of ['initial', 'final']) {
          if (phase === 'final') {
            for (let stepIndex = 0; stepIndex < plan.steps.length; stepIndex++) {
              try {
                await runStep(page, plan.steps[stepIndex]);
                checks.push({ id: `${prefix}:step-${stepIndex + 1}`, status: 'passed', action: plan.steps[stepIndex].action });
              } catch {
                checks.push({ id: `${prefix}:step-${stepIndex + 1}`, status: 'failed', action: plan.steps[stepIndex].action, reason: 'Browser action/assertion failed. Inputs and page content omitted.' });
                break;
              }
            }
          }
          const dom = await page.evaluate(inspectDom);
          for (const [name, count] of Object.entries(dom)) checks.push({ id: `${prefix}:${phase}:${name}`, status: count ? 'failed' : 'passed', count });
          const file = await artifactPath(root, join(output, `${prefix}-${phase}.png`));
          await page.screenshot({ path: file, fullPage: true, animations: 'disabled', mask: [page.locator('input[type=password], [data-private]')] });
          artifacts.push({ type: 'screenshot', file: relative(root, file).replaceAll('\\', '/'), sha256: createHash('sha256').update(await readFile(file)).digest('hex'), viewport, phase });
        }
        for (const [name, count] of Object.entries(counts)) checks.push({ id: `${prefix}:${name}`, status: count ? 'failed' : 'passed', count });
      } catch {
        checks.push({ id: `${prefix}:execution`, status: 'failed', reason: 'Navigation or capture did not complete. Inspect the local test environment.' });
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
  const expected = plan.steps.filter(step => step.action.startsWith('expect')).length * plan.viewports.length;
  const completed = checks.filter(check => check.action?.startsWith('expect') && check.status === 'passed').length;
  checks.push({ id: 'journey-assertions', status: expected > 0 && expected === completed ? 'passed' : 'not-run', reason: 'Every explicit expectation must execute successfully at each viewport.' });
  result.status = reportStatus(checks);
  if (await fingerprint(root) !== sourceDigest) {
    checks.push({ id: 'stable-source', status: 'not-run', reason: 'Project source changed during browser audit. Rerun against the final source.' });
    result.status = reportStatus(checks);
  }
  return result;
}

export async function main(args = process.argv.slice(2)) {
  const { values, flags, positional } = parseOptions(args, ['--plan', '--out', '--channel', '--tooling']);
  if (flags.has('--help')) { console.log('Usage: browser-audit.mjs <project> <loopback-url> [--plan file.json] [--out .devmind/browser] [--channel chrome|msedge] [--tooling directory] [--json]'); return; }
  if (positional.length !== 2) throw new Error('Expected project directory and loopback URL.');
  if (values['--channel'] && !['chrome', 'msedge'].includes(values['--channel'])) throw new Error('Supported channels: chrome, msedge.');
  const result = await auditBrowser(...positional, { plan: values['--plan'] ? await readJson(resolve(positional[0], values['--plan'])) : {}, output: values['--out'], channel: values['--channel'], toolingRoot: values['--tooling'] });
  const file = await writeReport(result.root, join(values['--out'] ?? '.devmind/browser', 'report.json'), result);
  console.log(flags.has('--json') ? JSON.stringify(result, null, 2) : `${result.status}: ${file}`);
  process.exitCode = reportExit(result.status);
}
if (isMain(import.meta.url)) main().catch(error => { console.error(`Browser audit: ${error.message}`); process.exitCode = 2; });
