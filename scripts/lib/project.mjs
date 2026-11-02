import { readdir, readFile, realpath } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const IGNORED = new Set([
  '.git', 'node_modules', 'dist', 'build', 'out', 'coverage', '.next', '.nuxt',
  '.output', '.svelte-kit', '.astro', '.turbo', '.cache', '.devmind', '.agents',
  '.codex', '.claude', '.venv', 'vendor',
]);
export const SOURCE_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.vue', '.svelte', '.html', '.css', '.scss',
]);

// devmind: lexical source checks only, use the project's parser and browser for semantic validation
export async function scanProject(targetDir = '.') {
  const root = await realpath(resolve(targetDir));
  const files = [];
  const skipped = [];
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, 'en'));
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relPath = relative(root, fullPath).replaceAll('\\', '/');
      if (entry.isSymbolicLink()) {
        skipped.push({ file: relPath, reason: 'symbolic-link' });
      } else if (entry.isDirectory()) {
        if (!IGNORED.has(entry.name)) await walk(fullPath);
      } else if (entry.isFile()) {
        files.push({ fullPath, relPath, ext: extname(entry.name).toLowerCase() });
      }
    }
  }
  await walk(root);
  return { root, files, skipped };
}

export async function readSource(file) {
  const content = await readFile(file.fullPath, 'utf8');
  return content.replace(/^\uFEFF/, '');
}

export function isMain(metaUrl) {
  return Boolean(process.argv[1]) && metaUrl === pathToFileURL(resolve(process.argv[1])).href;
}

export function parseArgs(args, flags = []) {
  const allowed = new Set(['--json', '--help', ...flags]);
  const options = new Set();
  const positional = [];
  for (const arg of args) {
    if (arg.startsWith('-')) {
      if (!allowed.has(arg)) throw new Error(`Unknown option: ${arg}`);
      options.add(arg);
    } else {
      positional.push(arg);
    }
  }
  return { options, positional };
}
