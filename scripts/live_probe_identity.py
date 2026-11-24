"""Check whether a live smoke receipt still targets the current review files."""
import argparse
import json
import os
import re
import subprocess


def read_identity(ref):
    source = subprocess.check_output(
        ['git', 'rev-parse', '--verify', '--end-of-options', f'{ref}^{{commit}}'],
        text=True).strip()
    if re.fullmatch(r'[0-9a-f]{40}', source) is None:
        raise ValueError('Live probe requires an exact source commit')

    def load(path):
        return json.loads(subprocess.check_output(['git', 'show', f'{source}:{path}']))

    health = load('state/content-control-health.json')
    captions = load('state/caption-health.json')
    base = load('state/deployment-contract.json').get('public_base_url')
    candidate = health.get('candidate_sha256')
    caption = captions.get('caption_sha256')
    if not isinstance(base, str) or not re.fullmatch(r'https://[^\s]+', base):
        raise ValueError('Live probe requires a valid deployment URL')
    if (health.get('status') != 'GREEN' or captions.get('status') != 'PASS'
            or health.get('publication_enabled') is not False
            or captions.get('publication_enabled') is not False
            or not all(isinstance(value, str) and re.fullmatch('[0-9a-f]{64}', value)
                       for value in (candidate, caption))
            or captions.get('candidate_sha256') != candidate):
        raise ValueError('Live probe requires current, bound video and caption receipts')
    return candidate, caption, base, source


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('ref')
    parser.add_argument('--capture', action='store_true')
    args = parser.parse_args()
    try:
        candidate, caption, base, source = read_identity(args.ref)
    except (AttributeError, OSError, ValueError, subprocess.CalledProcessError) as error:
        raise SystemExit(f'Cannot read live probe identity from {args.ref}: {error}') from error
    if args.capture:
        print(f'CANDIDATE_SHA={candidate}\nCAPTION_SHA={caption}\nPROBE_BASE_URL={base}\nEXPECTED_SOURCE_SHA={source}')
    elif (candidate, caption, base, source) != tuple(os.environ.get(name) for name in
                                                     ('CANDIDATE_SHA', 'CAPTION_SHA', 'PROBE_BASE_URL',
                                                      'EXPECTED_SOURCE_SHA')):
        raise SystemExit('Video, caption, deployment URL, or source changed; refusing stale live probe evidence')


if __name__ == '__main__':
    main()
