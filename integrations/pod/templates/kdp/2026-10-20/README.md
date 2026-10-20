# Retained official KDP calculator reference

This is an actual guide archive downloaded from the public
[KDP calculator](https://kdp.amazon.com/cover-calculator) on October 20, 2026,
using paperback, black ink, white paper, left-to-right, 6 by 9 inches and 24
pages. The predefined 6x9 selection left Calculate disabled in this browser;
the normal Custom trim size controls with width 6 and height 9 enabled it.
No login, challenge solving, hidden endpoint, fingerprint or network change was
used. The archive was captured after the visible Download Template action.

[Calculator observation](calculator.jpg) records the selected public form.
[acquisition.json](acquisition.json) records that observation, the source URL and
byte identity. These are attributable acquisition facts, not a signed template
or a platform/editorial/rights approval. This reference profile is not an actual
owner-approved book project. The en_US filename is a guide locale, not proof of
regional publication rights or availability.

The original archive is retained unchanged as
[paperback-6x9-24-bw-white-en_US.zip](paperback-6x9-24-bw-white-en_US.zip).
It contains one PDF, one PNG and readme.txt; their hashes and sizes are recorded
in [inspection.json](inspection.json). The PNG is 7383 by 5550 pixels at about
600 DPI. The guide PDF uses whole-point dimensions, 886 by 666 points; its text
reports rounded 12.304 by 9.250 inches and a 0.054-inch spine. Calculated profile
dimensions are 12.304048 by 9.25 inches and spine 0.054048 inch. This guide
quantization does not relax the final production PDF/pixel-equivalence policy.

Reproduce the offline inspection from the repository root:

~~~sh
python scripts/pod_kdp_template_import.py \
  --archive integrations/pod/templates/kdp/2026-10-20/paperback-6x9-24-bw-white-en_US.zip \
  --profile integrations/pod/templates/kdp/2026-10-20/profile.json \
  --expected-sha256 27915e7cfe7b7eb14b17044e996a8152440836f26e562130ea85a7b61a9ab6ac
~~~

The inspector captures at most 16 MiB from a nonblocking regular file, verifies
the expected SHA-256, and accepts exactly the three flat profile-derived names.
It rejects duplicate/extra/path/link/encrypted/unsupported-compression entries.
Members are capped at 16 MiB each and 32 MiB total before bounded reads; nothing
is extracted or executed. It checks static one-page PDF geometry/profile labels,
PNG dimensions/DPI/header CRCs and nonempty UTF-8 instructions. It does not
render or grade the PNG, parse every guide region, establish source authenticity
from a caller-supplied hash, or approve a production template. PDF checks occur
after parsing and are not a general decompression/malware sandbox. Unsupported
calculator formats/layouts require a separate reviewed contract.

Keep the guide separate from final artwork. It contains instructional text,
guide lines and barcode placement information; it must not be submitted as a
finished cover. No output is signed and both source_authority_verified and
production_template_approved remain false in the inspection report. A real job
still needs retained matching source bytes, authenticated current template
authority, rights/editorial/independent QA, actual preview and print verification.
The worker does not automatically select this reference or treat it as approval.
All 24 live acceptance areas remain open; publication flags stay false.
