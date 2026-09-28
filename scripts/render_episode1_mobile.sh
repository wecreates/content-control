#!/usr/bin/env bash
set -euo pipefail
mkdir -p public-review
npx remotion render remotion/v10-index.jsx Episode1V10FinalProof /tmp/episode1-v10-raw.mp4 --codec h264 --crf 25 --concurrency 2
ffmpeg -y -i /tmp/episode1-v10-raw.mp4 -map 0:v:0 -map 0:a:0 -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -profile:v high -level 4.1 -c:a copy -movflags +faststart public-review/episode1-v10-free.mp4
rm -f /tmp/episode1-v10-raw.mp4
python scripts/free_mobile_compat_qa.py --video public-review/episode1-v10-free.mp4 --output state/mobile-playback-health.json
