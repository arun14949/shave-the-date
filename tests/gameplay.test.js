import test from 'node:test';
import assert from 'node:assert/strict';
import { createPhotoGame, GRID_STEP, bladeFootprint, trimmerDepth } from '../src/photo-game.js';

function masks() {
  const width = 1086, height = 1448;
  const beard = new Uint8ClampedArray(width * height * 4);
  const hair = new Uint8ClampedArray(width * height * 4);
  for (let y = 565; y < 1265; y++) for (let x = 160; x < 925; x++) beard[(y * width + x) * 4 + 3] = 255;
  for (let y = 80; y < 560; y++) for (let x = 180; x < 900; x++) hair[(y * width + x) * 4 + 3] = 255;
  hair[(650 * width + 230) * 4 + 3] = 255;
  hair[(650 * width + 830) * 4 + 3] = 255;
  // An isolated pixel must still belong to an interaction tile.
  beard[(545 * width + 932) * 4 + 3] = 12;
  return createPhotoGame(beard, width, height, hair);
}

test('the beard advances one layer per drag and can be fully cleared', () => {
  const game = masks();
  assert.ok(game.cellCount > 0);
  assert.ok(game.stroke(500, 900, 'trimmer', 140, 1).thick.length > 0);
  assert.equal(game.stroke(500, 900, 'trimmer', 140, 1).full.length, 0);
  const firstPass = game.progress();
  assert.ok(game.stroke(500, 900, 'trimmer', 140, 2).full.length > 0);
  assert.ok(game.progress() > firstPass);
  assert.ok(game.stroke(500, 900, 'blade', 140, 3).short.length > 0);
  assert.equal(game.nearbyBare(500, 900), true);
  assert.equal(game.addCut(500, 300), false);
  assert.equal(game.addCut(500, 900), true);
  game.reset();
  assert.equal(game.progress(), 0);
  assert.equal(game.cutCount, 0);
});

test('scissors stop at medium hair, trimmer stops at short hair, and only the blade reveals scalp', () => {
  const game = masks();
  assert.ok(game.hairCellCount > 0);
  assert.ok(game.stroke(500, 250, 'scissors', 45, 1).longHair.length > 0);
  assert.equal(game.stroke(500, 250, 'scissors', 45, 2).mediumHair.length, 0);
  assert.ok(game.stroke(500, 250, 'trimmer', 45, 3).mediumHair.length > 0);
  assert.equal(game.stroke(500, 250, 'trimmer', 45, 4).buzzHair.length, 0);
  assert.ok(game.stroke(500, 250, 'blade', 45, 5).buzzHair.length > 0);
  assert.equal(game.stroke(500, 250, 'blade', 45, 6).buzzHair.length, 0);
  assert.ok(game.stroke(220, 610, 'trimmer', 45, 6).thick.length > 0);
});

test('trimmer guards progressively uncover four hair lengths without exposing bald scalp', () => {
  const game = masks();
  const stroke = (tool, id, guard) => game.stroke(500, 250, tool, 40, id, guard);
  const four = stroke('trimmer', 1, 4);
  assert.ok(four.longHair.length > 0);
  assert.equal(four.mediumHair.length, 0);
  const three = stroke('trimmer', 2, 3);
  assert.ok(three.mediumHair.length > 0);
  assert.equal(three.shortHair.length, 0);
  const two = stroke('trimmer', 3, 2);
  assert.ok(two.shortHair.length > 0);
  assert.equal(two.stubbleHair.length, 0);
  const one = stroke('trimmer', 4, 1);
  assert.ok(one.stubbleHair.length > 0);
  assert.equal(one.buzzHair.length, 0);
  assert.equal(one.fineHair.length, 0);
  assert.equal(stroke('trimmer', 5, 4).longHair.length, 0);
  assert.equal(stroke('trimmer', 6, 1).stubbleHair.length, 0);
  assert.ok(stroke('blade', 7).fineHair.length > 0);
});

