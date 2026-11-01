import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';

const client = new ElevenLabsClient();
mkdirSync('assets/music', { recursive: true });
const tracks = [
  ['barbershop-groove', 'Original upbeat retro Indian barbershop instrumental for a playful wedding grooming game. Warm electric piano, bright acoustic guitar, melodic flute, hand percussion, gentle bass, and a catchy joyful groove. Polished full-band recording, steady moderate tempo, no vocals, no spoken words, no recognizable existing melody. Start playing immediately without a long intro and finish with a natural looping feel.'],
  ['wedding-morning', 'Original cheerful Indian wedding morning instrumental for a lighthearted barbershop game. Lively tabla and handclaps, acoustic guitar, melodic flute, mellow electric piano, and a buoyant bassline. Warm retro pop feel, polished recording, moderate danceable tempo, no vocals, no spoken words, no recognizable existing melody, immediate musical opening.'],
  ['clipper-swing', 'Original playful barbershop lounge instrumental with an Indian retro pop flavor. Jazzy electric piano, muted guitar chops, nimble flute melody, soft hand percussion, bass guitar, and a gentle swinging rhythm. Bright and relaxed, polished full-band recording, no vocals, no spoken words, no recognizable existing melody, start with the groove immediately.'],
];

for (const [name, prompt] of tracks) {
  const path = `assets/music/${name}.mp3`;
  if (existsSync(path)) continue;
  const audio = await client.music.compose({ prompt, musicLengthMs: 45000, modelId: 'music_v2' });
  await pipeline(audio, createWriteStream(path));
}
