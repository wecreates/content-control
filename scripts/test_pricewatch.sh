#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node --test tests/monitor_*.test.mjs tests/pricewatch-*.test.mjs
python3 -m unittest discover -s tests -p 'test_pricewatch_*.py' -v
python3 -m unittest discover -s tests/pricewatch_core -p 'test*.py' -v
