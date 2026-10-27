# Chromrhythia

A browser-native port **in development** based on the **current Rhythia C# rewrite**, not the legacy Sound Space Plus client. It uses TypeScript, Three.js/WebGL, Web Audio, and IndexedDB, with a cloud Worker/R2 shared map library. This build is playable but does **not** reproduce the entirety of the native game; see [PORT_STATUS.md](PORT_STATUS.md).

Upstream: [Rhythia/Client](https://github.com/Rhythia/Client), revision `9200e16441c94f0cffca8ee10beb4e889235c56a` (0.2.0). This derivative and its corresponding source are distributed under AGPL-3.0. Original logo, font and hit/miss samples come from that source. This is an unofficial port.

## Play locally

Requires Node.js 22 or later and Chromium with hardware acceleration.

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:4173`. On the first build, a strong generated password is saved only in the ignored `.local/access-key.txt` file. Type that password on the unlock screen. It is never printed by the build or committed. To choose your own password, run `npm run password` in a terminal; input is hidden. Rebuild and redeploy after changing it.

## Controls and settings

Move the mouse to aim; notes are hit automatically as they reach the 3×3 playfield. On phones and tablets, drag a finger or stylus across the playfield to move the cursor. Settings → Touch controls offers direct finger aiming or trackpad-style relative motion using sensitivity. Lifting and placing the finger again continues play; interrupted gestures, device rotation and tab switches pause safely.

Menus adapt to portrait and landscape screens, with larger touch targets, safe-area spacing and a fixed Play button for the selected map on smaller displays. Narrow gameplay screens fit the entire note area and use a compact HUD. Fullscreen is requested where available; touch play does not require pointer lock. Mouse play keeps pointer capture. Escape or Space pauses; R restarts; Tab skips an available break. Tap the pause button to resume, retry, open settings or quit.

The custom settings menu exposes approach rate, spawn distance, fade in, fade out, FOV, sensitivity, volume, audio offset and render scale. Press **+** beside the color pickers to add another color; notes cycle through the list in chart order. Profiles can be exported and imported. Other implemented mechanics retain rewrite defaults (55 ms late-only hit window, 0.07 hit-box expansion, 0.875 note size, 0.25 camera parallax, 100 health, 15 initial health step, and 1–8× score multiplier).

Import `.phxm`, `.sspm` v1/v2, `.rhm`, or `.txt` maps. Select the text map and its matching `.mp3`, `.ogg`, or `.wav` together. The library contains uploaded maps only; built-in practice maps are excluded, including entries from older browser caches. Uploaded maps are shared through the hosted cloud library. Selecting a map downloads it on demand and caches it for offline use. Settings, scores and replays stay on the current browser and origin. Export important maps and replays before clearing site data or switching domains.

## Selector, previews and backgrounds

The pitch-black selector uses purple/blue accents, inline SVG icons, embedded SSPM cover art and shared thumbnails capped at 512 pixels. Map artwork loads separately from the song, so browsing does not download every map. The selected chart includes an animated note runway, audio preview, density timeline and seek control. Playback speed is adjustable from 0.25× to 3× using the slider, number field or presets; play time and average notes per minute update with the multiplier. Preview audio uses the same playback rate as gameplay.

Choose Grid, Tunnel, Aurora or Pitch black in Settings. The grid uses the original rewrite texture with a corrected color space and extended floor/ceiling to avoid the old hard edge. The browser renderer skips the full 3D scene in menus, warms shaders before play, updates only visible instance data and batches dynamic HUD text through a reusable font atlas. Automatic rendering caps 3D pixel work at 1600×900 or less and reduces resolution gradually if frames remain slow. Menus stay at native resolution. Fixed resolution remains available in Settings. Gameplay animation still follows the display refresh rate, and its FPS counter is visible during play.

## Cloud hosting and GitHub Pages

The primary deployment is a cloud Worker with a managed R2 bucket, using `.openai/hosting.json`. `npm run build` creates the encrypted offline-capable client and the ESM Worker at `dist/server/index.js`. Configure `PASSWORD_HASH` as a hosted secret containing the SHA-256 of the chosen password; the plaintext password is not deployed. The source is on GitHub. See [SHARED_HOSTING.md](SHARED_HOSTING.md).

For an independent static build, serve the root client files from `dist/` on GitHub Pages. Shared uploads require the cloud Worker; a static Pages deployment alone cannot accept shared uploads. To change the password, run `npm run password`, rebuild, update the hosted hash secret and redeploy.

For an optional CI rebuild, `.github/workflows/pages.yml` can check, build and deploy `dist/`. Add the repository Actions secret **GAME_PASSWORD** (12+ characters), select **GitHub Actions** as the Pages source, and run the workflow manually. CI fails if the password secret is absent. Never put your password into source files or workflow YAML.

Alternatively run `npm run build` locally and serve `dist/` over HTTPS on any static host. The production cloud deployment permits visitors with the game password; the Worker API checks a hosted password hash for listing, uploads and downloads. See SHARED_HOSTING.md.

## Password protection

The compiled runtime is encrypted with AES-256-GCM. Its key is derived with PBKDF2-SHA256 (600,000 iterations and a random salt). The unlock page downloads ciphertext and decrypts it in memory; a wrong password cannot decrypt the runtime. No plaintext password or reusable key is stored in the served files. A strong password matters because a downloaded encrypted bundle permits offline guessing. Lock reloads the page and discards the in-memory code/key; it does not erase the device's library.

This protects access to the hosted bundle, not ownership of open-source code: the AGPL source archive is intentionally downloadable and can be rebuilt by anyone. The shared map API separately authenticates a password-derived bearer token against a server-only secret. Uploads are shared with other password holders; local scores and replays stay in browser storage. This is not an encrypted vault for private uploads.

## Validation

```sh
npm run check
npm test
npm run build
```

Tests cover scoring, health, default approach/fades, chart coordinate conversions, PHXM round trips, malformed data and browser-compatible encryption. Renderer performance is bounded by visible notes, not total chart length. The instanced batch currently supports 8,192 simultaneously visible notes; higher-density charts are a known limitation. Frame rate depends on GPU, browser, display refresh rate and settings; no fixed FPS is guaranteed.

## Corresponding source

Every build includes `source.zip`, `SOURCE.txt`, and `LICENSE`. The source archive excludes passwords, local maps, scores and replays. Source provenance and the parity checklist are in [PORT_STATUS.md](PORT_STATUS.md). `scripts/build.mjs` generates the source archive from the project and encrypts only the executable bundle.

The pause panel and results page follow the current rewrite scene layouts. The standalone MISS flash has been removed; misses remain in the native counter. Graphics settings offer Uncapped (display refresh), 60, 120, 144 and 240 FPS limits; judgment/audio timing stays independent of the rendering limit. Chrome still follows the active display refresh rate. Sliders, scrollbars, focus and hover states use the dark theme.

Imported maps become playable from local storage before cloud sharing finishes. Sharing completes in the background; a completion message confirms availability to other visitors. Selecting another chart cancels any older pending Play request, and stale audio decoding cannot replace the selected chart.

## Cursor, parallax and shared presets

Settings includes camera parallax from 0% (off) to 75%, with the rewrite default at 25%. Direct touch aiming adjusts to the chosen parallax. Cursor options include the original rounded cursor, square, circle and diamond, a fill toggle, color, size, opacity, and an optional trail with duration and opacity. Cursor appearance never changes the hit box. Trails use at most 64 instances in one extra draw, and are off by default.

My presets saves named snapshots on the current browser. Share with everyone publishes a snapshot to the password-protected cloud library; the optional nickname is shown with it. Community presets can be applied to active local settings or saved as independent local copies. Applying or editing a copy does not alter the publisher's preset. Save current here updates a local snapshot; Update shared explicitly republishes it. Publisher keys stay in the originating browser's local storage, so clearing that storage loses the ability to update that published copy. Active settings, local snapshots and publisher keys are never automatically synced to other devices.

Uncapped disables the game's frame limiter. The browser-callback readout measures actual animation callbacks, independently of the rendering cap. If both remain near 60, check the OS display refresh rate and Chrome's performance settings. A website cannot switch the monitor to a higher refresh rate or override browser scheduling. High-refresh cadence is covered by simulated 120/144/240 Hz tests; available hardware was configured at 60 Hz during verification.
