import * as THREE from '../vendor/three.module.js';
import { createAvatar } from './realistic-avatar.js?v=24';
import { verdictFor } from './verdict.js';

const $ = selector => document.querySelector(selector);
const sceneElement = $('#scene');
const loading = $('#loading');
const status = $('#status-text');
const cursor = $('#cursor-tool');
let selectedTool = 'trimmer';
let pointerDown = false;
let dragMode = 'shave';
let lastPointer = null;
let riskyTime = 0;
let lastWarning = 0;

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-2.15, 2.15, 2.15, -2.15, 0.1, 100);
camera.position.set(0, .58, 7.5);
camera.lookAt(0, .30, 0);

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  sceneElement.appendChild(renderer.domElement);
} catch (error) {
  console.error('3D renderer unavailable', error);
  loading.textContent = 'This device could not start the 3D barber chair.';
}

scene.add(new THREE.HemisphereLight('#fff8e9', '#758d78', 2.25));
const keyLight = new THREE.DirectionalLight('#ffe4bd', 3.0);
keyLight.position.set(-2.8, 4, 5);
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight('#f8e7d8', 1.7);
rimLight.position.set(3.6, 1.8, -3);
scene.add(rimLight);
const fillLight = new THREE.PointLight('#fff8e9', 0.8);
fillLight.position.set(2.2, -.1, 4);
scene.add(fillLight);

