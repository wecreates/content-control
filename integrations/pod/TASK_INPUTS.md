# Stored production task inputs

A schema-version-1 task descriptor is a hash-addressed JSON artifact (maximum
256 KiB). Its files map contains 1–32 flat ASCII filenames, each 1–100 characters
from letters, digits, underscore, hyphen and dot. Dot and dot-dot names are
rejected. Each hash must be a lowercase 64-character hexadecimal **string**;
arrays and other coercible values are invalid. Restored bytes remain bounded
to 64 MiB in a private disposable workspace.

## Input/output separation

The names `package`, `qa.json` and `qa-signed.json` are reserved for generated
output and are rejected case-insensitively in the input map. Do not import an
input under those names. Rename it in the descriptor and update every referencing
role; preserve the artifact hash. The resolver validates the descriptor before
creating a workspace or fetching any input artifact. It does not overwrite
stored input bytes to make a malformed task run.

The required roles are `source`, `template`, `textLayers`, `assetRights` and
`reference`; each references a declared input filename. `templateScope` requires
a nonempty product and uppercase two-letter country. KDP interior tasks additionally
provide an object named `interior` containing **exactly** `template`, `pages` and
`font`, each referencing a declared filename. Omit `interior` when it does not
apply; null, false, arrays, missing roles and extra fields are rejected. Only
those three validated roles are resolved into local paths.

Validation failures use fixed diagnostic codes such as `TASK_FILES_INVALID`
and `TASK_INTERIOR_INVALID`; arbitrary child output, paths and credentials
remain excluded from operational reasons. Existing bounded remediation and
fresh authorization requirements still apply. A hash-valid input or successful
restoration is not rights clearance, template approval, independent QA or
publication permission. Host-configured reviewer identities are not supplied
by the descriptor.

Regression tests cover reserved filenames before input reads, malformed hashes,
interior shape/extra fields/traversal, valid interior restoration and cleanup,
and production rejection before Python execution. They do not establish live
platform or end-to-end acceptance.

## Current execution authority

The built-in stored-task resolver requires POD_GRANT_URL, a separate
POD_GRANT_AUTH_KEY and POD_UPSTREAM_KEY. It validates the existing HTTPS grant
client configuration and exposes authorityReady=false when missing or invalid.
The production runtime reports BLOCKED_GRANT_AUTHORITY before recovery or queue
claims in that case. Saved upstream_envelope remains intake evidence; it is
never a fallback execution approval, even if its signature has not expired.

Each execution check uses the current grant endpoint. Revocation, unavailable
authority, bad scope/signature and short lifetime block production. Configure
the real server-owned Money Factory authority before enabling the worker; do not
renew stored approvals or invent credentials. Custom host-supplied resolvers
remain trusted host integrations and must enforce the same current-authority
contract. The optional fetchImpl injection supports controlled transport tests;
it is not supplied by task descriptors or public requests.

The durable PostgreSQL/Python fixture uses a separate synthetic authority map,
fresh signed responses and an injected transport. It also revokes an approval
after enqueue and verifies no generated artifacts or readiness result. This is
revocation-contract testing, not live authority deployment or real approval.

## Local JSON evidence files

The shared Python JSON reader opens inputs nonblocking, rejects a final symlink,
and verifies the opened descriptor is a regular file before reading. Named pipes,
devices and directories are not supported evidence inputs. This prevents a FIFO
without a writer from hanging before the byte limit or evidence checks execute.
Provide an actual regular file at the selected path; never bypass these checks
to accept a stream as an approval.

The reader still captures at most 4 MiB plus one byte, rejects excess bytes,
requires strict UTF-8 and parses only the captured bytes. Descriptor ownership is
released on file-type rejection, wrapper failure, read failure and parse failure.
These checks do not replace path scoping, signature/expiry validation or the
production process deadline, and do not establish live approval or acceptance.


## Local binary inputs and hashing

Artwork/font snapshots, offline source HTML, reference images, QA snapshots and
file hashing use the shared regular-file opener. It opens nonblocking, refuses
a final symlink at the selected path, and checks the opened descriptor before
reading. FIFOs, devices and directories cannot supply production bytes. Callers
that deliberately resolve paths first retain their existing scoping rules; this
check is not a directory sandbox and does not prevent concurrent in-place writes.
Snapshot-based identity verification and decoding still consume the same bytes.

Hashing now reads at most 16 MiB plus one byte, matching the existing POD object
ceiling, and rejects excess bytes as DIGEST_TOO_LARGE. The bound applies to actual
reads even if a regular file grows after opening. Empty-file SHA-256 remains
supported by this identity helper; the existing image/font validators still
reject empty inputs. Existing per-source, snapshot and aggregate package limits
remain in place. Descriptor ownership is released on file-type, wrapper, read
and size failures. Large generated files are rejected before being recorded as
valid package objects; no truncation or automatic approval is performed.

Tests use temporary regular files, actual FIFOs without writers and fault-injected
reads to cover blocking, replacement, size limits and cleanup. These protections
supplement the production process deadline; they are not live capacity, rights,
independent-review or marketplace acceptance evidence.
