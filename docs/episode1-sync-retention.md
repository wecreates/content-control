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

The eighteen-shot timeline keeps every narration cue anchor unchanged and adds
six authored detail pictures at 5.6, 16.75, 20, 22.8, 26.2, and 28.2 seconds. They
show the purchase receipt, value/fee comparison, tentative keep decision, rethink
decision, arithmetic recap, and final decision rule. Each changes the illustrated
focal object and composition. They are not duplicate stills or cosmetic drift.
The longest source hold is now 58 frames / 2.416667 seconds at 24 fps, within the
unchanged 2.5-second limit. The former twelve-shot timeline is retained as a test
fixture and still fails five holds, including its 5.791667-second ending.

This source gate does not assert audience retention or creative approval. Inspect
the rendered transitions and captions before promoting any new video candidate.

Run regression tests with:

```sh
python -m unittest discover -s tests -p test_episode1_sync.py -v
node --test tests/episode1-picture-timeline.test.mjs
```

The tests intentionally assert the former timeline’s retention failure; they do not turn
that production failure into a passing release gate. Publishing remains disabled.