const faceData = await fetch('/assets/aakash-face.json?v=7').then(response => {
  if (!response.ok) throw new Error('Could not load Aakash face geometry');
  return response.json();
});
const avatar = createAvatar(scene, faceData);
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function resize() {
  if (!renderer) return;
  const width = sceneElement.clientWidth;
  const height = sceneElement.clientHeight;
  if (!width || !height) return;
  const viewHeight = window.innerWidth <= 540 ? 4.54 : 4.50;
  camera.top = viewHeight / 2;
  camera.bottom = -viewHeight / 2;
  camera.left = -viewHeight * width / height / 2;
  camera.right = viewHeight * width / height / 2;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

new ResizeObserver(resize).observe(sceneElement);
window.addEventListener('resize', resize);
resize();

function animate() {
  requestAnimationFrame(animate);
  avatar.update();
  if (renderer) renderer.render(scene, camera);
}
animate();
avatar.ready.then(() => loading.classList.add('is-hidden')).catch(error => {
  console.error('Face texture unavailable', error);
  loading.textContent = 'Aakash’s face could not load. Refresh to try again.';
});

function setStatus(message) { status.textContent = message; }
function updateProgress() { return avatar.progress(); }

function chooseTool(tool) {
  selectedTool = tool;
  riskyTime = 0;
  $('#tool-trimmer').classList.toggle('is-active', tool === 'trimmer');
  $('#tool-blade').classList.toggle('is-active', tool === 'blade');
  $('#tool-trimmer').setAttribute('aria-pressed', String(tool === 'trimmer'));
  $('#tool-blade').setAttribute('aria-pressed', String(tool === 'blade'));
  cursor.textContent = tool === 'trimmer' ? '✂' : '🪒';
  cursor.classList.toggle('is-blade', tool === 'blade');
  setStatus(tool === 'trimmer' ? 'Drag over the beard or hair to trim it short.' : 'Gently drag over the stubble for a clean shave.');
}

$('#tool-trimmer').addEventListener('click', () => chooseTool('trimmer'));
$('#tool-blade').addEventListener('click', () => chooseTool('blade'));
function hitAt(clientX, clientY) {
  const rect = sceneElement.getBoundingClientRect();
  mouse.x = (clientX - rect.left) / rect.width * 2 - 1;
  mouse.y = -((clientY - rect.top) / rect.height * 2 - 1);
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(avatar.pickables, false);
  if (!hits.length) return null;
  const hit = hits[0];
  return { zone: hit.object.userData.zone, point: avatar.group.worldToLocal(hit.point.clone()) };
}

function applyStroke(clientX, clientY, speed = 0, elapsed = 0) {
  const hit = hitAt(clientX, clientY);
  if (!hit) { riskyTime = Math.max(0, riskyTime - elapsed); return; }
  const { x, y } = hit.point;
  if (hit.zone === 'scalp') {
    if (selectedTool === 'trimmer') {
      const changed = avatar.trimScalp(x, y);
      if (changed) setStatus('A little off the top. Looking better already.');
    } else setStatus('The blade is for his face. Try the trimmer up here.');
    riskyTime = 0;
    return;
  }
  if (selectedTool === 'trimmer') {
    const changed = avatar.shaveFace(x, y, 'trimmer');
    if (changed) {
      setStatus('Nice trim! Switch to the blade to clear the stubble.');
      updateProgress();
    }
    riskyTime = 0;
    return;
  }
  // A sustained fast pass on bare skin earns a nick. The warning is visible
  // first; neither the cut nor its timing is random.
  if (speed > .0022 && avatar.nearbyBareSkin(x, y)) {
    riskyTime += elapsed;
    if (riskyTime > 115 && performance.now() - lastWarning > 600) {
      setStatus('Easy does it… slow that blade down!');
      lastWarning = performance.now();
    }
    if (riskyTime > 320) {
      if (avatar.addCut(x, y)) {
        setStatus('Ouch! Aakash would like to speak to the manager.');
        riskyTime = -1000;
      }
    }
  } else riskyTime = Math.max(0, riskyTime - elapsed * 1.4);

  const changed = avatar.shaveFace(x, y, 'blade');
  if (changed) {
    setStatus('Clean shave! Keep the blade steady.');
    updateProgress();
  } else if (!avatar.nearbyBareSkin(x, y) && y < .05 && y > -1.01) {
    setStatus('Trim the long beard first, then use the blade.');
  }
}

function moveCursor(event) {
  cursor.style.left = `${event.clientX}px`;
  cursor.style.top = `${event.clientY}px`;
  cursor.classList.toggle('is-visible', pointerDown && dragMode === 'shave' && event.pointerType !== 'touch');
}

sceneElement.addEventListener('pointerleave', () => { if (!pointerDown) cursor.classList.remove('is-visible'); });
sceneElement.addEventListener('pointerdown', event => {
  if (event.button !== 0 || !renderer) return;
  event.preventDefault();
  pointerDown = true;
  dragMode = hitAt(event.clientX, event.clientY) ? 'shave' : 'rotate';
  lastPointer = { x: event.clientX, y: event.clientY, t: performance.now() };
  riskyTime = 0;
  sceneElement.setPointerCapture(event.pointerId);
  moveCursor(event);
  if (dragMode === 'shave') applyStroke(event.clientX, event.clientY);
});
sceneElement.addEventListener('pointermove', event => {
  moveCursor(event);
  if (!pointerDown || !lastPointer) return;
  event.preventDefault();
  if (dragMode === 'rotate') {
    avatar.setRotation(avatar.getRotation() + (event.clientX - lastPointer.x) * .004);
    lastPointer = { x: event.clientX, y: event.clientY, t: performance.now() };
    return;
  }
  const now = performance.now();
  const elapsed = Math.max(1, now - lastPointer.t);
  const distance = Math.hypot(event.clientX - lastPointer.x, event.clientY - lastPointer.y);
  const speed = distance / elapsed / Math.max(1, sceneElement.clientHeight);
  const steps = Math.max(1, Math.ceil(distance / 14));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    applyStroke(lastPointer.x + (event.clientX - lastPointer.x) * t,
      lastPointer.y + (event.clientY - lastPointer.y) * t, speed, elapsed / steps);
  }
  lastPointer = { x: event.clientX, y: event.clientY, t: now };
});
function releasePointer() { pointerDown = false; lastPointer = null; riskyTime = 0; cursor.classList.remove('is-visible'); }
sceneElement.addEventListener('pointerup', releasePointer);
sceneElement.addEventListener('pointercancel', releasePointer);

