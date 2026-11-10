# November 9, 2026 — bound POD archive command completion

Started at Content Control main `95c22efe9d66afed85a0037f74d1044b4060cec2`
and Money Factory main `72ba628190f21900f5163d1ded8495349f216fb8`.
The authorized free Render service was live on `fd0348d7640df6b02bfee0ff846896c14337f10b`;
the intervening main change was watchdog evidence marked to skip Render.
The latest POD integration, container, and cross-repository gates had passed.

Both archive CLI regressions reproduced a false success when publication
settings changed while closing the owned pool. The old timeout was cleared
before shutdown and did not bound pool construction. The shared archive
session keeps the existing deadline through preflight, pool creation and
shutdown. Late pools are closed best effort; cleanup failure cannot mask an
earlier operation error. Final safety checks withhold stale success, without
claiming a committed restore rolled back or racing its in-flight COMMIT.

Focused local archive tests: 150 passed. The subprocess regression verifies
a stalled shutdown fails on the deadline without another referenced handle.
Offline verification and recovery fixtures use temporary paths and no live
archive key. Hosted results and deployment evidence are recorded on the PR.

No production database access path changed, so database administration was
not retried. No production restore, independent retention, marketplace action,
or publication occurred. The 24 live acceptance areas remain open.
