# Shave the Date

A playful photo-based wedding barber game for Aakash. [Play it here](https://shave-the-date.app.en3.wtf/).

Choose scissors, a trimmer, or a blade and drag across the portrait to groom his hair and beard. Scissors leave a medium cut, the trimmer has 1–4 mm guards, and the blade can shave clean. The game includes sound effects, haptics on supported devices, eye movement, a barbershop radio, and a shareable finished look.

## Run locally

No build step is needed. From the project directory:

```sh
npm run dev
```

Open <http://127.0.0.1:5173/> and select **Open the barbershop** to start. To check the source and run the tests:

```sh
npm run check
npm test
```

The active game uses `index.html`, `src/photo-main.js`, the other `src/` modules, and the portrait and sound files in `assets/`. `assets/source/` contains the aligned photo edits used to make the hair and beard layers. The `tools/` scripts can regenerate those layers. The older Three.js prototype is retained in `src/main.js`, `src/realistic-avatar.js`, and `vendor/`, but is not loaded by the current site.

Sound effects are generated with ElevenLabs. The public `assets/sfx/manifest.json` embeds the audio needed by the game; no API key is sent to the browser. To generate replacement sounds, install dependencies, complete ElevenLabs onboarding locally, and run `npm run generate:sfx`. Keep `.env.local` private. The optional face-building helper also requires a separately downloaded MediaPipe Face Landmarker model in `tools/models/`.

## License and media

The original source code is available under the [MIT License](LICENSE). Aakash's portrait and edited layers, generated sound effects, and other media are included to run this demo but are **not licensed for reuse in other projects**. The barbershop songs are third-party recordings used in the deployed site; they are not included in this repository or covered by the code license. The bundled Three.js files retain their own [license](vendor/THREE-LICENSE).
