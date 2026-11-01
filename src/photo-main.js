import { createPhotoGame, GRID_STEP, bladeFootprint, trimmerFootprint } from './photo-game.js?v=42';
import { createBarberSounds } from './barber-sounds.js?v=9';
import { createBarberHaptics } from './barber-haptics.js?v=1';
import { startEyeAnimation } from './eye-animation.js?v=1';
import { createBarbershopRadio } from './barbershop-radio.js?v=17';
import { createWaterSpray } from './water-spray.js?v=6';

const $ = selector => document.querySelector(selector);
const WIDTH = 1086;
const HEIGHT = 1448;
const BUZZ_CROWN_TOP = 145;
const SITE_URL = 'https://shave-the-date.app.en3.wtf/';
const SHARE_TEXT = `I gave Aakash a wedding makeover. Try yours: ${SITE_URL}`;
const stage = $('#portrait-stage');
const shell = $('.game-shell');
const base = $('#base-photo');
const sideburnClean = $('#sideburn-clean-layer');
const fineHair = $('#hair-fine-layer');
const buzzHair = $('#hair-buzz-layer');
const stubbleHair = $('#hair-stubble-layer');
const shortHair = $('#hair-short-layer');
const mediumHair = $('#hair-medium-layer');
const hair = $('#hair-layer');
const shortBeard = $('#beard-short-layer');
const fullBeard = $('#beard-full-layer');
const thickBeard = $('#beard-thick-layer');
const cuts = $('#cut-layer');
const clippings = $('#clippings-layer');
const preview = $('#preview-layer');
const hairContext = hair.getContext('2d');
const sideburnCleanContext = sideburnClean.getContext('2d');
const fineHairContext = fineHair.getContext('2d');
const buzzHairContext = buzzHair.getContext('2d');
const stubbleHairContext = stubbleHair.getContext('2d');
const shortHairContext = shortHair.getContext('2d');
const mediumHairContext = mediumHair.getContext('2d');
const shortContext = shortBeard.getContext('2d');
const fullContext = fullBeard.getContext('2d');
const thickContext = thickBeard.getContext('2d');
const cutContext = cuts.getContext('2d');
const clippingsContext = clippings.getContext('2d');
const previewContext = preview.getContext('2d');
const cursor = $('#cursor-tool');
const cursorImage = $('#cursor-image');
const loading = $('#loading');
const status = $('#status-text');
const sounds = createBarberSounds();
const radio = createBarbershopRadio();
const waterSpray = createWaterSpray($('#water-spray-layer'));
const startButton = $('#start-button');
let started = false;
const soundsReady = sounds.prepare();
const haptics = createBarberHaptics();
for (const eventName of ['contextmenu', 'dragstart', 'selectstart']) {
  shell.addEventListener(eventName, event => event.preventDefault());
}
let tool = null;
let trimmerGuardMm = 4;
let active = false;
let lastPoint = null;
let cutThisStroke = false;
let hairTouchedStroke = false;
let strokeId = 0;
const detachedBeard = new Map();
const falling = [];
const lastClippingTime = { hair: -Infinity, beard: -Infinity, fineHair: -Infinity, fineBeard: -Infinity };
let fallingFrame = 0;
let lastFallingFrame = 0;
const toolAreas = { scissors: 74, trimmer: 66, blade: 46 };
let lastHover = null;

function loadImage(source) {
  const image = new Image();
  image.src = source;
  return new Promise((resolve, reject) => {
    if (image.complete && image.naturalWidth) resolve(image);
    else { image.addEventListener('load', () => resolve(image), { once: true }); image.addEventListener('error', reject, { once: true }); }
  });
}

function fitStage() {
  const dock = started ? $('.tool-dock') : $('.start-dock');
  if (window.matchMedia('(max-width: 820px), (max-height: 500px) and (hover: none)').matches) {
    const headerHeight = $('.hero-copy').getBoundingClientRect().height;
    const dockHeight = dock.getBoundingClientRect().height;
    const availableHeight = window.innerHeight - headerHeight - dockHeight - 44;
    const maxWidth = Math.min(480, window.innerWidth - 24);
    const width = Math.min(maxWidth, Math.max(220, availableHeight * WIDTH / HEIGHT));
    stage.style.width = `${width}px`;
    stage.style.height = `${width * HEIGHT / WIDTH}px`;
    stage.style.top = '';
    return;
  }
  if (window.matchMedia('(min-width: 1080px) and (min-height: 600px)').matches) {
    const dockTop = dock.getBoundingClientRect().top;
    const maxHeight = Math.max(220, dockTop - 64);
    const width = Math.min(540, window.innerWidth * .39, maxHeight * WIDTH / HEIGHT);
    stage.style.width = `${width}px`;
    stage.style.height = `${width * HEIGHT / WIDTH}px`;
    stage.style.top = `${32 + maxHeight / 2}px`;
    return;
  }
  const headerBottom = $('.hero-copy').getBoundingClientRect().bottom;
  const dockTop = dock.getBoundingClientRect().top;
  const maxHeight = Math.max(220, dockTop - headerBottom - 24);
  const width = Math.min(480, window.innerWidth - 24, Math.min(640, maxHeight) * WIDTH / HEIGHT);
  stage.style.width = `${width}px`;
  stage.style.height = `${width * HEIGHT / WIDTH}px`;
  stage.style.top = `${(headerBottom + dockTop) / 2}px`;
}
window.addEventListener('resize', fitStage);
fitStage();
document.fonts.ready.then(fitStage);

