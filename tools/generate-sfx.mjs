import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

if (!process.env.ELEVENLABS_API_KEY) {
  throw new Error('ELEVENLABS_API_KEY is missing. Run ElevenLabs onboarding before generating sounds.');
}

const directory = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sfx');
const client = new ElevenLabsClient();
const effects = {
  scissors: {
    text: 'One close-miked snip of sharp professional barber scissors cutting a small lock of hair. Crisp steel blades closing with a delicate hair crunch and a tiny metallic release. Dry, intimate salon sound. Start immediately. No voice, music, background, or echo.',
    durationSeconds: .7,
  },
  trimmer: {
    text: 'Seamless loop of a professional electric hair trimmer running close to the microphone. Rich low motor hum, rapid fine blade chatter and subtle vibration. Steady speed and volume, clean studio recording. No switch click, voice, music, room ambience, or echo.',
    durationSeconds: 4,
    loop: true,
  },
  bladeHair: {
    text: 'Close-miked straight shaving razor scraping through dense short beard stubble. Soft gritty hair rasp with tiny individual bristle ticks, smooth blade travel, no injury or dramatic sound. Even continuous motion, dry studio recording. No voice, music, background, or echo.',
    durationSeconds: 2,
  },
  bladeSkin: {
    text: 'Close-miked shaving razor gliding gently over clean skin with a faint wet surface hiss. Quiet, smooth, short continuous motion. No cut, pain, voice, music, room ambience, or echo.',
    durationSeconds: 1.5,
  },
};

await mkdir(directory, { recursive: true });
const files = {};
for (const [name, options] of Object.entries(effects)) {
  const stream = await client.textToSoundEffects.convert({
    modelId: 'eleven_text_to_sound_v2',
    outputFormat: 'mp3_44100_128',
    promptInfluence: .7,
    ...options,
  });
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const bytes = Buffer.concat(chunks);
  if (bytes.length < 1024) throw new Error(`The ${name} sound was unexpectedly small.`);
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 10);
  const filename = `${name}-${hash}.mp3`;
  await writeFile(join(directory, filename), bytes);
  // DropDeploy's ZIP publisher does not serve MP3 files, so keep the generated
  // file for editing and embed the playable bytes in its public JSON manifest.
  files[name] = `data:audio/mpeg;base64,${bytes.toString('base64')}`;
  console.log(`Generated ${name}: ${filename}`);
}
await writeFile(join(directory, 'manifest.json'), `${JSON.stringify({ version: 1, generated: true, files }, null, 2)}\n`);
