import { Hunt } from './game.js';
import { RunnerHunt } from './runner.js';
import { drawRunnerScene } from './world.js';
import { WallHunt, drawWallScene } from './wall.js';
import { drawInsect, isInsect } from './insects.js';
import { ManualHunt } from './manual.js';

const $ = id => document.getElementById(id);
const home = $('home'), play = $('play');
const preview = $('preview-canvas'), canvas = $('game-canvas');
const names = { mouse: 'ねずみ', bug: 'てんとうむし', feather: 'はね', ant: '小さなアリ', gnat: '小バエ', spider: '蜘蛛' };
const descriptions = { mouse: 'ちょこちょこ、かくれんぼ', bug: 'すいすい、きまぐれに', feather: 'ゆらゆら、ひらひら', ant: 'ちょろちょろ、急に方向転換', gnat: '小さく、すばしっこく', spider: '8本の脚で、すたすた' };
const speeds = ['ゆったり', 'すばやく', '猛ダッシュ'];
const stageNames = { flat: '平面の狩り場', runner: '奥行きダッシュ', wall: '壁のぼり' };
function createHunt(width, height) {
  if (controlChoice === 'manual') return new ManualHunt(width, height, { prey: selected, size: sizeChoice, stage: stageChoice });
  const Engine = stageChoice === 'wall' ? WallHunt : stageChoice === 'runner' ? RunnerHunt : Hunt;
  return new Engine(width, height, { prey: selected, speed, size: sizeChoice });
}
let selected = 'mouse', speed = 2, sceneChoice = 'meadow', stageChoice = 'flat', sizeChoice = 1, contrastChoice = true, controlChoice = 'auto', active = false, paused = false;
let game, previewGame, audio, wakeLock, last = performance.now(), elapsed = 0, nextBreak = 180, toastTimer;
let holdTimer, holdPointer, dragPointer, previewPointer;
try {
  const saved = JSON.parse(localStorage.getItem('pawplay-preferences') || '{}');
  if (Object.hasOwn(names, saved.prey)) selected = saved.prey;
  if ([1, 2, 3].includes(saved.speed)) speed = saved.speed;
  if (['meadow', 'night'].includes(saved.scene)) sceneChoice = saved.scene;
  if (['flat', 'runner', 'wall'].includes(saved.stage)) stageChoice = saved.stage;
  if ([.6, 1, 1.45].includes(saved.size)) sizeChoice = saved.size;
  if (typeof saved.contrast === 'boolean') contrastChoice = saved.contrast;
  if (saved.control === 'manual') controlChoice = 'manual';
  if (controlChoice === 'manual' && stageChoice === 'runner') stageChoice = 'flat';
  if (stageChoice === 'wall' && !isInsect(selected)) selected = 'spider';
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
previewGame = createHunt(size.width, size.height);
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
  c.scale(hunt.scale * (hunt.size ?? sizeChoice), hunt.scale * (hunt.size ?? sizeChoice));
  if (isInsect(hunt.prey)) {
    drawInsect(c, hunt.prey, { time: hunt.time, stride: hunt.stride || 0, night: !hunt.thumbnail && sceneChoice === 'night', contrast: contrastChoice });
    c.restore(); return;
  }
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
  if (hunt.mode === 'wall') { drawWallScene(c, hunt, { night: sceneChoice === 'night', drawPrey }); drawRipples(c, hunt); return; }
  if (hunt.mode === 'runner') {
    drawRunnerScene(c, hunt, { night: sceneChoice === 'night', drawPrey });
    drawRipples(c, hunt);
    return;
  }
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
  drawRipples(c, hunt);
  drawPrey(c, hunt);
}
function drawRipples(c, hunt) {
  for (const ripple of hunt.ripples) {
    c.globalAlpha = ripple.life / .7;
    c.strokeStyle = ripple.hit ? '#849d62' : '#aab794'; c.lineWidth = 1.5;
    c.beginPath(); c.arc(ripple.x, ripple.y, 10 + (1 - ripple.life / .7) * 46, 0, Math.PI * 2); c.stroke();
    if (ripple.hit) for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; const r = 18 + (.7 - ripple.life) * 48; ellipse(c, ripple.x + Math.cos(a) * r, ripple.y + Math.sin(a) * r, 2, 2, '#a2b47e'); }
    if (ripple.points) {
      c.fillStyle = sceneChoice === 'night' ? '#fff0b5' : '#354e37';
      c.font = '600 20px Georgia, serif'; c.textAlign = 'center';
      c.fillText(`+${ripple.points}`, ripple.x, ripple.y - 25 - (0.7 - ripple.life) * 35);
    }
    c.globalAlpha = 1;
  }
}

