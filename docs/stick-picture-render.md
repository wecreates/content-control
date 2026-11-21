# Unpublished stick-picture cut

This path reuses the existing React/SVG artwork, original narration, music and sound effects. It creates eighteen still pictures aligned to the observed narration, with a reserved caption area. It works without launching Chromium. It does not replace the animated Remotion renderer or promote any production/creative acceptance record.

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

## One bounded production command

`produce_episode1_review.py` connects the existing components without changing the approved inputs or canonical candidate. It reuses the existing narration instead of generating a new voice. Install the pinned `requirements-transcription.txt` into a Python environment and cache the `base.en` faster-whisper model once before running. The command uses CPU inference and offline model loading; a missing cache blocks the run. No paid provider or publishing credentials are needed.

```sh
python scripts/produce_episode1_review.py \
  --output /absolute/new-review-run \
  --python /absolute/transcription-env/bin/python \
  --picture-python /absolute/picture-env/bin/python \
  --timeout 900
```

Use a new output directory with a simple filename (letters, digits, underscores, dashes, slashes and periods). Existing outputs are rejected. Node dependencies must already be installed in the repository; FFmpeg/ffprobe must be on PATH. Separate Python environments are supported; both arguments can point to one environment containing both pinned requirements sets.

The command checks source timing and retention, independently transcribes the existing narration, builds captions from the current observed speech, renders the pictures and burned captions, decodes the complete video/audio streams, runs mobile and technical audio checks, independently transcribes the encoded MP4, and requires exact approved spoken words in those bytes. Final receipt binding rejects changed sources, captions, candidate bytes, or encoded-transcription evidence. Package lock and source hashes record the input identity; they are not an audit of installed dependency bytes.

Successful output is `video.mp4`, `captions.vtt`, individual receipts/logs, `REVIEW.md`, and `run.json` with `status: AWAITING_REVIEW`. `technical_status: PASS` covers the listed checks only. It does not establish that captions are visually unobstructed, every visual cut matches the spoken action, the voice sounds natural, or competitor/creative review passed. `full_av_review`, `production_approved` and `publication_enabled` remain false.

One wall-clock deadline bounds subprocesses. Timeout kills their process group and removes owned renderer scratch files. Failure retains diagnostics and partial output with a `BLOCKED` receipt; it never reuses a prior PASS. Each retry needs a new directory. The command does not promote, deploy or publish its output.

For an isolated CPU runner, the repository owner can manually run the existing **Stick-picture narration alignment** workflow on `main`. Its manual-only review-packet job installs the pinned runtimes, caches the public speech model, runs the same offline command, and uploads `unpublished-episode1-review-packet` for 30 days. Repository permissions are read-only and checkout credentials are not persisted. PR events run contract tests only; they do not produce or promote videos.
