import { mkdir, copyFile } from 'node:fs/promises';

// Explicit list: do not deploy repository metadata, Node server, or test files.
const assets = ['index.html', 'style.css', 'app.js', 'game.js', 'runner.js', 'world.js', 'insects.js', 'wall.js', 'manual.js', 'string.js', 'remote.js', 'peer-session.js', 'remote-protocol.js', 'THIRD_PARTY_LICENSES.txt', 'icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'manifest.webmanifest', 'sw.js'];
await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
for (const asset of assets) await copyFile(new URL(`../${asset}`, import.meta.url), new URL(`../dist/${asset}`, import.meta.url));
await mkdir(new URL('../dist/vendor/', import.meta.url), { recursive: true });
await copyFile(new URL('../node_modules/peerjs/dist/peerjs.min.js', import.meta.url), new URL('../dist/vendor/peerjs.min.js', import.meta.url));
await copyFile(new URL('../node_modules/qrcode-generator/dist/qrcode.js', import.meta.url), new URL('../dist/vendor/qrcode.js', import.meta.url));
console.log(`Built ${assets.length + 2} static files in dist/`);
