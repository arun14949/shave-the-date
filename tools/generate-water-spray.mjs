import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

if (!process.env.ELEVENLABS_API_KEY) {
  throw new Error('ELEVENLABS_API_KEY is missing. Run ElevenLabs onboarding before generating sounds.');
}

const directory = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sfx');
const client = new ElevenLabsClient();
const stream = await client.textToSoundEffects.convert({
  modelId: 'eleven_text_to_sound_v2',
  outputFormat: 'mp3_44100_128',
  promptInfluence: .85,
  durationSeconds: 1.7,
  text: 'Close-miked small handheld barber water spray bottle misting hair. One firm plastic trigger squeeze and release, with a brief click followed by a fine airy atomized water spray and soft droplets landing on hair. A second quick squeeze follows. Natural light hand-pump spritzer sound, intimate dry recording. Sound begins instantly. No aerosol can, running faucet, pressure washer, steam, voice, music, or room ambience.',
});
const chunks = [];
for await (const chunk of stream) chunks.push(Buffer.from(chunk));
const bytes = Buffer.concat(chunks);
if (bytes.length < 1024) throw new Error('The water spray sound was unexpectedly small.');

const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 10);
const filename = `waterSpray-${hash}.mp3`;
await writeFile(join(directory, filename), bytes);

// DropDeploy's ZIP publisher does not serve MP3 files; the embedded data URL
// gives the browser the same recording while keeping the source file editable.
const manifestPath = join(directory, 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
manifest.files.waterSpray = `data:audio/mpeg;base64,${bytes.toString('base64')}`;
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Generated water spray: ${filename}`);
