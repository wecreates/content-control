#!/usr/bin/env python3
"""Run a private Content Control job through Money Factory's canonical integrations."""
import argparse
import os
from pathlib import Path
import subprocess
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('job', type=Path)
    parser.add_argument('--runtime', type=Path, required=True)
    args = parser.parse_args()
    configured = os.environ.get('MONEY_FACTORY_ROOT')
    if not configured:
        parser.error('MONEY_FACTORY_ROOT must point to the existing Money Factory checkout')
    root = Path(configured).resolve(strict=True)
    runner = root / 'integrations/run.py'
    if not runner.is_file():
        parser.error('Money Factory integration worker is not installed')
    env = dict(os.environ, PUBLICATION_ENABLED='false')
    return subprocess.run([sys.executable, str(runner), str(args.job.resolve(strict=True)),
                           '--runtime', str(args.runtime.resolve())], env=env, cwd=root).returncode


if __name__ == '__main__':
    sys.exit(main())
