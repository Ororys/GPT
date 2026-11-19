/**
 * Serves apps/mobile/dist for the browser tests of the on-device mode, like the app's local
 * web view: files only, `/biology/` → `/biology/index.html`, no API.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../../mobile/dist');
const port = Number(process.env.PORT || 3200);
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mjs': 'text/javascript',
};
createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url || '/', 'http://x').pathname);
  let file = normalize(join(root, path));
  if (!file.startsWith(root)) return void res.writeHead(403).end();
  if (path.endsWith('/')) file = join(file, 'index.html');
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`static ${root} on ${port}`));
