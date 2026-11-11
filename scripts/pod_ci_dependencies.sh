#!/usr/bin/env bash
set -euo pipefail

# One wall-clock budget covers both required package operations. timeout sends
# TERM to its process group, then KILL after five more seconds if needed.
# Keep the runner's configured repositories, network policy and package set.
# Any install error or deadline remains a failing gate, never a QA pass/skip.
exec timeout --signal=TERM --kill-after=5s 120s bash -euo pipefail -c '
  sudo apt-get update
  sudo apt-get install -y tesseract-ocr fonts-dejavu-core
'
