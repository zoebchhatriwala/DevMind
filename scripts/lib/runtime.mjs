import { createRequire } from 'node:module';
import { mkdir, lstat, realpath, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { scanProject, SOURCE_EXTENSIONS } from './project.mjs';

export function optionalPackage(root, names) {
  const require = createRequire(join(resolve(root), 'package.json'));
  for (const name of names) {
    let path;
    try { path = require.resolve(name); }
    catch (error) {
      if (error.code === 'MODULE_NOT_FOUND') continue;
      throw error;
    }
    return { name, module: require(path) };
  }
  return null;
}

export function parseOptions(args, valueFlags = [], booleanFlags = []) {
  const values = {};
  const flags = new Set();
  const positional = [];
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (valueFlags.includes(arg)) {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      if (arg in values) throw new Error(`Duplicate option: ${arg}`);
      values[arg] = value;
    } else if (['--json', '--help', ...booleanFlags].includes(arg)) flags.add(arg);
    else if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`);
    else positional.push(arg);
  }
  return { values, flags, positional };
}

export async function readJson(path) {
  const source = await readFile(path, 'utf8');
  try { return JSON.parse(source.replace(/^\uFEFF/, '')); }
  catch { throw new Error(`Invalid JSON file: ${path}`); }
}

export function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
}

export function assertKeys(value, allowed, label) {
  assertObject(value, label);
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new Error(`${label} contains unsupported fields.`);
}

export async function fingerprint(root) {
  const project = await scanProject(root);
  const hash = createHash('sha256');
  for (const file of project.files) {
    if (!SOURCE_EXTENSIONS.has(file.ext) && !/(?:package\.json|lock\.(?:json|yaml)|lock\.yaml)$/.test(file.relPath)) continue;
    hash.update(file.relPath).update('\0').update(await readFile(file.fullPath)).update('\0');
  }
  return hash.digest('hex');
}

// Resolve each existing ancestor before writing; lexical containment alone permits symlink escapes.
export async function artifactPath(root, path) {
  const base = await realpath(resolve(root));
  const target = resolve(base, path);
  const rel = relative(base, target);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error('Artifact must be inside the project.');
  let current = base;
  for (const part of rel.split(/[\\/]/)) {
    current = join(current, part);
    try {
      if ((await lstat(current)).isSymbolicLink()) throw new Error('Artifact paths must not traverse symbolic links.');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return target;
}

export async function writeReport(root, path, report) {
  const target = await artifactPath(root, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(report, null, 2) + '\n', 'utf8');
  return target;
}

export function reportStatus(checks) {
  if (checks.some(check => check.status === 'failed')) return 'failed';
  if (!checks.length || checks.some(check => check.status === 'not-run')) return 'incomplete';
  return 'passed';
}

export function reportExit(status) {
  return status === 'passed' ? 0 : status === 'failed' ? 1 : 2;
}
