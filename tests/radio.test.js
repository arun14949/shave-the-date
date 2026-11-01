import test from 'node:test';
import assert from 'node:assert/strict';
import { SONGS, songIndexAt, openingTimeAt, createShuffleBag, songAudioUrl } from '../src/barbershop-radio.js';

test('chapter boundaries select the song that is actually playing', () => {
  assert.equal(SONGS.length, 20);
  for (let index = 0; index < SONGS.length; index++) {
    const [, start] = SONGS[index];
    assert.equal(songIndexAt(start), index);
    if (index > 0) assert.equal(songIndexAt(start - 1), index - 1);
  }
});

test('every chapter maps to two half-song files for instant midpoint playback', () => {
  for (let index = 0; index < SONGS.length; index++) {
    for (let half = 0; half < 2; half++) {
      const url = songAudioUrl(index, half);
      assert.match(url, /^\/assets\/music\/song-\d\d-[ab]\.mp3$/);
    }
    assert.notEqual(songAudioUrl(index, 0), songAudioUrl(index, 1));
  }
});

test('opening the barbershop starts inside a song, away from chapter boundaries', () => {
  for (let index = 0; index < SONGS.length - 1; index++) {
    const start = SONGS[index][1];
    const end = SONGS[index + 1][1];
    const opening = openingTimeAt(index, .5);
    assert.ok(opening > start + 30);
    assert.ok(opening < end - 30);
    assert.equal(songIndexAt(opening), index);
  }
  assert.equal(openingTimeAt(SONGS.length - 1, .5, 7300), 7144);
});

test('shuffle plays every chapter once before repeating and avoids an immediate replay', () => {
  const bag = createShuffleBag(SONGS.length, () => .5);
  const firstRun = [bag.next(0), ...Array.from({ length: SONGS.length - 1 }, () => bag.next())];
  assert.notEqual(firstRun[0], 0);
  assert.equal(new Set(firstRun).size, SONGS.length);
  const next = bag.next(firstRun.at(-1));
  assert.notEqual(next, firstRun.at(-1));
});
