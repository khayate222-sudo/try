import test from 'node:test';
import assert from 'node:assert/strict';
import { ManualHunt } from '../manual.js';

function advance(game, seconds) { for (let i = 0; i < seconds * 60; i++) game.step(1 / 60); }
test('prey follows a finger quickly, stops on release, and never moves by itself', () => {
  const game = new ManualHunt(390, 844);
  advance(game, 3); assert.equal(game.x, 195); assert.equal(game.y, 422);
  game.point(.8, .3); advance(game, .1);
  assert.ok(Math.abs(game.x - 312) < 10 && Math.abs(game.y - 253.2) < 12);
  advance(game, 1); const stride = game.stride;
  advance(game, 3);
  assert.ok(Math.abs(game.stride - stride) < .001);
  assert.equal(game.catches, 0);
});
test('hide and reappear preserves the controlled position without adding catches', () => {
  const game = new ManualHunt(390, 844, { stage: 'wall', prey: 'spider' });
  game.hide(true); game.point(.7, .7); advance(game, 1);
  assert.equal(game.targets.length, 0);
  assert.ok(Math.abs(game.x - 273) < .01);
  game.hide(false); advance(game, 1);
  assert.equal(game.targets.length, 1);
  assert.ok(game.project().scale > .99);
  assert.equal(game.tap(195, 422), false); assert.equal(game.score, 0);
});
test('rotation keeps normalized finger position and points stay inside visible bounds', () => {
  const game = new ManualHunt(390, 844); game.point(.8, .3); advance(game, 1);
  game.resize(844, 390); advance(game, 1);
  assert.ok(Math.abs(game.x - 675.2) < .01 && Math.abs(game.y - 117) < .01);
  game.point(NaN, Infinity); advance(game, .1); assert.ok(Number.isFinite(game.x));
  game.point(-3, 5); advance(game, 1);
  assert.ok(game.x >= 24.9 && game.y <= 332);
});
