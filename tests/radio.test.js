import test from 'node:test';
import assert from 'node:assert/strict';
import { SONGS, songIndexAt, createShuffleBag } from '../src/barbershop-radio.js';

test('YouTube chapter boundaries select the song that is actually playing', () => {
  assert.equal(SONGS.length, 20);
  for (let index = 0; index < SONGS.length; index++) {
    const [, start] = SONGS[index];
    assert.equal(songIndexAt(start), index);
    if (index > 0) assert.equal(songIndexAt(start - 1), index - 1);
  }
});

test('shuffle plays every chapter once before repeating and avoids an immediate replay', () => {
  const bag = createShuffleBag(SONGS.length, () => .5);
  const firstRun = Array.from({ length: SONGS.length }, () => bag.next());
  assert.equal(new Set(firstRun).size, SONGS.length);
  const next = bag.next(firstRun.at(-1));
  assert.notEqual(next, firstRun.at(-1));
});