const baseReady = base.complete && base.naturalWidth ? Promise.resolve() : new Promise((resolve, reject) => {
  base.addEventListener('load', resolve, { once: true });
  base.addEventListener('error', reject, { once: true });
});

let hairImage;
let mediumHairImage;
let buzzHairImage;
let outsideBuzzMask;
let outsideMediumMask;
let beardImage;
let thickImage;
let cleanSideburnImage;
let game;
try {
  [hairImage, mediumHairImage, buzzHairImage, beardImage, thickImage, cleanSideburnImage] = await Promise.all([
    loadImage('/assets/aakash-hair-fitted-overlay.png?v=2'),
    loadImage('/assets/aakash-medium-hair-overlay.png?v=1'),
    loadImage('/assets/aakash-buzz-hair-overlay.png?v=1'),
    loadImage('/assets/aakash-beard-overlay.png?v=3'),
    loadImage('/assets/aakash-thick-beard-overlay.png?v=2'),
    loadImage('/assets/source/aakash-clean-sideburns-generated.png?v=1'),
    baseReady,
  ]);
  outsideBuzzMask = makeOutsideHairMask(buzzHairImage, BUZZ_CROWN_TOP);
  outsideMediumMask = makeOutsideHairMask(mediumHairImage);
  const sample = document.createElement('canvas');
  sample.width = WIDTH; sample.height = HEIGHT;
  const sampleContext = sample.getContext('2d', { willReadFrequently: true });
  sampleContext.drawImage(thickImage, 0, 0);
  sampleContext.drawImage(beardImage, 0, 0);
  const beardPixels = sampleContext.getImageData(0, 0, WIDTH, HEIGHT).data;
  sampleContext.clearRect(0, 0, WIDTH, HEIGHT);
  sampleContext.drawImage(beardImage, 0, 0);
  const coreBeardPixels = sampleContext.getImageData(0, 0, WIDTH, HEIGHT).data;
  sampleContext.clearRect(0, 0, WIDTH, HEIGHT);
  sampleContext.drawImage(base, 0, 0);
  const facePixels = sampleContext.getImageData(0, 0, WIDTH, HEIGHT).data;
  sampleContext.clearRect(0, 0, WIDTH, HEIGHT);
  sampleContext.drawImage(buzzHairImage, 0, 0);
  const buzzPixels = sampleContext.getImageData(0, 0, WIDTH, HEIGHT).data;
  for (let y = 0; y < BUZZ_CROWN_TOP; y++) for (let x = 0; x < WIDTH; x++) buzzPixels[(y * WIDTH + x) * 4 + 3] = 0;
  sampleContext.clearRect(0, 0, WIDTH, HEIGHT);
  sampleContext.drawImage(hairImage, 0, 0);
  sampleContext.drawImage(mediumHairImage, 0, 0);
  sampleContext.drawImage(buzzHairImage, 0, 0);
  const hairPixels = sampleContext.getImageData(0, 0, WIDTH, HEIGHT).data;
  game = createPhotoGame(beardPixels, WIDTH, HEIGHT, hairPixels, coreBeardPixels, facePixels, buzzPixels);
  paintCleanSideburns();
  resetLayers();
  loading.classList.add('is-hidden');
  await soundsReady;
  startButton.disabled = false;
  startEyeAnimation($('#eye-layer'), stage).catch(error => console.warn('Eye sprites could not load', error));
} catch (error) {
  console.error('Portrait could not load', error);
  loading.textContent = 'Aakash’s portrait could not load. Please refresh.';
}

function paintCleanSideburns() {
  const mask = document.createElement('canvas');
  mask.width = WIDTH;
  mask.height = HEIGHT;
  const maskContext = mask.getContext('2d');
  for (const [x, y, rx, ry] of [[235, 675, 34, 112], [822, 675, 34, 112]]) {
    maskContext.save();
    maskContext.translate(x, y);
    maskContext.scale(rx, ry);
    const fade = maskContext.createRadialGradient(0, 0, .55, 0, 0, 1);
    fade.addColorStop(0, '#fff');
    fade.addColorStop(1, 'rgba(255,255,255,0)');
    maskContext.fillStyle = fade;
    maskContext.beginPath();
    maskContext.arc(0, 0, 1, 0, Math.PI * 2);
    maskContext.fill();
    maskContext.restore();
  }
  sideburnCleanContext.clearRect(0, 0, WIDTH, HEIGHT);
  sideburnCleanContext.drawImage(cleanSideburnImage, 0, 0);
  sideburnCleanContext.globalCompositeOperation = 'destination-in';
  sideburnCleanContext.drawImage(mask, 0, 0);
  sideburnCleanContext.globalCompositeOperation = 'source-over';
}

