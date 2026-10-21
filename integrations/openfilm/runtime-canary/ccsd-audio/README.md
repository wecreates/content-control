# Disabled OpenFilm audio/CCSD candidate

An original synthetic OpenFilm render produced four seconds of video but only 3.5 seconds of audio. The intended final half-second was silence. Resetting mixed audio timestamps to sample order before padding fixes the gap without changing the original samples or video frames.

This directory consolidates the latest tested implementation from three local acceptance candidates. It is standalone review code, with no production entrypoint, runtime enablement or publication wiring. Remotion and Kokoro defaults are unchanged. No upstream implementation, dependency installation, media, generated receipts or logs are committed here.

## Implementation

- `audio-mix-compat.mjs` validates the pinned mixer graph and inserts the sample-based timestamp reset immediately before padding. Graph drift fails closed.
- `ccsd-audio.mjs` maps one selected dialogue per scene using the existing Kokoro manifest shape, locked voice IDs, text/audio hashes and bounded stereo PCM16/44.1 kHz snapshots. It preserves scene starts, gaps and duration; overruns, unsafe paths and unsupported audio layers reject. It returns detached assets and HTML with the pinned runtime's internal sound hook. Synthetic-only scope is mandatory.
- `audio-process.mjs` handles cancellation before/during child creation and while mix/mux children run. `render-candidate.mjs` cleans temporary outputs and exposes a final file only after completion.
- `storyboard-adapter.mjs` is our original dependency-free storyboard draft generator, not upstream OpenFilm source. Its copied snapshot is included so this candidate has no dependency on unpublished local branches.

Upstream pin: `695f4a887a97258d45ffe5715eadf537b6d2579b`. Runtime acceptance used the existing image `sha256:e2938261a328145e48bc6cb4dffdfa03fb3d2eb4bb68af4a18916ebad522806d`, Node 24, Chromium 155, Playwright Core 1.61.1 and FFmpeg 5.1.9. The image is not distributed by this change. Absolute `/app/src` imports intentionally execute only in that isolated runtime.

## Exact validation scope

Locally, 60 tests passed: 44 pre-existing OpenFilm/ReelMimic/streaming tests in the source checkout plus 16 tests in this consolidated directory. The current remote base does not contain those earlier unpublished OpenFilm/streaming changes; this PR does not import them or claim their integration into main.

The 16 candidate tests include actual installed FFmpeg operations: PCM output at 4/5/6 seconds; mapped two-second dialogue with gaps/tail; tone and half-gain preservation; and cancellation of actual mixing/Matroska mux children after positive processing progress. Negative tests cover identity/hash/path/format/overrun rejection, changed graphs, missing/delayed audio and frame defects.

Six real network-none container cases passed: original render, missing audio, video cancellation, CCSD-mapped render, mix cancellation and mux cancellation. Every container was removed. Mix/mux cancellation in the container fires at actual child spawn after all 96 video frames finish; host tests separately cover processing-time cancellation. Both cancel paths leave no final/temporary render artifacts or live renderer processes/listeners.

The mapped output has 96 frames at 24 fps and four-second audio/video. All 96 cue frames and 800 PCM windows were checked. Independent host checks confirm final-frame timestamp 3.958333 s, half-gain ratio 0.499673 and zero-RMS silent tail. Output SHA-256: `89bfc6823af995ee0546e7c8621e58529a3d0293d14327ee13cdd29c2ae66f3c`.

The original four-scene output remains SHA-256 `3efa05ca2df8ce9a0cc74aac29f8a198bfde0fdf082fa1602575ac20641b1760`; all 96 decoded frames and the first 3.5 seconds of decoded audio are identical to the pre-padding baseline. Full runtime receipts remain in the originating work chat; no generated artifacts are committed.

## Running checks

```sh
node --test audio-mix-compat.test.mjs verify-output.test.mjs
# Requires already-installed ffmpeg on PATH; performs no installation:
node --test audio-mix-compat.test.mjs audio-mix-ffmpeg.test.mjs verify-output.test.mjs ccsd-audio.test.mjs audio-process.test.mjs
```

PR CI checks the exact head's JavaScript syntax and the six dependency-free contracts only. It does not run Docker, render video, synthesize speech, use secrets, download assets or invoke providers.

`run_audio_scenes.py` is an opt-in MSI-local rerun tool requiring the preinstalled pinned image and Docker Desktop Linux engine. It uses an empty task-local Docker config and sanitized environment, asserts network-none/read-only/non-root/resource limits before execution, caps each case at 120 seconds, and removes ownership-labeled containers. It neither builds images nor installs/starts Docker. Use a fresh output location; existing media is never overwritten.

## Not accepted yet

Music/SFX layers, multiple/overlapping dialogue, fades, speeds/ranges, broader formats, long-duration/high-load behavior and arbitrary cancellation timing remain unsupported or unverified. No real voice, perceptual identity, creative/product, full-motion review or live provider comparison acceptance is claimed. Tone fixtures do not establish rights or approved production voice. Runtime and publication remain disabled; this draft is not a merge/deployment request.
