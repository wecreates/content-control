# Grounded V2 preview

The previous V2 visual review found floating symbolic snacks and repeated diagram-like staging. This isolated preview puts snacks on plates/counters, receives the FEE envelope at an open lounge door, and stages the BUDGET wallet on a desk. An authored tabletop insert makes the tiny-sandwich callback visible next to the wallet. It reuses the original Dave/Points Monk geometry and original wallet, sandwich and fee-jaw artwork. All narration, observed caption wording and timing remain inputs, unchanged.

`StudioAnimaticComposition` exposes `groundedPreview=false` and `stylePreview=false`; production defaults stay unchanged. The latter incorporates PR1213's selective keyword emphasis with text-only teal `#087F82` (4.807:1 against white), correcting the earlier text contrast issue. Character palette is unchanged. The rejected scaling/downpush experiment is not included.

## Local preview

Use installed repository dependencies and a separately installed `@resvg/resvg-js` module. The command neither installs dependencies nor calls providers:

```sh
RESVG_MODULE=/absolute/path/to/@resvg/resvg-js/index.js node scripts/render_v2_grounded_preview.mjs /absolute/path/to/ccsd.json /absolute/path/to/existing-v2.mp4 /absolute/path/to/new-preview.mp4
```

The tool requires the existing 840-frame/24fps V2 input and passing observed caption track, refuses existing output paths, renders 12 frames per child process to release native font/raster buffers, and copies the original AAC stream. It checks decoded-audio equality, unchanged input hashes, output dimensions/frame count and writes a source-bound receipt with publishing and production approval false. It never writes canonical media or acceptance state.

This is React SVG/resvg rendering with a deterministic frame context, not Chromium parity. System font rendering can differ. The first unbounded full-frame process was killed in the constrained workspace; process batches address native memory lifetime, and require actual completion evidence before claiming renderer success.

## Checks and review boundary

`node --test tests/v2-*.test.mjs tests/studio-layout.test.mjs`: 36 pass, including new continuous hand/envelope contact, plated snack/table contact, grounded feet, authored insert and text contrast checks. `python -m unittest tests.test_character_lock tests.test_v2_captions tests.test_v2_caption_timing_integrity`: 30 pass.

Actual sample review caught and corrected fee legs poking beneath the counter, the INVITED label touching its panel border, and unnecessary background lines. The fee detail, receiving hand, readable budget wallet and authored tabletop insert have been inspected at 720px and phone raster size. This is not all-frame or full audiovisual creative approval. Exact canonical feec786c review remains FAIL; the preview has its own hash and pending independent judgment.
