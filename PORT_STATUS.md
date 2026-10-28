# Port coverage

Target: current Rhythia rewrite, upstream commit `9200e16441c94f0cffca8ee10beb4e889235c56a`.

This is a playable first browser implementation, **not a completed full-game port**.

| Feature | Status |
| --- | --- |
| Default approach rate/distance, 55 ms hit window and hit box | Ported from SettingsProfile.cs, Constants.cs and Note.cs |
| Score, combo multipliers, accuracy and adaptive health | Ported from active Runner.cs / Attempt.cs logic |
| Approach, spawn distance, fade in/out, FOV, camera parallax | Implemented, saved locally |
| Color picker list with + and removal | Implemented, saved locally |
| Cursor shape, fill, size, color, opacity and trail | Browser customization; hit box unchanged, 64-point instanced trail |
| Local and community settings presets | Device-local snapshots and independent application; explicit cloud publishing through the shared password-protected library |
| Note opacity exponent, size, cursor bounds and drift | Rewrite defaults |
| Keyboard/mouse, touch/stylus, capture, fullscreen, pause, retry, focus pause | Browser implementation; direct or relative touch aim, responsive phone/tablet menus and compact HUD |
| Audio clock, speed, local offset, break skip | Browser implementation |
| PHXM standard static-note maps / PHXMO | Import and export |
| SSPM v1 / v2 standard notes | Import; extensions and non-note markers rejected |
| RHM and text chart + audio | Import |
| Search, sorting, favorites, random, map deletion | Implemented |
| Scores, timing graph, personal best, aggregate stats | Local IndexedDB |
| All nine upstream modifier types | Implemented; Chaos uses approximate noise, Earthquake uses deterministic pseudo-noise |
| Lock camera | Default input formula and parallax ported |
| Spin camera | Browser approximation, not exact native orbital behavior |
| Replays | Browser JSON format, recorded cursor/late hits, watch and export |
| Native PHXR replay compatibility | Not ported |
| Skin/mesh/UI skin imports | Not ported |
| Current default grid environment | Original grid texture, scroll and fog; extended planes and corrected color space avoid hard edges; Godot post-processing parity unverified |
| Default note mesh, cursor and grid textures | Original rewrite assets used |
| Other spaces and full original menus | Original tunnel textures plus browser Aurora/Pitch black options; custom black/purple/blue selector |
| Animated map object tracks and video backgrounds | Not ported; animated tracks rejected, video ignored |
| Map artwork / previews in menu | Embedded SSPM art, shared thumbnails, seekable audio and animated note preview; full native jukebox not ported |
| Native profile and library migration | Not ported; browser profiles supported |
| Desktop Discord, auto-updater, arbitrary user folder | Unavailable in a static browser game |
| Shared map uploads and downloads | Managed Worker/R2, password-protected, all visitors share one library |
| Low bandwidth and offline play | Compressed bundled runtime, precached core, on-demand maps cached in IndexedDB |
| Cloud score sync, accounts, multiplayer networking | Not implemented |
| Graphics and performance | Automatic or fixed resolution, batched HUD glyphs, visible FPS counter; device-specific frame rate |

## Source mapping

- `src/model.ts`: `scripts/database/settings/SettingsProfile.cs`, `scripts/Constants.cs`, `scripts/map/objects/Note.cs`, `scripts/game/Attempt.cs`, active judgment methods in `scripts/game/Runner.cs`.
- `src/maps.ts`: `scripts/map/MapParser.cs`, `scripts/map/Map.cs`.
- `src/renderer.ts`: depth, fades and opacity exponent from `scripts/game/renderers/NoteRenderer.cs`; effect formulas from `scripts/game/modifiers/`. GPU implementation is a separate browser renderer.
- `src/app.ts`: browser equivalents for scene flow, HUD, library, settings and replay control. `src/audio.ts` uses the Web Audio clock instead of Godot's audio backend.

The native `HealthJudgment.cs` and `HitJudgment.cs` contain unused/unfinished code in this revision; the port follows the active runner instead. Upstream is preserved at the revision link above; future updates need a new parity audit.

The gameplay HUD now uses the rewrite's original panel/bar textures, Nunito and Ubuntu fonts, and the exact 3D positions and viewport sizes in scenes/game.tscn. The stationary playfield border and grid guides are disabled as requested. Pixel-identical rendering across Godot and WebGL has not been verified. The supplied flvxify_dive_to_the_heart_-_kodak_yak.sspm parses as 1,183 notes with embedded audio and cover art.

The selector excludes bundled practice maps. Empty and migrated libraries show only uploaded charts. The dynamic HUD preserves the native positions/fonts while using a cached glyph atlas and one text batch; transparent HUD planes use one pass each.

Pause and results use the current rewrite scene structure and wording, adapted to responsive HTML/CSS. There is no standalone MISS label. The library cancels stale start requests and safely handles concurrent map/audio loading; local imports do not wait for cloud upload completion.

The selector follows the supplied native-client visual references with grid/list catalogs, cover stacks, local scores, Play/modifier controls and a speed popover. Settings uses a category overlay and gesture-safe touch sliders. The UI shows actual local grades and unranked map status; online ranking, RP, multiplayer and native collections are not implemented. RHM embedded cover import and persistent cloud artwork recovery are supported.

### Replay and HUD update
Local score/replay writes are atomic. Web replay v2 preserves attempt endpoints, unjudged notes, practice starts, camera mode/rotations and timed settings changes; v1 imports remain supported. Native PHXR replay conversion is still not implemented. The match HUD now follows the supplied website replay viewer, substituting the current accuracy grade for RP. No gameplay defaults changed.

### Engine optimization
The original note mesh had 678 non-indexed vertices. Position-only indexing keeps all 226 triangle positions and their order while reducing unique vertices to 113. Note colors are cached in linear color space; instance transforms write directly to the existing dynamic buffers. Modifier constants are computed once per frame, zero-opacity notes skip drawing, cursor trail uploads use partial ranges, and tunnel rings share two textures/materials and one geometry. Replay interpolation reuses outputs and advances a settings cursor; HUD nodes are cached and unchanged SVG/ARIA attributes are not rewritten. Resume resets the FPS measurement clock, avoiding a misleading low reading that includes pause duration.

`node scripts/benchmark-engine.mjs` reproduces a CPU microbenchmark, not browser FPS. On the development machine with Node v24.19.0, median preparation time for 300,000 unrotated instances changed from 78.80ms to 2.64ms; rotating instances changed from 75.33ms to 8.22ms. Nine 2048×2048 tunnel textures are reduced to two: estimated RGBA8 storage with mipmaps is 192MiB versus 42.67MiB when uploaded. Driver memory usage may differ. An additional comparison against the preceding renderer verified identical prepared visible transforms, colors and opacity across 81 modifier/speed/time cases. No foreground browser/GPU FPS comparison was completed because computer control could not verify the active Chrome URL. Gameplay defaults, scoring, timing and replay results are unchanged.
