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
