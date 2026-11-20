# Episode 1 source synchronization and retention

`python scripts/verify_episode1_sync.py` reads the exported authored timeline from
`remotion/episode1-picture-timeline.mjs`. It checks the renderer imports it,
playback order, narration-file identity, factual-contract cue anchors, and visual
text. Headline definition order and playback order are different: the arithmetic
picture plays before Points Monk, as the narration does.

The arithmetic semantic phrase is `80 minus 20 is 60`, matching the independently
transcribed narration. The spend and credit retain currency context, and visual
checks still require `$80 − $20` and `$60`. No global currency stripping or relaxed
math matching is used.

The health report separates `source_sync_status` from `retention_status`.
Aggregate `status` remains FAIL and the process exits 2 if either fails. A source
PASS is not verification of any encoded MP4, visual quality, or production
approval. File hashes and cue anchors bind each report to its source inputs.
The main workflow persists failure reports as well as passing reports, so a
failed retention gate cannot leave a stale PASS in state.

The authored timeline currently passes source checks but fails the unchanged
2.5-second maximum hold budget. The actual 24 fps frame windows are:

| Beat | Frames (end exclusive) | Hold seconds |
|---|---|---|
| Credit purchase | 91–171 | 3.333333 |
| Compare value | 368–437 | 2.875 |
| Value wins | 437–510 | 3.041667 |
| Fee wins | 510–581 | 2.958333 |
| Closing rule | 581–720 | 5.791667 |

These are genuine remaining production gaps. Smooth drift or a duplicated still
does not automatically count as a new pattern interrupt. Resolve them with
meaningful authored framing/action changes that preserve the narration anchors,
then render and inspect the affected windows. This verifier change does not
alter artwork, audio, cuts, or any accepted video candidate.

Run regression tests with:

```sh
python -m unittest discover -s tests -p test_episode1_sync.py -v
node --test tests/episode1-picture-timeline.test.mjs
```

The tests intentionally assert the current retention failure; they do not turn
that production failure into a passing release gate. Publishing remains disabled.
