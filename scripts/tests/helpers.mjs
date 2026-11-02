import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { artifactPath } from '../lib/runtime.mjs';

export async function fixture(files, operation) {
  const dir = await mkdtemp(join(tmpdir(), 'devmind-quality-'));
  try {
    for (const [path, content] of Object.entries(files)) {
      await mkdir(dirname(join(dir, path)), { recursive: true });
      await writeFile(join(dir, path), content, 'utf8');
    }
    return await operation(dir);
  } finally {
    assert.equal(dirname(resolve(dir)), resolve(tmpdir()));
    assert.ok(basename(dir).startsWith('devmind-quality-'));
    await rm(dir, { recursive: true, force: true });
  }
}

export async function serveProject(root, operation) {
  const server = createServer(async (request, response) => {
    try {
      const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      if (path === '/favicon.ico') { response.writeHead(204).end(); return; }
      const file = await artifactPath(root, '.' + (path === '/' ? '/index.html' : path));
      const content = await readFile(file);
      const type = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' }[extname(file)] ?? 'application/octet-stream';
      response.writeHead(200, { 'Content-Type': type }).end(content);
    } catch {
      response.writeHead(404).end('Not found');
    }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  try { return await operation(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}
