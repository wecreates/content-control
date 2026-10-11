# Watch video-analysis skill — integration specification

Source: https://github.com/bradautomates/claude-video/tree/main/skills/watch
Upstream skill: `watch` v0.3.2 at inspection; MIT.
State: **adapter and test contract only**. Do not claim installation until dependencies and end-to-end video test succeed.

## Purpose
Use Watch as an optional authorized-video analysis backend for Content Control's existing social intake. Do not replace `social-intake.js`, `social-router.js`, or existing transcription tools.

## Engines and cost
- Local: Python 3.10+, FFmpeg/ffprobe, yt-dlp. Captions first, frames when video accessible. No paid API needed.
- Optional Gemini: only when user authorizes cloud processing and provides their own key. A free tier may be available subject to quotas.
- WhisperX: optional, large local download and memory requirement; never auto-install.
- Never auto-provision a paid service or send private footage to an external API without permission.

## Safe execution
1. Classify URL and check user authorization and source restrictions.
2. Resolve skill at a pinned, reviewed upstream commit; inspect bundled Python before running.
3. Perform dependency preflight using bundled `scripts/setup.py --json` in an isolated runner.
4. Execute `scripts/watch.py URL --question QUESTION --engine local` only for authorized content.
5. Preserve source timestamps, frame/transcript coverage, failure details, and provenance.
6. Distinguish a complete video watch from partial captions, sampled frames, or metadata.
7. Send verified observations to existing Content Control and Money Factory classifiers.
8. Require existing quality, security, finance, and publication gates. Publication stays disabled.

## Acceptance tests
- [ ] Python/FFmpeg/yt-dlp available in execution runner
- [ ] Source commit pinned and inspected
- [ ] A user-authorized public video processed with timestamped frames and transcript
- [ ] A restricted video fails clearly without bypass attempts
- [ ] No fabricated visual claims from transcript-only input
- [ ] Verified findings routed to existing social-intake pipeline
- [ ] Zero unauthorized publishing, spending, or account changes

## Compatibility
This is an Agent Skill intended for supported local coding-agent environments. Copying `SKILL.md` into a GitHub repository does not install it into ChatGPT or guarantee that hosted video ingestion works.
