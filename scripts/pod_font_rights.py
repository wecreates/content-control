"""Bind a current signed font-rights grant to retained license evidence."""
import hashlib

from pod_common import open_regular_binary, verified

MAX_LICENSE_BYTES = 16 * 1024 * 1024
HASH_CHARS = frozenset('0123456789abcdef')


def _bounded_text(value):
    return type(value) is str and value == value.strip() and 0 < len(value) <= 256


def inspect_font_rights(envelope, evidence_path, font_sha256, country, product):
    """Require current scoped permission and the exact retained license bytes.

    The signer remains responsible for legal authority and document authenticity.
    This gate only proves that the reviewed grant and retained evidence are current,
    hash-bound, and scoped to the exact font, market and product under review.
    """
    if envelope is None:
        raise ValueError('FONT_RIGHTS_REQUIRED')
    if evidence_path is None:
        raise ValueError('FONT_LICENSE_EVIDENCE_REQUIRED')
    try:
        with open_regular_binary(evidence_path) as source:
            evidence = source.read(MAX_LICENSE_BYTES + 1)
    except (OSError, ValueError):
        raise ValueError('FONT_LICENSE_EVIDENCE_INVALID') from None
    if not evidence or len(evidence) > MAX_LICENSE_BYTES:
        raise ValueError('FONT_LICENSE_EVIDENCE_INVALID')
    evidence_sha256 = hashlib.sha256(evidence).hexdigest()
    try:
        rights = verified(envelope, 'POD_RIGHTS_KEY', 'pod:font-rights')
    except ValueError:
        raise ValueError('FONT_RIGHTS_INVALID') from None
    supplied_hashes = (rights.get('font_sha256'), rights.get('license_sha256'))
    if (type(font_sha256) is not str or len(font_sha256) != 64 or
            any(c not in HASH_CHARS for c in font_sha256) or
            any(type(value) is not str or len(value) != 64 or
                any(c not in HASH_CHARS for c in value) for value in supplied_hashes) or
            rights.get('status') != 'PASS' or rights['font_sha256'] != font_sha256 or
            rights['license_sha256'] != evidence_sha256 or
            rights.get('country') != country or rights.get('product') != product or
            rights.get('commercial_use') is not True or
            rights.get('print_on_demand') is not True or
            rights.get('font_embedding') is not True or
            rights.get('revoked') is not False or
            not _bounded_text(rights.get('license_id')) or
            not _bounded_text(rights.get('licensor'))):
        raise ValueError('FONT_RIGHTS_INVALID')
    return rights
