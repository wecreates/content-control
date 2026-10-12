# Watch video-analysis skill — existing social-intake integration

Source: https://github.com/bradautomates/claude-video/tree/main/skills/watch
Recorded upstream revision: `03ceb42f7fa2c4439aca01752118044baabffb8f` (Watch v0.3.2; MIT).

**Current status: adapter tested; complete audiovisual analysis remains unverified.**
The historical receipt `integrations/verification-2026-10-11.json` records extraction of a 52.1-second public Instagram reel and 16 reviewed frames, with no new transcript and no authenticated account. It does not identify a retained source-media file or its hash. A 2026-10-12 inspection found no corresponding source video in the current workspace or temporary media files. That historical receipt is not evidence that the source is currently available for transcription.

## Execution and free-only policy

`watch-bridge.mjs` preserves the existing `social-intake.js` and `social-router.js` pipeline. It builds a fixed argument array, never a shell command, normalizes supported source URLs, and requires an absolute trusted skill directory.

- Default: `transcription: 'whisperx'` produces `--whisper whisperx --engine local`.
- Explicit captions-only mode: `transcription: 'none'` produces `--no-whisper --engine local`.
- Other transcription selections are rejected. This adapter does not expose Gemini or paid/cloud transcription modes.
- WhisperX must already be provisioned in the trusted runtime. It is a substantial local dependency; **never auto-install it**. Missing dependencies must remain a visible failure, not silently fall back to a paid backend.
- Existing local faster-whisper may separately transcribe an already authorized and retrieved reference. Such output must carry actual timestamps and source-file provenance; it must not be passed off as a successful Watch/WhisperX run.
- No private footage uploads, paid provisioning, account changes, or publishing occur through this adapter.

Before execution, confirm source authorization and restrictions; inspect the pinned upstream scripts and run their dependency preflight. With local WhisperX already available, the adapter's equivalent command is:

```sh
python3 /trusted/watch/scripts/watch.py AUTHORIZED_URL \
  --question 'Summarize this video with timestamped visual and spoken evidence.' \
  --whisper whisperx --engine local
```

Use `transcription: 'none'` when deliberately collecting only available captions and sampled frames. That mode does not establish full audio coverage.

## Evidence and routing

`queueWatchResult` records raw extraction as `unreviewed_watch_output`, with `verified: false`, `review_required: true`, and no claim of full video or audio coverage. Re-extraction preserves previously verified findings and routing state instead of erasing them.

An agent or reviewer must inspect the actual extracted material before attaching findings through the existing social-intake evidence contract:

- Spoken findings require timestamped transcript coverage.
- Visual findings require reviewed frame timestamps or genuinely reviewed audiovisual intervals.
- Full analysis requires verified audiovisual evidence spanning the entire measured duration without gaps. A transcript plus 16 sampled frames cannot establish this.
- Record on-screen text, visual changes, editing patterns, and storytelling observations only where observed; retain missing coverage and retrieval errors.
- Keep publication disabled and preserve existing security, finance, quality, and Money Factory readiness gates.

## Remaining full-analysis acceptance

1. Locate or retrieve the user-authorized reference through an available authorized route; record the source URL, file hash, measured duration, and retrieval outcome.
2. Produce timestamped narration using the available local engine; distinguish ASR output from reviewed speech.
3. Inspect visual and on-screen-text evidence throughout the timeline, with explicit coverage gaps.
4. Attach only verified observations to the existing intake record and route its findings through the existing classifier.
5. Claim complete analysis only when the full audiovisual coverage contract passes. Restricted retrieval must fail clearly without bypass attempts.

Current adapter tests cover fixed arguments, allowed local transcription modes, unsupported-host rejection, preservation of reviewed evidence, and refusal to promote extraction to verified coverage:

```sh
node --test integrations/watch-video/watch-bridge.test.mjs
```

Copying the upstream skill into a repository does not install it into ChatGPT or prove hosted ingestion works. Actual source retrieval, account permissions, dependency availability, and reviewed evidence must each be verified separately.
