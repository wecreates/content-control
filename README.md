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

## Private preview evidence binding

After a Money Factory cycle export has passed its queue-independent durable
delivery verifier, capture this deployment's `/readyz` response and retain the
complete physical-phone screen recording plus its structured observation. Bind
those receipts without contacting the deployment or changing any state:

```sh
python scripts/verify_preview_delivery_acceptance.py \
  readyz.json delivery-package.json verified-delivery.json phone.json \
  phone-recording.mp4 <expected-40-hex-source-commit> \
  <trusted-64-hex-delivery-identity>
```

The command requires one fresh deployed source, candidate, caption identity,
and externally supplied durable delivery identity across every receipt. It
also hashes the retained recording and requires explicit complete-playback,
audio, caption, and inline-phone observations. A passing result establishes
receipt coherence only: an independent reviewer must still watch and listen to
the recording before phone playback, creative quality, or full audiovisual
acceptance can be claimed. Publishing and external writes remain disabled.
