# Episode 1 motion graphics

This is the motion-first Episode 1 rebuild. It is deliberately **not** a slide/presentation renderer.

The composition uses:
- continuous camera movement
- animated SVG stick-character acting
- kinetic typography
- object choreography
- physical UI and prop comedy
- moving equations and counters
- recurring visual callbacks
- hard publication lock

The GitHub Actions workflow downloads the current rebuilt narration to `public/narration.mp3`, calculates the exact audio duration, runs the motion contract tests, lists the Remotion composition, renders the exact audio-length frame range, and performs ffprobe runtime QC.
