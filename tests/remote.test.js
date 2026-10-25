import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCode, roomCode, peerId, packet, settings } from '../remote-protocol.js';
const config = { prey: 'string', stage: 'wall', scene: 'night', size: 1, contrast: true };
test('pairing codes are generated from secure random bytes and can be entered with spaces', () => {
  const values = new Set(Array.from({ length: 200 }, () => roomCode()));
  assert.equal(values.size, 200);
  for (const code of values) assert.equal(parseCode(code), code);
  assert.equal(parseCode('abcd efgh'), 'ABCDEFGH'); assert.equal(peerId('ABCDEFGH'), 'pawplay-tv-abcdefgh');
  for (const value of [null, '', 'ABCD0FGH', '<script>', 'ABCDEFGH123']) assert.equal(parseCode(value), null);
});
test('movement packets are bounded and malformed or unknown commands are rejected', () => {
  assert.deepEqual(packet({ v: 1, type: 'move', u: 2, vPos: -3 }), { v: 1, type: 'move', u: 1, vPos: 0 });
  for (const value of [null, 'move', { v: 2, type: 'ping' }, { v: 1, type: 'move', u: NaN, vPos: 0 }, { v: 1, type: 'move', u: .2, vPos: '1' }, { v: 1, type: 'arbitrary' }, { v: 1, type: 'hide', hidden: 'false' }]) assert.equal(packet(value), null);
});
test('remote settings allow all seven prey while guarding incompatible stages', () => {
  assert.deepEqual(settings({ ...config, ignored: 'discard' }), config);
  assert.equal(settings({ ...config, prey: 'mouse' }), null);
  assert.equal(settings({ ...config, stage: 'runner' }), null);
  assert.equal(settings({ ...config, size: 99999 }), null);
  assert.equal(settings({ ...config, prey: '__proto__' }), null);
  for (const prey of ['mouse', 'bug', 'feather', 'ant', 'gnat', 'spider', 'string']) assert.ok(settings({ ...config, stage: 'flat', prey }));
});
test('state packets preserve authoritative pause and visibility for reconnects', () => {
  const state = { v: 1, type: 'welcome', settings: config, paused: true, visible: false };
  assert.deepEqual(packet(state), state);
  assert.equal(packet({ ...state, paused: 'yes' }), null);
});
