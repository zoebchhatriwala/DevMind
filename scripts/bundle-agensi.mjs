#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { lstat, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';
import { build } from './build.mjs';
import { parseOptions } from './lib/runtime.mjs';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIR = join(ROOT_DIR, 'dist', 'antigravity', 'devmind');
const DEFAULT_OUT = join(ROOT_DIR, 'dist', 'agensi', 'devmind.zip');

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buffer.length; i++) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

async function collectFiles(directory, baseDir = directory, out = []) {
  const entries = (await readdir(directory)).sort();
  for (const name of entries) {
    const fullPath = join(directory, name);
    const stat = await lstat(fullPath);
    if (stat.isSymbolicLink()) throw new Error(`Agensi bundle source must not contain symbolic links: ${fullPath}`);
    if (stat.isDirectory()) {
      await collectFiles(fullPath, baseDir, out);
    } else if (stat.isFile()) {
      const archivePath = relative(baseDir, fullPath).replaceAll('\\', '/');
      out.push({ fullPath, archivePath, mtime: stat.mtime });
    }
  }
  return out;
}

function dosTimestamp(date) {
  const year = Math.max(1980, date.getUTCFullYear());
  const time = ((date.getUTCHours() & 0x1F) << 11) | ((date.getUTCMinutes() & 0x3F) << 5) | ((date.getUTCSeconds() >> 1) & 0x1F);
  const day = (((year - 1980) & 0x7F) << 9) | (((date.getUTCMonth() + 1) & 0x0F) << 5) | (date.getUTCDate() & 0x1F);
  return { time, day };
}

export async function createZipArchive(sourceDir, outFile) {
  const files = await collectFiles(sourceDir);
  if (!files.some(file => file.archivePath === 'SKILL.md')) {
    throw new Error('Expected root SKILL.md inside dist/antigravity/devmind before bundling.');
  }

  const localChunks = [];
  const centralChunks = [];
  let offset = 0;
  let rawBytes = 0;

  for (const entry of files) {
    const data = await readFile(entry.fullPath);
    rawBytes += data.length;
    const checksum = crc32(data);
    const deflated = deflateRawSync(data, { level: 9 });
    const useDeflate = deflated.length < data.length;
    const payload = useDeflate ? deflated : data;
    const method = useDeflate ? 8 : 0;
    const nameBytes = Buffer.from(entry.archivePath, 'utf8');
    const { time, day } = dosTimestamp(entry.mtime);
    const utf8Flag = 0x0800;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034B50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(utf8Flag, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(day, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    localChunks.push(local, nameBytes, payload);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014B50, 0);
    central.writeUInt16LE(0x031E, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(utf8Flag, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(day, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0o644 << 16, 38);
    central.writeUInt32LE(offset, 42);
    centralChunks.push(central, nameBytes);

    offset += local.length + nameBytes.length + payload.length;
  }

  const centralDir = Buffer.concat(centralChunks);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054B50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  const archive = Buffer.concat([...localChunks, centralDir, eocd]);
  const target = resolve(outFile);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, archive);

  const sha256 = createHash('sha256').update(archive).digest('hex');
  return { outFile: target, fileCount: files.length, rawBytes, zipBytes: archive.length, sha256 };
}

export async function bundleAgensi(options = {}) {
  if (options.rebuild !== false || !existsSync(join(SOURCE_DIR, 'SKILL.md'))) {
    await build();
  }
  const outFile = resolve(options.out || DEFAULT_OUT);
  return createZipArchive(SOURCE_DIR, outFile);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: node scripts/bundle-agensi.mjs [--out <path>] [--no-build]\nPackages dist/antigravity/devmind/ into a ZIP skill bundle for Agensi.io.');
    return;
  }
  const parsed = parseOptions(args, ['--out'], ['--no-build']);
  if (parsed.positional.length) throw new Error('Unexpected positional argument. Use --out <path>.');
  const result = await bundleAgensi({
    out: parsed.values['--out'],
    rebuild: !parsed.flags.has('--no-build'),
  });
  console.log(`\n📦 Agensi.io bundle ready: ${relative(ROOT_DIR, result.outFile) || result.outFile}`);
  console.log(`   Files: ${result.fileCount} (${(result.rawBytes / 1024).toFixed(1)} KB -> ${(result.zipBytes / 1024).toFixed(1)} KB zip)`);
  console.log(`   SHA-256: ${result.sha256}`);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch(error => {
    console.error(`bundle-agensi error: ${error.message}`);
    process.exit(1);
  });
}

