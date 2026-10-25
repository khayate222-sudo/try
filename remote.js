import { RemoteSession } from './peer-session.js';
import { parseCode, PREY, settings as validateSettings } from './remote-protocol.js';
import { ManualHunt } from './manual.js';

const $ = id => document.getElementById(id);
const loading = new Map();
function script(file) {
  if (!loading.has(file)) loading.set(file, new Promise((resolve, reject) => {
    const el = document.createElement('script'); el.src = new URL(file, import.meta.url).href;
    el.onload = resolve; el.onerror = () => { loading.delete(file); el.remove(); reject(new Error('読み込みに失敗しました。インターネット接続を確認してください。')); };
    document.head.append(el);
  }));
  return loading.get(file);
}

export function initRemote({ getState, onHostConnected, onControl, onHostDisconnected, onHostEnd, onControllerView, drawPrey }) {
  let session, generation = 0, controllerVisible = false, connected = false, code;
  let config = { prey: 'mouse', stage: 'flat', scene: 'meadow', size: 1, contrast: true }, paused = false, visible = true;
  let padGame, pointer, pendingPoint, lastSend = 0, lastFrame = performance.now();
  const pad = $('remote-pad');
  function status(text, online = false) { $('remote-status').textContent = text; $('remote-status').classList.toggle('online', online); }
  function pairStatus(text) { $('pair-status').textContent = text; }
  function stop() { generation++; session?.close(); session = undefined; connected = false; pointer = undefined; pendingPoint = undefined; }
  function unsupported() {
    return !window.RTCPeerConnection || !window.crypto?.getRandomValues || !window.isSecureContext;
  }
  function failure(message) {
    connected = false; pointer = undefined; pendingPoint = undefined;
    if (controllerVisible) {
      status(message); $('remote-join-form').hidden = false; $('remote-pad-shell').hidden = true;
      $('remote-connect').disabled = false; $('remote-code').disabled = false; $('remote-connect').textContent = '接続する';
    } else { pairStatus(message); $('pair-retry').hidden = false; if (!$('remote-pair').open) $('remote-pair').showModal(); }
  }
  async function startHost() {
    stop(); const token = generation;
    $('pair-code').textContent = '— — — —'; $('pair-qr').replaceChildren(); $('pair-link').textContent = '';
    $('pair-copy').disabled = true; $('pair-retry').hidden = true;
    if (!$('remote-pair').open) $('remote-pair').showModal();
    pairStatus('接続コードをつくっています…');
    if (unsupported()) { failure('このブラウザは端末間通信に対応していません。PCのChromeや対応するTVブラウザでお試しください。'); return; }
    try {
      await Promise.all([script('./vendor/peerjs.min.js'), script('./vendor/qrcode.js')]);
      if (token !== generation) return;
      session = new RemoteSession({ Peer: window.Peer, role: 'host', getState,
        onReady(value) {
          if (token !== generation) return;
          code = value; $('pair-code').textContent = `${code.slice(0, 4)} ${code.slice(4)}`;
          const link = new URL(location.href); link.hash = `remote=${code}`;
          $('pair-link').textContent = link.href; $('pair-copy').disabled = false;
          const qr = window.qrcode(0, 'M'); qr.addData(link.href); qr.make();
          $('pair-qr').innerHTML = qr.createSvgTag({ scalable: true, margin: 2 });
          pairStatus('iPhoneのカメラでQRコードを読み取ってください。');
        },
        onConnected() {
          if (token !== generation) return;
          connected = true; $('remote-pair').close(); onHostConnected();
          $('remote-receiver-badge').hidden = false;
        },
        onPacket: data => { if (token === generation) { onControl(data); session?.sendState(); } },
        onDisconnected() {
          if (token !== generation) return;
          connected = false; onHostDisconnected();
          pairStatus('iPhoneとの接続が切れました。TVを一時停止しています。このコードで再接続できます。');
          if (!$('remote-pair').open) $('remote-pair').showModal();
        },
        onError(message) { if (token === generation) { onHostDisconnected(); failure(message); } },
      });
    } catch (error) { if (token === generation) failure(error.message); }
  }
  function endHost() {
    if (session?.role !== 'host' && !$('remote-pair').open) return;
    stop(); $('remote-pair').close(); $('remote-receiver-badge').hidden = true; onHostEnd();
  }
  function showController(value) {
    if (session?.role === 'host') endHost();
    stop(); controllerVisible = true; $('remote-controller').hidden = false;
    $('remote-join-form').hidden = false; $('remote-pad-shell').hidden = true;
    $('remote-code').value = value || ''; $('remote-code').disabled = false;
    $('remote-connect').disabled = false; $('remote-connect').textContent = '接続する';
    status('TVに表示されている8文字のコードを入力してください。');
    onControllerView(true); $('remote-code').focus({ preventScroll: true });
    if (value) connectController();
  }
  function applyState(data) {
    config = data.settings; paused = data.paused; visible = data.visible;
    $('remote-prey').value = config.prey; $('remote-stage').value = config.stage;
    $('remote-scene').value = config.scene; $('remote-size').value = String(config.size); $('remote-contrast').checked = config.contrast;
    for (const option of $('remote-prey').options) option.disabled = config.stage === 'wall' && ['mouse', 'feather'].includes(option.value);
    $('remote-pause').textContent = paused ? 'つづける' : 'ひとやすみ';
    $('remote-hide').textContent = visible ? 'かくす' : '出す'; $('remote-hide').setAttribute('aria-pressed', String(!visible));
    $('remote-pad-hint').textContent = paused ? 'TVは一時停止中です。「つづける」で再開' : '指でなぞって、TVの獲物を動かそう';
    status(paused ? '接続中 · ひとやすみ' : 'TVにつながりました', true);
    if (!padGame || padGame.mode !== config.stage) fitPad();
    if (padGame) { padGame.prey = config.prey; padGame.size = config.size; padGame.hide(!visible); }
  }
  async function connectController() {
    const value = parseCode($('remote-code').value);
    if (!value) { status('コードは英数字8文字です。TVに表示された文字を確認してください。'); return; }
    stop(); const token = generation;
    $('remote-code').value = value; $('remote-code').disabled = true; $('remote-connect').disabled = true; $('remote-connect').textContent = '接続中…';
    status('TVにつないでいます…');
    if (unsupported()) { failure('このブラウザは端末間通信に対応していません。SafariやChromeで開いてください。'); return; }
    try {
      await script('./vendor/peerjs.min.js'); if (token !== generation) return;
      session = new RemoteSession({ Peer: window.Peer, role: 'controller', code: value,
        onConnected(data) {
          if (token !== generation) return;
          connected = true; $('remote-join-form').hidden = true; $('remote-pad-shell').hidden = false;
          applyState(data); fitPad();
        },
        onPacket: data => { if (token === generation) applyState(data); },
        onDisconnected: () => { if (token === generation) failure('TVとの接続が切れました。TVのコードを確認して再接続してください。'); },
        onError: message => { if (token === generation) failure(message); },
      });
    } catch (error) { if (token === generation) failure(error.message); }
  }
  function fitPad() {
    if (!controllerVisible || !connected) return;
    const rect = pad.getBoundingClientRect(); if (!rect.width || !rect.height) return;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    pad.width = Math.round(rect.width * ratio); pad.height = Math.round(rect.height * ratio);
    pad.getContext('2d').setTransform(ratio, 0, 0, ratio, 0, 0);
    if (padGame?.mode === config.stage) padGame.resize(rect.width, rect.height);
    else padGame = new ManualHunt(rect.width, rect.height, { ...config, stage: config.stage });
  }
  new ResizeObserver(fitPad).observe(pad);
  function point(event) {
    const rect = pad.getBoundingClientRect();
    const u = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const vPos = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    pendingPoint = { type: 'move', u, vPos }; padGame?.point(u, vPos);
  }
  pad.addEventListener('pointerdown', event => {
    if (!connected || paused || event.isPrimary === false) return;
    event.preventDefault(); pointer = event.pointerId; pad.setPointerCapture(pointer); point(event);
  });
  pad.addEventListener('pointermove', event => { if (connected && !paused && event.pointerId === pointer) { event.preventDefault(); point(event); } });
  function release(event) {
    if (event.pointerId !== pointer) return;
    if (pendingPoint) session?.send(pendingPoint); pendingPoint = undefined; pointer = undefined;
  }
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) pad.addEventListener(type, release);
  function animate(now) {
    const dt = Math.min(.05, Math.max(0, (now - lastFrame) / 1000)); lastFrame = now;
    if (controllerVisible && connected && padGame) {
      if (pendingPoint && now - lastSend >= 33) { session?.send(pendingPoint); pendingPoint = undefined; lastSend = now; }
      if (!paused) padGame.step(dt);
      const c = pad.getContext('2d'), w = padGame.width, h = padGame.height, night = config.scene === 'night';
      c.clearRect(0, 0, w, h); c.fillStyle = night ? '#213a46' : '#e5ead6'; c.fillRect(0, 0, w, h);
      c.strokeStyle = night ? '#c8d2b615' : '#8b9b7020'; c.lineWidth = 1;
      for (let x = 0; x < w; x += 36) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
      for (let y = 0; y < h; y += 36) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
      c.globalAlpha = paused ? .4 : 1;
      drawPrey(c, { ...padGame, night, contrast: config.contrast }); c.globalAlpha = 1;
    }
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
  function updateSettings() {
    const value = { prey: $('remote-prey').value, stage: $('remote-stage').value, scene: $('remote-scene').value, size: Number($('remote-size').value), contrast: $('remote-contrast').checked };
    if (value.stage === 'wall' && ['mouse', 'feather'].includes(value.prey)) value.prey = 'spider';
    if (validateSettings(value)) session?.send({ type: 'settings', settings: value });
  }
  for (const id of ['remote-prey', 'remote-stage', 'remote-scene', 'remote-size', 'remote-contrast']) $(id).addEventListener('change', updateSettings);
  for (const [value, label] of Object.entries(PREY)) { const option = document.createElement('option'); option.value = value; option.textContent = label; $('remote-prey').append(option); }
  $('remote-host').addEventListener('click', startHost); $('pair-retry').addEventListener('click', startHost);
  $('pair-close').addEventListener('click', endHost);
  $('remote-pair').addEventListener('cancel', event => { event.preventDefault(); endHost(); });
  $('pair-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('pair-link').textContent); pairStatus('操作用リンクをコピーしました。iPhoneで開いてください。'); }
    catch { pairStatus('リンクのコピーに対応していません。QRコードか接続コードを使ってください。'); }
  });
  $('remote-open-controller').addEventListener('click', () => showController());
  $('remote-join-form').addEventListener('submit', event => { event.preventDefault(); connectController(); });
  $('remote-pause').addEventListener('click', () => { session?.send({ type: 'pause', paused: !paused }); });
  $('remote-hide').addEventListener('click', () => { session?.send({ type: 'hide', hidden: visible }); });
  $('remote-back').addEventListener('click', () => {
    stop(); controllerVisible = false; $('remote-controller').hidden = true;
    history.replaceState(null, '', location.pathname + location.search); onControllerView(false);
  });
  document.addEventListener('visibilitychange', () => { if (controllerVisible && document.hidden) { pointer = undefined; pendingPoint = undefined; session?.send({ type: 'pause', paused: true }); } });
  window.addEventListener('pagehide', stop);
  const initialCode = new URLSearchParams(location.hash.slice(1)).get('remote');
  if (initialCode !== null) showController(parseCode(initialCode) || undefined);
  return { sendState: () => session?.sendState(), endHost, isHost: () => session?.role === 'host' };
}
