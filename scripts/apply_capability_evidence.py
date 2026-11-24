#!/usr/bin/env python3
"""Retain capability progress while available receipts remain diagnostic."""
import argparse
import json
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--progress', required=True, type=Path)
    parser.add_argument('--evidence-dir', required=True, type=Path)
    parser.add_argument('--out', required=True, type=Path)
    args = parser.parse_args()
    try:
        progress = json.loads(args.progress.read_text())
    except (OSError, ValueError):
        parser.error('invalid_progress')
    if not isinstance(progress, dict) or not isinstance(progress.get('capabilities'), dict):
        parser.error('invalid_progress')
    if progress.get('publication_enabled') is not False:
        parser.error('publication_must_remain_disabled')

    # Current producers report an integration placeholder or broad domain
    # diagnostics. Per-capability verification must precede lifecycle changes.
    receipts_observed = sum(path.is_file() for path in args.evidence_dir.glob('*.json'))
    args.out.write_text(json.dumps(progress, indent=2, sort_keys=True) + '\n')
    print(json.dumps({
        'status': 'PROGRESS_RETAINED',
        'total': len(progress['capabilities']),
        'receipts_observed': receipts_observed,
        'capabilities_promoted': 0,
        'publication_enabled': False,
    }))


if __name__ == '__main__':
    main()
