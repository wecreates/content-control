# Separate image/audio access verification — 2026-10-14

Publication remains disabled. No full creative acceptance is claimed.

## Observed access failure and successful workaround

A five-second, 138106-byte H.264/AAC MP4 made from the recovered original Short uploaded to Google AI Studio (Gemini 3.8 Flash, no API key selected), displayed "Token count failed", and returned INACCESSIBLE for video and audio.

The SAME approved excerpt was decoded locally into a JPEG first frame and PCM WAV, then supplied as separate attachments with a blind identification/transcription request. No script, expected words, labels or character description were supplied. The interface counted 1101 image tokens and 163 audio tokens.

The response correctly described a black-and-white angry stick figure holding a wallet, identified Stop / CHASE / AMEX, and transcribed "Stop attacking my wallet" and "Two cards, still no budget". Visual details match the locally viewed extracted image; speech matches the pre-existing observed-word caption record in the original artifact. This establishes sample access, not voice-performance approval.

The result isolates a working separate-image/audio ingestion route in this session. It does not prove the provider's internal root cause or reliable MP4 ingestion. Google documents that uploaded video must finish processing before inference: https://ai.google.dev/gemini-api/docs/video-understanding

## Integration

The existing offline_av_review.py now prepares separate 10-second PCM WAV packets and references to its existing 1 FPS JPEG samples. Each packet carries original candidate SHA-256, exact audio sample bounds, audio/image hashes and NOT_REVIEWED status. Audio packets partition the decoded final mix without resampling or omitted/duplicated samples. Image times are explicitly nominal filter-output times, not exact source-frame times.

No additional provider, API key, paid service or automated external upload was introduced. No new render was necessary. Full native video remains in the offline package for continuous motion review. Sampled frames must not be represented as continuous motion verification.

## Actual repaired-media execution

- Short candidate: 46a6989bc7a5f3e0c35c552d2a8c635d1c0fadf369c6252d1c66945b452ee17a
- Long candidate: 41a479dda53d9b926b299e3769493b9082d450e71c4e1e65e12bf9732d649766
- Both archives: CRC passed; exact recovered candidate hashes matched.
- Both complete video/audio streams: local strict decode passed.
- Short: 35 sampled frames, 4 audio packets.
- Long: 519 sampled frames, 52 audio packets.
- Existing exact review preparation emitted REVIEW_REQUIRED for each.

During this repair, another main-branch update independently added the same retained visual-run allowlist. Preserve that table implementation; this change adds expanded provenance regression coverage and the experimentally verified separate-media transport.

## Remaining acceptance

Full independent audiovisual judgment of both repaired candidates, continuous motion/pacing/synchronization, two full competitor audiovisual comparisons, and physical Android playback remain unverified. Successful upload, decoding, packets, transcripts and sample access do not satisfy those gates. The prior specific external-upload authorization covered only a five-second excerpt; the complete packets have been prepared locally, not externally uploaded.
