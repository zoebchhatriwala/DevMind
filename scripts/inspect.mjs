#!/usr/bin/env node
import { basename } from 'node:path';
import { isMain, parseArgs, readSource, scanProject, SOURCE_EXTENSIONS } from './lib/project.mjs';

export async function inspectProject(targetDir = '.') {
  const project = await scanProject(targetDir);
  const packages = [];
  for (const file of project.files.filter(file => basename(file.relPath) === 'package.json')) {
    let pkg;
    const source = await readSource(file);
    try {
      pkg = JSON.parse(source);
    } catch {
      throw new Error(`Cannot parse package JSON: ${file.relPath}`);
    }
    if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) {
      throw new Error(`Invalid package object: ${file.relPath}`);
    }
    packages.push({
      file: file.relPath,
      name: typeof pkg.name === 'string' ? pkg.name : null,
      // Commands and dependency values may contain credentials; expose names only.
      scripts: Object.keys(pkg.scripts ?? {}).sort(),
      dependencies: Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).sort(),
    });
  }
  const paths = project.files.map(file => file.relPath);
  return {
    root: project.root,
    filesScanned: paths.length,
    packages,
    sourceFiles: project.files.filter(file => SOURCE_EXTENSIONS.has(file.ext)).map(file => file.relPath),
    reuseCandidates: paths.filter(path => /(^|\/)(components|ui|hooks|utils|lib)\//.test(path)),
    designTokens: paths.filter(path => /(?:tokens?|theme|tailwind\.config)[^/]*\.(?:css|scss|[cm]?[jt]s)$/.test(path)),
    qualityConfigs: paths.filter(path => /(?:eslint|prettier|biome|tsconfig|vitest|playwright|jest|lock\.)/.test(basename(path))),
    skipped: project.skipped,
    limitations: ['Candidate paths are discovery hints, not proof of reuse.', 'Generated and dependency directories and symbolic links are excluded. Custom gitignore patterns are not interpreted.'],
  };
}

export async function main(args = process.argv.slice(2)) {
  const { options, positional } = parseArgs(args);
  if (options.has('--help')) {
    console.log('Usage: node inspect.mjs [directory] [--json]\nRead-only inventory of packages, reusable components, tokens, and quality tools.');
    return;
  }
  if (positional.length > 1) throw new Error('Expected at most one directory.');
  const result = await inspectProject(positional[0]);
  console.log(JSON.stringify(result, null, 2));
}

if (isMain(import.meta.url)) {
  main().catch(error => { console.error(`Inspect: ${error.message}`); process.exitCode = 2; });
}
