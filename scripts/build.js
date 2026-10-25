import { mkdir, copyFile } from 'node:fs/promises';

// Explicit list: do not deploy repository metadata, Node server, or test files.
const assets = ['index.html', 'style.css', 'app.js', 'game.js', 'runner.js', 'world.js', 'icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'manifest.webmanifest', 'sw.js'];
await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
for (const asset of assets) await copyFile(new URL(`../${asset}`, import.meta.url), new URL(`../dist/${asset}`, import.meta.url));
console.log(`Built ${assets.length} static files in dist/`);
