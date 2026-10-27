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
If a delayed production claim returns no job after cancellation, the direct
worker result is `STOPPED`, not a healthy `IDLE` cycle. The same result applies
when the production switch changes to false while an empty claim is in flight.
A claim that did acquire a lease continues through the existing fenced
`PRODUCTION_STOPPED` settlement; it is never silently abandoned.

In-flight database reads and filesystem writes are awaited before cleanup. This
does not cancel PostgreSQL queries, impose a pool-acquisition deadline, or promise
instant shutdown. It avoids racing workspace deletion against unfinished writes.
Existing host connection/query deadlines are still required. Failure recording
uses the current lease/fencing guard; an expired claim cannot be rewritten by a
late stopped worker. Cancellation does not imply automatic retry or approval.

The tests use synthetic grants, injected artifact reads, and real temporary files.
They establish cancellation boundaries and cleanup, not live storage, measured
capacity, independent review, or deployment acceptance. Publication remains off.

## Independent review callback

The optional host callback is now `reviewPackage(manifest, {signal})`. The signal
is the same worker cancellation signal supplied to task and grant resolution.
Existing one-argument reviewers remain callable. Reviewers should pass this
signal to their bounded network and filesystem operations and settle their
promise when canceled. The coordinator awaits settlement before cleanup; it does
not race deletion of the workspace against a detached callback.

After either resolution or rejection, the coordinator checks cancellation and
the production switch. A stopped review produces the fixed `PRODUCTION_STOPPED`
reason, discards any late attestation before reading its paths, and starts no QA
process or completion write. Ordinary reviewer failures retain existing redaction.
Failure recording remains subject to the current database lease/fencing checks.

This is cooperative cancellation, not a forced deadline for arbitrary host code.
A reviewer ignoring the signal can still delay shutdown, as can outstanding
database or cleanup work. The host must enforce its own review I/O deadlines.
The default stored resolver still holds work for independent review; no reviewer,
approval, timeout-based pass, or publication permission is created here.

## Print process completion deadline

The Python-stage runner uses one absolute monotonic deadline from before process
launch through child/pipe closure and successful output decoding. A zero exit
code at or beyond that deadline returns the fixed PYTHON_STAGE_TIMEOUT error,
even when the timer callback has not run. Timer-based termination still stops
stalled processes, and existing process-group cleanup is awaited before workspace
deletion. Earlier abort, output-limit, spawn or descendant-cleanup failures retain
their existing fixed reasons; raw process output is never added to timeout errors.

Elapsed checks cannot preempt synchronous JavaScript or force an immediate
callback while the event loop is blocked. The kill grace period can extend the
time needed to reap stopped processes; it does not extend the budget for a
successful stage result. Tests use real child processes with a controlled
monotonic clock and do not measure production capacity or confer QA approval.