function closeModal() {
  $('#result-modal').hidden = true;
  $('#finish-button').focus();
}
function restart() {
  closeModal();
  cursor.classList.remove('is-visible');
  avatar.reset();
  chooseTool('trimmer');
  updateProgress();
  setStatus('Fresh chair, fresh beard. Start with the trimmer.');
}
$('#result-retry').addEventListener('click', restart);
$('#close-modal').addEventListener('click', closeModal);
$('#result-modal .modal-backdrop').addEventListener('click', closeModal);
window.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeModal();
  if (event.key === '1') chooseTool('trimmer');
  if (event.key === '2') chooseTool('blade');
  if (event.key === 'ArrowLeft') avatar.setRotation(avatar.getRotation() - .24);
  if (event.key === 'ArrowRight') avatar.setRotation(avatar.getRotation() + .24);
});

let finalSuccess = false;
$('#finish-button').addEventListener('click', () => {
  const verdict = verdictFor(updateProgress(), avatar.cutCount);
  finalSuccess = verdict.invited;
  cursor.classList.remove('is-visible');
  $('#result-modal').hidden = false;
  $('#close-modal').focus();
  $('.result-card').classList.toggle('is-fail', !finalSuccess);
  $('#result-icon').textContent = finalSuccess ? '✦' : '✂';
  $('#result-title').textContent = finalSuccess ? 'Invited' : 'Not invited';
  $('#result-copy').textContent = verdict.copy;
  $('#result-retry').textContent = 'Try again';
});

function portraitCard() {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f7f0e2';
  ctx.fillRect(0, 0, 1080, 1350);
  ctx.fillStyle = '#304a39';
  ctx.fillRect(0, 0, 1080, 18);
  ctx.fillStyle = '#ac4e3a';
  ctx.font = 'bold 27px DM Sans, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SHAVE THE DATE', 540, 105);
  ctx.fillStyle = '#b9c9ad';
  ctx.beginPath();
  ctx.roundRect(66, 151, 948, 900, 36);
  ctx.fill();
  if (renderer) {
    renderer.render(scene, camera);
    const source = renderer.domElement;
    const scale = Math.min(850 / source.width, 870 / source.height);
    const w = source.width * scale;
    const h = source.height * scale;
    ctx.drawImage(source, 540 - w / 2, 155 + (895 - h) / 2, w, h);
  }
  ctx.fillStyle = '#2d4937';
  ctx.font = 'bold 71px Fraunces, Georgia, serif';
  ctx.fillText(finalSuccess ? 'Invited' : 'Not invited', 540, 1150);
  ctx.fillStyle = '#aa4f3c';
  ctx.font = 'bold 28px DM Sans, sans-serif';
  ctx.fillText('SHAVE THE DATE   ✦   AAKASH’S WEDDING   ✦   15 NOVEMBER', 540, 1220);
  ctx.fillStyle = '#7e897a';
  ctx.font = '23px DM Sans, sans-serif';
  ctx.fillText('A masterpiece from the barber chair', 540, 1284);
  return canvas;
}

$('#result-share').addEventListener('click', async () => {
  const card = portraitCard();
  const url = card.toDataURL('image/png');
  const bytes = Uint8Array.from(atob(url.split(',')[1]), char => char.charCodeAt(0));
  const file = new File([bytes], 'shave-the-date-aakash.png', { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Shave the Date', text: 'I gave Aakash a wedding makeover!' }); return; }
    catch (error) { if (error.name === 'AbortError') return; }
  }
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.click();
  $('#result-share').textContent = 'IMAGE SAVED ✓';
  setTimeout(() => { $('#result-share').textContent = 'SHARE THIS LOOK ↗'; }, 2500);
});
