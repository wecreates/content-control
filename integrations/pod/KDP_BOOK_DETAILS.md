# KDP book-details consistency gate

KDP production requires a hash-bound `bookDetails` JSON file in the stored
task's `interior` object. The current Money Factory grant authorizes the exact
task descriptor hash, so changing these bytes requires a new immutable task and
fresh grant. The file has exactly these fields:

| Field | Supported value |
| --- | --- |
| `schema_version` | Integer `5` |
| `title` | Trimmed NFC printable metadata text; title plus subtitle is at most 200 characters |
| `subtitle` | `null` or metadata text within the shared 200-character title limit |
| `author_name` | Trimmed NFC printable metadata text, 1–200 characters |
| `language` | `en` for the currently supported `en_US`/LTR profile |
| `description` | Plain NFC printable customer-facing text, 1–4,000 characters; HTML, web URLs and email addresses are rejected by this bounded contract |
| `keywords` | Ordered array of at most 7 unique NFC metadata phrases; empty is supported because KDP keywords are optional |
| `primary_marketplace` | `amazon.com` for the currently supported `en_US` lane |
| `categories` | Ordered array of 1–3 unique category-path strings |
| `publishing_rights` | `copyright_owner`; public-domain publishing needs a separate unsupported evidence path |
| `isbn` | `null` or an exact display string containing a checksum-valid 13-digit ISBN beginning with 978 or 979; optional uppercase `ISBN`/`ISBN-13` label and spaces/hyphens are supported |
| `imprint` | `null` or metadata text of at most 100 characters |
| `title_page` | Physical PDF page `1` or `3` |
| `edition` | `null` or exactly `{ "number": <integer 1–9999>, "display_text": <metadata text containing that decimal number> }` |
| `series` | `null` or exactly `{ "title": <metadata text>, "number": <null or integer 1–9999>, "display_text": <metadata text containing the exact title and, when supplied, decimal number> }` |
| `contributors` | Ordered array of at most 9 additional unique `{ "role": <metadata text>, "name": <metadata text> }` records; together with `author_name`, the total is at most 10 |
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

A supplied ISBN is syntax- and checksum-validated before exact manuscript
comparison. This does not prove ISBN ownership, format uniqueness, agency
registration, or that title/author/imprint match the agency record; those remain
live account and rights checks.

The description, keyword and category values are immutable task-owned inputs. The
validator enforces the current field counts, the 4,000-character description
ceiling, plain-text hygiene, unique entries, the supported primary marketplace
and the copyright-owner path. It does not decide whether marketing copy is
effective, whether keywords or categories are substantively relevant, whether
copyright is actually owned, or whether the same selections were entered in KDP.
Those require independent review, current rights evidence and live account
readback.

KDP requires publishers to disclose AI-generated text, images and translations,
including AI-generated cover or interior artwork. The three disclosure booleans
are therefore mandatory and part of the canonical task-owned book-details hash.
They record the authorized job's declared answers; they do not determine whether
the declaration is truthful, classify AI-assisted work, or prove that the same
answers were entered into KDP. Generation provenance, independent review and live
account readback remain separate acceptance evidence.

Sources rechecked October 20, 2026:

- [Fix Paperback and Hardcover Formatting Issues](https://kdp.amazon.com/en_US/help/topic/G201834260)
- [Metadata Guidelines for Books](https://kdp.amazon.com/en_US/help/topic/G201097560)
- [Write a Book Description](https://kdp.amazon.com/en_US/help/topic/G201189630)
- [Make Your Book More Discoverable with Keywords](https://kdp.amazon.com/en_US/help/topic/G201298500)
- [KDP Categories](https://kdp.amazon.com/en_US/help/topic/G200652170)
- [Books Titles & Editions](https://kdp.amazon.com/en_US/help/topic/GW7J4WEKBVU25YEC)
- [Authors & Contributors](https://kdp.amazon.com/en_US/help/topic/G2BWJN2BY98T5PV2)
- [Create a Book](https://kdp.amazon.com/en_US/help/topic/G202172740)
- [Content Guidelines: Artificial intelligence content](https://kdp.amazon.com/en_US/help/topic/G200672390)
- [Paperback and Hardcover Manuscript Templates](https://kdp.amazon.com/en_US/help/topic/G201834230)
- [Create a Paperback Cover](https://kdp.amazon.com/en_US/help/topic/G201953020)

Schema versions 1 through 4 are deliberately not accepted after this fail-closed
upgrade. An existing task must be regenerated as version 4 and receive a fresh Money
Factory grant; the validator never silently assumes that omitted metadata is
empty.

This is a necessary consistency check for the task-owned values. It is not a
live KDP account readback and cannot prove what an operator entered during title
setup. It does not validate unsupported languages, ISBN ownership, imprint
rights, contributor truthfulness, substantive editorial quality, or
Amazon acceptance. Those require a separately implemented contract and actual
account/platform evidence. `PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED`
remain false.
