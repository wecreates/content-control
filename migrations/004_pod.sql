-- One ledger event, one authoritative upstream identity. If historical rows
-- violate this invariant, fail migration for explicit reconciliation; never
-- delete, rewrite or silently bless immutable financial history.
CREATE UNIQUE INDEX pod_financial_authority_once ON pod_financial_events(authority_event_id);
