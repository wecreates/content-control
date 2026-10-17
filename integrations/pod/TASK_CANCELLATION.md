# Stopping stored-task restoration

The production coordinator passes its AbortSignal to
`resolveTask(job, {signal})`. Existing one-argument host resolvers remain callable;
host implementations must honor the signal for cooperative cancellation.

The stored resolver checks cancellation before reading the descriptor, after
descriptor and input reads, after creating the workspace, and after each file
write. It starts no later input read after observing cancellation, removes any
partial workspace, and returns the fixed `PRODUCTION_STOPPED` reason without
including an arbitrary abort reason. The coordinator also rechecks its stop
signal and production switch after a delayed claim or initial grant lookup and
after task resolution, before reading templates or invoking Python.

In-flight database reads and filesystem writes are awaited before cleanup. This
does not cancel PostgreSQL queries, impose a pool-acquisition deadline, or promise
instant shutdown. It avoids racing workspace deletion against unfinished writes.
Existing host connection/query deadlines are still required. Failure recording
uses the current lease/fencing guard; an expired claim cannot be rewritten by a
late stopped worker. Cancellation does not imply automatic retry or approval.

The tests use synthetic grants, injected artifact reads, and real temporary files.
They establish cancellation boundaries and cleanup, not live storage, measured
capacity, independent review, or deployment acceptance. Publication remains off.
