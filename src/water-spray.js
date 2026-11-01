const FRAME_COUNT = 12;
const FRAME_WIDTH = 700;
const FRAME_HEIGHT = 430;
const BOTTLE_X = 80;
const BOTTLE_Y = 185;
const BOTTLE_WIDTH = 260;
const BOTTLE_HEIGHT = 566;
// The nozzle is the small cylinder at the upper right of the source photo.
// Keep the mist anchored to its tip as the bottle rocks during the animation.
const NOZZLE_X = BOTTLE_WIDTH * (329 / 340);
const NOZZLE_Y = BOTTLE_HEIGHT * (25 / 740);
const MIST_ROOT_Y = 195;

export function createWaterSpray(canvas) {
  const context = canvas.getContext('2d');
  const sprite = new Image();
  sprite.src = '/assets/water-spray-sprite.png?v=1';
  const bottle = new Image();
  bottle.src = '/assets/water-spray-bottle-realistic.png?v=1';
  let animation = 0;
  let run = 0;

  return {
    async play() {
      const currentRun = ++run;
      cancelAnimationFrame(animation);
      context.clearRect(0, 0, canvas.width, canvas.height);
      try { await Promise.all([sprite.decode(), bottle.decode()]); } catch { return; }
      if (currentRun !== run) return;
      const begin = performance.now();
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const duration = reduced ? 300 : 1600;
      function tick(now) {
        const elapsed = now - begin;
        context.clearRect(0, 0, canvas.width, canvas.height);
        if (elapsed >= duration) return;
        const frame = Math.min(FRAME_COUNT - 1, Math.floor(elapsed / (duration / FRAME_COUNT)));
        const angle = -0.025 * Math.sin(elapsed / 115);
        const nozzleX = BOTTLE_X + Math.cos(angle) * NOZZLE_X - Math.sin(angle) * NOZZLE_Y;
        const nozzleY = BOTTLE_Y + Math.sin(angle) * NOZZLE_X + Math.cos(angle) * NOZZLE_Y;
        context.globalAlpha = Math.min(1, (duration - elapsed) / 230);
        // Crop away the sprite's bottle and place its mist at the photo nozzle.
        context.drawImage(sprite,
          (frame % 4) * FRAME_WIDTH + 215, Math.floor(frame / 4) * FRAME_HEIGHT,
          FRAME_WIDTH - 215, FRAME_HEIGHT,
          nozzleX, nozzleY - MIST_ROOT_Y, FRAME_WIDTH - 215, FRAME_HEIGHT);
        context.save();
        context.translate(BOTTLE_X, BOTTLE_Y);
        context.rotate(angle);
        context.drawImage(bottle, 0, 0, BOTTLE_WIDTH, BOTTLE_HEIGHT);
        context.restore();
        context.globalAlpha = 1;
        animation = requestAnimationFrame(tick);
      }
      animation = requestAnimationFrame(tick);
    },
  };
}
