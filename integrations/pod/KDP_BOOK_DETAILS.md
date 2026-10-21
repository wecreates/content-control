# KDP book-details consistency gate

KDP production requires a hash-bound `bookDetails` JSON file in the stored
task's `interior` object. The current Money Factory grant authorizes the exact
task descriptor hash, so changing these bytes requires a new immutable task and
fresh grant. The file has exactly these fields:

| Field | Supported value |
| --- | --- |
| `schema_version` | Integer `13` |
| `title` | Trimmed NFC printable metadata text; title plus subtitle is at most 200 characters |
| `subtitle` | `null` or metadata text within the shared 200-character title limit |
| `author_name` | Trimmed NFC printable metadata text, 1–200 characters |
| `language` | `en` for the currently supported `en_US`/LTR profile |
| `description` | Plain NFC printable customer-facing text, 1–4,000 characters; HTML, web URLs and email addresses are rejected by this bounded contract |
| `keywords` | Ordered array of at most 7 unique NFC metadata phrases; empty is supported because KDP keywords are optional |
| `primary_marketplace` | `amazon.com` for the currently supported `en_US` lane |
| `list_price` | Exactly `{ "marketplace": "amazon.com", "currency": "USD", "amount_minor": <integer 1–25000> }`; the amount is the task-owned tax-exclusive Amazon.com paperback list price in cents |
| `categories` | Ordered array of 1–3 unique category-path strings |
| `primary_audience` | Exactly `{ "sexually_explicit": <boolean>, "reading_age": <null or { "minimum": <integer>, "maximum": <integer> }> }`; a non-null age range must be one official band: 0–2, 3–5, 6–8, 9–12, or 13–17 |
| `low_content` | Exact boolean `false`; this supported lane requires a substantive book interior and does not admit KDP low-content classification |
| `publishing_rights` | `copyright_owner`; public-domain publishing needs a separate unsupported evidence path |
| `distribution_rights` | Exactly `{ "scope": "individual", "territories": ["US"] }`; the bounded lane selects only the United States and does not accept a worldwide-rights assertion |
| `publication_date` | Exact `null`; the supported original-book lane intentionally leaves KDP’s previously-published date blank |
| `release_plan` | Exactly `{ "mode": "release_now", "date": null }`; scheduled print releases remain unsupported and the choice does not authorize publication |
| `expanded_distribution` | Exact boolean `false`; the bounded lane does not enroll a paperback in non-Amazon distribution without separate current territorial-rights, ISBN-eligibility, and economics evidence |
| `isbn_source` | Exact lowercase `kdp_free` or `owned`; this immutable task choice controls the required ISBN/imprint pairing |
| `isbn` | Exactly `null` for `kdp_free`, or an exact display string containing a checksum-valid 13-digit ISBN beginning with 978 or 979 for `owned`; optional uppercase `ISBN`/`ISBN-13` label and spaces/hyphens are supported |
| `imprint` | Exactly `null` for `kdp_free`, or metadata text of at most 100 characters for `owned` |
| `title_page` | Physical PDF page `1` or `3` |
| `edition` | `null` or exactly `{ "number": <integer 1–9999>, "display_text": <metadata text containing that decimal number> }` |
| `series` | `null` or exactly `{ "title": <metadata text>, "number": <null or integer 1–9999>, "display_text": <metadata text containing the exact title and, when supplied, decimal number> }` |
| `contributors` | Ordered array of at most 9 additional unique `{ "role": <metadata text>, "name": <metadata text> }` records; together with `author_name`, the total is at most 10 |
| `cover_finish` | Exact lowercase `matte` or `glossy`; the selected KDP paperback cover-finish option is immutable task-owned metadata |
| `ai_generated` | Exactly `{ "text": <boolean>, "images": <boolean>, "translations": <boolean> }`; each boolean declares whether that content category contains AI-generated material under KDP's current definition |

Independent QA requires title, optional subtitle and author as exactly one
separate front-cover text layer each, at least 0.125 inch inside the front trim.
The selected right-facing title page must contain exactly those lines in that
order. A supplied ISBN or imprint must appear exactly once in the first eight
manuscript pages. A supplied edition display, series display, and every
additional contributor name must likewise occur exactly once in those pages.
The edition number, series title, ordered contributor roles/names, and their
task-owned display text are included in the canonical book-details hash. The
actual PDF still has to match the original manuscript line-for-line under the
existing manuscript gate.

Known KDP template placeholder phrases are rejected across cover text and the
entire original manuscript. No placeholder is automatically deleted, no title
or author is inferred, and no metadata is rewritten. A correction therefore
needs revised source files, a new descriptor hash, current authority, and fresh
review of the new package.