test('the same guard setting takes a thick beard to its chosen length in one pass', () => {
  const game = masks();
  const one = game.stroke(500, 900, 'trimmer', 40, 1, 1);
  assert.ok(one.thick.length > 0);
  assert.ok(one.full.length > 0);
  assert.ok(one.beardGuardShort.length > 0);
  assert.equal(game.nearbyBare(500, 900), false);
  assert.equal(game.stroke(500, 900, 'trimmer', 40, 2, 4).beardGuardShort.length, 0);
  assert.ok(game.stroke(500, 900, 'blade', 40, 3).short.length > 0);
});

test('scissors can cut temple hair above either ear', () => {
  const game = masks();
  for (const [x, strokeId] of [[245, 1], [830, 2]]) {
    const first = game.stroke(x, 545, 'scissors', 12, strokeId);
    assert.ok(first.longHair.some(cell => Math.abs(cell.x - x) <= 12 && cell.y >= 530));
    assert.equal(game.stroke(x, 545, 'scissors', 12, strokeId + 2).longHair.length, 0);
    assert.ok(game.stroke(x, 545, 'trimmer', 12, strokeId + 4).mediumHair.length > 0);
  }
});

test('trimming a short-hair root detaches its top strands beyond the brush', () => {
  const width = 1086, height = 1448;
  const beard = new Uint8ClampedArray(width * height * 4);
  const hair = new Uint8ClampedArray(width * height * 4);
  const buzz = new Uint8ClampedArray(width * height * 4);
  for (let y = 90; y < 310; y++) for (let x = 480; x < 540; x++) {
    hair[(y * width + x) * 4 + 3] = 255;
    if (y >= 200) buzz[(y * width + x) * 4 + 3] = 255;
  }
  const game = createPhotoGame(beard, width, height, hair, null, null, buzz);
  game.stroke(510, 215, 'trimmer', 38, 1);
  const cut = game.stroke(510, 215, 'trimmer', 38, 2);
  assert.ok(cut.hairFringe.some(cell => cell.y < 175));
  assert.equal(game.stroke(510, 125, 'trimmer', 20, 3).longHair.length, 0);
});

test('a 3 mm guard releases outer strands when their scalp root is cut', () => {
  const width = 1086, height = 1448;
  const hair = new Uint8ClampedArray(width * height * 4);
  const buzz = new Uint8ClampedArray(width * height * 4);
  for (let y = 90; y < 310; y++) for (let x = 480; x < 540; x++) {
    hair[(y * width + x) * 4 + 3] = 255;
    if (y >= 200) buzz[(y * width + x) * 4 + 3] = 255;
  }
  const game = createPhotoGame(null, width, height, hair, null, null, buzz);
  const cut = game.stroke(510, 215, 'trimmer', 38, 1, 3);
  assert.ok(cut.hairFringe.some(cell => cell.y < 175));
  assert.ok(cut.hairFringe.every(cell => cell.state >= 2));
});

test('a 4 mm guard takes three passes before releasing outer strands', () => {
  const width = 1086, height = 1448;
  const hair = new Uint8ClampedArray(width * height * 4);
  const buzz = new Uint8ClampedArray(width * height * 4);
  for (let y = 90; y < 310; y++) for (let x = 480; x < 540; x++) {
    hair[(y * width + x) * 4 + 3] = 255;
    if (y >= 200) buzz[(y * width + x) * 4 + 3] = 255;
  }
  const game = createPhotoGame(null, width, height, hair, null, null, buzz);
  const first = game.stroke(510, 215, 'trimmer', 38, 1, 4);
  assert.ok(first.longHair.length > 0);
  assert.ok(first.longHair.every(cell => cell.fourMmPasses === 1 && cell.state === 0));
  assert.equal(first.hairFringe.length, 0);
  assert.equal(game.stroke(510, 215, 'trimmer', 38, 1, 4).longHair.length, 0);
  const second = game.stroke(510, 215, 'trimmer', 38, 2, 4);
  assert.ok(second.longHair.every(cell => cell.fourMmPasses === 2 && cell.state === 0));
  assert.equal(second.hairFringe.length, 0);
  const cut = game.stroke(510, 215, 'trimmer', 38, 3, 4);
  assert.ok(cut.longHair.some(cell => cell.fourMmPasses === 3 && cell.state >= 1));
  assert.ok(cut.fourMmFinished.length > 0);
  assert.equal(cut.mediumHair.length, 0);
  assert.ok(cut.hairFringe.some(cell => cell.y < 175));
  assert.equal(game.stroke(510, 125, 'scissors', 20, 4).longHair.length, 0);
});

