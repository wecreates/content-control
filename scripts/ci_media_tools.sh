#!/usr/bin/env bash
# Prefer verified runner tools; a package mirror outage must not consume the job.
set -euo pipefail
media_tools_ready() {
  command -v ffmpeg >/dev/null 2>&1 && command -v ffprobe >/dev/null 2>&1 &&
    timeout 10s ffmpeg -version >/dev/null 2>&1 &&
    timeout 10s ffprobe -version >/dev/null 2>&1
}
if media_tools_ready; then
  echo 'Verified existing ffmpeg and ffprobe'
  exit 0
fi
timeout --kill-after=10s 180s sudo apt-get -o Acquire::Retries=1 -o Acquire::http::Timeout=30 -o Acquire::https::Timeout=30 update -qq
timeout --kill-after=10s 180s sudo apt-get -o DPkg::Lock::Timeout=30 install -y -qq ffmpeg
media_tools_ready || { echo 'ffmpeg/ffprobe verification failed' >&2; exit 2; }
echo 'Verified installed ffmpeg and ffprobe'