function formatTime(seconds) { return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`; }
function frame(now) {
  const dt = Math.min(Math.max((now - last) / 1000, 0), .05); last = now;
  if (!document.hidden) {
    if (!active) { previewGame.step(dt); scene(preview, previewGame, true); }
    else if (!paused) {
      game.step(dt); elapsed += dt; scene(canvas, game);
      $('session-time').textContent = formatTime(elapsed);
      if (!game.manual && game.mode !== 'flat') $('pass-count').textContent = `${game.missed} 通過`;
      if (elapsed >= nextBreak) { nextBreak += 180; pause(true); }
    }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function refreshSettings() {
  if (controlChoice === 'manual' && stageChoice === 'runner') stageChoice = 'flat';
  home.classList.toggle('manual-selected', controlChoice === 'manual');
  $('mirror-note').hidden = controlChoice !== 'manual';
  document.querySelectorAll('[data-control]').forEach(b => { const chosen = b.dataset.control === controlChoice; b.classList.toggle('selected', chosen); b.setAttribute('aria-pressed', String(chosen)); });
  if (stageChoice === 'wall' && !isInsect(selected)) selected = 'spider';
  home.classList.toggle('wall-selected', stageChoice === 'wall');
  if ((previewGame.mode || 'flat') !== stageChoice || !!previewGame.manual !== (controlChoice === 'manual')) { const rect = preview.getBoundingClientRect(); previewGame = createHunt(rect.width, rect.height); }
  document.querySelectorAll('[data-stage]').forEach(b => { const chosen = b.dataset.stage === stageChoice; b.classList.toggle('selected', chosen); b.setAttribute('aria-pressed', String(chosen)); b.disabled = controlChoice === 'manual' && b.dataset.stage === 'runner'; });
  $('stage-caption').textContent = stageNames[stageChoice];
  $('stage-note').textContent = controlChoice === 'manual' ? '画面をなぞって獲物を操作。平面・壁のステージで遊べます。奥行きダッシュは自動モードで。' : stageChoice === 'runner' ? '奥から迫る獲物を、通り過ぎる前にタッチ。遠くでつかまえると高得点！' : stageChoice === 'wall' ? '蜘蛛や小さな虫が、壁を不規則にのぼる。近くを触ると、さっと逃げる。' : '急に走る、止まる、くるっと曲がる。小さな虫の気まぐれを追いかけよう。';
  preview.parentElement.classList.toggle('wall-preview', stageChoice === 'wall');
  preview.parentElement.classList.toggle('runner-preview', stageChoice === 'runner');
  $('preview-instruction').textContent = stageChoice === 'runner' ? '奥から、こっちへ！' : 'あ、うごいた。';
  previewGame.prey = selected; previewGame.speed = speed; previewGame.size = sizeChoice;
  document.querySelectorAll('.friend').forEach(b => { const chosen = b.dataset.prey === selected; b.classList.toggle('selected', chosen); b.setAttribute('aria-pressed', String(chosen)); b.disabled = stageChoice === 'wall' && !isInsect(b.dataset.prey); });
  document.querySelectorAll('.scene-option').forEach(b => { const chosen = b.dataset.scene === sceneChoice; b.classList.toggle('selected', chosen); b.setAttribute('aria-pressed', String(chosen)); });
  $('speed').value = speed; $('speed').setAttribute('aria-valuetext', speeds[speed - 1]);
  $('speed-label').textContent = controlChoice === 'manual' ? '指で操作' : speeds[speed - 1];
  $('speed').disabled = controlChoice === 'manual';
  $('friend-caption').textContent = names[selected];
  $('prey-tag').textContent = descriptions[selected];
  $('scene-name').textContent = `${{ flat: '01', runner: '02', wall: '03' }[stageChoice]} / ${stageNames[stageChoice]}`;
  preview.parentElement.classList.toggle('night-preview', sceneChoice === 'night');
  $('launch-prey').textContent = `${names[selected]}とあそぶ`;
  $('launch-detail').textContent = `${stageChoice === 'runner' ? '奥行き' : stageChoice === 'wall' ? '壁のぼり' : '平面'} · ${controlChoice === 'manual' ? '指で操作' : speeds[speed - 1]} · ${$('sound').checked ? '音あり' : '音なし'}`;
  for (const b of document.querySelectorAll('[data-size]')) { const chosen = Number(b.dataset.size) === sizeChoice; b.classList.toggle('selected', chosen); b.setAttribute('aria-pressed', String(chosen)); }
  for (const b of document.querySelectorAll('[data-contrast]')) { const chosen = (b.dataset.contrast === 'high') === contrastChoice; b.classList.toggle('selected', chosen); b.setAttribute('aria-pressed', String(chosen)); }
  $('contrast-description').textContent = contrastChoice ? sceneChoice === 'night' ? '暗い背景に、淡い色の虫。小さくてもくっきり。' : '明るい背景に、黒い虫。小さくてもくっきり。' : '茶色の体で、背景に少しなじむ見え方。';
  document.querySelector('[data-scene=meadow] strong').textContent = stageChoice === 'wall' ? '明るい壁' : 'こもれびの草原';
  document.querySelector('[data-scene=night] strong').textContent = stageChoice === 'wall' ? '暗い壁' : '月あかりの庭';
  renderThumbnails();
  $('sound-description').textContent = $('sound').checked ? 'そっと音をならす' : '静かにあそぶ';
  try { localStorage.setItem('pawplay-preferences', JSON.stringify({ prey: selected, speed, scene: sceneChoice, stage: stageChoice, size: sizeChoice, contrast: contrastChoice, control: controlChoice, sound: $('sound').checked })); } catch { /* Gameplay works without storage. */ }
}
refreshSettings();
// Render the same custom illustrations in the cards and in the game.
function renderThumbnails() {
  for (const thumbnail of document.querySelectorAll('[data-drawing]')) {
    const c = thumbnail.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, thumbnail.width, thumbnail.height);
    c.scale(1.3, 1.3);
    drawPrey(c, { x: 57, y: 39, angle: -.3, scale: ['ant', 'gnat'].includes(thumbnail.dataset.drawing) ? 1.8 : 1, size: 1, thumbnail: true, time: 0, prey: thumbnail.dataset.drawing });
  }
}
document.querySelectorAll('[data-control]').forEach(b => b.addEventListener('click', () => { controlChoice = b.dataset.control; refreshSettings(); }));
document.querySelectorAll('[data-size]').forEach(b => b.addEventListener('click', () => { sizeChoice = Number(b.dataset.size); refreshSettings(); }));
document.querySelectorAll('[data-contrast]').forEach(b => b.addEventListener('click', () => { contrastChoice = b.dataset.contrast === 'high'; refreshSettings(); }));
document.querySelectorAll('[data-stage]').forEach(button => button.addEventListener('click', () => { stageChoice = button.dataset.stage; refreshSettings(); }));
document.querySelectorAll('.friend').forEach(button => button.addEventListener('click', () => { selected = button.dataset.prey; refreshSettings(); }));
document.querySelectorAll('.scene-option').forEach(button => button.addEventListener('click', () => { sceneChoice = button.dataset.scene; refreshSettings(); }));
$('speed').addEventListener('input', event => { speed = Number(event.target.value); refreshSettings(); });
$('sound').addEventListener('change', refreshSettings);
function pointFromEvent(surface, hunt, event) {
  const rect = surface.getBoundingClientRect();
  hunt.point((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
}
preview.addEventListener('pointerdown', event => {
  if (active || event.isPrimary === false) return;
  event.preventDefault();
  if (previewGame.manual) { previewPointer = event.pointerId; preview.setPointerCapture(event.pointerId); pointFromEvent(preview, previewGame, event); }
  else { const rect = preview.getBoundingClientRect(); previewGame.tap(event.clientX - rect.left, event.clientY - rect.top); }
  preview.parentElement.classList.add('touched');
});
preview.addEventListener('pointermove', event => { if (previewGame.manual && event.pointerId === previewPointer) pointFromEvent(preview, previewGame, event); });
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) preview.addEventListener(type, () => { previewPointer = undefined; });

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
  const rect = fit(canvas); game = createHunt(rect.width, rect.height);
  const runner = stageChoice !== 'flat' && !game.manual;
  $('manual-tools').hidden = !game.manual; $('catch-count').hidden = !!game.manual;
  $('hide-prey').setAttribute('aria-pressed', 'false'); $('hide-prey').textContent = 'かくす';
  $('fullscreen').hidden = !game.manual || !document.documentElement.requestFullscreen;
  dragPointer = undefined;
  $('score-display').hidden = !runner; $('pass-count').hidden = !runner; $('pause-score-stat').hidden = !runner;
  $('score-value').textContent = '0'; $('pass-count').textContent = '0 通過';
  $('stage-badge').textContent = stageNames[stageChoice];
  document.querySelector('.session-stats').classList.toggle('has-score', runner);
  scene(canvas, game); toast(game.manual ? '指でなぞると獲物が動きます。指を離すとストップ' : stageChoice === 'runner' ? '通り過ぎる前にタッチ！ 遠くでキャッチすると高得点' : '獲物をタッチしてみよう', 3500);
  document.body.style.overflow = 'hidden'; keepAwake(); $('pause').focus({ preventScroll: true });
});
canvas.addEventListener('pointerdown', event => {
  if (!active || paused || event.isPrimary === false) return;
  event.preventDefault();
  if (game.manual) { dragPointer = event.pointerId; canvas.setPointerCapture(event.pointerId); pointFromEvent(canvas, game, event); return; }
  const rect = canvas.getBoundingClientRect();
  if (game.tap(event.clientX - rect.left, event.clientY - rect.top)) { $('catch-count').textContent = `${game.catches} キャッチ`; if (game.mode !== 'flat') $('score-value').textContent = game.score; chime(); }
});
canvas.addEventListener('pointermove', event => { if (active && !paused && game.manual && event.pointerId === dragPointer) { event.preventDefault(); pointFromEvent(canvas, game, event); } });
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(type, () => { dragPointer = undefined; });
$('hide-prey').addEventListener('click', () => {
  if (!active || paused || !game.manual) return;
  game.hide(game.visible); $('hide-prey').setAttribute('aria-pressed', String(!game.visible)); $('hide-prey').textContent = game.visible ? 'かくす' : '出す';
});
$('fullscreen').addEventListener('click', async () => {
  try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); else await document.exitFullscreen(); }
  catch { toast('このブラウザでは全画面に切り替えられません'); }
});
function pause(isBreak = false) {
  if (!active || paused) return;
  dragPointer = undefined; cancelHold(); paused = true; releaseWakeLock(); clearTimeout(toastTimer); $('play-toast').classList.add('faded');
  $('pause-title').textContent = isBreak ? 'そろそろ、ひとやすみ。' : 'ひとやすみ。';
  $('pause-message').textContent = isBreak ? '3分あそびました。少し休んだり、本物のおもちゃでも遊んでみてね。' : 'また気になったら、つづきをどうぞ。';
  $('pause-catches').parentElement.hidden = !!game.manual;
  document.querySelector('.session-stats').classList.toggle('manual-stats', !!game.manual);
  $('pause-catches').textContent = game.catches; $('pause-score').textContent = game.score || 0; $('pause-time').textContent = formatTime(elapsed);
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
  dragPointer = undefined; cancelHold(); active = false; paused = false; releaseWakeLock(); play.hidden = true; $('pause-panel').hidden = true; $('pause').disabled = false;
  home.hidden = false; document.querySelector('.brand').hidden = false; document.body.style.overflow = ''; fit(preview, previewGame); $('start').focus({ preventScroll: true });
});
$('mirror-help').addEventListener('click', () => $('mirror-dialog').showModal());
$('mirror-close').addEventListener('click', () => $('mirror-dialog').close());
$('mirror-done').addEventListener('click', () => $('mirror-dialog').close());
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
