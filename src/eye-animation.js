// Each frame is a narrow crop of the same portrait. The soft masks keep the
// generated frames on the eyelids only, leaving Aakash's sideburns and beard
// entirely in the original, groomable layers.
const CROP = { x: 286, y: 570, width: 496, height: 128 };
const EYES = [
  { x: 395, y: 626, rx: 89, ry: 45 },
  { x: 663, y: 624, rx: 88, ry: 44 },
];
const GAZES = ['left', 'right', 'up', 'down'];

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function maskedSprite(image) {
  const canvas = document.createElement('canvas');
  canvas.width = CROP.width;
  canvas.height = CROP.height;
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0, CROP.width, CROP.height);
  const mask = document.createElement('canvas');
  mask.width = CROP.width;
  mask.height = CROP.height;
  const maskContext = mask.getContext('2d');
  for (const eye of EYES) {
    maskContext.save();
    maskContext.translate(eye.x - CROP.x, eye.y - CROP.y);
    maskContext.scale(eye.rx, eye.ry);
    const edge = maskContext.createRadialGradient(0, 0, .7, 0, 0, 1);
    edge.addColorStop(0, '#fff');
    edge.addColorStop(1, 'rgba(255,255,255,0)');
    maskContext.fillStyle = edge;
    maskContext.beginPath();
    maskContext.arc(0, 0, 1, 0, Math.PI * 2);
    maskContext.fill();
    maskContext.restore();
  }
  context.globalCompositeOperation = 'destination-in';
  context.drawImage(mask, 0, 0);
  context.globalCompositeOperation = 'source-over';
  return canvas;
}

function gazeToward(clientX, clientY, stage) {
  const bounds = stage.getBoundingClientRect();
  const x = (clientX - bounds.left) / bounds.width * 1086;
  const y = (clientY - bounds.top) / bounds.height * 1448;
  const dx = (x - 529) / 220;
  const dy = (y - 625) / 180;
  if (Math.hypot(dx, dy) < .22) return 'center';
  if (Math.abs(dx) > Math.abs(dy) * .88) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'up' : 'down';
}

export async function startEyeAnimation(canvas, stage) {
  const names = ['half', 'closed', ...GAZES];
  const images = await Promise.all(names.map(name => loadImage(`/assets/eyes/${name}.webp?v=1`)));
  const sprites = Object.fromEntries(names.map((name, index) => [name, maskedSprite(images[index])]));
  const context = canvas.getContext('2d');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let gaze = 'center';
  let requestedGaze = gaze;
  let frame = gaze;
  let gazeTimer;
  let blinkTimer;
  let blinkSteps = [];

  function render(name) {
    frame = name;
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (sprites[name]) context.drawImage(sprites[name], CROP.x, CROP.y);
  }

  function scheduleBlink() {
    clearTimeout(blinkTimer);
    if (document.hidden || reducedMotion.matches) return;
    blinkTimer = setTimeout(blink, 2900 + Math.random() * 4800);
  }

  function blink() {
    if (document.hidden) return;
    render('half');
    blinkSteps = [
      setTimeout(() => render('closed'), 55),
      setTimeout(() => render('half'), 130),
      setTimeout(() => { render(gaze); scheduleBlink(); }, 205),
    ];
  }

  function onPointerMove(event) {
    const next = gazeToward(event.clientX, event.clientY, stage);
    if (next === requestedGaze) return;
    requestedGaze = next;
    clearTimeout(gazeTimer);
    gazeTimer = setTimeout(() => {
      gaze = requestedGaze;
      if (frame !== 'half' && frame !== 'closed') render(gaze);
    }, 70);
  }

  function onVisibilityChange() {
    clearTimeout(blinkTimer);
    for (const timer of blinkSteps) clearTimeout(timer);
    blinkSteps = [];
    render(gaze);
    scheduleBlink();
  }

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  document.addEventListener('visibilitychange', onVisibilityChange);
  reducedMotion.addEventListener?.('change', onVisibilityChange);
  scheduleBlink();
}