test('moving away and back counts a new 4 mm pass within one drag', () => {
  const game = masks();
  const first = game.stroke(500, 250, 'trimmer', 40, 1, 4);
  assert.ok(first.longHair.length > 0);
  assert.equal(game.stroke(500, 250, 'trimmer', 40, 1, 4).longHair.length, 0);
  game.stroke(850, 1050, 'trimmer', 40, 1, 4);
  const second = game.stroke(500, 250, 'trimmer', 40, 1, 4);
  assert.ok(second.longHair.some(cell => cell.fourMmPasses === 2));
});

test('a suspended hair patch drops when its last stem is trimmed', () => {
  const width = 1086, height = 1448;
  const hair = new Uint8ClampedArray(width * height * 4);
  const buzz = new Uint8ClampedArray(width * height * 4);
  const face = new Uint8ClampedArray(width * height * 4);
  const paint = (pixels, left, top, right, bottom, alpha = 255) => {
    for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) pixels[(y * width + x) * 4 + 3] = alpha;
  };
  paint(hair, 470, 180, 550, 216);
  paint(hair, 505, 216, 517, 311);
  paint(buzz, 500, 275, 522, 311);
  // A separate rooted lock should survive the cleanup.
  paint(hair, 640, 180, 705, 311);
  paint(buzz, 640, 275, 705, 311);
  for (let y = 275; y < 311; y++) for (let x of [...Array.from({ length: 22 }, (_, index) => 500 + index), ...Array.from({ length: 65 }, (_, index) => 640 + index)]) {
    const pixel = (y * width + x) * 4;
    face[pixel] = 160; face[pixel + 1] = 105; face[pixel + 2] = 80;
  }
  const game = createPhotoGame(null, width, height, hair, null, face, buzz);
  game.stroke(511, 246, 'trimmer', 12, 1);
  assert.equal(game.pruneFloatingHair().length, 0);
  game.stroke(511, 246, 'trimmer', 12, 2);
  const detached = game.pruneFloatingHair();
  assert.ok(detached.some(cell => cell.x < 550 && cell.y < 216));
  assert.ok(detached.every(cell => cell.x < 600));
  assert.equal(game.stroke(510, 195, 'scissors', 8, 3).longHair.length, 0);
  assert.ok(game.stroke(670, 195, 'scissors', 8, 4).longHair.length > 0);
});

test('the selected blade clears thick beard and long scalp hair in one pass', () => {
  const game = masks();
  assert.equal(game.tryBladeCut(500, 900, 1, () => 0), false);
  const beard = game.stroke(500, 900, 'blade', 45, 1);
  assert.ok(beard.thick.length > 0);
  assert.ok(beard.beardRetouch.thick.length > 0);
  assert.ok(beard.beardRetouch.full.length > 0);
  assert.ok(beard.beardRetouch.short.length > 0);
  assert.equal(game.nearbyBare(500, 900), true);
  assert.equal(game.tryBladeCut(500, 900, 1, () => 0), false);
  const scalp = game.stroke(500, 250, 'blade', 45, 2);
  assert.ok(scalp.longHair.length > 0);
  assert.ok(scalp.mediumHair.length > 0);
  assert.ok(scalp.buzzHair.length > 0);
  assert.equal(game.stroke(500, 250, 'blade', 45, 3).longHair.length, 0);
});

test('scissors stay circular while the trimmer follows its rounded-square preview', () => {
  const game = masks();
  const center = { x: 500, y: 525 };
  const radius = 60;
  const scissors = game.stroke(center.x, center.y, 'scissors', radius, 1);
  const trimmer = game.stroke(center.x, center.y, 'trimmer', radius, 2);
  assert.ok(scissors.longHair.length > 0);
  assert.ok(trimmer.thick.length > 0);
  for (const cell of scissors.longHair) {
    const farthestX = Math.abs(cell.x - center.x) + GRID_STEP / 2;
    const farthestY = Math.abs(cell.y - center.y) + GRID_STEP / 2;
    assert.ok(Math.hypot(farthestX, farthestY) <= radius);
  }
  for (const cell of trimmer.thick) {
    assert.ok(trimmerDepth(cell.x, cell.y, center.x, center.y, radius) >= GRID_STEP * Math.SQRT2 / 2);
  }
  const scalp = game.stroke(500, 250, 'trimmer', radius, 3);
  assert.ok(scalp.longHair.some(cell => Math.hypot(cell.x - 500, cell.y - 250) > radius));
  assert.ok(game.stroke(500, 200, 'scissors', 12, 3).longHair.length > 0);
});

