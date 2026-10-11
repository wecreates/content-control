# Awesome Opus 5.5 videos — optional reference-library adapter

Upstream: https://github.com/yihui-dev/awesome-opus5-5-videos
Source type: curated examples, prompts, and links, **not an installable video generator**.
Integration status: catalog specification committed; ingestion/rendering not wired or tested.

## Intended integration
Read `data/videos.json` and the linked `prompts/*.md` files from a pinned upstream revision. Record each item's creator, source URL, technique, prompt path, dependencies, and license/rights status. Never execute downloaded code or remote scripts during catalog ingestion.

Prioritize:
- Motion graphics, SVG/Canvas/GSAP
- Explainer animation and picture-story transitions
- Mobile-safe text motion, camera movements, and visual continuity
- Three.js only when it materially improves a scene

## Mapping into Content Control
Existing reference-DNA and capability queue remain authoritative.
`source example -> extracted general animation grammar -> original CYZOR storyboard -> Remotion implementation -> preview -> visual/audio QA`.

For each proposed animation:
- Retain original CYZOR characters, branding, and narration.
- Use original scene layouts, artwork, and code.
- Avoid copying unlicensed creator assets or source prompts verbatim into published work.
- Verify attribution and reuse rights per entry; public availability is not blanket permission.
- Preserve the Money Factory content-readiness ceiling and disabled-by-default publishing.
- Keep costs at zero unless approved. Use existing renderer and open-source libraries where licensed.

## Acceptance checks
- [ ] Pin and inspect upstream revision and per-item rights
- [ ] Parse catalog into deduplicated records
- [ ] Build and test importer against existing project contracts
- [ ] Select 3 explainers and 3 motion references for proof-of-concept
- [ ] Produce a real Remotion test render with audio
- [ ] Check layout overlap, scene continuity, mobile readability, character consistency, and licensing
- [ ] Confirm no regression to existing production pipeline

This file does not claim a production installation.
