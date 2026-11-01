import test from 'node:test';
import assert from 'node:assert/strict';
import { createBarberHaptics } from '../src/barber-haptics.js';

test('trimmer vibrates continuously with longer pulses until released', () => {
  const calls = [];
  let repeat;
  let cancelled = false;
  const haptics = createBarberHaptics({
    vibrate: pattern => calls.push(pattern),
    schedule: callback => { repeat = callback; return 1; },
    cancel: () => { cancelled = true; },
  });
  haptics.start('trimmer');
  assert.deepEqual(calls.at(-1), [90, 25, 90, 25, 90]);
  repeat();
  assert.deepEqual(calls.at(-1), [90, 25, 90, 25, 90]);
  haptics.stop();
  assert.equal(cancelled, true);
  assert.equal(calls.at(-1), 0);
});

test('scissors and blade give shorter, throttled feedback only while cutting', () => {
  const calls = [];
  let time = 0;
  const haptics = createBarberHaptics({ vibrate: pattern => calls.push(pattern), now: () => time });
  haptics.start('scissors');
  haptics.cut('scissors');
  assert.equal(calls.at(-1), 18);
  time = 50;
  haptics.cut('scissors');
  assert.equal(calls.filter(pattern => pattern === 18).length, 1);
  time = 120;
  haptics.cut('scissors');
  assert.equal(calls.filter(pattern => pattern === 18).length, 2);
  haptics.start('blade');
  haptics.cut('scissors');
  assert.equal(calls.at(-1), 0);
  haptics.cut('blade');
  assert.deepEqual(calls.at(-1), [25, 15, 20]);
  haptics.stop();
});

test('devices without vibration support keep the game usable', () => {
  const haptics = createBarberHaptics({ vibrate: null });
  assert.doesNotThrow(() => { haptics.start('trimmer'); haptics.cut('blade'); haptics.stop(); });
});
