// Vibration is available on some mobile browsers. Patterns change the feel,
// while the device itself controls the physical intensity.
export function createBarberHaptics({
  vibrate = globalThis.navigator?.vibrate?.bind(globalThis.navigator),
  schedule = globalThis.setInterval,
  cancel = globalThis.clearInterval,
  now = () => performance.now(),
  visible = () => globalThis.document?.visibilityState !== 'hidden',
} = {}) {
  const trimmerPattern = [90, 25, 90, 25, 90];
  let activeTool = null;
  let trimmerTimer = null;
  let lastScissors = -Infinity;
  let lastBlade = -Infinity;

  function emit(pattern) {
    if (typeof vibrate !== 'function' || !visible()) return;
    try { vibrate(pattern); } catch { /* Haptics are optional on this device. */ }
  }

  function stop() {
    if (trimmerTimer !== null) {
      cancel(trimmerTimer);
      trimmerTimer = null;
    }
    activeTool = null;
    if (typeof vibrate === 'function') {
      try { vibrate(0); } catch { /* Nothing to stop on this device. */ }
    }
  }

  function start(tool) {
    stop();
    activeTool = tool;
    if (tool !== 'trimmer' || typeof vibrate !== 'function') return;
    // A near-continuous, dense pulse reads like the trimmer motor.
    emit(trimmerPattern);
    trimmerTimer = schedule(() => {
      if (activeTool === 'trimmer') emit(trimmerPattern);
    }, 340);
  }

  function cut(tool) {
    if (tool !== activeTool) return;
    const time = now();
    if (tool === 'scissors' && time - lastScissors >= 120) {
      lastScissors = time;
      emit(18);
    } else if (tool === 'blade' && time - lastBlade >= 110) {
      lastBlade = time;
      emit([25, 15, 20]);
    }
  }

  return { start, cut, stop };
}