The title, subtitle, author, imprint, edition, series and contributor fields reject HTML tags, punctuation-only values
and KDP's prohibited sentinel-only values such as `unknown`, `n/a`, `blank`,
`none`, `null` and `not applicable`. These checks are intentionally lexical:
they do not claim to determine trademark permission, contributor truthfulness,
promotional intent or substantive metadata quality.

`isbn_source: kdp_free` requires both ISBN and imprint to be null because KDP
assigns the number and displays the imprint as “Independently published.”
`isbn_source: owned` requires both a checksum-valid ISBN and a nonempty imprint;
those supplied strings must appear exactly once in the retained front matter.
This pairing prevents a null ISBN from silently standing for an undecided setup
choice. It does not prove ISBN ownership, format uniqueness, agency registration,
or that title/author/imprint match the agency record; those remain live account
and rights checks.

The exact primary-marketplace list price is part of the canonical book-details
hash and the signed QA receipt. Immediately before any KDP adapter call, Content
Control requires its marketplace, currency and minor-unit amount to equal Money
Factory's current verified grant price, and the existing economics gate then
requires that same price to match the package-scoped receipts and cost evidence.
The static gate enforces Amazon.com's current positive 250 USD maximum but does
not guess the variable minimum price, royalty rate, printing cost, tax, currency
conversion or margin. Those remain current provider/business evidence owned by
Money Factory, plus live KDP Rights & Pricing readback.

The description, keyword, category, primary-audience and cover-finish values are immutable task-owned inputs. The
validator enforces the current field counts, the 4,000-character description
ceiling, plain-text hygiene, unique entries, the supported primary marketplace,
the copyright-owner path, and the supported matte/glossy cover-finish enum. It does not decide whether marketing copy is
effective, whether keywords or categories are substantively relevant, whether
copyright is actually owned, or whether the same selections were entered in KDP.
Those require independent review, current rights evidence and live account
readback.

The signed cover and interior templates are separate authorities, so package
assembly also requires their binding, ink type and paper type to match exactly
before rendering the interior. Page count and trim geometry remain bound as
before. This prevents an individually valid cream-paper, color, or hardcover
interior specification from being paired with a cover generated for a different
print product. It does not prove that the same options were selected in KDP or
that a physical proof is acceptable.

Cover finish does not change the generated PDF geometry, so it is bound in the canonical
book-details record rather than inferred from the cover file. A valid value proves only
which option the authorized task owns; live KDP readback is still required to prove that
an operator selected the same option during title setup.

KDP requires an explicit Yes/No answer for sexually explicit images or title. Reading
age is optional, but this bounded profile accepts only KDP's published age bands. These
answers are part of the canonical task-owned hash so they cannot be changed at submission
without a new task and authority grant. The validator does not classify the cover,
interior, title, audience, or category suitability; independent review and live account
readback remain required.

KDP treats low-content books differently for ISBN, series, release-date and expanded-
distribution eligibility. The current production contract is for substantive text books,
so `low_content` must be exactly `false` and is part of the canonical task-owned hash.
The validator does not infer this classification from repetitive page layout; substantive
editorial review and live KDP readback remain separate requirements.

The supported lane is a first publication, so `publication_date` must be null rather
than an invented prior date. Its release plan is fixed to `release_now` with no date;
that means availability only after KDP review if and when a separately authorized
operator submits the book. Scheduled releases are deliberately unsupported because
they create a five-day file/detail lock and deadline risk. These fields are package
metadata only: they do not bypass either publication flag or explicit launch approval.

KDP requires a worldwide or individual-territory rights choice during print title
setup. Because verified worldwide territorial evidence is absent, this bounded
lane does not accept the worldwide option: `distribution_rights` must select the
individual United States territory only. The exact object is part of the
canonical book-details hash. It records the authorized task's intended UI
selection and limits its scope; it is not legal clearance, does not prove U.S.
rights, and does not replace the current concept-rights gate or live KDP readback.
Other countries and worldwide scope require a later evidence-backed contract.

A KDP package also requires current signed `pod:package-rights` evidence with
an exact `regional_rights` object. It binds the United States territory,
paperback format, `copyright_owner` publishing basis, the exact selected
categories, commercial print-on-demand permission, original-work and verified-
rights-holder assertions, non-revocation, a stable authority event, one or more
retained source-evidence identities, and the retained evidence SHA-256.
Independent QA copies these identities and scopes into its signed receipt, and
the publication policy rejects legacy KDP QA without the dedicated
`regional_rights` check. Missing, expired, revoked, differently scoped,
duplicate-evidence, malformed, or extra-key records fail closed. This contract
does not create or validate the underlying legal document: live acceptance still
requires genuine owner-authorized evidence and, if KDP requests it, the actual
documentation KDP accepts. A copyright page alone is not treated as proof.

