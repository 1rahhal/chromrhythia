# Chromrhythia

A browser-native port **in development** based on the **current Rhythia C# rewrite**, not the legacy Sound Space Plus client. It uses TypeScript, Three.js/WebGL, Web Audio, and IndexedDB. This build is playable but does **not** reproduce the entirety of the native game; see [PORT_STATUS.md](PORT_STATUS.md).

Upstream: [Rhythia/Client](https://github.com/Rhythia/Client), revision `9200e16441c94f0cffca8ee10beb4e889235c56a` (0.2.0). This derivative and its corresponding source are distributed under AGPL-3.0. Original logo, font and hit/miss samples come from that source. This is an unofficial port.

## Play locally

Requires Node.js 22 or later and Chromium with hardware acceleration.

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:4173`. On the first build, a strong generated password is saved only in the ignored `.local/access-key.txt` file. Type that password on the unlock screen. It is never printed by the build or committed. To choose your own password, run `npm run password` in a terminal; input is hidden. Rebuild and redeploy after changing it.

## Controls and settings

Move the mouse to aim; notes are hit automatically as they reach the 3×3 playfield. Play requests fullscreen and pointer lock. Escape or Space pauses; R restarts; Tab skips an available break. The game pauses on tab switches and loss of mouse capture.

The custom settings menu exposes approach rate, spawn distance, fade in, fade out, FOV, sensitivity, volume, audio offset and render scale. Press **+** beside the color pickers to add another color; notes cycle through the list in chart order. Profiles can be exported and imported. Other implemented mechanics retain rewrite defaults (55 ms late-only hit window, 0.07 hit-box expansion, 0.875 note size, 0.25 camera parallax, 100 health, 15 initial health step, and 1–8× score multiplier).

Import `.phxm`, `.sspm` v1/v2, `.rhm`, or `.txt` maps. Select the text map and its matching `.mp3`, `.ogg`, or `.wav` together. Three generated practice charts include generated tones; commercial songs are not bundled. Maps, settings, scores and replays stay on the current browser and origin, without cloud sync. Export important maps and replays before clearing site data or switching domains.

## GitHub Pages

The included `.github/workflows/pages.yml` checks and builds the project, then deploys `dist/` using GitHub Pages. Add the repository Actions secret **GAME_PASSWORD** (12+ characters), then choose **GitHub Actions** as the source in repository Settings → Pages. CI fails if the password secret is absent. Pages runs must be authorized for this repository. Never put your password into source files or workflow YAML.

Alternatively run `npm run build` locally and serve `dist/` over HTTPS on any static host. The Sites deployment is private to the owner by default and adds its own account sign-in; GitHub Pages uses only the game password.

## Password protection

The compiled runtime is encrypted with AES-256-GCM. Its key is derived with PBKDF2-SHA256 (600,000 iterations and a random salt). The unlock page downloads ciphertext and decrypts it in memory; a wrong password cannot decrypt the runtime. No plaintext password or reusable key is stored in the served files. A strong password matters because a downloaded encrypted bundle permits offline guessing. Lock reloads the page and discards the in-memory code/key; it does not erase the device's library.

This protects access to the hosted bundle, not ownership of open-source code: the AGPL source archive is intentionally downloadable and can be rebuilt by anyone. This is not a server authentication system, rate limiter or encrypted vault for personal maps. Personal maps and scores use browser storage on that device.

## Validation

```sh
npm run check
npm test
npm run build
```

Tests cover scoring, health, default approach/fades, chart coordinate conversions, PHXM round trips, malformed data and browser-compatible encryption. Renderer performance is bounded by visible notes, not total chart length. The instanced batch currently supports 8,192 simultaneously visible notes; higher-density charts are a known limitation. Frame rate depends on GPU, browser, display refresh rate and settings; no fixed FPS is guaranteed.

## Corresponding source

Every build includes `source.zip`, `SOURCE.txt`, and `LICENSE`. The source archive excludes passwords, local maps, scores and replays. Source provenance and the parity checklist are in [PORT_STATUS.md](PORT_STATUS.md). `scripts/build.mjs` generates the source archive from the project and encrypts only the executable bundle.

