# KDP book-details consistency gate

KDP production requires a hash-bound `bookDetails` JSON file in the stored
task's `interior` object. The current Money Factory grant authorizes the exact
task descriptor hash, so changing these bytes requires a new immutable task and
fresh grant. The file has exactly these fields:

| Field | Supported value |
| --- | --- |
| `schema_version` | Integer `2` |
| `title` | Trimmed NFC printable metadata text; title plus subtitle is at most 200 characters |
| `subtitle` | `null` or metadata text within the shared 200-character title limit |
| `author_name` | Trimmed NFC printable metadata text, 1–200 characters |
| `language` | `en` for the currently supported `en_US`/LTR profile |
| `isbn` | `null` or a bounded exact display string |
| `imprint` | `null` or a bounded exact display string |
| `title_page` | Physical PDF page `1` or `3` |
| `edition` | `null` or exactly `{ "number": <integer 1–9999>, "display_text": <metadata text> }` |
| `series` | `null` or exactly `{ "title": <metadata text>, "display_text": <metadata text> }` |
| `contributors` | Ordered array of at most 9 additional unique `{ "role": <metadata text>, "name": <metadata text> }` records; together with `author_name`, the total is at most 10 |

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

The title, subtitle, author, edition, series and contributor fields reject HTML tags, punctuation-only values
and KDP's prohibited sentinel-only values such as `unknown`, `n/a`, `blank`,
`none`, `null` and `not applicable`. These checks are intentionally lexical:
they do not claim to determine trademark permission, contributor truthfulness,
promotional intent or substantive metadata quality.

Sources rechecked October 20, 2026:

- [Fix Paperback and Hardcover Formatting Issues](https://kdp.amazon.com/en_US/help/topic/G201834260)
- [Metadata Guidelines for Books](https://kdp.amazon.com/en_US/help/topic/G201097560)
- [Books Titles & Editions](https://kdp.amazon.com/en_US/help/topic/GW7J4WEKBVU25YEC)
- [Authors & Contributors](https://kdp.amazon.com/en_US/help/topic/G2BWJN2BY98T5PV2)
- [Create a Book](https://kdp.amazon.com/en_US/help/topic/G202172740)
- [Paperback and Hardcover Manuscript Templates](https://kdp.amazon.com/en_US/help/topic/G201834230)
- [Create a Paperback Cover](https://kdp.amazon.com/en_US/help/topic/G201953020)

Schema version 1 is deliberately not accepted after this fail-closed upgrade.
An existing task must be regenerated as version 2 and receive a fresh Money
Factory grant; the validator never silently assumes that omitted metadata is
empty.

This is a necessary consistency check for the task-owned values. It is not a
live KDP account readback and cannot prove what an operator entered during title
setup. It does not validate unsupported languages, ISBN ownership, imprint
rights, contributor truthfulness, substantive editorial quality, or
Amazon acceptance. Those require a separately implemented contract and actual
account/platform evidence. `PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED`
remain false.
