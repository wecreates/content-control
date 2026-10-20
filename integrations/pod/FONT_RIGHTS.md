# KDP interior font-rights evidence

KDP QA requires two additional immutable stored-task inputs beside the original
font: `fontRights` and `fontLicense`. The resolver restores both as regular task
artifacts and the worker passes them only to the independent KDP QA stage. Other
platform contracts are unchanged.

`fontLicense` is the retained source evidence reviewed by the rights authority.
It must be a nonempty regular non-symlink file of at most 16 MiB. QA reads one
bounded snapshot and hashes the exact bytes; FIFOs, devices, directories, links,
empty files, growth beyond the limit and changed bytes fail closed.

`fontRights` is a strict signed JSON envelope using `POD_RIGHTS_KEY`, audience
`pod:font-rights`, schema version 1 and the shared maximum 15-minute lifetime.
Its payload must contain:

- `status: "PASS"`, `revoked: false`;
- lowercase `font_sha256` matching the authenticated original TTF;
- lowercase `license_sha256` matching the retained evidence snapshot;
- exact `country` and `product` matching the signed task/template scope;
- `commercial_use`, `print_on_demand` and `font_embedding` all `true`;
- nonempty trimmed `license_id` and `licensor` strings, each at most 256 characters.

QA records `checks.font_rights`, `font_license_sha256` and `font_license_id` and
caps its receipt lifetime at the font-rights expiry. It revalidates the signed
grant after the slower QA work, so an expired grant cannot become a PASS receipt.
Missing, malformed, expired, wrongly scoped, revoked or permission-incomplete
evidence blocks KDP readiness. Existing stored KDP tasks need a newly reviewed
hash-bound descriptor and current grant; never rewrite or silently renew them.

This gate establishes that current signed permission references the exact font,
retained license bytes, country and product presented to QA. It does not determine
whether the document is genuine, whether the signer has legal authority, whether
the license terms are legally sufficient, or whether Amazon accepts the font or
book. Those remain owner-authorized rights, legal-review and live-platform
acceptance obligations. Synthetic fixtures are not clearance. Publication stays
disabled.
