# Exact production artifact recovery and bounded audiovisual findings

## Outcome

Original Short and Long recovered and durably saved separately from Actions retention. Both ZIP digests match GitHub, ZIP CRC checks pass, candidate hashes match the prior execution records, and both complete audiovisual streams decode without error. Publication and production approval remain disabled. Neither candidate is creatively approved.

| Item | Short | Long |
|---|---|---|
| Run | 38472504826 | 38472504826 |
| Artifact ID | 11851919897 | 11853980184 |
| Archive bytes | 24413126 | 339215165 |
| ZIP SHA256 | ac6a7923c2b8b85d77747f29f63cf0eec46dac9aa23257ad480c2d069e6e5e42 | c57da0c70f75b50d6fe8df5b9ed9f9f573c9138a579a52d0cdc9fc9724e53b93 |
| MP4 SHA256 | b67bf2cdb74026f39c62f6e187ffb3fd362fdc820d009f01f9401c5dd70a5884 | ae4b2332c2c616b5004dc58ff9e8fcdbd754107ac04fd478bba8eb26a950d324 |
| Duration | 35.042 seconds | 519.333 seconds |
| Fresh full decode | PASS | PASS |
| Integrated loudness | -16.8 LUFS | -16.3 LUFS |
| True peak | -1.0 dBFS | -0.9 dBFS |
| Fresh frames extracted at 1-second intervals | 36 | 520 |
| Complete visual/listening acceptance | NOT VERIFIED | NOT VERIFIED |
| Android-device acceptance | NOT VERIFIED | NOT VERIFIED |

GitHub artifact expiry remains October 27 at 21:46:51 UTC (Short) and 22:03:14 UTC (Long). Recovery does not extend GitHub retention; separate saved original archives remove reliance on that deadline.

## Directly observed defects and bounded findings

- **Long visual FAIL, opening at 0.000s:** the metal card obscures the lower part of the headline `METAL CARD. REAL BILL.` in the original decoded frame. Current source at base d3d8048 retains the same start position. Fix: constrain the card's entire rotated stroke bounds below y=200 and above the table at y=500, preserving the existing character assets and animation. Regression samples 40 seconds at 240 geometry samples/second. Static SVG output of the actual React composition with recovered props was rasterized and inspected: the heading is now clear. This is static-source verification, not a new encoded-video approval.
- **Short visual concern, 33.500s:** `with tiny sandwiches?` crowds `CAPE OPTIONAL.` in the original candidate. Main already removes that decorative label; no duplicate source fix was made. The recovered old candidate still contains it, and a new render is required to verify the existing change.
- **Sampled character consistency:** recognizable Dave, Monk and pointed-ear Goblin persist in inspected Short frames; Dave and Monk persist in inspected Long frames. This is not a full-frame identity or voice-assignment certification.
- **Pacing concern, not a freeze verdict:** Long samples show repeated wide two-character stages. Recovered scene metadata groups the interest action from 266.708 to 312.250 seconds and doors from 405.000 to 446.417 seconds. These spans do not prove no internal motion or interrupts; full motion/listening review is still required. Full-stream FFmpeg freezedetect at -50dB and 0.75 seconds reported no freeze events. Motion detection cannot establish engaging choreography.
- **Audio diagnostics:** no Short silence event longer than 0.5 seconds at -45dB. Long has nine low-level intervals, longest 465.155–466.598 seconds (1.442 seconds). These can be deliberate pauses; no automatic trimming or voice replacement was justified. Audio energy, peak and duration do not verify narration delivery, SFX placement, speaker identity or lip/caption synchronization.
- **Visual coverage actually inspected:** 35 approximate one-second Short samples, 52 approximate ten-second Long samples, exact original frames at Long 0.000s and Short 33.500s, and all ten stored competitor reference stills. The new pack's 556 timestamped samples were extracted, not all individually reviewed. No end-to-end listening occurred in this environment.

## Competitor comparison scope

The ten stored reference stills use handwritten-looking text, selective teal emphasis and more varied concrete settings/interactions (reading, bed, couch, groups and money exchange). The recovered candidates use heavier sans-serif text, largely white backgrounds and more repeated diagram-like staging. Short props support an identifiable wallet/card conflict and checklist payoff; the Long's repeated two-actor stage has less sampled setting variation. These are direct still-image comparisons, not two distinct complete competitor audiovisual reviews, measured competitor retention, or proof of style parity. The current reference selection is empty; retained stills lack complete audiovisual coverage. No unrelated creator's assets were copied.

## Google AI Studio investigation

PR39 records both attachments showing `Token count failed`; the Short's unrelated mortgage narrative was rejected, and subsequent access challenges returned INACCESSIBLE for both candidates. Fresh hash matches and successful full decodes rule out archive transfer damage or ordinary decode failure in these recovered copies. They do not prove what bytes reached Google's backend.

Google's official video documentation distinguishes uploaded files in PROCESSING state from ACTIVE files ready for use: https://ai.google.dev/gemini-api/docs/video-understanding . Upload acceptance alone is insufficient. No provider file-state response, browser network trace or processing error code was retained in PR39, so the precise provider cause remains UNKNOWN. Possible processing/session/model failures are hypotheses, not confirmed root causes. No new paid API key or external upload was used.

## Implemented free alternative

`scripts/offline_av_review.py` prepares an offline player from the exact original MP4, full mixed PCM audio, measured audio diagnostics, probe metadata and timestamped decoded frames. It requires an expected SHA256, checks it before and after preparation, rejects existing output directories and never writes approval. Only Python standard library and FFmpeg/FFprobe are needed. No account, service credits, inference or outbound upload is required.

The existing Exact AV Reviewer workflow now invokes this preparation after its existing provenance/hash checks. Its existing review validation and publication locks remain intact. The pack is a reliable accessible inspection alternative; it is NOT an autonomous semantic/listening judge. Open index.html alongside its assets in a local browser; frame buttons seek the original. No playback event automatically certifies review.

Example:

```sh
python3 scripts/offline_av_review.py --video candidate.mp4 --out offline-review --sha256 EXACT_CANDIDATE_SHA256
```

Validation: 35 existing/updated Node tests pass, plus one real generated-media integration test covering hash binding, exact frame timestamps, overwrite rejection and no approval. Both original production candidates completed actual pack generation. Remotion CLI still rendering in this workspace failed with `uv_interface_addresses ... Unknown system error 1`; no workaround weakened runtime restrictions. Static React/SVG raster inspection verified the geometry correction only.

## Still required

A fresh encoded Long render of the fix; full actual audiovisual review of each candidate, including voice performance, SFX, motion and synchronization; two distinct full authorized competitor audiovisual reviews; actual Android acceptance. No claim of completed creative approval or a fully automated independent reviewer is made. Original candidates and existing working components are preserved.

## Follow-up reconciliation

Main gained an independently implemented offline review pack, aspect-preserving motion analysis, caption repair and mobile comparison workspace after this report. Those implementations are retained. PR44 now carries the opening-card correction, the recovered evidence, and an additional retained-visual-repair workflow using current compositions with the exact original audio. A confirmed ordering bug in repair_retained_captions.py wrote ccsd.json before installing the repaired caption track; the write now follows assignment so props and technical verification use the same captions. Prior descriptions of this branch's alternative offline script are historical; main's current implementation is authoritative. The new workflow must succeed and its encoded output must be inspected before calling the media repaired.
