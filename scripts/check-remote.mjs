import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import http from 'node:http';
import { readFile, access } from 'node:fs/promises';
import assert from 'node:assert/strict';

const publicBroker = process.env.REMOTE_PUBLIC === '1';
let browser, localProcess, tv, phone;
const root = new URL('../dist/', import.meta.url);
const mime = { html: 'text/html', js: 'text/javascript', css: 'text/css', svg: 'image/svg+xml', png: 'image/png', webmanifest: 'application/manifest+json' };
const server = http.createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  const file = path.slice('/try/'.length) || 'index.html';
  if (!path.startsWith('/try/') || !/^[\w./-]+$/.test(file) || file.includes('..')) { res.writeHead(404); return res.end(); }
  try { const body = await readFile(new URL(file, root)); res.writeHead(200, { 'Content-Type': mime[file.split('.').at(-1)] || 'text/plain' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
});
const listen = await new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
const base = `http://127.0.0.1:${listen}/try/`;
let localOptions;
if (!publicBroker) {
  localProcess = spawn(process.execPath, ['--input-type=module', '-e', "import { PeerServer } from 'peer'; PeerServer({ port: 0, host: '127.0.0.1', path: '/' }, server => console.log(server.address().port));"], { cwd: new URL('../', import.meta.url), stdio: ['ignore', 'pipe', 'inherit'] });
  const reader = createInterface({ input: localProcess.stdout });
  const port = await new Promise(resolve => reader.once('line', value => resolve(Number(value))));
  reader.close();
  localOptions = { debug: 0, host: '127.0.0.1', port, path: '/', secure: false, config: { iceServers: [] } };
}
const errors = [];
async function page(context, trackHost = false) {
  const p = await context.newPage();
  p.on('pageerror', e => errors.push(e.message));
  if (!publicBroker) await p.route('**/peer-session.js', async route => {
    const body = (await readFile(new URL('../peer-session.js', import.meta.url), 'utf8')).replace('Object.freeze({ debug: 0 })', `Object.freeze(${JSON.stringify(localOptions)})`);
    await route.fulfill({ status: 200, contentType: 'text/javascript', body });
  });
  await p.addInitScript(() => {
    const Native = RTCPeerConnection; window.testConnections = [];
    window.RTCPeerConnection = class extends Native { constructor(...args) { super(...args); window.testConnections.push(this); this.testEvents = []; this.addEventListener('icecandidate', e => this.testEvents.push(e.candidate ? e.candidate.type : 'complete')); this.addEventListener('connectionstatechange', () => this.testEvents.push(this.connectionState)); } };
  });
  if (trackHost) await p.addInitScript(() => {
    const proto = CanvasRenderingContext2D.prototype, clear = proto.clearRect, translate = proto.translate, quad = proto.quadraticCurveTo;
    proto.clearRect = function(...args) { if (this.canvas.id === 'game-canvas') { window.preyPosition = undefined; window.ropeDraws = 0; } return clear.apply(this, args); };
    proto.translate = function(x, y) { if (this.canvas.id === 'game-canvas' && x > 10 && y > 10) window.preyPosition = { x, y }; return translate.call(this, x, y); };
    proto.quadraticCurveTo = function(...args) { if (this.canvas.id === 'game-canvas' && ['#9b4e3c', '#e2b878'].includes(this.strokeStyle)) window.ropeDraws++; return quad.apply(this, args); };

  });
  return p;
}
try {
  let executablePath;
  for (const candidate of [process.env.CHROME_PATH, '/usr/bin/chromium', '/usr/bin/google-chrome'].filter(Boolean)) { try { await access(candidate); executablePath = candidate; break; } catch {} }
  browser = await chromium.launch({ executablePath, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const tvContext = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
  const phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  tv = await page(tvContext, true);
  await tv.goto(base); await tv.locator('#remote-host').click();
  await tv.waitForFunction(() => /^[A-HJ-NP-Z2-9]{8}$/.test(document.getElementById('pair-code').textContent.replace(/\s/g, '')), {}, { timeout: 30000 });
  const code = (await tv.locator('#pair-code').innerText()).replace(/\s/g, '');
  assert.ok(await tv.locator('#pair-qr svg').isVisible());
  phone = await page(phoneContext);
  await phone.goto(`${base}#remote=${code}`);
  await phone.waitForFunction(() => !document.getElementById('remote-pad-shell').hidden || /できません|つなげられません|切れ|見つかりません|失敗|対応していません/.test(document.getElementById('remote-status').textContent), {}, { timeout: 45000 });
  assert.ok(await phone.locator('#remote-pad-shell').isVisible(), await phone.locator('#remote-status').innerText());
  await tv.locator('#game-canvas').waitFor({ state: 'visible' });
  assert.ok(await tv.evaluate(() => window.testConnections.some(pc => pc.connectionState === 'connected')));
  await phone.locator('#remote-pad').scrollIntoViewIfNeeded();
  const bounds = await phone.locator('#remote-pad').boundingBox();
  const cdp = await phoneContext.newCDPSession(phone);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bounds.x + bounds.width * .3, y: bounds.y + bounds.height * .6 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: bounds.x + bounds.width * .8, y: bounds.y + bounds.height * .3 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await tv.waitForFunction(() => window.preyPosition && Math.abs(window.preyPosition.x - 1024) < 7 && Math.abs(window.preyPosition.y - 216) < 7);
  await phone.locator('#remote-hide').click();
  await tv.waitForFunction(() => document.getElementById('hide-prey').getAttribute('aria-pressed') === 'true');
  await phone.locator('#remote-hide').click();
  await tv.waitForFunction(() => document.getElementById('hide-prey').getAttribute('aria-pressed') === 'false');
  await phone.locator('#remote-prey').selectOption('string');
  await tv.waitForFunction(() => window.ropeDraws > 5);
  await phone.locator('#remote-stage').selectOption('wall');
  await tv.waitForFunction(() => document.getElementById('stage-badge').textContent === '壁のぼり');
  await phone.locator('#remote-scene').selectOption('night');
  await tv.waitForFunction(() => document.getElementById('play').classList.contains('night-play'));
  await phone.locator('#remote-size').selectOption('1.45');
  await phone.locator('#remote-pause').click(); await tv.locator('#pause-panel').waitFor({ state: 'visible' });
  await phone.waitForFunction(() => document.getElementById('remote-pause').textContent === 'つづける');
  await phone.locator('#remote-pause').click(); await tv.locator('#pause-panel').waitFor({ state: 'hidden' });
  await phone.close();
  await tv.locator('#remote-pair').waitFor({ state: 'visible', timeout: 12000 });
  assert.ok(await tv.locator('#pause-panel').isVisible());
  phone = await page(phoneContext); await phone.goto(`${base}#remote=${code}`);
  await phone.locator('#remote-pad-shell').waitFor({ state: 'visible', timeout: 45000 });
  assert.equal(await phone.locator('#remote-prey').inputValue(), 'string');
  assert.equal(await phone.locator('#remote-stage').inputValue(), 'wall');
  assert.equal(await phone.locator('#remote-size').inputValue(), '1.45');
  assert.equal(await phone.locator('#remote-pause').innerText(), 'つづける');
  await phone.locator('#remote-pause').click(); await tv.locator('#pause-panel').waitFor({ state: 'hidden' });
  await tv.keyboard.press('Escape'); await tv.locator('#exit').click();
  await phone.locator('#remote-join-form').waitFor({ state: 'visible', timeout: 12000 });
  await tv.locator('[data-control=auto]').click(); await tv.locator('[data-stage=flat]').click(); await tv.locator('[data-prey=mouse]').click();
  await tv.locator('#start').click(); await tv.waitForTimeout(100);
  const pos = await tv.evaluate(() => window.preyPosition); await tv.mouse.click(pos.x, pos.y);
  assert.equal(await tv.locator('#catch-count').innerText(), '1 キャッチ');
  const unsupported = await page(tvContext);
  await unsupported.addInitScript(() => Object.defineProperty(window, 'RTCPeerConnection', { value: undefined }));
  await unsupported.goto(base); await unsupported.locator('#remote-host').click();
  assert.ok((await unsupported.locator('#pair-status').innerText()).includes('対応していません'));
  assert.deepEqual(errors, []);
  console.log(`PASS (${publicBroker ? 'PUBLIC PeerJS signaling' : 'local signaling'}): real WebRTC pairing, QR, iPhone touch movement on receiver, hide/show, string and wall settings, night scene, pause/resume, disconnect pause, reconnect with settings, host exit, auto-game regression, unsupported-browser message.`);
} catch (error) {
  if (tv && !tv.isClosed()) console.log('TV status:', await tv.locator('#pair-status').innerText().catch(() => 'unavailable'));
  if (phone && !phone.isClosed()) console.log('Phone status:', await phone.locator('#remote-status').innerText().catch(() => 'unavailable'));
  if (tv && !tv.isClosed()) console.log('ICE diagnostics:', await tv.evaluate(() => window.testConnections.map(pc => ({ state: pc.connectionState, localCandidates: (pc.localDescription?.sdp.match(/a=candidate:/g) || []).length, remoteCandidates: (pc.remoteDescription?.sdp.match(/a=candidate:/g) || []).length, events: pc.testEvents }))).catch(() => []));
  console.error(`::error::Remote browser check failed: ${error.message.replace(/\n/g, ' ').slice(0, 1400)}`);
  process.exitCode = 1;
} finally {
  await browser?.close();
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  localProcess?.kill('SIGTERM');
}
