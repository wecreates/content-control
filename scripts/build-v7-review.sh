#!/usr/bin/env bash
set -euo pipefail
# One quality mode only. Keep this review render separate from publication.
mkdir -p public
npx remotion render remotion/v7-index.jsx Episode1V7VerticalProof public/episode1-v7.mp4 --codec h264 --crf 28 --concurrency 2
