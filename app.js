import { Hunt } from './game.js';

const $ = id => document.getElementById(id);
const home = $('home'), play = $('play');
const preview = $('preview-canvas'), canvas = $('game-canvas');
const names = { mouse: 'ねずみ', bug: 'てんとうむし', feather: 'はね' };
const descriptions = { mouse: 'ちょこちょこ、かくれんぼ', bug: 'すいすい、きまぐれに', feather: 'ゆらゆら、ひらひら' };
const speeds = ['のんびり', 'ふつう', 'すばやく'];
let selected = 'mouse', speed = 2, sceneChoice = 'meadow', active = false, paused = false;
let game, previewGame, audio, wakeLock, last = performance.now(), elapsed = 0, nextBreak = 180, toastTimer;
let holdTimer, holdPointer;
try {
  const saved = JSON.parse(localStorage.getItem('pawplay-preferences') || '{}');
  if (Object.hasOwn(names, saved.prey)) selected = saved.prey;
  if ([1, 2, 3].includes(saved.speed)) speed = saved.speed;
  if (['meadow', 'night'].includes(saved.scene)) sceneChoice = saved.scene;
  $('sound').checked = saved.sound === true;
} catch { /* Settings are optional when browser storage is unavailable. */ }

function fit(surface, hunt) {
  const rect = surface.getBoundingClientRect();
  if (!rect.width || !rect.height) return rect;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  surface.width = Math.round(rect.width * ratio);
  surface.height = Math.round(rect.height * ratio);
  surface.getContext('2d').setTransform(ratio, 0, 0, ratio, 0, 0);
  if (hunt) hunt.resize(rect.width, rect.height);
  return rect;
}
const size = fit(preview);
previewGame = new Hunt(size.width, size.height, { prey: selected, speed });
const observer = new ResizeObserver(() => { fit(preview, previewGame); if (active) { fit(canvas, game); if (paused) scene(canvas, game); } });
observer.observe(preview);
window.addEventListener('resize', () => { if (active) { fit(canvas, game); if (paused) scene(canvas, game); } });
function ellipse(c, x, y, rx, ry, color, rotation = 0) {
  c.fillStyle = color;
  c.beginPath(); c.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2); c.fill();
}
function drawPrey(c, hunt) {
  c.save();
  c.translate(hunt.x, hunt.y);
  c.rotate(hunt.angle);
  c.scale(hunt.scale, hunt.scale);
  const wiggle = Math.sin(hunt.time * 11);
  if (hunt.prey === 'mouse') {
    c.strokeStyle = '#b19b86'; c.lineWidth = 2.5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-18, 0); c.bezierCurveTo(-36, 14 + wiggle * 3, -45, -13, -53, wiggle * 3); c.stroke();
    ellipse(c, 0, 4, 24, 13, '#49543915');
    ellipse(c, -1, 0, 22, 14, '#7e806c');
    ellipse(c, -5, -4, 16, 9, '#9a9e84');
    ellipse(c, 14, 0, 12, 10, '#9b9b85');
    ellipse(c, 9, -10, 7, 7, '#929580'); ellipse(c, 9, -10, 4.2, 4.2, '#c8b6a0');
    ellipse(c, 20, -4, 1.6, 1.6, '#303c32'); ellipse(c, 26, 0, 2.3, 2, '#b79b88');
    c.strokeStyle = '#6d7a6355'; c.lineWidth = .8;
    for (const side of [-1, 1]) { c.beginPath(); c.moveTo(22, side * 3); c.lineTo(32, side * 9); c.moveTo(22, side * 3); c.lineTo(33, side * 4); c.stroke(); }
  } else if (hunt.prey === 'bug') {
    c.strokeStyle = '#4a5841'; c.lineWidth = 1.6;
    for (const i of [-1, 0, 1]) { c.beginPath(); c.moveTo(i * 8, -7); c.lineTo(i * 9 - 3, -15 - wiggle); c.moveTo(i * 8, 7); c.lineTo(i * 9 - 3, 15 + wiggle); c.stroke(); }
    ellipse(c, 13, 0, 8, 8, '#3c4b39'); ellipse(c, -2, 0, 17, 13, '#b96649');
    c.strokeStyle = '#704a36'; c.beginPath(); c.moveTo(-18, 0); c.lineTo(12, 0); c.stroke();
    for (const x of [-9, 3]) for (const y of [-6, 6]) ellipse(c, x, y, 2.5, 2.5, '#494c38');
  } else {
    c.rotate(Math.sin(hunt.time * 2) * .2);
    c.fillStyle = '#f4f1d8'; c.beginPath(); c.moveTo(-30, 0); c.bezierCurveTo(-8, -28, 30, -16, 33, -5); c.bezierCurveTo(19, 12, -6, 20, -30, 0); c.fill();
    c.strokeStyle = '#b1aa80'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-38, 3); c.lineTo(30, -4); c.stroke();
    c.strokeStyle = '#d7d0ad'; c.lineWidth = .8;
    for (let x = -16; x < 22; x += 6) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 8, -12); c.moveTo(x, 0); c.lineTo(x + 8, 10); c.stroke(); }
  }
  c.restore();
}
function scene(surface, hunt, isPreview = false) {
  const c = surface.getContext('2d');
  const w = hunt.width, h = hunt.height;
  c.clearRect(0, 0, w, h);
  if (!isPreview) {
    c.fillStyle = '#e7eadc'; c.fillRect(0, 0, w, h);
    const gradient = c.createRadialGradient(w * .5, h * .4, 0, w * .5, h * .4, h);
    gradient.addColorStop(0, sceneChoice === 'night' ? '#2c4c58' : '#f2f2e4'); gradient.addColorStop(1, sceneChoice === 'night' ? '#172e3b' : '#dbe2cd'); c.fillStyle = gradient; c.fillRect(0, 0, w, h);
  }
  if (isPreview && sceneChoice === 'night') { c.fillStyle = '#213c48'; c.fillRect(0, 0, w, h); }
  for (let i = 0; i < (isPreview ? 12 : 32); i++) {
    const x = ((i * 137.508 + 37) % 1000) / 1000 * w;
    const y = ((i * 263.213 + 113) % 1000) / 1000 * h;
    const sway = Math.sin(hunt.time * .6 + i) * 1.5;
    c.strokeStyle = sceneChoice === 'night' ? '#90b2a52e' : i % 3 ? '#9eae8544' : '#93a37966'; c.lineWidth = 1.2; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x - 3, y); c.quadraticCurveTo(x - 7, y - 8, x - 6 + sway, y - 13); c.moveTo(x - 3, y); c.quadraticCurveTo(x, y - 5, x + 2 + sway, y - 8); c.stroke();
    if (i % 6 === 0) { ellipse(c, x + 15, y + 4, 2, 2, sceneChoice === 'night' ? '#c8ce92' : '#c8b77d'); ellipse(c, x + 23, y - 3, 1.5, 1.5, '#bbc1a1'); }
  }
  if (!isPreview) for (const [x, y, rotate] of [[w * .1, h * .27, -.7], [w * .87, h * .76, .8], [w * .75, h * .14, 1.2]]) {
    ellipse(c, x, y, 30, 13, sceneChoice === 'night' ? '#365953' : '#bdc9a6', rotate); ellipse(c, x + 14, y + 14, 25, 11, sceneChoice === 'night' ? '#40665d' : '#c8d1b5', rotate + .6);
  }
  for (const ripple of hunt.ripples) {
    c.globalAlpha = ripple.life / .7;
    c.strokeStyle = ripple.hit ? '#849d62' : '#aab794'; c.lineWidth = 1.5;
    c.beginPath(); c.arc(ripple.x, ripple.y, 10 + (1 - ripple.life / .7) * 46, 0, Math.PI * 2); c.stroke();
    if (ripple.hit) for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; const r = 18 + (.7 - ripple.life) * 48; ellipse(c, ripple.x + Math.cos(a) * r, ripple.y + Math.sin(a) * r, 2, 2, '#a2b47e'); }
    c.globalAlpha = 1;
  }
  drawPrey(c, hunt);
}
function formatTime(seconds) { return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`; }
function frame(now) {
  const dt = Math.min(Math.max((now - last) / 1000, 0), .05); last = now;
  if (!document.hidden) {
    if (!active) { previewGame.step(dt); scene(preview, previewGame, true); }
    else if (!paused) {
      game.step(dt); elapsed += dt; scene(canvas, game);
      $('session-time').textContent = formatTime(elapsed);
      if (elapsed >= nextBreak) { nextBreak += 180; pause(true); }
    }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function refreshSettings() {
  previewGame.prey = selected; previewGame.speed = speed;
  document.querySelectorAll('.friend').forEach(b => { const chosen = b.dataset.prey === selected; b.classList.toggle('selected', chosen); b.setAttribute('aria-pressed', String(chosen)); });
  document.querySelectorAll('.scene-option').forEach(b => { const chosen = b.dataset.scene === sceneChoice; b.classList.toggle('selected', chosen); b.setAttribute('aria-pressed', String(chosen)); });
  $('speed').value = speed; $('speed').setAttribute('aria-valuetext', speeds[speed - 1]);
  $('speed-label').textContent = speeds[speed - 1];
  $('friend-caption').textContent = names[selected];
  $('prey-tag').textContent = descriptions[selected];
  $('scene-name').textContent = sceneChoice === 'night' ? '02 / 月あかりの庭' : '01 / こもれびの草原';
  preview.parentElement.classList.toggle('night-preview', sceneChoice === 'night');
  $('launch-prey').textContent = `${names[selected]}とあそぶ`;
  $('launch-detail').textContent = `${sceneChoice === 'night' ? '夜の庭' : '草原'} · ${speeds[speed - 1]} · ${$('sound').checked ? '音あり' : '音なし'}`;
  $('sound-description').textContent = $('sound').checked ? 'そっと音をならす' : '静かにあそぶ';
  try { localStorage.setItem('pawplay-preferences', JSON.stringify({ prey: selected, speed, scene: sceneChoice, sound: $('sound').checked })); } catch { /* Gameplay works without storage. */ }
}
refreshSettings();
// Render the same custom illustrations in the cards and in the game.
for (const thumbnail of document.querySelectorAll('[data-drawing]')) {
  const c = thumbnail.getContext('2d');
  c.scale(1.3, 1.3);
  drawPrey(c, { x: 57, y: 39, angle: -.3, scale: 1, time: 0, prey: thumbnail.dataset.drawing });
}
document.querySelectorAll('.friend').forEach(button => button.addEventListener('click', () => { selected = button.dataset.prey; refreshSettings(); }));
document.querySelectorAll('.scene-option').forEach(button => button.addEventListener('click', () => { sceneChoice = button.dataset.scene; refreshSettings(); }));
$('speed').addEventListener('input', event => { speed = Number(event.target.value); refreshSettings(); });
$('sound').addEventListener('change', refreshSettings);
preview.addEventListener('pointerdown', event => {
  if (active || event.isPrimary === false) return;
  event.preventDefault();
  const rect = preview.getBoundingClientRect();
  previewGame.tap(event.clientX - rect.left, event.clientY - rect.top);
  preview.parentElement.classList.add('touched');
});

async function keepAwake() {
  try {
    if ('wakeLock' in navigator) {
      const lock = await navigator.wakeLock.request('screen');
      if (!active || paused || document.hidden) await lock.release();
      else wakeLock = lock;
    }
  } catch { /* Optional on unsupported devices or low battery. */ }
}
function releaseWakeLock() { if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; } }
function chime() {
  if (!$('sound').checked || !audio || audio.state !== 'running') return;
  const osc = audio.createOscillator(), gain = audio.createGain();
  osc.type = 'sine'; osc.frequency.setValueAtTime(660, audio.currentTime); osc.frequency.exponentialRampToValueAtTime(440, audio.currentTime + .12);
  gain.gain.setValueAtTime(.025, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .15);
  osc.connect(gain); gain.connect(audio.destination); osc.start(); osc.stop(audio.currentTime + .16);
}
function toast(message, duration = 3000) {
  $('play-toast').textContent = message; $('play-toast').classList.remove('faded');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('play-toast').classList.add('faded'), duration);
}
$('start').addEventListener('click', () => {
  if ($('sound').checked) { const Audio = window.AudioContext || window.webkitAudioContext; if (Audio) { audio ||= new Audio(); audio.resume().catch(() => {}); } }
  home.hidden = true; document.querySelector('.brand').hidden = true; play.hidden = false;
  active = true; paused = false; elapsed = 0; nextBreak = 180; last = performance.now();
  play.classList.toggle('night-play', sceneChoice === 'night');
  $('pause-panel').hidden = true; $('pause').disabled = false; $('catch-count').textContent = '0 キャッチ'; $('session-time').textContent = '0:00';
  const rect = fit(canvas); game = new Hunt(rect.width, rect.height, { prey: selected, speed });
  scene(canvas, game); toast('獲物をタッチしてみよう', 3500);
  document.body.style.overflow = 'hidden'; keepAwake(); $('pause').focus({ preventScroll: true });
});
canvas.addEventListener('pointerdown', event => {
  if (!active || paused || event.isPrimary === false) return;
  event.preventDefault();
  const rect = canvas.getBoundingClientRect();
  if (game.tap(event.clientX - rect.left, event.clientY - rect.top)) { $('catch-count').textContent = `${game.catches} キャッチ`; chime(); }
});
function pause(isBreak = false) {
  if (!active || paused) return;
  cancelHold(); paused = true; releaseWakeLock(); clearTimeout(toastTimer); $('play-toast').classList.add('faded');
  $('pause-title').textContent = isBreak ? 'そろそろ、ひとやすみ。' : 'ひとやすみ。';
  $('pause-message').textContent = isBreak ? '3分あそびました。少し休んだり、本物のおもちゃでも遊んでみてね。' : 'また気になったら、つづきをどうぞ。';
  $('pause-catches').textContent = game.catches; $('pause-time').textContent = formatTime(elapsed);
  $('pause-panel').hidden = false; $('pause').disabled = true; $('resume').focus({ preventScroll: true });
}
function cancelHold() { clearTimeout(holdTimer); holdTimer = undefined; holdPointer = undefined; $('pause').classList.remove('holding'); }
$('pause').addEventListener('pointerdown', event => {
  if (paused || holdTimer || event.isPrimary === false) return;
  event.preventDefault();
  holdPointer = event.pointerId; $('pause').setPointerCapture(event.pointerId); $('pause').classList.add('holding');
  holdTimer = setTimeout(() => pause(), 850);
});
$('pause').addEventListener('pointerup', event => { if (event.pointerId === holdPointer) { cancelHold(); if (!paused) toast('休憩するときは、ボタンを長押し'); } });
$('pause').addEventListener('pointercancel', cancelHold);
$('pause').addEventListener('lostpointercapture', cancelHold);
$('pause').addEventListener('contextmenu', event => event.preventDefault());
$('pause').addEventListener('click', event => { if (event.detail === 0 && !event.pointerType) pause(); });
$('resume').addEventListener('click', () => { paused = false; $('pause-panel').hidden = true; $('pause').disabled = false; last = performance.now(); keepAwake(); $('pause').focus({ preventScroll: true }); });
$('exit').addEventListener('click', () => {
  cancelHold(); active = false; paused = false; releaseWakeLock(); play.hidden = true; $('pause-panel').hidden = true; $('pause').disabled = false;
  home.hidden = false; document.querySelector('.brand').hidden = false; document.body.style.overflow = ''; fit(preview, previewGame); $('start').focus({ preventScroll: true });
});
$('help-open').addEventListener('click', () => $('help-dialog').showModal());
$('help-close').addEventListener('click', () => $('help-dialog').close());
$('help-done').addEventListener('click', () => $('help-dialog').close());
$('help-dialog').addEventListener('click', event => { if (event.target === $('help-dialog')) { const r = $('help-dialog').getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) $('help-dialog').close(); } });
document.addEventListener('visibilitychange', () => { if (document.hidden && active) pause(); last = performance.now(); });
window.addEventListener('pagehide', releaseWakeLock);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && active) pause();
  if (event.key === 'Tab' && paused) {
    if (event.shiftKey && document.activeElement === $('resume')) { event.preventDefault(); $('exit').focus(); }
    else if (!event.shiftKey && document.activeElement === $('exit')) { event.preventDefault(); $('resume').focus(); }
  }
});
if ('serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('./sw.js').catch(() => { /* Optional offline installation; online gameplay remains available. */ });
