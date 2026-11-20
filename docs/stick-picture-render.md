# Unpublished stick-picture cut

This path reuses the existing React/SVG artwork, original narration, music and sound effects. It creates twelve still pictures aligned to the observed narration, with a reserved caption area. It works without launching Chromium. It does not replace the animated Remotion renderer or promote any production/creative acceptance record.

Prerequisites: Node 22+, `npm ci --ignore-scripts`, FFmpeg/ffprobe with libass and libx264, Python 3.12+, and Cairo (`libcairo2` on Debian/Ubuntu). Install `requirements-picture-render.txt` into a virtual environment.

```sh
python -m venv .venv-picture
.venv-picture/bin/pip install -r requirements-picture-render.txt
PICTURE_PYTHON=.venv-picture/bin/python node scripts/render_episode1_pictures.mjs /absolute/new-picture.mp4 /absolute/verified-captions.vtt
```

Use current source-bound verified captions, not a historical VTT. The optional caption argument is burned in; the picture renderer checks VTT format but does not independently grant caption acceptance. It records the caption hash for the existing provenance verifier.

The renderer refuses changed narration, existing output files, and incomplete video/audio streams. It emits an MP4 and a hash receipt with `publication_enabled:false` and `production_approved:false`. The output is 30 seconds, 720×1280, 24fps, H.264/AAC, 48kHz stereo and faststart. Twelve scene cuts use ceil-to-frame observed speech timing. The two editorial inserts (Again/Wallet) fill existing speech or breathing space without changing the script.

Run existing technical checks against the new path, with separate outputs:

```sh
node --test tests/episode1-picture-timeline.test.mjs
python scripts/free_mobile_compat_qa.py --video /absolute/new-picture.mp4 --output /absolute/mobile-qa.json
python scripts/free_audio_qa.py --video /absolute/new-picture.mp4 --output /absolute/audio-qa.json
```

Technical PASS does not certify voice naturalness, creative quality, reference parity, or publishing approval. Do not overwrite canonical candidate receipts with this preview's diagnostics.
