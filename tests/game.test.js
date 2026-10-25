import test from 'node:test';
import assert from 'node:assert/strict';
import { Hunt } from '../game.js';

function rng(seed = 71) { return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646; }
test('a catch counts once and the prey returns after a short interval', () => {
  const game = new Hunt(390, 844, { random: rng() });
  assert.equal(game.tap(game.x, game.y), true);
  assert.equal(game.catches, 1);
  assert.equal(game.tap(game.x, game.y), false);
  for (let i = 0; i < 35; i++) game.step(.05);
  assert.equal(game.phase, 'moving');
  assert.ok(game.scale > .5);
  assert.equal(game.tap(game.x, game.y), true);
  assert.equal(game.catches, 2);
});
test('all prey types move, wait, hide, and remain inside a phone screen', () => {
  for (const prey of ['mouse', 'bug', 'feather']) {
    const game = new Hunt(320, 568, { prey, speed: 3, random: rng() });
    const phases = new Set();
    let distance = 0;
    for (let i = 0; i < 12000; i++) {
      const x = game.x, y = game.y;
      game.step(.05); phases.add(game.phase); distance += Math.hypot(x - game.x, y - game.y);
      assert.ok(game.x >= 0 && game.x <= 320 && game.y >= 0 && game.y <= 568);
      if (game.phase === 'hidden') assert.equal(game.tap(game.x, game.y), false);
    }
    assert.ok(distance > 1000);
    for (const phase of ['moving', 'waiting', 'hidden']) assert.ok(phases.has(phase));
  }
});
test('a near miss makes resting prey move and resize keeps it inside the viewport', () => {
  const game = new Hunt(844, 390, { random: rng() });
  game.phase = 'waiting';
  assert.equal(game.tap(0, 0), false);
  assert.equal(game.phase, 'moving');
  game.resize(390, 844);
  assert.ok(game.x >= 0 && game.x <= 390 && game.y >= 0 && game.y <= 844);
});
