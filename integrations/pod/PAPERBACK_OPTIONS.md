# Independent KDP paperback option admission

KDP's [Paperback Submission Guidelines](https://kdp.amazon.com/en_US/help/topic/G201857950)
were retrieved on October 20, 2026. Independent package QA now checks the
supported black-ink paper/trim/page combinations in the separately published
US and JP tables, in addition to existing PDF, margin, pairing and font checks.
The versioned Python table is separate from Node production admission. Tests
compare both implementations over all 28 reviewed rows and their boundaries.
This necessary technical table does not establish current account availability,
regional rights, licensing, genuine source authority or preview/print acceptance.

For KDP, pod_vision_qa.py requires an explicit `--country US` or `--country JP`
from the authorized host. The production worker supplies the country from the
hash-bound descriptor whose signed cover/interior scope was authenticated before
production. The Python evaluate API accepts the same input as `target_country`.
There is no default. The guide's en_US locale and producer-controlled package,
cover or interior country fields cannot select this target. Manual review hosts
must obtain it from the original authorized task, rather than infer it from a
package or choose a table that happens to accept the book. Standalone KDP QA
without this argument now fails closed; other marketplaces retain their contract.

Unlisted regions/trims, color ink, unknown paper or malformed dimensions fail
KDP_PRINT_OPTIONS_UNSUPPORTED. Counts outside the selected paper/trim's range,
including malformed numeric types, fail KDP_PRINT_PAGE_LIMIT. This check runs
before PDF preflight; a passing assembly receipt or rebound package hash cannot
lower the page ceiling. Successful KDP QA records target_country in its signed
report. Existing package-bound rights, independent comparative/editorial review,
current authority and explicit publication safeguards still apply. No approval
is created, input is resized, paper is substituted or page is inserted.

Scope remains the existing text-only, no-bleed paperback subset. Independent
QA does not reauthenticate the retained official calculator archive or prove
the host's target is the one authorized by the owner; the production host must
preserve the immutable task/current-grant contract. Other regions, custom trims,
color, hardcover, barcode geometry and CMYK output require separately verified
contracts. Both publication flags remain false, and live acceptance remains open.
