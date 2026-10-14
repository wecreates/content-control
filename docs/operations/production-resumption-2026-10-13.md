# CYZOR production resumption — 2026-10-13

## Acceptance status

Production is **not fully accepted**. Technical production success does not establish complete audiovisual review, competitor comparison, creative acceptance, or Android-device playback. Automatic publication remains disabled. No paid service, desktop, TinyFish, duplicate deployment, or relaxed approval gate was used.

## Changes executed

- Content Control PR26: full-capability scheduling now rejects missing domain validation rather than reporting fabricated completion. Existing unimplemented capabilities remain blocked.
- Content Control PR27: actual pinned OpenMontage upstream probe/stitch execution, beyond adapter unit tests.
- Content Control PR29: missing Python and stalled validation children cannot crash or indefinitely lock the playback server; bounded logs, timeout, error handling, and single-flight tests.
- Content Control PR30: hash-bound short/long execution summaries and live status routes; incomplete, missing, stale, or failed evidence cannot report approval. Future production runs persist summaries without recursively triggering production.
- Content Control PR32: replaces unrelated hardcoded audiovisual-review input with selected production artifacts, measured duration, exact hash, provenance and full-coverage validation. Preparation does not approve anything. Input/output aliases and media mutation are rejected. No inference provider is called.
- Content Control PR33: records fresh Short technical evidence and repairs the obsolete cost-guard test while retaining the real unverified-cost provider blocks.
- Money Factory PR7: reconciles existing hosted CPU evidence without claiming broad provider readiness.
- Money Factory PR8: pinned REA 6.4.0 offline JavaScript source analysis, dependency integrity lock, isolated configuration, no inherited provider credentials, unchanged target hashes, and exclusive evidence output. Real execution passed on free GitHub Ubuntu; the workspace's broken procps boundary was not bypassed.

Existing working components and alternative draft PRs were preserved. Unverified alternate runtimes and optional GPU integrations were not merged simply to clear the PR list.

## Execution evidence

Fresh production run: https://github.com/wecreates/content-control/actions/runs/38472504826

Source commit: `89f02aaa10036df57283982fcf727b443dcc306e`. Later source changes are not implicitly covered by this run.

Short: `Amex vs Chase Boss Fight`, 35.042 seconds, 720×1280, H.264/AAC. SHA-256 `b67bf2cdb74026f39c62f6e187ffb3fd362fdc820d009f01f9401c5dd70a5884`. Actual free voice generation, mix, ASR contract, captions, Remotion render, mux, memory/package, recovery and technical media checks passed. An independent full decode and technical media probe also passed. No black samples; audio spans the video; mean audio level −20.8dB; longest sampled duplicate run 0.25 seconds. These metrics do not establish voice performance, complete listening, factual approval, or creative quality.

Long: current-run production job completed successfully. `Credit Card DLC`, 519.333 seconds (8 minutes 39.333 seconds), 1280×720, H.264/AAC. SHA-256 `ae4b2332c2c616b5004dc58ff9e8fcdbd754107ac04fd478bba8eb26a950d324`. The strict execution summary independently hashes the downloaded current candidate and matches required media QA and OpenMontage probe checks. Technical PASS remains REVIEW_PENDING; creative/listening review and publication approval remain false/pending. Independent fresh full actual-media QA also passed for the same hash. QA reports complete audiovisual decode, no black samples, audio covering the entire video, mean audio level −20.0 dB, and longest sampled duplicate run 0.625 seconds. Historical run 38269521289 is separate and not used to certify this candidate.

Visual spot-checks covered 18 Short frames and 12 Long frames: sampled captions and labels were readable, characters consistent, and no obvious sampled overlaps were seen. This does not establish full visual coverage or complete listening.

Exact Short review preparation executed successfully: https://github.com/wecreates/content-control/actions/runs/38474041594 . Long exact review preparation also succeeded: https://github.com/wecreates/content-control/actions/runs/38475295616 . Both produce review requests, not review verdicts.

System Wiring Audit after PR33: https://github.com/wecreates/content-control/actions/runs/38474237574 — success. REA hardening CI: https://github.com/wecreates/Money-factory/actions/runs/38474203336 — success. Runtime smoke and deployment checks after PR29 passed. Test suites overlap; their counts are not added into an artificial total.

## Hosted runtime and playback

The existing free Render service remains `content-control-render-worker` (`srv-darsdb8u01pc73dn4i2g`). Its accepted V10 media and caption hashes match, `/health` responds 200, and MP4 byte-range requests respond 206. Accepted media SHA-256 is `54f37c847c79e632e26648a3f31f11f24266d316217dd71025187b1924c1b127`.

