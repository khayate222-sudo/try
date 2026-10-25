export const PREY = Object.freeze({ mouse: 'ねずみ', bug: 'てんとうむし', feather: 'はね', ant: '小さなアリ', gnat: '小バエ', spider: '蜘蛛', string: 'ひらひら紐' });
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function roomCode(cryptoSource = globalThis.crypto) {
  return [...cryptoSource.getRandomValues(new Uint8Array(8))].map(n => CODE_ALPHABET[n % 32]).join('');
}
export function parseCode(value) {
  if (typeof value !== 'string') return null;
  const code = value.toUpperCase().replace(/[\s-]/g, '');
  return code.length === 8 && [...code].every(c => CODE_ALPHABET.includes(c)) ? code : null;
}
export const peerId = code => `pawplay-tv-${code.toLowerCase()}`;
export function settings(value) {
  if (!value || !Object.hasOwn(PREY, value.prey) || !['flat', 'wall'].includes(value.stage) || !['meadow', 'night'].includes(value.scene) || ![.6, 1, 1.45].includes(value.size) || typeof value.contrast !== 'boolean') return null;
  if (value.stage === 'wall' && ['mouse', 'feather'].includes(value.prey)) return null;
  return { prey: value.prey, stage: value.stage, scene: value.scene, size: value.size, contrast: value.contrast };
}
export function packet(value) {
  if (!value || typeof value !== 'object' || value.v !== 1) return null;
  switch (value.type) {
    case 'hello': case 'ping': case 'pong': return { v: 1, type: value.type };
    case 'move': return Number.isFinite(value.u) && Number.isFinite(value.vPos) ? { v: 1, type: 'move', u: Math.max(0, Math.min(1, value.u)), vPos: Math.max(0, Math.min(1, value.vPos)) } : null;
    case 'hide': return typeof value.hidden === 'boolean' ? { v: 1, type: 'hide', hidden: value.hidden } : null;
    case 'pause': return typeof value.paused === 'boolean' ? { v: 1, type: 'pause', paused: value.paused } : null;
    case 'settings': { const config = settings(value.settings); return config ? { v: 1, type: 'settings', settings: config } : null; }
    case 'state': case 'welcome': {
      const config = settings(value.settings);
      return config && typeof value.paused === 'boolean' && typeof value.visible === 'boolean' ? { v: 1, type: value.type, settings: config, paused: value.paused, visible: value.visible } : null;
    }
    default: return null;
  }
}
