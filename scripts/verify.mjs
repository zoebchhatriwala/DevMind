#!/usr/bin/env node
import { isMain, readSource, scanProject, SOURCE_EXTENSIONS } from './lib/project.mjs';
import { analyzeSource, loadParser } from './lib/semantic.mjs';
import { parseOptions } from './lib/runtime.mjs';

const definitions = [
  ['SEC-001', 'Possible browser secret exposure', 'Security', 'error'],
  ['SEC-004', 'Interpolated raw SQL', 'Security', 'error'],
  ['SEC-005', 'Webhook signature review', 'Security', 'warning'],
  ['FLOW-007', 'Swallowed error', 'Reliability', 'error'],
  ['FLOW-008', 'Placeholder interaction', 'Quality', 'warning'],
  ['SEC-009', 'Request validation review', 'Security', 'warning'],
  ['FE-011', 'Generic or placeholder product copy', 'Design', 'warning'],
  ['FE-012', 'Image without alternative text', 'Accessibility', 'warning'],
  ['FE-013', 'Non-semantic clickable element', 'Accessibility', 'warning'],
  ['CODE-014', 'Type safety bypass', 'Quality', 'error'],
  ['CODE-015', 'Compliance theater comment', 'Quality', 'warning'],
  ['FE-016', 'Focus indicator removed', 'Accessibility', 'warning'],
  ['CODE-017', 'Parser syntax error', 'Quality', 'error'],
];
export const RULES = Object.fromEntries(definitions.map(([id, name, category, severity]) => [id, { id, name, category, severity }]));

// Preserve offsets for evidence while removing comments. Strings remain for markup checks.
function withoutComments(source) {
  let result = '';
  let quote = null;
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    const next = source[index + 1];
    if (quote) {
      result += char;
      if (char === '\\') { result += next ?? ''; index++; }
      else if (char === quote) quote = null;
    } else if ('"\'`'.includes(char)) {
      quote = char;
      result += char;
    } else if (char === '/' && next === '/') {
      while (index < source.length && source[index] !== '\n') { result += ' '; index++; }
      if (index < source.length) result += '\n';
    } else if (char === '/' && next === '*') {
      result += '  ';
      index += 2;
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) {
        result += source[index] === '\n' ? '\n' : ' ';
        index++;
      }
      if (index < source.length) { result += '  '; index++; }
    } else {
      result += char;
    }
  }
  return result;
}

