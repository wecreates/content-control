# November 10, 2026 — reject ambiguous market JSON-LD

Starting heads: Content Control `3fd2a4a27b3fc38a4d4ec38660641d4590917941`,
Money Factory `d2c8a6d3c024792b9185e3e9898eabd1385ab196`. The recent POD
gates passed and no overlapping PR was open. Render was live on that Content
Control revision, previously verified with both publication flags false.

Signed offline snapshot fixtures reproduced three defects: a duplicate
decoded price key was silently overwritten, a malformed offer aborted the
whole import, and non-text metadata could not be serialized. The parser now
ignores ambiguous JSON-LD blocks, retains valid siblings, and projects only
serializable observations. Valid decimal prices keep exact precision; an
invalid optional offer or field stays unknown. The result still binds the
same exact source bytes and preserves the existing authorization checks.

The three regressions failed before repair; all four focused Python tests
passed afterward, including the existing decimal regression. Local tests
used the fixtures' mocked vision path because OpenCV was unavailable locally.
The hosted integration and image gates exercise the real dependencies.

No marketplace was contacted, no scope or network access was widened, and
no collection authorization, rights clearance, market rank, profit or
publication approval is inferred. The live database access path did not
change and was not retried. All 24 live acceptance areas remain open.
