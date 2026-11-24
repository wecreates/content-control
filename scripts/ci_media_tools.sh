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
apt_network=(-o Acquire::Retries=1 -o Acquire::http::Timeout=30 -o Acquire::https::Timeout=30 -o Acquire::Languages=none)
update_index() {
  timeout --kill-after=3s 85s sudo apt-get "${apt_network[@]}" update -qq
}
echo 'Refreshing media package index'
if update_index; then
  :
else
  status=$?
  if [[ "$status" == 124 ]]; then
    echo 'Media package index refresh timed out; retrying once' >&2
    sleep 3
    update_index || { status=$?; echo "Media package index refresh failed (exit $status)" >&2; exit "$status"; }
  else
    echo "Media package index refresh failed (exit $status)" >&2
    exit "$status"
  fi
fi
echo 'Installing FFmpeg media tools'
timeout --kill-after=10s 180s sudo apt-get "${apt_network[@]}" -o DPkg::Lock::Timeout=30 install -y -qq --no-install-recommends ffmpeg ||
  { status=$?; echo "FFmpeg package installation failed (exit $status)" >&2; exit "$status"; }
media_tools_ready || { echo 'ffmpeg/ffprobe verification failed' >&2; exit 2; }
echo 'Verified installed ffmpeg and ffprobe'