test('scissors cut thick beard once and leave a shorter layer for the trimmer', () => {
  const game = masks();
  const center = { x: 500, y: 900 };
  const radius = 60;
  const first = game.stroke(center.x, center.y, 'scissors', radius, 1);
  assert.ok(first.thick.length > 0);
  assert.ok(first.beardRetouch.thick.length > 0);
  assert.equal(first.beardRetouch.full.length, 0);
  for (const cell of first.thick) {
    const farthestX = Math.abs(cell.x - center.x) + GRID_STEP / 2;
    const farthestY = Math.abs(cell.y - center.y) + GRID_STEP / 2;
    assert.ok(Math.hypot(farthestX, farthestY) <= radius);
  }
  const second = game.stroke(center.x, center.y, 'scissors', radius, 2);
  assert.equal(second.thick.length, 0);
  assert.equal(second.full.length, 0);
  const trimmed = game.stroke(center.x, center.y, 'trimmer', radius, 3);
  assert.ok(trimmed.full.length > 0);
  assert.ok(trimmed.beardRetouch.full.length > 0);
});

test('blade removes hair and beard within a rectangle, including its corners', () => {
  const game = masks();
  const radius = 45;
  const { halfWidth, halfHeight } = bladeFootprint(radius);
  const beard = game.stroke(500, 900, 'blade', radius, 1);
  const hair = game.stroke(500, 250, 'blade', radius, 2);
  for (const [cells, centerY] of [[beard.thick, 900], [hair.buzzHair, 250]]) {
    assert.ok(cells.some(cell => Math.abs(cell.x - 500) > radius && Math.abs(cell.y - centerY) > radius * .3));
    for (const cell of cells) {
      assert.ok(Math.abs(cell.x - 500) + GRID_STEP / 2 <= halfWidth);
      assert.ok(Math.abs(cell.y - centerY) + GRID_STEP / 2 <= halfHeight);
    }
  }
});

test('a beard edge strengthens toward the brush center without repeated-stamp buildup', () => {
  const game = masks();
  const first = game.stroke(500, 900, 'trimmer', 80, 1);
  const fringe = first.beardRetouch.thick.find(cell => cell.strength > .02 && cell.strength < .8);
  assert.ok(fringe);
  const centered = game.stroke(fringe.x, fringe.y, 'trimmer', 80, 1);
  assert.ok(centered.beardRetouch.thick.some(cell => cell.x === fringe.x && cell.y === fringe.y));
  assert.equal(centered.full.length, 0);
  assert.equal(game.stroke(fringe.x, fringe.y, 'trimmer', 80, 1).beardRetouch.thick.length, 0);
});

test('sideburns can be finished with the blade after a trimmer pass', () => {
  const game = masks();
  assert.ok(game.stroke(230, 650, 'trimmer', 8, 1).longHair.length > 0);
  const leftBlade = game.stroke(230, 650, 'blade', 8, 2);
  assert.ok(leftBlade.mediumHair.length > 0);
  assert.ok(leftBlade.buzzHair.length > 0);
  assert.equal(game.stroke(230, 650, 'blade', 8, 3).buzzHair.length, 0);
  assert.ok(game.stroke(830, 650, 'trimmer', 8, 4).longHair.length > 0);
  assert.ok(game.stroke(830, 650, 'trimmer', 8, 5).mediumHair.length > 0);
  assert.equal(game.stroke(830, 650, 'trimmer', 8, 6).buzzHair.length, 0);
  assert.ok(game.stroke(830, 650, 'blade', 8, 7).buzzHair.length > 0);
});

