# POD production claim admission — November 10, 2026

The worker previously accepted a snapshot with a well-shaped claim and a
contradictory embedded brief. A callback could be reached before the durable
stage guard had a chance to check the row. Falsy adapter outcomes were also
treated as evidence of an idle queue.

The worker now requires matching job, account, marketplace and destination
identities before authority lookup, task restoration or any settlement. It
does not settle a row from a contradictory claim. Existing lease recovery
owns that row. Only explicit null is idle; unsupported marketplaces and
malformed results fail with the existing fixed uncertainty signal.

Eight negative cases reproduced the gap on the base and passed with the
repair. The valid and immutable claim paths retain their previous behavior.
This is not a live production run or marketplace authorization. Both
publication flags remain off and all 24 live acceptance areas remain open.
