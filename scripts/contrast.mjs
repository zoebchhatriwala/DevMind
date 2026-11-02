#!/usr/bin/env node
import { isMain, parseArgs } from './lib/project.mjs';

function luminance(hex) {
  if (typeof hex !== 'string' || !/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(hex)) {
    throw new Error('Colors must be opaque #RGB or #RRGGBB values. Resolve transparency against the rendered background first.');
  }
  const value = hex.length === 4 ? hex.slice(1).split('').map(char => char + char).join('') : hex.slice(1);
  const linear = [0, 2, 4].map(offset => {
    const channel = Number.parseInt(value.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

export function checkContrast(foreground, background) {
  const a = luminance(foreground);
  const b = luminance(background);
  const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  return {
    foreground, background, ratio,
    normalTextAA: ratio >= 4.5,
    largeTextAA: ratio >= 3,
    nonTextAA: ratio >= 3,
    normalTextAAA: ratio >= 7,
    limitations: ['Solid color pairs only. Verify actual rendered colors, text size, focus, and component states in a browser.'],
  };
}

export async function main(args = process.argv.slice(2)) {
  const { options, positional } = parseArgs(args, ['--large', '--non-text']);
  if (options.has('--help')) {
    console.log('Usage: node contrast.mjs "#foreground" "#background" [--json] [--large|--non-text]\nDefault threshold: normal text AA (4.5:1). Large text: 18pt regular or 14pt bold.');
    return;
  }
  if (positional.length !== 2) throw new Error('Expected foreground and background colors. Quote hex colors in the shell.');
  const result = checkContrast(...positional);
  const passed = options.has('--large') ? result.largeTextAA : options.has('--non-text') ? result.nonTextAA : result.normalTextAA;
  console.log(options.has('--json') ? JSON.stringify({ ...result, passed }, null, 2) : `${result.ratio.toFixed(2)}:1 ${passed ? 'PASS' : 'FAIL'}`);
  process.exitCode = passed ? 0 : 1;
}

if (isMain(import.meta.url)) {
  main().catch(error => { console.error(`Contrast: ${error.message}`); process.exitCode = 2; });
}
