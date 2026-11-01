import test from 'node:test';
import assert from 'node:assert/strict';
import { verdictFor } from '../src/verdict.js';

test('the random allotment is weighted by barbering and always has a funny status', () => {
  const low = () => .01;
  const high = () => .99;
  for (const progress of [0, 50, 92, 100]) {
    for (const cuts of [0, 1]) {
      assert.equal(verdictFor(progress, cuts, low).invited, true);
      assert.equal(verdictFor(progress, cuts, high).invited, false);
      assert.ok(verdictFor(progress, cuts, low).copy.length > 20);
    }
  }
  assert.equal(verdictFor(100, 0, () => .5).invited, true);
  assert.equal(verdictFor(100, 1, () => .5).invited, false);
});