Expanded Distribution is optional and may expose a paperback through bookstores,
libraries, academic institutions, and other retailers outside Amazon. It has separate
US/UK territorial-rights requirements, ISBN and format eligibility, a 40% royalty
basis before printing costs, and changes can take up to eight weeks to propagate.
This bounded contract therefore requires `expanded_distribution: false`. Enabling it
requires a future schema, immutable task authorization, verified regional rights,
current live pricing and royalty evidence, and live KDP readback. The false value does
not decide standard Amazon marketplace territories and does not prove any rights.

KDP requires publishers to disclose AI-generated text, images and translations,
including AI-generated cover or interior artwork. The three disclosure booleans
are therefore mandatory and part of the canonical task-owned book-details hash.
They record the authorized job's declared answers; they do not determine whether
the declaration is truthful, classify AI-assisted work, or prove that the same
answers were entered into KDP. Generation provenance, independent review and live
account readback remain separate acceptance evidence.

Sources rechecked October 21, 2026:

- [Fix Paperback and Hardcover Formatting Issues](https://kdp.amazon.com/en_US/help/topic/G201834260)
- [Metadata Guidelines for Books](https://kdp.amazon.com/en_US/help/topic/G201097560)
- [Title Setup: Book Details, Content, & Pricing](https://kdp.amazon.com/en_US/help/topic/G73MVSZ5P69VVCN6)
- [Release Date Options](https://kdp.amazon.com/en_US/help/topic/GZUV7SNV728WT4QE)
- [Schedule a Release](https://kdp.amazon.com/en_US/help/topic/GDTMGBCWHAY35NK4)
- [What is an ISBN and Imprint?](https://kdp.amazon.com/en_US/help/topic/G201834170)
- [Get an ISBN](https://kdp.amazon.com/en_US/help/topic/GTJ8LBXL6Z4WV5QX)
- [Expanded Distribution](https://kdp.amazon.com/en_US/help/topic/GQTT4W3T5AYK7L45)
- [Paperback and Hardcover Distribution Rights](https://kdp.amazon.com/en_US/help/topic/G201834280)
- [Intellectual Property Rights Frequently Asked Questions](https://kdp.amazon.com/en_US/help/topic/G200672400)
- [Paperback Royalty](https://kdp.amazon.com/en_US/help/topic/G201834330)
- [Primary Audience and Reading Age](https://kdp.amazon.com/en_US/help/topic/G201506310)
- [Low-Content Books](https://kdp.amazon.com/en_US/help/topic/GGE5T76TWKA85DJM)
- [Write a Book Description](https://kdp.amazon.com/en_US/help/topic/G201189630)
- [Make Your Book More Discoverable with Keywords](https://kdp.amazon.com/en_US/help/topic/G201298500)
- [KDP Categories](https://kdp.amazon.com/en_US/help/topic/G200652170)
- [Books Titles & Editions](https://kdp.amazon.com/en_US/help/topic/GW7J4WEKBVU25YEC)
- [Authors & Contributors](https://kdp.amazon.com/en_US/help/topic/G2BWJN2BY98T5PV2)
- [Create a Book](https://kdp.amazon.com/en_US/help/topic/G202172740)
- [Content Guidelines: Artificial intelligence content](https://kdp.amazon.com/en_US/help/topic/G200672390)
- [Paperback and Hardcover Manuscript Templates](https://kdp.amazon.com/en_US/help/topic/G201834230)
- [Create a Paperback Cover](https://kdp.amazon.com/en_US/help/topic/G201953020)
- [Print Options](https://kdp.amazon.com/en_US/help/topic/G201834180)

Schema versions 1 through 12 are deliberately not accepted after this fail-closed
upgrade. An existing task must be regenerated as version 13 and receive a fresh Money
Factory grant; the validator never silently assumes that omitted metadata is
empty.

This is a necessary consistency check for the task-owned values. It is not a
live KDP account readback and cannot prove what an operator entered during title
setup. It does not validate unsupported languages, ISBN ownership, imprint
rights, contributor truthfulness, substantive editorial quality, or
Amazon acceptance. Those require a separately implemented contract and actual
account/platform evidence. `PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED`
remain false.