export async function runVerify(targetDir = '.', options = {}) {
  const project = await scanProject(targetDir);
  const files = project.files.filter(file => SOURCE_EXTENSIONS.has(file.ext) && !/(?:^|\/)(?:__tests__|fixtures)\/|\.(?:test|spec)\.[^.]+$|\.d\.ts$/.test(file.relPath));
  const findings = [];
  const parser = loadParser(project.root, options.toolingRoot);
  const astRules = new Set(['FLOW-007', 'FLOW-008', 'CODE-014', 'FE-012', 'FE-013']);
  for (const file of files) {
    const source = await readSource(file);
    const content = withoutComments(source);
    const code = content.replace(/"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|`(?:\\[\s\S]|[^`\\])*`/g, match => match.replace(/[^\n]/g, ' '));
    const comments = source.split('').map((char, index) => content[index] === ' ' ? char : char === '\n' ? '\n' : ' ').join('');
    const css = ['.css', '.scss'].includes(file.ext);
    const markup = /\.(?:jsx|tsx|vue|svelte|html)$/.test(file.relPath);
    const client = /^\s*['"]use client['"]/.test(content) || /\.(?:jsx|vue|svelte|html)$/.test(file.relPath) || /(?:^|\/)(?:client|browser)\//.test(file.relPath);
    const server = /(?:^|\/)(?:api|routes|controllers)\/|(?:^|\/)(?:route|actions?)\.[cm]?[jt]s$|\.server\./.test(file.relPath) || /^\s*['"]use server['"]/.test(content);
    const useAst = parser && /\.[cm]?[jt]sx?$/.test(file.relPath);
    function add(id, offset, message, fix) {
      findings.push({
        rule: RULES[id], file: file.relPath,
        line: source.slice(0, offset).split('\n').length,
        confidence: 'heuristic', message, fix,
        snippet: '[Source omitted to avoid copying credentials or private data into reports.]',
      });
    }
    function check(id, expression, message, fix, input = content) {
      if (useAst && astRules.has(id) && input !== comments) return;
      for (const match of input.matchAll(expression)) add(id, match.index, message, fix);
    }
    if (useAst) {
      for (const finding of analyzeSource(parser, file.relPath, source)) add(finding.id, finding.offset, finding.message, finding.fix);
    }
    if (!css) {
      if (client) check('SEC-001', /(?:process\.env\.|import\.meta\.env\.)(?=[A-Z\d_]*(?:SECRET|PRIVATE|SERVICE_ROLE|ADMIN_KEY|TOKEN|PASSWORD))[A-Z][A-Z\d_]*\b/g,
        'Possible private credential referenced in browser code, including publicly prefixed variables.', 'Inspect bundle reachability and move private credentials to the server. Publicly prefixed secrets are still secrets.');
      check('SEC-004', /\b(?:query|raw|\$queryRawUnsafe|\$executeRawUnsafe)\s*\(\s*`[^`]*\$\{[^`]*`/g,
        'Raw query interpolates a value.', 'Use bound parameters or a supported parameterizing tagged template.');
      check('FLOW-007', /\bcatch\s*(?:\([^)]*\))?\s*\{\s*\}/g,
        'An empty catch block discards the failure.', 'Recover explicitly, report a safe error, or propagate the failure.', code);
      check('FLOW-007', /\.catch\s*\(\s*(?:\([^)]*\)|\w+)\s*=>\s*\{\s*\}\s*\)/g,
        'A promise rejection handler discards the failure.', 'Handle the rejected operation and preserve a useful recovery path.', code);
      if (markup) {
        check('FLOW-008', /\bhref\s*=\s*["'](?:#|javascript:\s*void\(0\))["']/g,
          'Link has a placeholder destination.', 'Use a real destination or a button that performs the action.');
        check('FLOW-008', /\b(?:onClick|onSubmit|onclick|onsubmit)\s*=\s*\{\s*(?:async\s*)?\([^)]*\)\s*=>\s*(?:\{\s*\}|(?:void\s+0|undefined))\s*\}/g,
          'Interaction handler does no work.', 'Implement the user-visible outcome and its error path.');
        for (const match of content.matchAll(/<img\b[^>]*>/gi)) {
          if (!useAst && !/\balt\s*=/.test(match[0])) add('FE-012', match.index,
            'Image may be missing alternative text.', 'Add meaningful alt text, or alt="" when decorative. Verify spread props before changing code.');
        }
        check('FE-013', /<(?:div|span)\b[^>]*\b(?:onClick|onclick)\s*=/g,
          'Clickable non-semantic element needs keyboard and accessibility review.', 'Prefer button or anchor semantics; verify focus, accessible name, and keyboard behavior.');
        check('FE-011', /(?:>\s*|\b(?:title|placeholder|aria-label)\s*=\s*["'])(?:Lorem ipsum\b[^<"']*|(?:Unlock|Unleash) (?:your|the) (?:potential|power)[^<"']*|(?:Next-gen|Revolutionary|Seamless) (?:platform|experience|solution)[^<"']*)/gi,
          'Visible copy appears generic or unfinished.', 'Name the concrete user task, benefit, or recovery action. Preserve intentional quoted content.');
      }
      if (/\.[cm]?tsx?$/.test(file.relPath)) {
        check('CODE-014', /(?::|\bas|\bsatisfies)\s*any\b|\b(?:Array|Promise|Record|Map|Set)\s*<[^;\n>]*\bany\b/g,
          'Explicit any bypasses type checking.', 'Use a domain type, a generic constraint, or unknown with boundary validation.', code);
        check('CODE-014', /\/\/\s*@ts-ignore\b/g,
          'Type checking is suppressed.', 'Fix the type boundary; a justified @ts-expect-error must describe the external limitation.', comments);
      }
      check('CODE-015', /\/\/[^\n]*(?:DevMind\s+\d|(?:complying with|as per|enforcing)\s+(?:the\s+)?(?:prompt|rule\s+\d|standards?\s+compliance))/gi,
        'Comment narrates compliance instead of explaining code.', 'Delete the comment or explain a non-obvious constraint.', comments);
      if (server) {
        for (const match of code.matchAll(/\b(?:request|req)\.(?:json\s*\(|body\b)/g)) {
          const prefix = code.slice(Math.max(0, match.index - 150), match.index);
          const associated = /(?<!\bJSON)\.(?:safeParse|parse)\(\s*(?:await\s*)?$/.test(prefix);
          if (!associated) add('SEC-009', match.index, 'This request-body read needs a runtime validation review.', 'Trace this value into its schema and handler. Unrelated parse calls elsewhere do not establish validation.');
        }
      }
      if (server && /webhook/i.test(file.relPath) && /stripe|github|webhook/i.test(content) && !/constructEvent|verifySignature|timingSafeEqual/.test(content)) {
        add('SEC-005', 0, 'Webhook verification is not visible in this handler.', 'Trace the signature verifier and confirm it authenticates the raw payload before any mutation.');
      }
    }
    if (css) {
      check('FE-016', /\boutline\s*:\s*(?:none|0)\s*[;}]/g,
        'Focus outline removed; replacement needs visual review.', 'Verify an equally visible focus indicator, including keyboard and high contrast modes.');
    }
  }
  findings.sort((a, b) => a.file.localeCompare(b.file, 'en') || a.line - b.line || a.rule.id.localeCompare(b.rule.id));
  const counts = {
    errors: findings.filter(finding => finding.rule.severity === 'error').length,
    warnings: findings.filter(finding => finding.rule.severity === 'warning').length,
    info: 0,
    total: findings.length,
  };
  return {
    root: project.root, filesScanned: files.length, counts,
    passed: counts.errors === 0 && (!options.strict || counts.warnings === 0),
    findings, skipped: project.skipped,
    engine: { parser: parser ? `typescript ${parser.version}` : 'unavailable', fallback: 'lexical checks for unsupported syntax and remaining review hints' },
    coverage: { implemented: Object.keys(RULES).filter(id => parser || id !== 'CODE-017'), parserOnly: ['CODE-017'], manual: ['SEC-002: database access policies', 'SEC-003: authentication and authorization paths', 'FLOW-006: framework entrypoints and reachability', 'SEC-010: server authority over price and privilege'] },
    limitations: ['Source patterns and optional AST checks are not data-flow analysis, a security/accessibility audit, or a visual quality score.', 'Generated/dependency directories, declarations, tests, fixtures, and symbolic links are excluded. Custom gitignore patterns are not interpreted.', 'A clean result means no active check matched. Verify browser behavior, authorization, validation, and visual composition separately.'],
  };
}

export async function main(args = process.argv.slice(2)) {
  const { flags, values, positional } = parseOptions(args, ['--tooling'], ['--strict']);
  if (flags.has('--help')) {
    console.log('Usage: node verify.mjs [directory] [--json] [--strict] [--tooling directory]\nUses installed TypeScript for supported AST checks, with lexical fallback. --strict fails on warnings. Exit: 0 pass, 1 findings, 2 usage/scan failure.');
    return;
  }
  if (positional.length > 1) throw new Error('Expected at most one directory. Automatic --fix is unsupported; review evidence before edits.');
  const result = await runVerify(positional[0], { strict: flags.has('--strict'), toolingRoot: values['--tooling'] });
  if (flags.has('--json')) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`DevMind source checks: ${result.passed ? 'PASS' : 'FAIL'} (${result.filesScanned} files, ${result.counts.errors} errors, ${result.counts.warnings} warnings)`);
    for (const finding of result.findings) console.log(`${finding.file}:${finding.line} [${finding.rule.id}] ${finding.message}\n  ${finding.fix}`);
    console.log('Source checks only. Browser, framework, and security review are still required.');
  }
  process.exitCode = result.passed ? 0 : 1;
}

if (isMain(import.meta.url)) {
  main().catch(error => { console.error(`Verify: ${error.message}`); process.exitCode = 2; });
}
