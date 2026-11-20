# Draft typography experiment — no production approval

The V2 caption renderer emphasizes entire lines, sometimes highlighting a different word from the comic beat. This opt-in prototype selects a keyword in the current observed caption and uses the existing Dave teal (#11A7A7), a dark outline, and italic styling. It retains the existing font stack, words, timings, and layout regions. `stylePreview` defaults to false. No workflow, canonical artifact, audio, publishing setting, or camera changes are included.

This is **not a reference-style match or a completed video**. The independent review of the exact original candidate remains creative FAIL: typography and staging mismatch. The available font remains sans serif, not the reference handwriting. Grounded action, motivated shot variety, and full audiovisual review remain unresolved.

## Actual comparison evidence

Source commit: `e7d0720d5a908f1cf478f91bfe151b1a3bcedc26`.
Original candidate SHA256: `feec786c87a0f811dd6793f0108d15e34b57308a83666f987c294f8cdfa2cc25`.
The exact downloaded candidate CCSD and observed captions were evaluated at frames 336, 372, 420, 450, 466, 500, 744, 768, 800, and 839 (24fps).

[Before frame 420](before-420.svg) / [Typography frame 420](after-420.svg)

[Before frame 800](before-800.svg) / [Typography frame 800](after-800.svg)

These are actual composition SVG outputs produced with React server rendering, fixed frame/fps hook values, and resvg rasterization. Chromium failed locally with `socket() failed: Operation not permitted`; these are not final Chromium/Remotion MP4 frames. Font fallback and rasterization may differ from the original encoded video. Compare before/after pairs from the same renderer.

All ten pairs retained identical visible text. With `stylePreview=false`, all rendered pixels were unchanged. With the prototype enabled, action pixels below y=340 were unchanged. See [verification.json](verification.json). Independent visual review checked typography-only frames 420/768/800: selective words were readable, prop/head/hand clearance retained, and full pedestal restored. This supports further typography exploration only.

## Rejected camera experiment

A separate larger-stage camera experiment was reviewed and removed. At frame 372, feet drifted below the arena foreground edge. At frames 800/839, the victory pedestal was cropped. The result was mostly a downward push, not grounded medium/detail staging. None of that camera code is included in this draft.

Before any production use: validate all captions in actual Chromium output, check contrast and text bounds at phone size, independently review the complete audiovisual result, and resolve the remaining creative staging mismatch. Keep publishing disabled.
