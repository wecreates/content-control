# CYZOR Content Control

Automated content production, reference-DNA adaptation, voice/render QA, and business-content execution.

## Money Factory integration

Content Control now consumes the Money Factory business-content contract.

- Every known business can generate content.
- Each business has a maximum content mode: RESEARCH, PRELAUNCH, or LAUNCH.
- Content Control must fail closed if asked to exceed the Money Factory readiness ceiling.
- Product-specific claims, pricing, shipping, safety, warranty, revenue, and social proof require verified upstream evidence.
- Product-demo short-form grammar is active for software, Chrome extensions, AI tools, digital products, gadgets, and physical products with demonstrable value.
- Publication remains disabled by default.

Primary policy: `production/money-factory-content-policy.json`
Style DNA: `reference-dna.json`
Capability queue: `capability-queue.json`

## Review preview identity

`/readyz` describes the exact unpublished canonical Episode 1 preview and
`/episode3/health` describes Episode 3. A green response includes one hash-bound
`watchUrl`, `mediaUrl`, and `captionsUrl`; the candidate and caption hashes in
those URLs are the same identities reported in that response. Consumers must
follow the returned watch URL rather than combining `/readyz` evidence with a
different episode's watch route.

When any Episode 3 evidence exists, Episode 3 owns the user-facing `/latest`
selection. If its media, captions, receipt binding, or publication lock is
invalid, `/latest` and the root review link fail closed instead of falling back
to an older green Episode 1. Canonical deployment readiness remains independently
observable at `/readyz`. A hash-bound watch URL returns a blocked page when
either requested identity has changed. These checks establish byte/route
coherence only; they are not physical-phone playback, listening, creative
acceptance, deployment freshness, or permission to publish. Publication remains
disabled.
