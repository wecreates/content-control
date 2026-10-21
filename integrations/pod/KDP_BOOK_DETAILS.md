# KDP book-details consistency gate

KDP production requires a hash-bound `bookDetails` JSON file in the stored
task's `interior` object. The current Money Factory grant authorizes the exact
task descriptor hash, so changing these bytes requires a new immutable task and
fresh grant. The file has exactly these fields:

| Field | Supported value |
| --- | --- |
| `schema_version` | Integer `1` |
| `title` | Trimmed NFC printable string, 1–200 characters |
| `subtitle` | `null` or the same bounded string |
| `author_name` | Trimmed NFC printable string, 1–200 characters |
| `language` | `en` for the currently supported `en_US`/LTR profile |
| `isbn` | `null` or a bounded exact display string |
| `imprint` | `null` or a bounded exact display string |
| `title_page` | Physical PDF page `1` or `3` |

Independent QA requires title, optional subtitle and author as exactly one
separate front-cover text layer each, at least 0.125 inch inside the front trim.
The selected right-facing title page must contain exactly those lines in that
order. A supplied ISBN or imprint must appear exactly once in the first eight
manuscript pages. The actual PDF still has to match the original manuscript
line-for-line under the existing manuscript gate.

Known KDP template placeholder phrases are rejected across cover text and the
entire original manuscript. No placeholder is automatically deleted, no title
or author is inferred, and no metadata is rewritten. A correction therefore
needs revised source files, a new descriptor hash, current authority, and fresh
review of the new package.

Sources rechecked October 20, 2026:

- [Fix Paperback and Hardcover Formatting Issues](https://kdp.amazon.com/en_US/help/topic/G201834260)
- [Metadata Guidelines for Books](https://kdp.amazon.com/en_US/help/topic/G201097560)
- [Paperback and Hardcover Manuscript Templates](https://kdp.amazon.com/en_US/help/topic/G201834230)
- [Create a Paperback Cover](https://kdp.amazon.com/en_US/help/topic/G201953020)

This is a necessary consistency check for the task-owned values. It is not a
live KDP account readback and cannot prove what an operator entered during title
setup. It does not validate unsupported languages, series/contributor/edition
metadata, ISBN ownership, imprint rights, substantive editorial quality, or
Amazon acceptance. Those require a separately implemented contract and actual
account/platform evidence. `PUBLICATION_ENABLED` and `POD_PUBLICATION_ENABLED`
remain false.
