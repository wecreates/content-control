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
provide an object named `interior` containing **exactly** `template`, `pages`,
`font`, `fontRights`, `fontLicense` and `source`, each referencing a declared
filename. Omit `interior` when it does not apply; null, false, arrays, missing
roles and extra fields are rejected. Only those six validated roles are resolved
into local paths. `fontRights` is the current signed grant and `fontLicense` is
the retained evidence it hashes; see `FONT_RIGHTS.md`. `source` is the retained
official interior-template archive described in
[KDP_INTERIOR_TEMPLATE_SOURCE.md](KDP_INTERIOR_TEMPLATE_SOURCE.md).

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


## Unambiguous stored descriptor JSON

After the artifact store verifies the descriptor's byte hash, the resolver uses
strict UTF-8 decoding and the shared iterative JSON validator. Invalid byte
sequences, a leading UTF-8 BOM, duplicate decoded object keys at any depth
(including escaped spellings and identical repeated values), numeric overflow
and invalid JSON all fail as TASK_INVALID. No input artifact is fetched and no
workspace is created for these parse failures. Error details and source text are
not persisted in the production reason.

Valid Unicode strings, JSON escapes, finite numbers and repeated keys in separate
objects retain their meaning. The existing 256 KiB descriptor limit, role checks,
64 MiB restored-input budget, fresh grants and cleanup contract are unchanged.
This validates the interpretation of stored bytes; it does not approve the task,
verify rights or establish live production acceptance.


## Original artwork output collisions

The deterministic geometric generator encodes into a private 0600 temporary file
in the output directory, flushes and syncs it, and computes the bounded source
hash before exposing the output. An atomic hard link installs the completed file
without replacing an existing path, including a dangling symlink or a concurrent
writer's file. Collisions return OUTPUT_EXISTS. The early existence check is only
an optimization; it is not the overwrite safeguard.

Encoder, size/hash and file-sync failures clean the temporary file without
installing the output. A failure after linking, such as directory-sync failure,
can leave a complete output while the call fails and returns no receipt. Inspect
that output through the existing evidence process; do not overwrite it or claim
successful generation from the failed call. These filesystem operations require
hard-link support within the selected output directory. They are not a directory
sandbox, an independently retained backup or a physical power-loss test.

The artwork and receipt remain deterministic for the same specification, with
rights UNASSESSED and publication false. This change does not establish original
content clearance, quality, capacity, provider approval or live acceptance.


## Retained KDP cover source

KDP production now requires `templateSource`, a declared input filename in the
hash-bound task descriptor. The resolver restores it through ArtifactStore into
the same private workspace and removes it with the task. When present on any
descriptor, this role must reference a declared file; paths, null and coercible
values are rejected. Other marketplace tasks can omit it.

After authenticating the cover/interior envelopes and checking their pairing,
the worker opens this retained cover source nonblocking with final-symlink refusal,
requires a nonempty regular file and hashes at most 16 MiB plus one byte. It compares
the captured bytes with `source_sha256` from the authenticated cover envelope.
Missing, invalid, oversized or changed bytes block before any Python stage with
fixed TEMPLATE_SOURCE_* reasons. Cancellation closes the file and stops execution;
the existing fresh-grant and lease check still precedes generation.

Existing KDP tasks without this retained source now require a new reviewed,
hash-bound descriptor and matching current grant. Do not silently update queued
approvals or substitute the example reference. Custom host resolvers must provide
the same source path contract. This is identity verification, not a directory
sandbox or a content snapshot delivered to a renderer. Source bytes are retained
as task inputs; they are not used as finished cover artwork.

The offline KDP cover-guide and interior-template inspectors remain separate
profile/member validation tools. Interior source bytes are independently retained
and inspected as documented in
[KDP_INTERIOR_TEMPLATE_SOURCE.md](KDP_INTERIOR_TEMPLATE_SOURCE.md). These gates
do not verify download origin, create a provenance approval, map barcode regions,
establish CMYK output or prove preview/
print acceptance. The signer must still supply current attributable official
provenance for the actual product, region and profile. The retained reference and
synthetic signatures used by tests confer no production approval. Both publication
flags remain false.


## KDP archive profile admission

KDP production now also runs pod_kdp_template_import.py before artwork generation.
Its inline profile is derived from the authenticated paired cover/interior:
binding, ink, paper, trim and page count come from the interior; reading_direction
and locale come from signed cover.kdp fields. The supported guide format requires
explicit left_to_right and en_US values. This guide locale does not authorize a
country or establish regional rights. Other reading directions/locales need a
separately verified contract.

The worker retains the cover source-byte check, renews current authority/lease
before the cover inspection child, independently authenticates and inspects the
interior archive, and renews it again before artwork. The cover inspector re-reads
and hashes the bounded original ZIP, checks exact profile-derived member names,
bounded static PDF/PNG guide content and instructions. A guide for another page
count, paper or trim blocks even if its retained bytes match the signed hash.
The child uses the existing deadline, output cap, process-group cancellation and
fixed diagnostic vocabulary. Failure cannot reach artwork, book assembly or QA.

The CLI accepts exactly one of --profile FILE or --profile-json JSON. The inline
form is capped at 4096 UTF-8 bytes and rejects duplicate decoded keys and nonfinite
JSON constants before profile inspection. It has no approval side effect, output
file write, extraction or URL fetch. Its report remains source_authority_verified
false and production_template_approved false; success is a necessary technical
profile check, not a new provenance decision.

KDP descriptors whose signed cover lacks locale/direction or whose retained
source does not match the job need newly reviewed immutable inputs and a fresh
grant. Do not modify or renew queued approvals to bypass admission. The example
archive is still never selected automatically. Download-origin authority, barcode-region mapping, final CMYK handling, calibrated
independent review and actual preview/print acceptance remain open. Final-cover
strict geometry is unchanged by the guide's separate whole-point policy.