test('a tiny overlay patch is removable', () => {
  const game = masks();
  assert.equal(game.stroke(932, 545, 'trimmer', 8, 1).thick.length, 1);
});

test('trimming a jaw root drops its detached outer fibers without widening the brush cut', () => {
  const width = 1086, height = 1448;
  const beard = new Uint8ClampedArray(width * height * 4);
  const core = new Uint8ClampedArray(width * height * 4);
  for (let y = 888; y < 912; y++) for (let x = 745; x < 865; x++) {
    beard[(y * width + x) * 4 + 3] = 255;
    if (x <= 818) core[(y * width + x) * 4 + 3] = 255;
  }
  const game = createPhotoGame(beard, width, height, null, core);
  const first = game.stroke(807, 900, 'trimmer', 31, 1);
  assert.ok(first.thick.length > 0);
  assert.ok(first.beardFringe.every(cell => trimmerDepth(cell.x, cell.y, 807, 900, 31) >= GRID_STEP * Math.SQRT2 / 2));
  assert.ok(first.beardOrphans.some(cell => cell.x >= 846));
  const repeated = game.stroke(807, 900, 'trimmer', 31, 1);
  assert.equal(repeated.beardFringe.length, 0);
  assert.equal(repeated.beardOrphans.length, 0);
  assert.equal(game.stroke(850, 900, 'trimmer', 12, 2).thick.length, 0);
});

test('a beard tuft outside the skin edge stays within the highlighted trimmer area', () => {
  const width = 1086, height = 1448;
  const beard = new Uint8ClampedArray(width * height * 4);
  const core = new Uint8ClampedArray(width * height * 4);
  const face = new Uint8ClampedArray(width * height * 4);
  for (let y = 974; y < 998; y++) for (let x = 730; x < 840; x++) {
    const pixel = (y * width + x) * 4;
    beard[pixel + 3] = 255;
    if (x <= 815) core[pixel + 3] = 255;
    if (x <= 770) { face[pixel] = 160; face[pixel + 1] = 105; face[pixel + 2] = 80; }
  }
  const game = createPhotoGame(beard, width, height, null, core, face);
  const stroke = game.stroke(765, 986, 'trimmer', 32, 1);
  assert.ok(stroke.thick.length > 0);
  assert.ok(stroke.beardFringe.every(cell => trimmerDepth(cell.x, cell.y, 765, 986, 32) >= GRID_STEP * Math.SQRT2 / 2));
  assert.ok(game.stroke(815, 986, 'trimmer', 12, 2).thick.length > 0);
});

test('blade nicks are allowed only on bare face skin and do not stack', () => {
  const width = 1086, height = 1448;
  const beard = new Uint8ClampedArray(width * height * 4);
  const face = new Uint8ClampedArray(width * height * 4);
  for (let y = 780; y < 940; y++) for (let x = 450; x < 660; x++) {
    const pixel = (y * width + x) * 4;
    face[pixel] = 160; face[pixel + 1] = 105; face[pixel + 2] = 80;
    if (x < 560 && y > 850) beard[pixel + 3] = 255;
  }
  const game = createPhotoGame(beard, width, height, null, null, face);
  assert.equal(game.isBareFace(500, 900), false);
  assert.equal(game.addCut(500, 900), false);
  assert.equal(game.isBareFace(620, 800), true);
  assert.equal(game.addCut(620, 800), true);
  assert.equal(game.addCut(620, 800), false);
  assert.equal(game.addCut(700, 800), false);
  game.stroke(500, 900, 'trimmer', 45, 1);
  game.stroke(500, 900, 'trimmer', 45, 2);
  game.stroke(500, 900, 'blade', 45, 3);
  assert.equal(game.isBareFace(500, 900), true);
  assert.equal(game.addCut(500, 900), true);
  assert.equal(game.cutCount, 2);
  game.reset();
  assert.equal(game.cutCount, 0);
  assert.equal(game.addCut(620, 800), true);
});

