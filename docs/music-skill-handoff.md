# Local music-skill handoff (technical preview only)

The optional adapter `scripts/music_skill_mix.py` connects an already rendered local music-skill master to the existing `v2_sound_mix` pipeline. It does not install or execute upstream code, call a model/provider, upload media, or enable publishing. Render the original score separately with the approved pinned music-skill installation.

Supply the master WAV, upstream `report.json`, `project.json`, and SHA-256 of each exact file; existing local narration and two effects; a publication-disabled CCSD; and a **new** output directory. The upstream project receipt uses canonical JSON hashing, which is checked separately from the caller's exact file hash. All inputs are bounded regular-file snapshots.

```
python scripts/music_skill_mix.py --music /path/master.wav --music-sha256 HASH \
  --report /path/report.json --report-sha256 HASH \
  --project /path/project.json --project-sha256 HASH \
  --voice /path/narration.wav --ccsd /path/ccsd.json \
  --sfx /path/effect1.wav /path/effect2.wav --out-dir /path/new-mix
```

The result contains `music.wav`, `sfx.wav`, `mix.wav` and `music-skill-mix-receipt.json`. Output is `TECHNICAL_PASS_AUDITION_PENDING`; production/creative approval and publication remain false. Caller-supplied hashes establish integrity, not trusted authorship, sample licensing or musical quality. Preserve upstream sound-bank attribution and verify rights separately. The existing mixer loops the bed and attenuates it below narration; listen to transitions, looping and speech masking before acceptance.

This adapter is not yet an automatic queue job or proof of a production video. Do not replace production assets automatically. Integrate the returned mix into a new candidate and rerun exact-artifact audiovisual/factual/caption review.

Tests: `python -m unittest tests.test_music_skill_mix tests.test_v2_sound_mix`.
