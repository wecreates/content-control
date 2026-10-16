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
