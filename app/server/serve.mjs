import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createCollector, telemetryMiddleware } from './telemetry.mjs';
const root = fileURLToPath(new URL('../dist/client/', import.meta.url));
const collector = createCollector(), api = telemetryMiddleware(collector);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const server = createServer((req, res) => api(req, res, async () => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
    let info;
    try { info = await stat(file); } catch { res.writeHead(404); return res.end('Not found'); }
    if (!info.isFile()) { res.writeHead(404); return res.end(); }
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream'); res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method === 'HEAD') return res.end();
    const stream = createReadStream(file); stream.on('error', () => res.destroy()); stream.pipe(res);
  } catch { res.writeHead(400); res.end('Bad request'); }
}));
const port = Number(process.env.PORT || 4173);
server.listen(port, '127.0.0.1', () => console.log(`PulseDeck is running at http://127.0.0.1:${port}`));
server.on('close', () => collector.close());
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { collector.close(); server.close(() => process.exit(0)); });
