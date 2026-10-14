# Exact candidate recovery and bounded audiovisual evidence

Publication remains disabled. Neither candidate has full creative approval.

## Recovery: PASS

Recovered both complete original ZIPs from production run 38472504826 before expiry. ZIP CRC checks passed for all 46 Short entries and 134 Long entries. Both archives were independently saved beyond GitHub Actions retention.

| Candidate | ZIP bytes | ZIP SHA-256 | MP4 SHA-256 |
|---|---:|---|---|
| Short, artifact 11851919897 | 24413126 | ac6a7923c2b8b85d77747f29f63cf0eec46dac9aa23257ad480c2d069e6e5e42 | b67bf2cdb74026f39c62f6e187ffb3fd362fdc820d009f01f9401c5dd70a5884 |
| Long, artifact 11853980184 | 339215165 | c57da0c70f75b50d6fe8df5b9ed9f9f573c9138a579a52d0cdc9fc9724e53b93 | ae4b2332c2c616b5004dc58ff9e8fcdbd754107ac04fd478bba8eb26a950d324 |

Source commit: 89f02aaa10036df57283982fcf727b443dcc306e. Newer source is not certified by these files.

## New independent technical checks: PASS

Both exact final MP4s passed fresh full audiovisual FFmpeg decoding and the existing production_reality_media_qa.py against their own props.json ccsd. An initial invocation mistakenly supplied composition.json (a render configuration, not the timeline) and produced duration/publication-contract failures; those were input-selection errors, not media defects. Corrected runs passed every check.

| Check | Short | Long |
|---|---:|---:|
| Duration | 35.041667 s | 519.333333 s |
| Every-frame motion diagnostic decoded frames | 841 | 12464 |
| Integrated final-mix loudness | -16.8 LUFS | -16.3 LUFS |
| Final-mix true peak (FFmpeg reported) | -1.0 dBFS | -0.9 dBFS |
| Final mux vs retained mix waveform correlation, zero lag, mono 8 kHz | 0.9996998 | 0.9996574 |
| Low-change intervals lasting at least 1 s at configured threshold | None | None |

Long has four silence intervals at the diagnostic -45 dB threshold: 1.29231, 1.1088, 1.44247 and 1.12288 seconds. These are observations, not proven editing defects. Both retained SFX stems contain nonzero audio. Overall RMS levels cannot establish whether sparse effects are appropriate or audible under dialogue. Waveform correspondence establishes mux alignment to the retained mix, not semantic lip/gesture/caption synchronization.

## Actual visual inspection: PARTIAL, not full PASS

Examined an 18-frame Short sheet sampled every 2 seconds and a 17-frame Long sheet sampled every 30 seconds. Empty black cells in the Long contact sheet are tile padding after the last sample, not black video frames.

Short observations: opening wallet conflict; card/sword contrast around 2–6 seconds; cape and sandwich imagery around 8–10; fee-envelope gag around 16–20; panic/check-value buttons around 22–24; shield around 26–30; budget payoff at 32–34. These sampled frames support the declared stick-figure, white-background visual grammar. They do not establish every transition or voice performance.

Long observations: sampled scenes repeatedly stage two figures on opposite sides of a centered prop, including receipt, points, shopping cart, interest ghost and contract. This suggests a staging-variety review priority; sparse sampling cannot prove missing five-second pattern interrupts. Small secondary financial labels need actual phone verification. Sampled characters appear consistent; exact identity and all-frame overlap acceptance remain pending.

Compared actual retained reference/frames/ref-01.jpg and ref-06.jpg: reference uses larger expressive faces, more prominent headline typography and a large focal character/prop. Current samples have more empty space and smaller faces/labels. This is a still-image comparison only; these two files do not represent two independently reviewed competitor videos. No competitor motion, voice or retention parity is certified. Do not copy the reference character identity.

Retained ASR output matches the wallet/Amex/Chase Short and Credit Card DLC Long subjects. This was inspection of existing ASR evidence, not fresh listening. Voice performance, narrator/character identity separation, sound-effect timing, full pacing, factual review and complete synchronization remain UNVERIFIED.

## AI Studio failure investigation

PR39 records both uploads showing Token count failed and subsequent INACCESSIBLE responses. The unrelated mortgage response is invalid evidence. Fresh successful decoding of the exact H.264/AAC files narrows the failure to the tested provider attachment/access path rather than general local file corruption; it does not identify the provider's root cause.

Google's official video documentation distinguishes upload from processing readiness and shows processing-state handling. File size alone is not an established cause. No provider processing state, request ID or backend error was retained in PR39. Browser-only failure cannot prove quota exhaustion, authorization failure, model limitation, or a codec bug. Future provider trials must require ready media plus an unprompted opening visual/audio access check; supplied script text must not be mistaken for observed media.

Source: https://ai.google.dev/gemini-api/docs/generate-content/video-understanding

## Implemented free alternative and confirmed repair

Extended the existing Exact AV Reviewer workflow with scripts/offline_av_review.py. It creates a local HTML player using a byte-identical candidate, decoded final mixed WAV, aspect-preserving 1 FPS frames, full decode log, loudness/silence diagnostics and SHA-256 inventory. No account, network inference, API key or paid service is used. Both real candidate packages executed successfully. This is reliable local media access and technical analysis, not a replacement claim of autonomous creative judgment. Existing exact review validation and publication locks remain intact.

Confirmed diagnostic bug fixed: visual_motion_analysis.py previously distorted landscape frames to 180x320. It now preserves aspect ratio (Long 180x101), records it, and rejects source mutation during analysis. Tests cover aspect handling, actual offline media preparation, output collision rejection and unchanged approval restrictions.

Validation: 3 Python offline/motion tests; 3 free-review guard tests; 24 Node exact-review/handoff tests passed. Fresh full decode of both original candidates passed. No creative media edits were made on the basis of incomplete inspection.

Remaining acceptance: complete independent visual/listening review with timestamped findings, two distinct full audiovisual competitor reviews, and physical Android playback acceptance. Status REVIEW_PENDING; production_approved=false; publication_enabled=false.
