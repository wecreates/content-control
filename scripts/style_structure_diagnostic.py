#!/usr/bin/env python3
"""Experimental line-art diagnostic. Never an acceptance or creative-quality gate."""
import argparse
import hashlib
import json
from pathlib import Path

import cv2
import numpy as np


def structure_mask(image):
    if image is None or image.ndim != 3 or image.shape[2] != 3:
        raise ValueError('Decoded BGR image required')
    # Fixed resolution makes occupancy comparisons independent of source size.
    gray = cv2.cvtColor(cv2.resize(image, (180, 320), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY).astype(float)
    background = float(np.percentile(gray, 90))
    if background < 128:
        return None, background
    # Relative ink contrast suppresses light paper variation, not dark artwork.
    return (background-gray)/background > .20, background


def compare_structure(reference, candidate):
    ref, rb = structure_mask(reference)
    cand, cb = structure_mask(candidate)
    base = {'status': 'MEASURED', 'acceptance_effect': 'none', 'calibrated': False,
            'reference_background_gray': rb, 'candidate_background_gray': cb,
            'publication_enabled': False}
    if ref is None or cand is None:
        return dict(base, status='UNSUPPORTED', reason='Dark-background input outside experimental line-art scope')
    counts = [int(mask.sum()) for mask in (ref, cand)]
    union = int(np.logical_or(ref, cand).sum())
    # A blank image cannot be evidence of matching line-art, even against blank.
    valid = min(counts) > 0
    intersection = int(np.logical_and(ref, cand).sum())
    def grid(mask):
        return mask.reshape(16, 20, 9, 20).mean(axis=(1, 3))
    return dict(base, foreground_present_in_both=valid,
                reference_ink_fraction=float(ref.mean()), candidate_ink_fraction=float(cand.mean()),
                mask_iou=float(intersection/union) if valid and union else None,
                spatial_occupancy_distance=float(np.abs(grid(ref)-grid(cand)).mean()),
                scope='Foreground geometry only; different stories may legitimately differ. No style, full audiovisual, or creative approval inferred.')


def fingerprint(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024*1024), b''):
            h.update(chunk)
    return h.hexdigest()


def measure(reference_dir, candidate_video):
    files = sorted(Path(reference_dir).glob('ref-*.jpg'))
    if len(files) < 4:
        raise ValueError('At least four reference frames required')
    cap = cv2.VideoCapture(str(candidate_video))
    pairs = []
    try:
        total = cap.get(cv2.CAP_PROP_FRAME_COUNT)
        if not np.isfinite(total) or total < len(files) or not float(total).is_integer():
            raise ValueError('Candidate frame count invalid')
        for i, path in enumerate(files):
            index = round((total-1)*i/(len(files)-1))
            if not cap.set(cv2.CAP_PROP_POS_FRAMES, index):
                raise ValueError('Candidate seek failed')
            ok, frame = cap.read()
            position = cap.get(cv2.CAP_PROP_POS_FRAMES)
            if not ok or not np.isfinite(position) or abs(position-index-1) > .5:
                raise ValueError('Candidate sample position unverified')
            pairs.append(dict(reference_file=path.name, reference_sha256=fingerprint(path),
                              candidate_frame=index, **compare_structure(cv2.imread(str(path)), frame)))
    finally:
        cap.release()
    return {'schema_version': 1, 'status': 'MEASURED', 'acceptance_effect': 'none',
            'calibrated': False, 'candidate_sha256': fingerprint(candidate_video),
            'parameters': {'resolution': [180, 320], 'background_percentile': 90, 'relative_ink_contrast': .20},
            'scope': 'Sparse decoded-frame experiment; not full audiovisual review or a replacement for existing parity.',
            'pairs': pairs, 'publication_enabled': False}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--reference-dir', required=True)
    parser.add_argument('--candidate-video', required=True)
    args = parser.parse_args()
    print(json.dumps(measure(args.reference_dir, args.candidate_video), sort_keys=True))


if __name__ == '__main__':
    main()
