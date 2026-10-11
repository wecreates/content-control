# Social integration in the existing projects

`/social` extends the existing Content Control review service. `/api/social/status` reads the existing `capability-queue.json` and dated platform research; `/api/social/project-links` checks Money Factory's existing idea-vault references through a fixed read-only GitHub URL. No separate production queue was created.

`POST /api/social/validate` recognizes and deduplicates links without saving. `POST /api/social/intake` returns 503 until an authenticated durable writer is implemented. Render's free filesystem is not used as a pretend persistent job store. Authorized chat-assisted intake is saved with the existing GitHub connection; dashboard writes and automatic ingestion from every future chat message are not configured.

All other mutation routes in this integration return 403 PUBLICATION_DISABLED. No social publishing adapter or refresh-token secret is installed. Token renewal helpers are planning-only. Tests cover retries and an environment requesting publication; the code denies these external effects. This is a scoped integration test, not a claim that every historical workflow in both repositories has been exhaustively audited.

## Acceptance source

Instagram Reel `DeUlQTQxv5O`: Transcriptor returned metadata, automatic Whisper transcript/SRT through 52.08 seconds, and frames inspected at 0, 15 and 35 seconds. Complete continuous video/audio inspection was not achieved. Evidence and three scoped findings are in the existing queue, not represented as a complete viewing. Creator allegations about Wi-Fi/silent-mode targeting remain unverified.

Duolingo's own article supports notification personalization and experimentation: https://blog.duolingo.com/hi-its-duo-the-ai-behind-the-meme/. That general evidence informs an internal experiment only; no collection or messaging is enabled. No CYZOR performance uplift is asserted.

`production/social-intake/DeUlQTQxv5O-brief.json` is a draft technique brief retaining Remotion, white backgrounds, black stick figures, assigned voices and separate audio stems. It is not a rendered video. Money Factory's existing idea vault holds the corresponding retention experiment with the canonical source reference and unknown financial metrics.

## Verification and operation

Run `npm run test:social`. Platform matrix: `social-capabilities.json`; explicit dependencies: `SOCIAL_INTEGRATION_STATUS.json`. API documentation and account operation are separate statuses. Only Instagram/YouTube connector inventories were probed; both were empty. Other connections remain unverified. Existing V10 health passed live; V2 failed its existing acceptance gate.

Keep supplied tokens, credentials and account identifiers out of these public repository records. Use secure provider authorization and private server-side token storage when a supported connection is configured. Do not add confidential evidence to the public queue. No new recurring production automation was configured.
