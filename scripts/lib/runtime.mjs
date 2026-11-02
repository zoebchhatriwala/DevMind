import { createRequire } from 'node:module';
import { createReadStream } from 'node:fs';
import { mkdir, lstat, realpath, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { scanProject } from './project.mjs';

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
  const hash = createHash('sha256').update('devmind:inventory:v2\0');
  for (const file of project.files) {
    const contentHash = createHash('sha256');
    for await (const chunk of createReadStream(file.fullPath)) contentHash.update(chunk);
    hash.update(file.relPath).update('\0').update(contentHash.digest('hex')).update('\0');
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
  const target = await evidencePath(root, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(report, null, 2) + '\n', 'utf8');
  return target;
}

export async function evidencePath(root, path) {
  const target = await artifactPath(root, path);
  const rel = relative(await realpath(resolve(root)), target).replaceAll('\\', '/');
  if (rel !== '.devmind' && !rel.startsWith('.devmind/')) throw new Error('Store generated evidence under .devmind/ so it cannot invalidate its own source fingerprint.');
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
