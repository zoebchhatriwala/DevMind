import { cp, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

// Keep installed entrypoints and their shared modules together in every bundle.
export const HELPER_FILES = ['verify.mjs', 'inspect.mjs', 'contrast.mjs', 'browser-audit.mjs', 'quality.mjs', 'review.mjs', 'eval.mjs', 'strata.mjs', 'init.mjs', 'handover.mjs', 'lib', 'evals'];

export async function copyHelperScripts(sourceRoot, destination) {
  const scripts = join(destination, 'scripts');
  await mkdir(scripts, { recursive: true });
  for (const file of HELPER_FILES) {
    await cp(join(sourceRoot, 'scripts', file), join(scripts, file), { recursive: true });
  }
  await cp(join(sourceRoot, 'templates'), join(destination, 'templates'), { recursive: true });
}
