# Bind QA to captured package bytes

Technical QA now copies the hash-verified package inputs and reference into a
private temporary workspace before OCR, raster, PDF or optional model inspection.
The manifest is already captured by the bounded JSON reader. Each artifact hash
is computed from the same bytes written to the workspace; reference hashing and
optional similarity inspection use the same captured reference. Replacing or
deleting an original path afterward cannot change what QA inspects.

Packages contain 1–32 flat generated filenames, at most 16 MiB per artifact and
64 MiB total. The reference has a separate 16 MiB limit. Reads use a regular-file
descriptor with no final-symlink following and a bounded read even if a file grows
after its size check. Invalid identities, escaped paths, oversized data and hash
mismatches fail closed before inspection. Temporary copies are removed on success
or failure. Nested filenames are unsupported by this generated-package contract.

This adds bounded temporary disk usage; it does not provide durable storage or
replace independent review. Current signed package rights, competitive review,
KDP editorial evidence and expiry checks still apply. No approval is manufactured,
publication remains disabled, and tests with synthetic signatures do not prove
live independent QA, print acceptance or measured production capacity.

## Review export response deadlines

The default HTTPS transport in `scripts/pod_review_export.py` enforces a
20-second wall-clock budget per response, in addition to the existing socket
timeout and byte ceilings. The timer surrounds opening the response, reading
headers/body and closing it; slow-drip bytes cannot renew the budget. Elapsed
monotonic time is checked before returning bytes, so a late completion cannot
be accepted merely because an alarm callback was delayed.

This synchronous CLI requires a POSIX main thread with an unused real-time
interval timer. Unsupported contexts fail before opening the network connection;
an existing alarm is never replaced. The previous signal handler is restored
and the temporary timer cleared after success/failure. Signal delivery depends
on the Python runtime and is not a process-isolation guarantee for arbitrary
uninterruptible native code. This is a per-request bound, not a whole-export
capacity measurement. A custom injected transport remains the caller's bounded
transport responsibility.

An artifact timeout removes the partial output directory through the existing
cleanup path. The CLI retains its redacted `REVIEW_EXPORT_FAILED` receipt, and
hash checks, HTTPS-only endpoints, redirect rejection, output overwrite protection
and publication restrictions remain unchanged. Local HTTP fixtures exercise
slow headers, slow-drip manifests/artifacts and a valid restore; they establish
neither live recovery nor independent approval.