function resetLayers() {
  for (const context of [hairContext, mediumHairContext, shortHairContext, stubbleHairContext, buzzHairContext, fineHairContext, shortContext, fullContext, thickContext, cutContext, previewContext]) context.clearRect(0, 0, WIDTH, HEIGHT);
  fineHairContext.globalAlpha = .36;
  fineHairContext.drawImage(buzzHairImage, 0, 0);
  fineHairContext.globalAlpha = 1;
  buzzHairContext.drawImage(buzzHairImage, 0, 0);
  // The generated buzz photo has a disconnected wisp well above the crown.
  buzzHairContext.clearRect(0, 0, WIDTH, BUZZ_CROWN_TOP);
  fineHairContext.clearRect(0, 0, WIDTH, BUZZ_CROWN_TOP);
  // Keep the 2 mm texture attached to the photographed short-hair roots.
  stubbleHairContext.globalAlpha = .62;
  stubbleHairContext.drawImage(mediumHairImage, 0, 0);
  stubbleHairContext.globalAlpha = 1;
  stubbleHairContext.globalCompositeOperation = 'destination-in';
  stubbleHairContext.drawImage(buzzHairImage, 0, 0);
  stubbleHairContext.globalCompositeOperation = 'source-over';
  stubbleHairContext.clearRect(0, 0, WIDTH, BUZZ_CROWN_TOP);
  // Two photographed intermediate lengths bridge the long cut and the buzz.
  shortHairContext.globalAlpha = .45;
  shortHairContext.drawImage(mediumHairImage, 0, 0);
  shortHairContext.globalAlpha = 1;
  shortHairContext.globalCompositeOperation = 'destination-in';
  shortHairContext.drawImage(buzzHairImage, 0, 0);
  shortHairContext.globalCompositeOperation = 'source-over';
  shortHairContext.clearRect(0, 0, WIDTH, BUZZ_CROWN_TOP);
  // Keep the intermediate haircut fully opaque. Partial 4 mm passes reveal
  // this layer, so transparency makes its crown look like a grey halo.
  mediumHairContext.drawImage(mediumHairImage, 0, 0);
  // The short-hair photo has no pixels at some outer curls. Fill those gaps
  // with the original dark hair until a completed pass releases the strands.
  mediumHairContext.globalCompositeOperation = 'destination-over';
  mediumHairContext.drawImage(hairImage, 0, 0);
  mediumHairContext.globalCompositeOperation = 'source-over';
  hairContext.drawImage(hairImage, 0, 0);
  // The thick portrait extends beyond the jaw. Only the outermost layer may
  // contain those long fibers; carrying them into shorter layers makes a
  // translucent gray halo appear after trimming.
  shortContext.globalAlpha = .4;
  shortContext.drawImage(beardImage, 0, 0);
  shortContext.globalAlpha = 1;
  fullContext.drawImage(beardImage, 0, 0);
  thickContext.drawImage(thickImage, 0, 0);
}

