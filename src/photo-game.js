// Small tiles keep the interaction mask aligned with the visible tool footprint.
export const GRID_STEP = 4;
const STEP = GRID_STEP;
export function bladeFootprint(radius) {
  return { halfWidth: radius * 1.4, halfHeight: radius * .55 };
}
export function trimmerFootprint(radius) {
  return { halfWidth: radius, halfHeight: radius * .84, cornerRadius: radius * .18 };
}
export function trimmerDepth(x, y, centerX, centerY, radius) {
  const { halfWidth, halfHeight, cornerRadius } = trimmerFootprint(radius);
  const qx = Math.abs(x - centerX) - (halfWidth - cornerRadius);
  const qy = Math.abs(y - centerY) - (halfHeight - cornerRadius);
  return cornerRadius - Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - Math.min(Math.max(qx, qy), 0);
}

function beardEdgeNoise(x, y) {
  let value = Math.imul(Math.floor(x / 12) + 41, 374761393) ^ Math.imul(Math.floor(y / 20) - 19, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  const clump = ((value ^ (value >>> 16)) >>> 0) / 4294967295;
  value = Math.imul(x + 73, 374761393) ^ Math.imul(y - 97, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  const strand = ((value ^ (value >>> 16)) >>> 0) / 4294967295;
  return clump * .65 + strand * .35;
}

function createField(pixels, width, height, bounds) {
  const [left, top, right, bottom] = bounds;
  const gx0 = Math.floor(left / STEP), gy0 = Math.floor(top / STEP);
  const gx1 = Math.ceil(Math.min(width, right) / STEP), gy1 = Math.ceil(Math.min(height, bottom) / STEP);
  const columns = gx1 - gx0;
  const rows = gy1 - gy0;
  const grid = new Array(columns * rows);
  const cells = [];
  if (pixels) {
    for (let gy = gy0; gy < gy1; gy++) {
      for (let gx = gx0; gx < gx1; gx++) {
        let alpha = 0;
        for (let py = gy * STEP; py < Math.min((gy + 1) * STEP, height); py++) {
          for (let px = gx * STEP; px < Math.min((gx + 1) * STEP, width); px++) {
            alpha = Math.max(alpha, pixels[(py * width + px) * 4 + 3]);
          }
        }
        if (alpha <= 3) continue;
        const cell = { x: gx * STEP + STEP / 2, y: gy * STEP + STEP / 2, alpha, state: 0, lastStroke: -1,
          fourMmPasses: 0,
          fringeCleared: false, guardMm: Infinity,
          visualThickStroke: -1, visualFullStroke: -1, visualShortStroke: -1,
          visualThickAmount: 0, visualFullAmount: 0, visualShortAmount: 0 };
        grid[(gy - gy0) * columns + gx - gx0] = cell;
        cells.push(cell);
      }
    }
  }
  function around(x, y, radius, visit, fullyInside = false) {
    const minX = Math.max(gx0, Math.floor((x - radius - STEP) / STEP));
    const maxX = Math.min(gx1 - 1, Math.floor((x + radius + STEP) / STEP));
    const minY = Math.max(gy0, Math.floor((y - radius - STEP) / STEP));
    const maxY = Math.min(gy1 - 1, Math.floor((y + radius + STEP) / STEP));
    const reach = fullyInside ? Math.max(0, radius - STEP * Math.SQRT2 / 2) : radius + STEP * .8;
    const squared = reach ** 2;
    for (let gy = minY; gy <= maxY; gy++) for (let gx = minX; gx <= maxX; gx++) {
      const cell = grid[(gy - gy0) * columns + gx - gx0];
      if (cell && (cell.x - x) ** 2 + (cell.y - y) ** 2 <= squared) visit(cell);
    }
  }
  function inRect(x, y, halfWidth, halfHeight, visit, fullyInside = false) {
    const inset = fullyInside ? STEP / 2 : 0;
    const minX = Math.max(gx0, Math.floor((x - halfWidth) / STEP));
    const maxX = Math.min(gx1 - 1, Math.floor((x + halfWidth) / STEP));
    const minY = Math.max(gy0, Math.floor((y - halfHeight) / STEP));
    const maxY = Math.min(gy1 - 1, Math.floor((y + halfHeight) / STEP));
    for (let gy = minY; gy <= maxY; gy++) for (let gx = minX; gx <= maxX; gx++) {
      const cell = grid[(gy - gy0) * columns + gx - gx0];
      if (cell && Math.abs(cell.x - x) <= halfWidth - inset && Math.abs(cell.y - y) <= halfHeight - inset) visit(cell);
    }
  }
  function cellAt(x, y) {
    const gx = Math.floor(x / STEP), gy = Math.floor(y / STEP);
    if (gx < gx0 || gx >= gx1 || gy < gy0 || gy >= gy1) return null;
    return grid[(gy - gy0) * columns + gx - gx0] || null;
  }
  return { cells, around, inRect, cellAt };
}

// The longest beard has loose fibers outside the shorter beard's silhouette.
// Link each of those fibers to a cell on the jaw, so trimming its root also
// removes the otherwise unsupported tip beyond the circular brush.
function fringeByRoot(beard, corePixels, facePixels, width) {
  const linked = new Map();
  if (!corePixels && !facePixels) return linked;
  const boundaries = new Map();
  for (let y = 756; y <= 1120; y += STEP) {
    let coreLeft = Infinity, coreRight = -Infinity;
    let faceLeft = Infinity, faceRight = -Infinity;
    for (let py = y; py < y + STEP; py++) {
      for (let x = 190; x < 900; x++) {
        const pixel = (py * width + x) * 4;
        if (corePixels && corePixels[pixel + 3] >= 96) {
          coreLeft = Math.min(coreLeft, x);
          coreRight = Math.max(coreRight, x);
        }
        if (facePixels && facePixels[pixel] < 195 && facePixels[pixel] - facePixels[pixel + 1] > 18
          && facePixels[pixel + 1] - facePixels[pixel + 2] > 8) {
          faceLeft = Math.min(faceLeft, x);
          faceRight = Math.max(faceRight, x);
        }
      }
    }
    // The ear can be farther out than the cheek. Anchor fringe to the beard's
    // actual inner silhouette instead of treating ear skin as its root.
    const left = Number.isFinite(coreLeft) ? coreLeft : faceLeft;
    const right = Number.isFinite(coreRight) ? coreRight : faceRight;
    if (Number.isFinite(left)) boundaries.set(y + STEP / 2, { left, right });
  }
  for (const cell of beard.cells) {
    const bounds = boundaries.get(cell.y);
    if (!bounds) continue;
    const rightSide = cell.x > 540 && cell.x > bounds.right;
    const leftSide = cell.x < 540 && cell.x < bounds.left;
    if (!rightSide && !leftSide) continue;
    let root = null, bestCost = Infinity;
    // Jaw hairs grow out and down. Search above the tip too, so a low wisp is
    // attached to the cheek it grew from instead of the distant chin at its row.
    for (let rootY = cell.y; rootY >= cell.y - 96; rootY -= STEP) {
      const row = boundaries.get(rootY);
      if (!row) continue;
      const boundary = rightSide ? row.right : row.left;
      let candidate = null;
      for (let inset = 5; inset <= 25 && !candidate; inset += STEP) {
        candidate = beard.cellAt(boundary + (rightSide ? -inset : inset), rootY);
      }
      if (!candidate) continue;
      const cost = (cell.x - candidate.x) ** 2 + .42 * (cell.y - candidate.y) ** 2;
      if (cost < bestCost) { root = candidate; bestCost = cost; }
    }
    if (!root) continue;
    if (!linked.has(root)) linked.set(root, []);
    linked.get(root).push(cell);
  }
  return linked;
}

// The full and medium photos extend beyond the short haircut's silhouette.
// Tie those outer strands to their nearest short-hair root so a cut cannot
// leave a disconnected ring of hair suspended above the head.
function hairFringeByRoot(hair, buzzPixels, width) {
  const linked = new Map();
  if (!buzzPixels) return linked;
  const anchored = cell => buzzPixels[(Math.floor(cell.y) * width + Math.floor(cell.x)) * 4 + 3] > 42;
  const roots = new Map();
  const queue = [];
  for (const cell of hair.cells) {
    if (cell.y > 530 || !anchored(cell)) continue;
    roots.set(cell, cell);
    queue.push(cell);
  }
  // Grow outward from actual short hair. This follows the whole silhouette,
  // including the temples where a straight radial search misses the root.
  const neighbors = [[0, -1], [1, 0], [0, 1], [-1, 0], [-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (let index = 0; index < queue.length; index++) {
    const cell = queue[index];
    const root = roots.get(cell);
    for (const [dx, dy] of neighbors) {
      const next = hair.cellAt(cell.x + dx * STEP, cell.y + dy * STEP);
      if (!next || next.y > 530 || roots.has(next)) continue;
      roots.set(next, root);
      queue.push(next);
    }
  }
  for (const [tip, root] of roots) {
    if (tip === root) continue;
    if (!linked.has(root)) linked.set(root, []);
    linked.get(root).push(tip);
  }
  return linked;
}

export function createPhotoGame(beardPixels, width, height, hairPixels = null, coreBeardPixels = null, facePixels = null, buzzPixels = null) {
  const beard = createField(beardPixels, width, height, [145, 540, 940, 1275]);
  const hair = createField(hairPixels, width, height, [115, 25, 970, 825]);
  const fringe = fringeByRoot(beard, coreBeardPixels, facePixels, width);
  const hairFringe = hairFringeByRoot(hair, buzzPixels, width);
  const scalpRoots = new Set();
  if (buzzPixels) {
    for (const cell of hair.cells) {
      if (cell.y > 530) continue;
      const pixel = (Math.floor(cell.y) * width + Math.floor(cell.x)) * 4;
      if (buzzPixels[pixel + 3] <= 42) continue;
      if (facePixels && !(facePixels[pixel] - facePixels[pixel + 1] > 18
        && facePixels[pixel + 1] - facePixels[pixel + 2] > 8)) continue;
      scalpRoots.add(cell);
    }
  }
  let cutCount = 0;
  const cutPositions = [];
  let lastCutAttemptStroke = -1;
  let automaticStrokeId = 0;
  const bladeVisits = [];
  const fourMmContacts = new Set();
  let fourMmStrokeId = -1;
  function isBareFace(x, y) {
    if (x < 185 || x > 900 || y < 540 || y > 1130) return false;
    const cell = beard.cellAt(x, y);
    if (cell && cell.state !== 3) return false;
    if (!facePixels) return !!cell;
    // Keep the whole mark on skin, including near the jaw and ears.
    return [[0, 0], [-10, 0], [10, 0], [0, -10], [0, 10]].every(([dx, dy]) => {
      const pixel = (Math.floor(y + dy) * width + Math.floor(x + dx)) * 4;
      const red = facePixels[pixel], green = facePixels[pixel + 1], blue = facePixels[pixel + 2];
      return red - green > 18 && green - blue > 7;
    });
  }
  function addCutAt(x, y) {
    if (cutCount >= 3 || !isBareFace(x, y) || cutPositions.some(cut => Math.hypot(cut.x - x, cut.y - y) < 68)) return false;
    cutPositions.push({ x, y });
    cutCount++;
    return true;
  }
  return {
    pruneFloatingHair() {
      if (!buzzPixels) return [];
      const rootWasCut = cell => cell.state >= 2 || cell.guardMm <= 3;
      const connected = new Set();
      const queue = [];
      const roots = scalpRoots.size ? scalpRoots : new Set(hair.cells.filter(cell => {
        if (cell.y > 530) return false;
        const pixel = (Math.floor(cell.y) * width + Math.floor(cell.x)) * 4;
        return buzzPixels[pixel + 3] > 42;
      }));
      for (const cell of roots) {
        if (rootWasCut(cell) || cell.alpha < 20) continue;
        connected.add(cell);
        queue.push(cell);
      }
      const neighbors = [[0, -1], [1, 0], [0, 1], [-1, 0], [-1, -1], [1, -1], [1, 1], [-1, 1]];
      for (let index = 0; index < queue.length; index++) {
        const cell = queue[index];
        for (const [dx, dy] of neighbors) {
          const next = hair.cellAt(cell.x + dx * STEP, cell.y + dy * STEP);
          if (!next || next.y > 530 || rootWasCut(next) || next.alpha < 20 || connected.has(next)) continue;
          connected.add(next);
          queue.push(next);
        }
      }
      const detached = [];
      for (const cell of hair.cells) {
        if (cell.y > 530 || rootWasCut(cell) || connected.has(cell)) continue;
        cell.state = 2;
        cell.hairFringeCleared = true;
        detached.push(cell);
      }
      return detached;
    },
    stroke(x, y, tool, radius = 58, strokeId = ++automaticStrokeId, guardMm = null) {
      const guarded = tool === 'trimmer' && Number.isInteger(guardMm) && guardMm >= 1 && guardMm <= 4;
      const guardState = guarded ? (guardMm <= 2 ? 2 : 1) : null;
      const changes = { thick: [], full: [], short: [], beardRetouch: { thick: [], full: [], short: [] },
        beardGuardFull: [], beardGuardShort: [], beardFringe: [], beardOrphans: [], hairFringe: [],
        longHair: [], fourMmFinished: [], mediumHair: [], shortHair: [], stubbleHair: [], buzzHair: [], fineHair: [] };
      const bladeShape = tool === 'blade' ? bladeFootprint(radius) : null;
      const trimmerShape = tool === 'trimmer' ? trimmerFootprint(radius) : null;
      const insideFootprint = cell => bladeShape
        ? Math.abs(cell.x - x) + STEP / 2 <= bladeShape.halfWidth && Math.abs(cell.y - y) + STEP / 2 <= bladeShape.halfHeight
        : trimmerShape
          ? trimmerDepth(cell.x, cell.y, x, y, radius) >= STEP * Math.SQRT2 / 2
          : Math.hypot(Math.abs(cell.x - x) + STEP / 2, Math.abs(cell.y - y) + STEP / 2) <= radius;
      const visitBeard = cell => {
        const distance = Math.hypot(cell.x - x, cell.y - y);
        const depth = bladeShape
          ? Math.min(bladeShape.halfWidth - Math.abs(cell.x - x), bladeShape.halfHeight - Math.abs(cell.y - y))
          : trimmerShape ? trimmerDepth(cell.x, cell.y, x, y, radius) : radius - distance;
        const edgeInset = bladeShape ? 0 : Math.min(radius * .23, 13) * (.25 + .75 * beardEdgeNoise(cell.x, cell.y));
        if (!bladeShape && depth < STEP * Math.SQRT2 / 2 + edgeInset) return;
        if (cell.lastStroke !== strokeId) {
          const before = cell.state;
          if (tool === 'scissors' && before === 0) cell.state = 1;
          if (tool === 'trimmer' && !guarded && before < 2) cell.state++;
          if (guarded && before < 3 && guardMm < cell.guardMm) {
            const previousGuard = cell.guardMm;
            cell.guardMm = guardMm;
            cell.state = Math.max(before, guardState);
            if (guardMm === 3 && previousGuard > 3) changes.beardGuardFull.push({ x: cell.x, y: cell.y, strength: .32 });
            if (guardMm === 1 && previousGuard > 1) changes.beardGuardShort.push({ x: cell.x, y: cell.y, strength: .48 });
          }
          if (tool === 'blade' && before < 3) cell.state = 3;
          if (cell.state !== before) {
            cell.lastStroke = strokeId;
            if (before < 1 && cell.state >= 1) changes.thick.push(cell);
            if (before < 2 && cell.state >= 2) changes.full.push(cell);
            if (before < 3 && cell.state >= 3) changes.short.push(cell);
          }
        }
        // Increment only to the strongest coverage reached in this drag.
        // Repeated pointer samples must not compound a soft edge into a stripe.
        const strandDepth = bladeShape ? depth : depth + (beardEdgeNoise(cell.x, cell.y) - .5) * Math.min(40, radius * .6);
        const fade = Math.max(0, Math.min(1, bladeShape ? (strandDepth - 1) / 5 : (strandDepth - 4) / Math.max(4, radius - 4)));
        const target = fade * fade * (3 - 2 * fade);
        for (const [name, minimum] of [['thick', 1], ['full', 2], ['short', 3]]) {
          if (cell.state < minimum || target < .01) continue;
          const key = name[0].toUpperCase() + name.slice(1);
          const strokeKey = `visual${key}Stroke`;
          const amountKey = `visual${key}Amount`;
          if (cell[strokeKey] !== strokeId) { cell[strokeKey] = strokeId; cell[amountKey] = 0; }
          const previous = cell[amountKey];
          if (target <= previous + .01) continue;
          const strength = (target - previous) / (1 - previous);
          changes.beardRetouch[name].push({ x: cell.x, y: cell.y, depth, strength });
          cell[amountKey] = target;
        }
      };
      if (bladeShape) beard.inRect(x, y, bladeShape.halfWidth, bladeShape.halfHeight, visitBeard, true);
      else if (trimmerShape) beard.inRect(x, y, trimmerShape.halfWidth, trimmerShape.halfHeight,
        cell => { if (trimmerDepth(cell.x, cell.y, x, y, radius) >= STEP * Math.SQRT2 / 2) visitBeard(cell); }, true);
      else beard.around(x, y, radius, visitBeard, true);
      for (const retouch of changes.beardRetouch.thick) {
        const root = beard.cellAt(retouch.x, retouch.y);
        if (!root || root.fringeCleared || root.visualThickAmount < .12 + .32 * beardEdgeNoise(root.x, root.y)) continue;
        root.fringeCleared = true;
        for (const tip of fringe.get(root) || []) {
          tip.state = 3;
          const group = insideFootprint(tip) ? changes.beardFringe : changes.beardOrphans;
          group.push({ x: tip.x, y: tip.y, strength: 1 });
        }
      }
      const hairTargets = new Set();
      if (bladeShape) hair.inRect(x, y, bladeShape.halfWidth, bladeShape.halfHeight, cell => hairTargets.add(cell), true);
      else if (trimmerShape) hair.inRect(x, y, trimmerShape.halfWidth, trimmerShape.halfHeight,
        cell => { if (trimmerDepth(cell.x, cell.y, x, y, radius) >= STEP * Math.SQRT2 / 2) hairTargets.add(cell); }, true);
      else hair.around(x, y, radius, cell => hairTargets.add(cell), true);
      if (guarded && guardMm === 4) {
        if (fourMmStrokeId !== strokeId) { fourMmContacts.clear(); fourMmStrokeId = strokeId; }
        for (const cell of fourMmContacts) if (!hairTargets.has(cell)) fourMmContacts.delete(cell);
      }
      for (const cell of hairTargets) {
        const progressiveFour = guarded && guardMm === 4 && cell.state === 0;
        if (cell.state >= 3 || (cell.lastStroke === strokeId && !progressiveFour)) continue;
        if (tool !== 'scissors' && tool !== 'trimmer' && tool !== 'blade') continue;
        // Scissors leave a medium cut; the trimmer leaves a short, visible cut.
        // Only the blade can expose the clean scalp.
        if ((tool === 'scissors' && cell.state >= 1)
          || (tool === 'trimmer' && !guarded && cell.state >= 2)
          || (guarded && guardMm >= cell.guardMm)
          || (progressiveFour && fourMmContacts.has(cell))) continue;
        const before = cell.state;
        const previousGuard = cell.guardMm;
        if (progressiveFour) {
          fourMmContacts.add(cell);
          cell.fourMmPasses = Math.min(3, cell.fourMmPasses + 1);
          if (cell.fourMmPasses < 3) {
            cell.lastStroke = strokeId;
            changes.longHair.push(cell);
            continue;
          }
        }
        cell.state = tool === 'blade' ? 3 : guarded ? Math.max(before, guardState) : before + 1;
        if (guarded) cell.guardMm = guardMm;
        cell.lastStroke = strokeId;
        if (guarded && guardMm === 4) changes.fourMmFinished.push(cell);
        if (before === 0 && cell.state >= 1) changes.longHair.push(cell);
        if (tool === 'blade' || (guarded ? guardMm <= 3 && previousGuard > 3 : before <= 1 && cell.state >= 2)) changes.mediumHair.push(cell);
        if (tool === 'blade' || (guarded ? guardMm <= 2 && previousGuard > 2 : before <= 1 && cell.state >= 2)) changes.shortHair.push(cell);
        if (tool === 'blade' || (guarded && guardMm <= 1 && previousGuard > 1)) changes.stubbleHair.push(cell);
        if (cell.state === 3) changes.buzzHair.push(cell);
        if (cell.state === 3) changes.fineHair.push(cell);
        if ((cell.state >= 2 || guarded) && !cell.hairFringeCleared) {
          cell.hairFringeCleared = true;
          for (const tip of hairFringe.get(cell) || []) {
            // Once the root is gone, its outer strands are no longer attached.
            // They become falling clippings, even when their tips extend past
            // the brush that touched the root.
            tip.state = Math.max(tip.state, 2);
            changes.hairFringe.push(tip);
          }
        }
      }
      return changes;
    },
    isBareFace,
    nearbyBare: isBareFace,
    addCut: addCutAt,
    tryBladeCut(x, y, strokeId, random = Math.random, now = performance.now()) {
      if (!isBareFace(x, y)) return false;
      // A blade pass may expose skin under stubble; that same pass stays safe.
      const cell = beard.cellAt(x, y);
      if (cell && cell.lastStroke === strokeId) return false;
      for (let index = bladeVisits.length - 1; index >= 0; index--) {
        if (now - bladeVisits[index].time > 3000) bladeVisits.splice(index, 1);
      }
      const nearby = bladeVisits.filter(visit => Math.hypot(visit.x - x, visit.y - y) <= 32);
      if (nearby.some(visit => visit.strokeId === strokeId)) return false;
      bladeVisits.push({ x, y, strokeId, time: now });
      if (nearby.length >= 3 && addCutAt(x, y)) return true;
      if (lastCutAttemptStroke === strokeId) return false;
      lastCutAttemptStroke = strokeId;
      return random() < .10 && addCutAt(x, y);
    },
    progress() {
      if (!beard.cells.length) return 0;
      return Math.round(100 * beard.cells.reduce((sum, cell) => sum + [0, .3, .62, 1][cell.state], 0) / beard.cells.length);
    },
    reset() {
      for (const cell of [...beard.cells, ...hair.cells]) {
        cell.state = 0; cell.lastStroke = -1; cell.fringeCleared = false; cell.hairFringeCleared = false; cell.guardMm = Infinity; cell.fourMmPasses = 0;
        cell.visualThickStroke = cell.visualFullStroke = cell.visualShortStroke = -1;
        cell.visualThickAmount = cell.visualFullAmount = cell.visualShortAmount = 0;
      }
      cutCount = 0;
      cutPositions.length = 0;
      lastCutAttemptStroke = -1;
      bladeVisits.length = 0;
      fourMmContacts.clear();
      fourMmStrokeId = -1;
    },
    get cutCount() { return cutCount; },
    get cellCount() { return beard.cells.length; },
    get hairCellCount() { return hair.cells.length; },
  };
}
