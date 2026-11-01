const SFX_MANIFEST = '/assets/sfx/manifest.json?v=5';

export function createBarberSounds() {
  let audio;
  let output;
  let noise;
  let motor;
  let motorGain;
  let motorKind;
  let trimmerHeld = false;
  let decoded = {};
  let decoding = Promise.resolve();
  let lastScrape = 0;
  let lastSnip = 0;

  // Fetch the finished assets early; decoding waits for the first user gesture.
  // A missing manifest or asset leaves the Web Audio fallback available.
  const downloaded = typeof fetch === 'function'
    ? fetch(SFX_MANIFEST).then(async response => {
      if (!response.ok) return null;
      const manifest = await response.json();
      if (!manifest.generated || !manifest.files) return null;
      const entries = await Promise.all(Object.entries(manifest.files).map(async ([name, path]) => {
        if (typeof path !== 'string' || (!path.startsWith('/assets/sfx/') && !path.startsWith('data:audio/mpeg;base64,'))) return [name, null];
        try {
          const file = await fetch(path);
          return [name, file.ok ? await file.arrayBuffer() : null];
        } catch { return [name, null]; }
      }));
      return Object.fromEntries(entries);
    }).catch(() => null)
    : Promise.resolve(null);

  function ensure(resume = true) {
    if (!audio) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      audio = new AudioContext();
      output = audio.createGain();
      output.gain.value = 1;
      output.connect(audio.destination);
      noise = audio.createBuffer(1, Math.ceil(audio.sampleRate * .4), audio.sampleRate);
      const samples = noise.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
      decoding = downloaded.then(async files => {
        if (!files) return;
        const entries = await Promise.all(Object.entries(files).map(async ([name, bytes]) => {
          if (!bytes) return [name, null];
          try { return [name, await audio.decodeAudioData(bytes)]; }
          catch { return [name, null]; }
        }));
        decoded = Object.fromEntries(entries);
        if (trimmerHeld && decoded.trimmer && motorKind === 'synth') {
          stopMotor();
          startMotor();
        }
      });
    }
    if (resume && audio.state === 'suspended') void audio.resume().catch(() => {});
    return audio;
  }

  function noiseBurst(context, when, duration, frequency, resonance, volume, attack) {
    const source = context.createBufferSource();
    source.buffer = noise;
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = resonance;
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(.0001, when);
    envelope.gain.exponentialRampToValueAtTime(volume, when + attack);
    envelope.gain.exponentialRampToValueAtTime(.0001, when + duration);
    source.connect(filter).connect(envelope).connect(output);
    source.start(when, Math.random() * (noise.duration - duration - .01));
    source.stop(when + duration);
  }

  function stopMotor() {
    if (!motor || !audio) return;
    const node = motor;
    motor = null;
    motorKind = null;
    motorGain.gain.setTargetAtTime(0, audio.currentTime, .025);
    try { node.stop(audio.currentTime + .16); } catch { /* already stopped */ }
  }

  function stop() {
    trimmerHeld = false;
    stopMotor();
  }

  function startMotor() {
    if (!audio || motor) return;
    motorGain = audio.createGain();
    motorGain.gain.value = 0;
    if (decoded.trimmer) {
      motor = audio.createBufferSource();
      motor.buffer = decoded.trimmer;
      motor.loop = true;
      motor.connect(motorGain).connect(output);
      motorKind = 'sample';
      motor.start();
      motorGain.gain.setTargetAtTime(.72, audio.currentTime, .035);
      return;
    }
    motor = audio.createOscillator();
    motor.type = 'sawtooth';
    motor.frequency.value = 82;
    const filter = audio.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 580;
    motor.connect(filter).connect(motorGain).connect(output);
    motorKind = 'synth';
    motor.start();
    motorGain.gain.setTargetAtTime(.09, audio.currentTime, .018);
  }

  function start(tool) {
    if (tool !== 'trimmer') return;
    const context = ensure();
    if (!context) return;
    trimmerHeld = true;
    startMotor();
  }

  function sampleBurst(name, gain, duration, randomOffset = false) {
    const buffer = decoded[name];
    if (!buffer || !audio) return false;
    const length = Math.min(duration, buffer.duration - .005);
    if (length <= .02) return false;
    const when = audio.currentTime + .002;
    const source = audio.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = .96 + Math.random() * .08;
    const envelope = audio.createGain();
    envelope.gain.setValueAtTime(.0001, when);
    envelope.gain.linearRampToValueAtTime(gain, when + .012);
    envelope.gain.setValueAtTime(gain, when + Math.max(.015, length - .04));
    envelope.gain.linearRampToValueAtTime(.0001, when + length);
    source.connect(envelope).connect(output);
    const offset = randomOffset ? Math.random() * Math.max(0, buffer.duration - length - .15) : 0;
    source.start(when, offset, length);
    return true;
  }

  function scrape(intensity = 1) {
    const now = performance.now();
    if (now - lastScrape < 85) return;
    lastScrape = now;
    const context = ensure();
    if (!context) return;
    const loudness = Math.max(.2, Math.min(1, intensity));
    const bareSkin = intensity < .5;
    if (sampleBurst(bareSkin ? 'bladeSkin' : 'bladeHair', bareSkin ? .28 : 1.15 * loudness, .18, true)) return;
    const when = context.currentTime + .002;
    const grain = (Math.random() - .5) * 500;
    noiseBurst(context, when, .12, 1900 + grain, .65, .16 * loudness, .012);
    noiseBurst(context, when + .004, .085, 4300 + grain, 1.1, .07 * loudness, .006);
  }

  function snip() {
    const now = performance.now();
    if (now - lastSnip < (decoded.scissors ? 160 : 105)) return;
    lastSnip = now;
    const context = ensure();
    if (!context) return;
    if (sampleBurst('scissors', .85, .42)) return;
    const when = context.currentTime + .002;
    const pitch = (Math.random() - .5) * 460;
    noiseBurst(context, when, .032, 4100 + pitch, 2.4, .15, .002);
    noiseBurst(context, when + .012, .052, 1800 + pitch * .4, .8, .038, .005);
    noiseBurst(context, when + .048, .038, 3200 + pitch, 2, .082, .002);
  }

  function spray() {
    const context = ensure();
    if (!context) return;
    if (sampleBurst('waterSpray', .95, 1.7)) return;
    const when = context.currentTime + .005;
    for (let index = 0; index < 4; index++) {
      noiseBurst(context, when + index * .21, .18, 2700 + index * 150, .55, .10, .012);
    }
  }

  return {
    // Preload bytes, but create AudioContext inside the start-button gesture.
    // Mobile Safari can leave a context created during page load silent.
    prepare: () => downloaded,
    unlock: () => ensure(true),
    whenReady: () => decoding,
    start, stop, scrape, snip, spray,
  };
}