function brushNoise(x, y, seed) {
  let value = Math.imul(x + seed * 73, 374761393) ^ Math.imul(y - seed * 97, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function makeOutsideHairMask(image, crownTop = 0) {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, WIDTH, HEIGHT);
  for (let index = 0; index < pixels.data.length; index += 4) {
    // The shorter photographed cut is the anchor for any hair left above it.
    // Clear medium strands beyond that silhouette, with a soft edge.
    const coverage = pixels.data[index + 3] / 255;
    const t = Math.max(0, Math.min(1, (coverage - .02) / .16));
    pixels.data[index + 3] = Math.round(255 * (1 - t * t * (3 - 2 * t)));
  }
  for (let y = 0; y < crownTop; y++) for (let x = 0; x < WIDTH; x++) pixels.data[(y * WIDTH + x) * 4 + 3] = 255;
  context.putImageData(pixels, 0, 0);
  return canvas;
}

function eraseUnanchoredHair(cells, center, radius, shape = 'scissors', mask = outsideBuzzMask) {
  if (!cells.length) return;
  // Prune unsupported outer strands only where the highlighted brush touches.
  for (const context of [hairContext, mediumHairContext, shortHairContext]) {
    context.save();
    clipToolArea(context, center, radius, shape);
    context.globalCompositeOperation = 'destination-out';
    context.drawImage(mask, 0, 0);
    context.restore();
  }
}

function eraseDetachedHair(cells) {
  if (!cells.length) return;
  for (const context of [hairContext, mediumHairContext, shortHairContext]) {
    context.save();
    context.globalCompositeOperation = 'destination-out';
    context.fillStyle = '#000';
    context.beginPath();
    for (const cell of cells) context.rect(cell.x - GRID_STEP / 2, cell.y - GRID_STEP / 2, GRID_STEP, GRID_STEP);
    context.fill();
    context.restore();
  }
}

function clipToolArea(context, center, radius, shape = 'scissors') {
  context.beginPath();
  if (shape === 'blade') {
    const { halfWidth, halfHeight } = bladeFootprint(radius);
    context.rect(center.x - halfWidth, center.y - halfHeight, halfWidth * 2, halfHeight * 2);
  } else if (shape === 'trimmer') {
    const { halfWidth, halfHeight, cornerRadius } = trimmerFootprint(radius);
    context.roundRect(center.x - halfWidth, center.y - halfHeight, halfWidth * 2, halfHeight * 2, cornerRadius);
  } else context.arc(center.x, center.y, radius, 0, Math.PI * 2);
  context.clip();
}

function eraseCells(context, cells, center, radius, direction = { x: 0, y: -1 }, strength = 1, shape = 'scissors') {
  if (!cells.length) return;
  const length = Math.hypot(direction.x, direction.y) || 1;
  const travelX = direction.x / length;
  const travelY = direction.y / length;
  const changed = new Set(cells.map(cell => `${cell.x}:${cell.y}`));
  context.save();
  clipToolArea(context, center, radius, shape);
  context.globalCompositeOperation = 'destination-out';
  context.fillStyle = '#000';
  // Clear every selected tile; the clip prevents blur or strands escaping the circle.
  context.beginPath();
  for (const cell of cells) context.rect(cell.x - GRID_STEP / 2, cell.y - GRID_STEP / 2, GRID_STEP, GRID_STEP);
  context.filter = 'blur(9px)';
  context.globalAlpha = .8 * strength;
  context.fill();
  context.filter = 'none';
  context.globalAlpha = strength;
  context.fill();
  // A fine, directional fringe makes the edge read as clipped strands rather
  // than a chain of round brush stamps.
  const edges = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  for (const cell of cells) {
    for (let edge = 0; edge < edges.length; edge++) {
      const [outX, outY] = edges[edge];
      if (changed.has(`${cell.x + outX * GRID_STEP}:${cell.y + outY * GRID_STEP}`)) continue;
      const tangentX = -outY, tangentY = outX;
      for (let strand = 0; strand < 3; strand++) {
        const seed = edge * 3 + strand;
        const offset = (brushNoise(cell.x, cell.y, seed) - .5) * GRID_STEP;
        const forward = Math.max(0, outX * travelX + outY * travelY);
        const reach = 7 + brushNoise(cell.x, cell.y, seed + 11) * 11 + forward * 9;
        const sway = (brushNoise(cell.x, cell.y, seed + 23) - .5) * 7;
        const width = 1.4 + brushNoise(cell.x, cell.y, seed + 37) * 2.1;
        const rootX = cell.x + outX * (GRID_STEP / 2 - 1) + tangentX * offset;
        const rootY = cell.y + outY * (GRID_STEP / 2 - 1) + tangentY * offset;
        const tipX = rootX + outX * reach + tangentX * sway;
        const tipY = rootY + outY * reach + tangentY * sway;
        context.globalAlpha = (.64 + brushNoise(cell.x, cell.y, seed + 47) * .36) * strength;
        context.beginPath();
        context.moveTo(rootX - tangentX * width, rootY - tangentY * width);
        context.quadraticCurveTo(rootX + outX * reach * .5, rootY + outY * reach * .5, tipX, tipY);
        context.lineTo(rootX + tangentX * width, rootY + tangentY * width);
        context.closePath();
        context.fill();
      }
    }
  }
  context.restore();
}

function eraseBeardCells(context, cells, center, radius, shape = 'scissors') {
  if (!cells.length) return;
  context.save();
  clipToolArea(context, center, radius, shape);
  context.globalCompositeOperation = 'destination-out';
  context.fillStyle = '#000';
  // Each cell carries only the extra coverage needed to reach the strongest
  // point of this drag. The photographed strands fade into the uncut beard.
  for (const cell of cells) {
    const ink = 1 - Math.cbrt(1 - cell.strength);
    context.globalAlpha = ink;
    context.beginPath();
    context.arc(cell.x, cell.y, 3.25, 0, Math.PI * 2);
    context.fill();
  }

  // Tapered cuts follow the grain at the soft rim and stop before the safety edge.
  for (const cell of cells) {
    if (shape === 'blade') continue;
    if (cell.depth > 38 || cell.strength < .08 || brushNoise(cell.x, cell.y, 69) < .35) continue;
    const dx = cell.x - center.x, dy = cell.y - center.y;
    const distance = Math.hypot(dx, dy) || 1;
    const outwardX = dx / distance, outwardY = dy / distance;
    const tangentX = -outwardY, tangentY = outwardX;
    for (let strand = 0; strand < 2; strand++) {
      const seed = strand * 41;
      const offset = (brushNoise(cell.x, cell.y, seed + 71) - .5) * 4;
      const rootX = cell.x + tangentX * offset;
      const rootY = cell.y + tangentY * offset;
      const safeRadius = radius - 6 - brushNoise(cell.x, cell.y, seed + 137) * 13;
      if (shape !== 'trimmer' && Math.hypot(rootX - center.x, rootY - center.y) >= safeRadius) continue;
      const length = 12 + brushNoise(cell.x, cell.y, seed + 83) * 22;
      const sway = (brushNoise(cell.x, cell.y, seed + 97) - .5) * 8;
      const desiredX = rootX + outwardX * length + tangentX * sway;
      const desiredY = rootY + outwardY * length + tangentY * sway;
      const tipDistance = Math.hypot(desiredX - center.x, desiredY - center.y);
      const scale = shape === 'trimmer' ? 1 : tipDistance > safeRadius ? safeRadius / tipDistance : 1;
      const tipX = center.x + (desiredX - center.x) * scale;
      const tipY = center.y + (desiredY - center.y) * scale;
      const width = 2.4 + brushNoise(cell.x, cell.y, seed + 121) * 3.2;
      context.globalAlpha = (1 - Math.cbrt(1 - cell.strength)) * (.55 + brushNoise(cell.x, cell.y, seed + 109) * .4);
      context.beginPath();
      context.moveTo(rootX - tangentX * width / 2, rootY - tangentY * width / 2);
      context.quadraticCurveTo((rootX + tipX) / 2 + tangentX * 2, (rootY + tipY) / 2, tipX, tipY);
      context.quadraticCurveTo((rootX + tipX) / 2 - tangentX * 2, (rootY + tipY) / 2, rootX + tangentX * width / 2, rootY + tangentY * width / 2);
      context.closePath();
      context.fill();
    }
  }
  context.restore();
}

function eraseUnsupportedFringe(cells, center, radius, shape = 'scissors') {
  if (!cells.length) return;
  for (const context of [thickContext, fullContext, shortContext]) {
    context.save();
    clipToolArea(context, center, radius, shape);
    context.globalCompositeOperation = 'destination-out';
    context.fillStyle = '#000';
    for (const cell of cells) {
      context.globalAlpha = cell.strength;
      context.fillRect(cell.x - GRID_STEP / 2, cell.y - GRID_STEP / 2, GRID_STEP, GRID_STEP);
    }
    context.restore();
  }
}

function animateClippings(time) {
  const step = Math.min(2.5, (time - (lastFallingFrame || time)) / 16.67);
  lastFallingFrame = time;
  clippingsContext.clearRect(0, 0, WIDTH, HEIGHT);
  for (let index = falling.length - 1; index >= 0; index--) {
    const piece = falling[index];
    piece.age += step;
    piece.x += piece.vx * step;
    piece.y += piece.vy * step;
    piece.vy += .34 * step;
    piece.angle += piece.spin * step;
    if (piece.age >= piece.life || piece.y > HEIGHT + 40) { falling.splice(index, 1); continue; }
    clippingsContext.save();
    clippingsContext.globalAlpha = Math.min(1, (piece.life - piece.age) / 12);
    clippingsContext.translate(piece.x, piece.y);
    clippingsContext.rotate(piece.angle);
    clippingsContext.drawImage(piece.image, -piece.image.width / 2, -piece.image.height / 2);
    clippingsContext.restore();
  }
  if (falling.length) fallingFrame = requestAnimationFrame(animateClippings);
  else { fallingFrame = 0; lastFallingFrame = 0; }
}

function emitClippings(cells, sources, kind, force = false) {
  if (!cells.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const now = performance.now();
  if (!force && now - lastClippingTime[kind] < 45) return;
  lastClippingTime[kind] = now;
  const count = Math.min(12, cells.length);
  const stride = Math.max(1, Math.floor(cells.length / count));
  for (let index = 0; index < cells.length && index / stride < count; index += stride) {
    const cell = cells[index];
    const source = sources.find(context => context.getImageData(cell.x, cell.y, 1, 1).data[3] > 16);
    if (!source) continue;
    const image = document.createElement('canvas');
    image.width = 26; image.height = 34;
    const context = image.getContext('2d');
    context.drawImage(source.canvas, cell.x - 13, cell.y - 17, 26, 34, 0, 0, 26, 34);
    context.globalCompositeOperation = 'destination-in';
    const feather = context.createRadialGradient(13, 17, 4, 13, 17, 17);
    feather.addColorStop(0, '#fff');
    feather.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = feather;
    context.fillRect(0, 0, 26, 34);
    const seed = brushNoise(cell.x, cell.y, 251);
    falling.push({ image, x: cell.x, y: cell.y, vx: (seed - .5) * 3.5,
      vy: -1 - seed * 1.8, angle: (seed - .5) * .4, spin: (seed - .5) * .045,
      age: 0, life: 35 + seed * 18 });
  }
  if (falling.length > 90) falling.splice(0, falling.length - 90);
  if (falling.length && !fallingFrame) fallingFrame = requestAnimationFrame(animateClippings);
}

function emitFineClippings(cells, point, kind, guardMm) {
  if (!cells.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const key = kind === 'hair' ? 'fineHair' : 'fineBeard';
  const now = performance.now();
  if (now - lastClippingTime[key] < 85) return;
  lastClippingTime[key] = now;
  const count = Math.min(guardMm === 1 ? 2 : 3, Math.ceil(cells.length / 5));
  const stride = Math.max(1, Math.floor(cells.length / count));
  for (let index = 0; index < cells.length && index / stride < count; index += stride) {
    const cell = cells[index];
    const seed = brushNoise(cell.x, cell.y, guardMm + (kind === 'beard' ? 359 : 307));
    const size = guardMm === 1 ? 10 : 14;
    const image = document.createElement('canvas');
    image.width = size;
    image.height = size;
    const context = image.getContext('2d');
    context.strokeStyle = kind === 'beard' ? '#302b29' : '#272424';
    context.lineWidth = guardMm === 1 ? 1.5 : 2;
    context.lineCap = 'round';
    for (let strand = 0; strand < (guardMm === 1 ? 1 : 2); strand++) {
      const offset = (strand - .5) * 3;
      context.beginPath();
      context.moveTo(size * .28 + offset, size * .25);
      context.quadraticCurveTo(size * (.5 + seed * .12) + offset, size * .45,
        size * (.6 + seed * .12) + offset, size * .73);
      context.stroke();
    }
    falling.push({ image, x: point.x - 20 - seed * 20, y: point.y + 10 + seed * 8,
      vx: (seed - .5) * 2, vy: -.4 - seed * .7, angle: (seed - .5) * .5,
      spin: (seed - .5) * .035, age: 0, life: 35 + seed * 10 });
  }
  if (falling.length > 90) falling.splice(0, falling.length - 90);
  if (falling.length && !fallingFrame) fallingFrame = requestAnimationFrame(animateClippings);
}

function collectDetachedBeard(cells) {
  for (const cell of cells) detachedBeard.set(`${cell.x}:${cell.y}`, cell);
}

function dropDetachedBeard() {
  if (!detachedBeard.size) return;
  emitClippings([...detachedBeard.values()], [thickContext, fullContext, shortContext], 'beard');
  // These tiles sit outside the face and were attached to a root shaved during
  // this stroke. Remove only those exact fibers when the tool lifts.
  for (const context of [thickContext, fullContext, shortContext]) {
    context.save();
    context.globalCompositeOperation = 'destination-out';
    context.fillStyle = '#000';
    context.beginPath();
    for (const cell of detachedBeard.values()) {
      context.rect(cell.x - GRID_STEP / 2, cell.y - GRID_STEP / 2, GRID_STEP, GRID_STEP);
    }
    context.fill();
    context.restore();
  }
  detachedBeard.clear();
}

function localPoint(clientX, clientY) {
  const rect = stage.getBoundingClientRect();
  if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
  return { x: (clientX - rect.left) * WIDTH / rect.width, y: (clientY - rect.top) * HEIGHT / rect.height };
}
function drawCut(x, y) {
  const patterns = [
    { start: [-13, 1], bend: [-2, -2], end: [12, 0], width: 2 },
    { start: [-9, -3], bend: [-1, 1], end: [10, 3], width: 1.8 },
    { start: [-15, 2], bend: [1, -2], end: [15, -1], width: 2.2 },
    { start: [-7, 1], bend: [0, -1], end: [8, -2], width: 1.7 },
  ];
  const mark = patterns[Math.floor(Math.random() * patterns.length)];
  cutContext.save();
  cutContext.translate(x, y);
  cutContext.rotate((Math.random() - .5) * .85);
  cutContext.lineCap = 'round';
  cutContext.lineJoin = 'round';
  cutContext.beginPath();
  cutContext.moveTo(...mark.start);
  cutContext.quadraticCurveTo(...mark.bend, ...mark.end);
  cutContext.strokeStyle = 'rgba(176, 80, 71, .24)';
  cutContext.lineWidth = mark.width + 6;
  cutContext.shadowColor = 'rgba(174, 72, 65, .18)';
  cutContext.shadowBlur = 5;
  cutContext.stroke();
  cutContext.shadowBlur = 0;
  cutContext.strokeStyle = 'rgba(103, 39, 36, .72)';
  cutContext.lineWidth = mark.width;
  cutContext.stroke();
  cutContext.strokeStyle = 'rgba(222, 132, 119, .62)';
  cutContext.lineWidth = .7;
  cutContext.stroke();
  if (Math.random() < .18) {
    cutContext.fillStyle = 'rgba(123, 44, 39, .74)';
    cutContext.beginPath();
    cutContext.ellipse(mark.end[0], mark.end[1] + 1.5, 1.1, 1.5, -.2, 0, Math.PI * 2);
    cutContext.fill();
  }
  cutContext.restore();
}
function setStatus(message) { status.textContent = message; }
function drawPreview(point) {
  previewContext.clearRect(0, 0, WIDTH, HEIGHT);
  if (!point || !game || !tool) return;
  const radius = toolAreas[tool];
  previewContext.save();
  previewContext.beginPath();
  if (tool === 'blade') {
    const { halfWidth, halfHeight } = bladeFootprint(radius);
    previewContext.rect(point.x - halfWidth, point.y - halfHeight, halfWidth * 2, halfHeight * 2);
  } else if (tool === 'trimmer') {
    const { halfWidth, halfHeight, cornerRadius } = trimmerFootprint(radius);
    previewContext.roundRect(point.x - halfWidth, point.y - halfHeight, halfWidth * 2, halfHeight * 2, cornerRadius);
  } else previewContext.arc(point.x, point.y, radius, 0, Math.PI * 2);
  previewContext.fillStyle = tool === 'blade' ? 'rgba(255, 118, 86, .30)' : 'rgba(255, 218, 103, .28)';
  previewContext.fill();
  previewContext.setLineDash([9, 7]);
  previewContext.lineWidth = 3;
  previewContext.strokeStyle = '#fff1d6';
  previewContext.shadowColor = 'rgba(0,0,0,.75)';
  previewContext.shadowBlur = 9;
  previewContext.stroke();
  previewContext.restore();
}
function applyStroke(clientX, clientY) {
  if (!game || !tool) return;
  const point = localPoint(clientX, clientY);
  if (!point) return;
  const { x, y } = point;
  const direction = lastPoint ? { x: clientX - lastPoint.x, y: clientY - lastPoint.y } : { x: 0, y: -1 };
  const radius = toolAreas[tool];
  const madeCut = tool === 'blade' && game.tryBladeCut(x, y, strokeId);
  const changes = game.stroke(x, y, tool, radius, strokeId, tool === 'trimmer' ? trimmerGuardMm : null);
  if (changes.longHair.length || changes.fourMmFinished.length || changes.mediumHair.length || changes.shortHair.length || changes.stubbleHair.length || changes.buzzHair.length || changes.fineHair.length || changes.hairFringe.length) hairTouchedStroke = true;
  collectDetachedBeard(changes.beardOrphans);
  const fineTrim = tool === 'trimmer' && trimmerGuardMm <= 2;
  const gentleFour = tool === 'trimmer' && trimmerGuardMm === 4;
  const completedLongHair = gentleFour
    ? changes.longHair.filter(cell => cell.fourMmPasses >= 3) : changes.longHair;
  emitClippings(fineTrim ? changes.hairFringe : [...changes.hairFringe, ...completedLongHair],
    [hairContext, mediumHairContext], 'hair');
  emitClippings(changes.beardFringe, [thickContext, fullContext, shortContext], 'beard');
  if (gentleFour) emitFineClippings(changes.longHair.filter(cell => cell.fourMmPasses < 3),
    point, 'hair', 2);
  if (fineTrim) {
    emitFineClippings(trimmerGuardMm === 1 ? changes.stubbleHair : changes.shortHair,
      point, 'hair', trimmerGuardMm);
    emitFineClippings(trimmerGuardMm === 1 ? changes.beardGuardShort : changes.full,
      point, 'beard', trimmerGuardMm);
  }
  if (tool === 'scissors') {
    eraseCells(hairContext, changes.longHair, point, radius, direction);
    eraseBeardCells(thickContext, changes.beardRetouch.thick, point, radius);
    eraseUnsupportedFringe(changes.beardFringe, point, radius);
    if (changes.longHair.length || changes.thick.length) {
      sounds.snip();
      haptics.cut('scissors');
      setStatus(changes.thick.length
        ? 'Beard snipped down. The trimmer can take it shorter.'
        : 'Long hair cut to medium. Use the trimmer for a shorter cut.');
    }
    return;
  }
  if (tool === 'trimmer') {
    if (gentleFour) {
      // Keep the original dark strands intact on the light passes. Overlapping
      // brush stamps compound even a weak erase into a transparent grey notch.
      // The third visit cuts the cell to the 4 mm layer in one bounded stroke.
      eraseCells(hairContext, changes.longHair.filter(cell => cell.fourMmPasses >= 3),
        point, radius, direction, 1, 'trimmer');
    } else eraseCells(hairContext, changes.longHair, point, radius, direction, 1, 'trimmer');
    eraseCells(mediumHairContext, changes.mediumHair, point, radius, direction, 1, 'trimmer');
    eraseCells(shortHairContext, changes.shortHair, point, radius, direction, 1, 'trimmer');
    eraseCells(stubbleHairContext, changes.stubbleHair, point, radius, direction, 1, 'trimmer');
    eraseUnanchoredHair(changes.fourMmFinished, point, radius, 'trimmer', outsideMediumMask);
    eraseUnanchoredHair([...changes.mediumHair, ...changes.shortHair], point, radius, 'trimmer');
    eraseDetachedHair(changes.hairFringe);
    eraseBeardCells(thickContext, changes.beardRetouch.thick, point, radius, 'trimmer');
    eraseBeardCells(fullContext, changes.beardRetouch.full, point, radius, 'trimmer');
    eraseCells(fullContext, changes.beardGuardFull, point, radius, direction, .35, 'trimmer');
    eraseCells(shortContext, changes.beardGuardShort, point, radius, direction, .48, 'trimmer');
    eraseUnsupportedFringe(changes.beardFringe, point, radius, 'trimmer');
    if (changes.thick.length || changes.full.length || changes.beardGuardFull.length || changes.beardGuardShort.length
      || changes.longHair.length || changes.mediumHair.length || changes.shortHair.length || changes.stubbleHair.length) {
      setStatus(gentleFour && changes.longHair.some(cell => cell.fourMmPasses < 3)
        ? 'Light 4 mm trim. Pass over the same spot again for a shorter cut.'
        : `Trimmed with the ${trimmerGuardMm} mm guard. Switch to a smaller guard for a closer cut.`);
    }
    return;
  }
  if (madeCut) {
    drawCut(x, y);
    setStatus('Ouch! Aakash would like to speak to the manager.');
    cutThisStroke = true;
  }
  if (changes.longHair.length) eraseCells(hairContext, changes.longHair, point, radius, direction, 1, 'blade');
  if (changes.mediumHair.length) eraseCells(mediumHairContext, changes.mediumHair, point, radius, direction, 1, 'blade');
  if (changes.shortHair.length) eraseCells(shortHairContext, changes.shortHair, point, radius, direction, 1, 'blade');
  if (changes.stubbleHair.length) eraseCells(stubbleHairContext, changes.stubbleHair, point, radius, direction, 1, 'blade');
  if (changes.buzzHair.length) {
    eraseCells(buzzHairContext, changes.buzzHair, point, radius, direction, 1, 'blade');
  }
  if (changes.fineHair.length) eraseCells(fineHairContext, changes.fineHair, point, radius, direction, 1, 'blade');
  eraseDetachedHair(changes.hairFringe);
  eraseBeardCells(thickContext, changes.beardRetouch.thick, point, radius, 'blade');
  eraseBeardCells(fullContext, changes.beardRetouch.full, point, radius, 'blade');
  eraseBeardCells(shortContext, changes.beardRetouch.short, point, radius, 'blade');
  eraseUnsupportedFringe(changes.beardFringe, point, radius, 'blade');
  const shavedBeard = changes.thick.length || changes.full.length || changes.short.length;
  const shavedHair = changes.longHair.length || changes.mediumHair.length || changes.shortHair.length || changes.stubbleHair.length || changes.buzzHair.length || changes.fineHair.length;
  if (shavedBeard || shavedHair) {
    sounds.scrape();
    haptics.cut('blade');
  } else if (game.isBareFace(x, y)) {
    sounds.scrape(.3);
    haptics.cut('blade');
  }
  if (cutThisStroke) return;
  if (shavedBeard) {
    setStatus('Clean shave! Keep the blade steady.');
  } else if (shavedHair) {
    setStatus('Hair shaved clean.');
  }
}

function chooseTool(next) {
  if (tool === next) return;
  tool = next;
  for (const name of ['scissors', 'trimmer', 'blade']) {
    const button = $(`#tool-${name}`);
    button.classList.toggle('is-active', name === next);
    button.setAttribute('aria-pressed', String(name === next));
  }
  cursorImage.src = next === 'scissors' ? '/assets/scissors-cursor-small.png' : next === 'blade' ? '/assets/blade-cursor-small.png' : '/assets/trimmer-cursor-small.png';
  cursor.classList.toggle('is-blade', next === 'blade');
  cursor.classList.toggle('is-scissors', next === 'scissors');
  stage.style.cursor = 'none';
  $('#trimmer-guards').hidden = next !== 'trimmer';
  drawPreview(lastHover);
}
for (const button of document.querySelectorAll('[data-guard]')) {
  button.addEventListener('click', () => {
    trimmerGuardMm = Number(button.dataset.guard);
    for (const option of document.querySelectorAll('[data-guard]')) {
      option.setAttribute('aria-pressed', String(option === button));
    }
    setStatus(`${trimmerGuardMm} mm guard selected. Lower settings leave finer hair.`);
  });
}
for (const name of ['scissors', 'trimmer', 'blade']) {
  $(`#tool-${name}`).addEventListener('click', () => chooseTool(name));
}
chooseTool('trimmer');

startButton.addEventListener('click', async () => {
  if (started || !game) return;
  started = true;
  startButton.disabled = true;
  sounds.unlock();
  radio.start();
  await sounds.whenReady();
  sounds.spray();
  waterSpray.play();
  $('.start-dock').hidden = true;
  $('.tool-dock').hidden = false;
  setStatus('Barbershop open. Choose a tool and give Aakash a wedding trim.');
  requestAnimationFrame(fitStage);
});

function moveCursor(event) {
  cursor.style.left = `${event.clientX}px`;
  cursor.style.top = `${event.clientY}px`;
  lastHover = localPoint(event.clientX, event.clientY);
  drawPreview(lastHover);
  cursor.classList.toggle('is-visible', started && !!lastHover && !!tool && event.pointerType !== 'touch');
}
stage.addEventListener('pointerdown', event => {
  if (event.button !== 0 || !game || !started) return;
  const point = localPoint(event.clientX, event.clientY);
  if (!point) return;
  event.preventDefault();
  active = true;
  strokeId++;
  lastPoint = { x: event.clientX, y: event.clientY };
  cutThisStroke = false;
  hairTouchedStroke = false;
  sounds.start(tool);
  haptics.start(tool);
  stage.setPointerCapture(event.pointerId);
  moveCursor(event);
  applyStroke(event.clientX, event.clientY);
});
stage.addEventListener('pointermove', event => {
  moveCursor(event);
  if (!active || !lastPoint) return;
  event.preventDefault();
  const distance = Math.hypot(event.clientX - lastPoint.x, event.clientY - lastPoint.y);
  const steps = Math.max(1, Math.ceil(distance / 8));
  for (let i = 1; i <= steps; i++) {
    const fraction = i / steps;
    applyStroke(lastPoint.x + (event.clientX - lastPoint.x) * fraction,
      lastPoint.y + (event.clientY - lastPoint.y) * fraction);
  }
  lastPoint = { x: event.clientX, y: event.clientY };
});
function releasePointer(event) {
  if (active) {
    if (hairTouchedStroke) {
      const floating = game.pruneFloatingHair();
      emitClippings(floating, [hairContext, mediumHairContext, shortHairContext], 'hair', true);
      eraseDetachedHair(floating);
    }
    dropDetachedBeard();
  }
  active = false; lastPoint = null; cutThisStroke = false;
  hairTouchedStroke = false;
  sounds.stop();
  haptics.stop();
  if (event?.pointerType === 'touch') { lastHover = null; drawPreview(null); }
  drawPreview(lastHover);
  cursor.classList.toggle('is-visible', !!lastHover && !!tool && event?.pointerType !== 'touch');
}
stage.addEventListener('pointerup', releasePointer);
stage.addEventListener('pointercancel', releasePointer);
window.addEventListener('blur', releasePointer);
document.addEventListener('visibilitychange', () => { if (document.hidden) releasePointer(); });
stage.addEventListener('pointerleave', () => {
  if (!active) { lastHover = null; drawPreview(null); cursor.classList.remove('is-visible'); }
});

function portraitCard() {
  const canvas = document.createElement('canvas');
  canvas.width = 1080; canvas.height = 1350;
  const context = canvas.getContext('2d');
  context.fillStyle = '#182a91'; context.fillRect(0, 0, 1080, 1350);
  context.fillStyle = '#ffda67'; context.fillRect(0, 0, 1080, 18);
  context.fillStyle = '#ffda67'; context.textAlign = 'center'; context.font = '800 27px "Bricolage Grotesque", sans-serif';
  context.fillText('SHAVE THE DATE', 540, 85);
  const x = 180, y = 125, width = 720, height = width * HEIGHT / WIDTH;
  context.save();
  context.beginPath(); context.roundRect(x, y, width, height, 24); context.clip();
  for (const layer of [base, sideburnClean, fineHair, buzzHair, stubbleHair, shortHair, mediumHair, hair, shortBeard, fullBeard, thickBeard, cuts]) context.drawImage(layer, x, y, width, height);
  context.restore();
  context.fillStyle = '#fff1d6'; context.font = '800 62px "Bricolage Grotesque", sans-serif';
  context.fillText('Aakash’s new look', 540, 1185);
  context.fillStyle = '#ffda67'; context.font = 'bold 24px DM Sans, sans-serif';
  context.fillText('AAKASH’S WEDDING  ✦  15 NOVEMBER', 540, 1240);
  context.fillStyle = '#fff1d6'; context.font = '500 23px DM Sans, sans-serif';
  context.fillText(SITE_URL, 540, 1292);
  return canvas;
}
$('#share-button').addEventListener('click', async () => {
  if (!game) return;
  const card = portraitCard();
  const blob = await new Promise(resolve => card.toBlob(resolve, 'image/png'));
  if (!blob) { setStatus('Could not make the image. Please try again.'); return; }
  const file = new File([blob], 'shave-the-date-aakash.png', { type: 'image/png' });
  const download = async () => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = file.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    try {
      await navigator.clipboard.writeText(SITE_URL);
      setStatus('Your look is downloaded and the website link is copied.');
    } catch {
      setStatus(`Your look is downloaded. Share it with ${SITE_URL}`);
    }
  };
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Shave the Date', text: SHARE_TEXT });
    } else {
      await download();
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('Could not open the share sheet; downloading portrait instead', error);
      await download();
    }
  }
});