test('a blade stroke rolls for a cut only once on bare skin', () => {
  const width = 1086, height = 1448;
  const beard = new Uint8ClampedArray(width * height * 4);
  const face = new Uint8ClampedArray(width * height * 4);
  for (let y = 760; y < 920; y++) for (let x = 430; x < 680; x++) {
    const pixel = (y * width + x) * 4;
    face[pixel] = 160; face[pixel + 1] = 105; face[pixel + 2] = 80;
    if (x < 480) beard[pixel + 3] = 255;
  }
  const game = createPhotoGame(beard, width, height, null, null, face);
  assert.equal(game.tryBladeCut(460, 810, 1, () => 0), false);
  assert.equal(game.tryBladeCut(550, 810, 1, () => .9), false);
  assert.equal(game.tryBladeCut(580, 810, 1, () => 0), false);
  assert.equal(game.tryBladeCut(550, 810, 2, () => 0), true);
  assert.equal(game.tryBladeCut(610, 810, 2, () => 0), false);
  assert.equal(game.cutCount, 1);
  game.reset();
  assert.equal(game.tryBladeCut(550, 810, 2, () => 0), true);
});

test('nicks are rare, spaced apart, and limited to three', () => {
  const width = 1086, height = 1448;
  const face = new Uint8ClampedArray(width * height * 4);
  for (let y = 700; y < 1090; y++) for (let x = 390; x < 710; x++) {
    const pixel = (y * width + x) * 4;
    face[pixel] = 160; face[pixel + 1] = 105; face[pixel + 2] = 80;
  }
  const game = createPhotoGame(null, width, height, null, null, face);
  assert.equal(game.tryBladeCut(500, 800, 1, () => .10), false);
  assert.equal(game.tryBladeCut(500, 800, 2, () => .099), true);
  assert.equal(game.tryBladeCut(540, 800, 3, () => 0), false);
  assert.equal(game.tryBladeCut(600, 800, 4, () => 0), true);
  assert.equal(game.tryBladeCut(500, 950, 5, () => 0), true);
  assert.equal(game.tryBladeCut(600, 950, 6, () => 0), false);
  assert.equal(game.cutCount, 3);
});

test('the blade pass that first clears stubble cannot nick that same spot', () => {
  const game = masks();
  game.stroke(500, 900, 'trimmer', 45, 1);
  game.stroke(500, 900, 'trimmer', 45, 2);
  assert.equal(game.tryBladeCut(500, 900, 3, () => 0), false);
  game.stroke(500, 900, 'blade', 45, 3);
  assert.equal(game.tryBladeCut(500, 900, 3, () => 0), false);
  assert.equal(game.tryBladeCut(500, 900, 4, () => 0), true);
});

test('four separate blade passes over the same bare spot within three seconds cause a cut', () => {
  const width = 1086, height = 1448;
  const face = new Uint8ClampedArray(width * height * 4);
  for (let y = 760; y < 980; y++) for (let x = 400; x < 680; x++) {
    const pixel = (y * width + x) * 4;
    face[pixel] = 160; face[pixel + 1] = 105; face[pixel + 2] = 80;
  }
  const game = createPhotoGame(null, width, height, null, null, face);
  assert.equal(game.tryBladeCut(520, 860, 1, () => 1, 0), false);
  assert.equal(game.tryBladeCut(525, 860, 1, () => 1, 100), false);
  assert.equal(game.tryBladeCut(530, 865, 2, () => 1, 600), false);
  assert.equal(game.tryBladeCut(515, 855, 3, () => 1, 1200), false);
  assert.equal(game.tryBladeCut(520, 860, 4, () => 1, 2200), true);
  assert.equal(game.cutCount, 1);
  game.reset();
  assert.equal(game.tryBladeCut(520, 860, 5, () => 1, 0), false);
  assert.equal(game.tryBladeCut(520, 860, 6, () => 1, 1000), false);
  assert.equal(game.tryBladeCut(520, 860, 7, () => 1, 2000), false);
  assert.equal(game.tryBladeCut(520, 860, 8, () => 1, 4001), false);
});

test('a full three-pass shave clears all visible beard tiles', () => {
  const game = masks();
  for (let pass = 1; pass <= 3; pass++) {
    const tool = pass === 3 ? 'blade' : 'trimmer';
    for (let y = 550; y < 1280; y += 40) for (let x = 145; x < 950; x += 40) game.stroke(x, y, tool, 52, pass);
  }
  assert.equal(game.progress(), 100);
});
