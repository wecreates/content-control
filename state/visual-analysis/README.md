# Visual analysis evidence

This package compares the actual 34.96-second V2 draft against the ten existing reference images. It records sampled frame indices and file hashes, side-by-side sheets, and every-frame motion measurements. Analysis completion is separate from artistic acceptance.

The automated CPU workflow is `.github/workflows/visual-analysis.yml`. It runs on relevant changes and hourly to pick up draft commits created by other workflows. Each run validates the exact current candidate and uploads its own reports and images. The checked-in package below is a historical snapshot; compare its candidate SHA-256 before reuse.

Verified hosted run: https://github.com/wecreates/content-control/actions/runs/38431786160

- [Comparison measurements](comparison.json)
- [Full-frame motion measurements](motion.json)
- [Real CPU semantic model comparison](semantic.json)
- [Independent sampled-frame visual review](frame-review.json)
- [Frames 1–4](comparison-evidence/comparison-01.jpg)
- [Frames 5–8](comparison-evidence/comparison-02.jpg)
- [Frames 9–10](comparison-evidence/comparison-03.jpg)

The comparator identifies real deficiencies: small/light typography, small characters, and sparse staging compared with the references. White backgrounds are intentional brand direction, not a parity failure. Existing reference images have no verified source-video extraction manifest; they cannot establish competitor motion or audio parity. New local-video references can be extracted with `scripts/reference_frame_manifest.py` with exact frame hashes and source attribution limitations.

No publication or production approval is granted by this package. Full audiovisual review remains separate.

Semantic comparison uses OpenCLIP embeddings plus Florence image descriptions, with fresh candidate frames derived directly from the hashed video. Models ran successfully on CPU. Their descriptions can contain mistakes; the independent visual review remains authoritative for the documented sampled-frame findings. The semantic workflow follows completed V2 builds and also runs daily.
