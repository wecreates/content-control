# Outbox storage safety cutoff

Internal Money Factory feedback uses the same `PodDB.active()` safety boundary
as other POD work: it stops when storage expiry is unknown or within 24 hours.
Delivery checks that boundary before selecting events, before each HTTP send,
and before reporting batch completion, including an empty page. Database waits,
earlier HTTP responses and acknowledgement commits cannot authorize later sends
after the cutoff. The batch-wide error is not swallowed by `continueOnError`.
The runtime retains its previous cursor on rejection and backs off as usual.

An HTTP send already in flight cannot be undone. If its receiver accepts an event
but the local acknowledgement cannot commit, the event remains pending locally.
The receiver must atomically deduplicate its stable event ID on a later authorized
retry. A previously committed acknowledgement is retained. A rejected batch does
not return partial counters, so runtime counters are not an authoritative ledger;
the durable event rows and Money Factory inbox determine delivery state.

The controlled-clock tests exercise the real storage-boundary and transaction
methods with injected database/HTTP operations. They do not demonstrate live
storage retention, current grants, delivery to a mounted authority or a recovery
drill. No automatic expiry extension, credentials or publication is enabled.
