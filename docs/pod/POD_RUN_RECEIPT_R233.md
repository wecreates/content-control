# POD run receipt r233 — lossless signed event JSON

Date: 2026-10-24

## Reconstructed state and scope

Content Control started from main
`5def24c9ce174c61138adc258ccc9cd18bd47a27`; Money Factory started from
`9efbd0cb2dca3b4c545dd951de8133966a17a510`, preserving the concurrent
`free monitor cadence tick`. Current POD completion, implementation-status and
free-deployment documents, open pull requests, exact-head workflow results and
the authorized existing Render service were inspected. Open pull requests were
unrelated draft media/offline work and did not overlap this repair. The
previously failed database-administration path had no credible access change
and was not retried. No resource, credential, account, network rule or
marketplace state was created or changed.

## Repair and regression evidence

Content Control's durable outbox sender serialized an event immediately before
signing it. JavaScript JSON serialization can normalize non-finite numbers to
`null`, omit `undefined`, and preserve unsafe integer spelling despite loss of
numeric identity. An acknowledgement for the stable event ID could therefore
mark an event delivered after the signed body had diverged from the durable
value. The pre-fix regression reproduced this behavior as `Missing expected
rejection`.

[Content Control PR 563](https://github.com/wecreates/content-control/pull/563)
now validates a present durable payload before serialization, signing or
network dispatch. It rejects non-finite numbers, unsafe integers, unsupported
JavaScript values, exotic objects, hidden or symbolic members, and excessive
depth or collection size with `OUTBOX_EVENT_JSON_INVALID`. Invalid events send
no request and write no delivered marker. The exact remote PR head was
`42ec2f36768948edb9604549ee017b675d43ee34`. Remote blobs were
`35817a4300b7ff0cf6adbefccc0dc45d638441cb` for `OUTBOX.md`,
`42c3c53c664fb9b4660c0c71516c3c025507caa0` for `outbox.mjs`, and
`c8087ca85fcccfa5e9984041c91dc9d5c058deac` for the runtime regression; they
matched the tested local contents.

The focused outbox suites passed 78/78. The broad dependency-free local POD
Node suite reached 713 tests: 711 passed, two expected skips and zero failures.
The unfiltered local command reached 693 passed and two skipped; its only six
failures were unchanged import failures because this scratch checkout lacks the
`pg` package, so no local PostgreSQL pass is claimed. Exact-head hosted runs
[40098622096](https://github.com/wecreates/content-control/actions/runs/40098622096),
job 120885995026, and
[40098622097](https://github.com/wecreates/content-control/actions/runs/40098622097),
job 120885995030, both passed. They supplied pinned dependencies, disposable
PostgreSQL, full Python/rendering, real print/durable-review and
publication-disabled production-image startup gates. PR 563 was squash-merged
as `09dd2fd094627481c9ef92879d1dee04dae2e9ef`.

Money Factory's strict JSON parser rejected overflow to infinity but still
accepted integer literals outside JavaScript's exact safe range. A signed
literal such as `9007199254740993` could therefore be rounded before scope
checks, hashing or storage. The pre-fix parser regression failed with `Missing
expected exception`; the signed-event case reached ordinary scope handling
after the rounding had occurred.

[Money Factory PR 188](https://github.com/wecreates/Money-factory/pull/188)
now rejects such tokens with `REQUEST_JSON_UNSAFE_INTEGER` before scope checks,
database acquisition or storage, and pins its cross-repository production gate
to the immutable Content Control merge above. Its exact remote head was
`4b21479a2777b2b728917d8502bb32c0b248a7df`. Remote blobs were
`ed91875569c505597f9e8f0b401c138c5ab85616` for the POD README,
`493cea27edf3518a663b9e6976141fb959ea1edf` for the parser,
`9aca6b6163a0f53a95b4c88c90b65fda443f1150` for the parser regression,
`fc7b46ddd4efb39be7988cf001ed9ad0a745edc8` for the clock-contract regression,
and `3ed3562b70df5af2d2f9f8f87648e54fabbb1eb4` for the pinned workflow; they
matched the tested local contents.

The focused parser suite passed 7/7. The paired Money Factory Node suite reached
114 tests: 113 passed, one expected PostgreSQL-environment skip and zero
failures. All 81 Python tests passed. Exact-head hosted run
[40099187148](https://github.com/wecreates/Money-factory/actions/runs/40099187148),
job 120887624375, passed every pinned review, recovery, rights, template,
editorial, Node, Python, package-contract and disposable-PostgreSQL stage. PR
188 was squash-merged as `6712b593a664c9cee0dab507b5e587d20a66da46`.

## Deployment and acceptance state

Render auto-deploy correctly observed the Content Control application merge as
deploy `dep-dbebaeks728c73cd2n8g`, but failed before build at
2026-10-24T13:40:11Z because free pipeline minutes were exhausted. The exact
events were deploy start `evt-dbebaersp5es73c04ecg`,
`pipeline_minutes_exhausted` `evt-dbebaer4qb4c739ks7g0`, and failed deploy end
`evt-dbebaerphbkc739lbbq0`. No manual retry, purchase, plan/cache change,
replacement service, secret access or network widening occurred.

All 24 live acceptance areas remain **OPEN**. This closes two lossless-event
transport ambiguities only; merged code and hosted CI are not live acceptance.
Production restricted database/schema/migrations, retained recovery evidence,
deployed hybrid dependencies, mounted Money Factory authority/current grants
and revocation, real accounts/sources/rights/templates/reviewers, authorized
five-platform adapters, actual economics/reconciliation, owner-phone
acceptance, monitoring/recovery drills, measured capacity and a real authorized
end-to-end launch remain unverified. `PUBLICATION_ENABLED=false` and
`POD_PUBLICATION_ENABLED=false` remain mandatory; Etsy remains excluded. No
approval, clearance, revenue, publication or continuously running self-hosted
worker is claimed.
