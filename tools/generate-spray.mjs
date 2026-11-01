import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

if (!process.env.ELEVENLABS_API_KEY) throw new Error('ELEVENLABS_API_KEY is missing.');
const directory = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sfx');
const client = new ElevenLabsClient();
const stream = await client.textToSoundEffects.convert({
  modelId: 'eleven_text_to_sound_v2',
  outputFormat: 'mp3_44100_128',
  promptInfluence: .75,
  text: 'Close-miked barbershop spray bottle: four quick trigger squeezes, each with a crisp plastic click and a realistic fine mist of water landing on hair. Fresh, light, satisfying salon foley. Begin immediately. Isolated dry studio recording, no voice, music, room ambience, or echo.',
  durationSeconds: 2,
});
const chunks = [];
for await (const chunk of stream) chunks.push(Buffer.from(chunk));
const bytes = Buffer.concat(chunks);
if (bytes.length < 1024) throw new Error('The spray sound was unexpectedly small.');
const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 10);
const filename = `waterSpray-${hash}.mp3`;
await writeFile(join(directory, filename), bytes);
const manifestPath = join(directory, 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
manifest.files.waterSpray = `data:audio/mpeg;base64,${bytes.toString('base64')}`;
manifest.version = 2;
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Generated water spray: ${filename}`);