Existing playback: https://content-control-render-worker.onrender.com/watch

This is the earlier accepted video, **not either fresh finished deliverable**. The canonical browser player reached readyState 4, duration 30.058667 seconds, with no media error. Browser/HTTP checks are not a physical Android-device test. The fresh candidates remain review-pending with no approved playback URL. The server intentionally withholds unapproved draft media.

The hosted Short execution endpoint was verified against run 38472504826 and its exact candidate hash. It reports technical PASS, REVIEW_PENDING, no watch/media URL, and disabled production approval/publication.

The hosted integration status reports verified scoped CPU operations through GitHub Actions, not a persistent generation worker or full project readiness. The earlier `WORKER_NOT_CONFIGURED` failure no longer reproduces.

## Integration scope

| Component | Evidence-backed status | Remaining scope |
|---|---|---|
| Remotion, free CPU voices, audio, captions, character memory | Actual retained production stages pass | Complete creative and listening acceptance |
| OpenMontage | Actual pinned probe/stitch acceptance run 38471856797 passes | Not full creative acceptance |
| Watch | Fixed local-only adapter, six tests pass | Retained complete authorized reference and full audiovisual analysis missing |
| REA | Actual pinned offline source analysis passes | Other modes not claimed |
| Lemo-Opuscar | Pinned style catalog/tools and generic 3-second FFmpeg smoke pass | Not an executed Lemo production pipeline |
| Opus animation references | Importer tested against 513 catalog entries | Reference library, not generator; per-item rights and creative adaptation separate |
| Money Factory | Eight scoped hosted CPU operations verified | Provider-backed workflows and persistent worker state not established |
| Wan | Optional, disabled | CUDA host/model weights absent; no paid GPU provisioned |

## External and review boundaries

1. **Full audiovisual review:** the earlier terms/authorization boundary was cleared by the user. On 2026-10-14 UTC, both authorized candidate files were attached in Google AI Studio using Gemini 3.8 Flash with no API key selected. Both showed `Token count failed`. The Short response described unrelated mortgage content and was rejected; when challenged to transcribe and identify the actual opening, it returned `INACCESSIBLE`. A separate Long access preflight, limited to the first 15 seconds at 1 FPS, also returned `INACCESSIBLE`. This establishes failure of this browser review path, not a defect in the independently decoded media or a successful full audiovisual review. No paid key or upgrade was enabled. No fabricated findings were used for repair or approval.
2. **Instagram:** the browser is ordinarily signed out; no connected Instagram account is returned by the available account connector. This is an authentication gap, not a reproduced bot block or wrong-password bug. Official integration still lacks required Meta/Instagram configuration. No authentication bypass or repeated login loop was attempted.
3. **Owner and YouTube OAuth:** required owner GitHub client configuration and YouTube client/channel configuration remain absent. Publication stays off even after configuration.
4. **Reference review:** existing intake/reference evidence does not establish two distinct full audiovisual competitor reviews. Sampled frames and transcripts cannot be relabeled as complete coverage.
5. **Durability:** the existing free PostgreSQL instance expires 2026-10-26T20:02:09.446632Z. Existing encrypted storage evidence was retained; TLS and network restrictions were not weakened. Free Render is not an always-on durable GPU service. Actions media artifacts have finite retention.

These boundaries prevent claiming the requested two fully finished, audiovisual-approved, Android-verified videos. They must remain visible in status and handoff records.

## Reviewer attempt update — 2026-10-14 UTC

The user explicitly authorized uploading these two unpublished candidates to Google AI Studio after disclosure of its data-use implications. Upload authorization is no longer the blocker. Media attachment processing/access in the tested free browser session is the remaining observed blocker; the underlying provider failure cause is not established.

The Short's invented mortgage narrative contradicts the exact source's wallet/Amex/Chase opening ("Stop attacking my wallet"). Model assertions that video/audio were accessible were therefore rejected before any acceptance decision. The subsequent explicit `INACCESSIBLE` responses from both sessions are not creative verdicts. The Long preflight covered only a requested 15-second sample and cannot establish whole-video review.

Candidate hashes, technical PASS, REVIEW_PENDING, and disabled publication remain unchanged. No new approved playback URL exists for either candidate. The previously verified hosted player remains the earlier V10 video. Complete listening/visual review, two distinct authorized audiovisual reference reviews, and Android playback acceptance remain unverified. This documentation-only update does not rerun or certify newer source changes.
