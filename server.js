import http from 'node:http';
import { readFile } from 'node:fs/promises';

const types = { '/insects.js': ['insects.js', 'text/javascript'], '/wall.js': ['wall.js', 'text/javascript'], '/runner.js': ['runner.js', 'text/javascript'], '/world.js': ['world.js', 'text/javascript'], '/index.html': ['index.html', 'text/html; charset=utf-8'], '/': ['index.html', 'text/html; charset=utf-8'], '/style.css': ['style.css', 'text/css'], '/app.js': ['app.js', 'text/javascript'], '/game.js': ['game.js', 'text/javascript'], '/sw.js': ['sw.js', 'text/javascript'], '/manifest.webmanifest': ['manifest.webmanifest', 'application/manifest+json'], '/icon.svg': ['icon.svg', 'image/svg+xml'], '/icon-192.png': ['icon-192.png', 'image/png'], '/icon-512.png': ['icon-512.png', 'image/png'], '/apple-touch-icon.png': ['apple-touch-icon.png', 'image/png'] };
const server = http.createServer(async (req, res) => {
  const entry = types[new URL(req.url, 'http://localhost').pathname];
  if (!entry) { res.writeHead(404); return res.end('Not found'); }
  try {
    const body = await readFile(new URL(entry[0], import.meta.url));
    res.writeHead(200, { 'Content-Type': entry[1], 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(body);
  } catch { res.writeHead(500); res.end('Unable to read application'); }
});
server.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log(`Pawplay listening on port ${server.address().port}`));
