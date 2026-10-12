"""Require current-candidate evidence before preparing a V2 health package."""
import math
import re


def verified_media_evidence(candidate_sha256, parity, media):
    if not isinstance(candidate_sha256, str) or not re.fullmatch(r'[0-9a-f]{64}', candidate_sha256):
        raise ValueError('Valid current candidate SHA-256 required')
    for label, receipt in (('visual parity', parity), ('complete media decode', media)):
        if not isinstance(receipt, dict) or receipt.get('status') != 'PASS':
            raise ValueError(f'{label} QA did not pass')
        if receipt.get('candidate_sha256') != candidate_sha256:
            raise ValueError(f'{label} receipt does not match current candidate')
    duration = (media.get('metrics') or {}).get('duration')
    if isinstance(duration, bool) or not isinstance(duration, (int, float)) or not math.isfinite(duration) or duration <= 0:
        raise ValueError('Verified finite positive media duration required')
    return {'candidate_sha256': candidate_sha256, 'duration_seconds': duration, 'verified': True}
