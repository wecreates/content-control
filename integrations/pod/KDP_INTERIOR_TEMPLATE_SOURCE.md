# Retained KDP interior template source

KDP tasks retain a separate immutable `interior.source` archive. Its SHA-256 and
selected DOCX member are authenticated by the current `pod:interior-template`
envelope. The worker checks those bytes before generation; independent QA captures
and checks them again.

The offline inspector accepts one bounded regular ZIP and one exact safe `.docx`
member path. Both ZIP layers reject duplicate, encrypted, non-regular, traversing,
unsupported-compression and oversized entries. The DOCX must contain bounded Word
document/settings XML, exactly one section, the signed trim size, mirrored margins,
zero separate gutter and minimum no-bleed margins. Reports include both hashes and
the parsed trim/margins.

The official KDP blank-template page and public ZIP were inspected on 2026-10-20.
The English archive contained separate DOCX files per trim size; its 6 x 9-inch
blank template declared a 6 x 9 page, mirror margins, a 0.75-inch left/inside
margin, 0.5-inch other margins and zero separate gutter. Those observed bytes
informed the parser but are not committed as production approval or silently
substituted for task evidence.

The signed URL, `official_source_verified` flag and hash remain claims of the
configured evidence signer. Parsing proves identity and selected layout facts,
not download origin, signer authority, current regional availability, manuscript
quality, placeholder removal, title metadata, print/preview acceptance or
permission to publish. Tests use synthetic archives and signatures. Publication
and production remain disabled until the full acceptance checklist passes.
