"""Authenticate original KDP template evidence independently of the producer."""
import re
import time
from datetime import datetime,timezone
from urllib.parse import urlsplit
from pod_common import canonical,open_regular_binary,verified,MAX_JSON_BYTES,strict_json
from pod_interior_preflight import inspect_pairing
from pod_kdp_options import require_paperback_options
from pod_kdp_template_import import inspect_template_archive


def original_envelope(path,audience):
    try:
        with open_regular_binary(path) as source:data=source.read(MAX_JSON_BYTES+1)
        if len(data)>MAX_JSON_BYTES:raise ValueError()
        envelope=strict_json(data.decode('utf-8',errors='strict'))
        # Strictly parse authenticated payload text too. The common verifier
        # still owns HMAC, audience, schema and current-time validation.
        strict_json(envelope['payload'])
        record=verified(envelope,'POD_TEMPLATE_KEY',audience)
        return envelope,record
    except Exception:
        raise ValueError('KDP_TEMPLATE_PROVENANCE_INVALID') from None


def provenance(record,product,country):
    try:
        source=urlsplit(record['source_url']);observed=record['observed_at']
        if (record.get('product')!=product or record.get('country')!=country or
                record.get('official_source_verified') is not True or
                source.scheme!='https' or not source.hostname or source.username or source.password or
                type(record.get('source_sha256')) is not str or
                re.fullmatch('[a-f0-9]{64}',record['source_sha256']) is None or
                type(observed) is not str or re.fullmatch(
                    r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})',observed) is None or
                datetime.fromisoformat(observed.replace('Z','+00:00'))>datetime.fromtimestamp(time.time(),timezone.utc)):
            raise ValueError()
    except Exception:
        raise ValueError('KDP_TEMPLATE_PROVENANCE_INVALID') from None


def template_evidence_deadline(evidence):
    try:
        cover=verified(evidence['cover'],'POD_TEMPLATE_KEY','pod:template')
        interior=verified(evidence['interior'],'POD_TEMPLATE_KEY','pod:interior-template')
        return min(cover['expires_at_ms'],interior['expires_at_ms'])
    except Exception:
        raise ValueError('KDP_TEMPLATE_PROVENANCE_INVALID') from None


def inspect_kdp_template_evidence(manifest,paths,product,country):
    if (not isinstance(paths,dict) or set(paths)!={'cover','interior','source'} or
            type(product) is not str or not product.strip() or len(product)>128 or
            type(country) is not str or re.fullmatch('[A-Z]{2}',country) is None):
        raise ValueError('KDP_TEMPLATE_PROVENANCE_REQUIRED')
    cover_envelope,cover=original_envelope(paths['cover'],'pod:template')
    interior_envelope,interior=original_envelope(paths['interior'],'pod:interior-template')
    provenance(cover,product,country);provenance(interior,product,country)
    try:
        if (manifest.get('platform')!='kdp' or canonical(cover['template'])!=canonical(manifest['template']) or
                canonical(interior['template'])!=canonical(manifest['interior']['template'])):
            raise ValueError('KDP_TEMPLATE_PACKAGE_MISMATCH')
        c=cover['template'];i=interior['template'];k=c['kdp']
        inspect_pairing(i,c);require_paperback_options(i,country)
        if k.get('barcode_mode')!='amazon_placed':raise ValueError('KDP_BARCODE_MODE_UNSUPPORTED')
        profile={name:i[name] for name in ('binding','ink_type','paper_type','trim_inches','page_count')}
        profile.update(reading_direction=k['reading_direction'],locale=k['locale'])
    except (KeyError,TypeError,OverflowError):
        raise ValueError('KDP_TEMPLATE_PACKAGE_MISMATCH') from None
    # Reopen/hash/capture the retained source independently. No URL is fetched
    # and no original source or template is replaced with producer declarations.
    try:
        inspection=inspect_template_archive(paths['source'],profile,cover['source_sha256'])
    except ValueError:
        raise
    except Exception:
        raise ValueError('KDP_TEMPLATE_PROVENANCE_INVALID') from None
    evidence={'cover':cover_envelope,'interior':interior_envelope,'inspection':inspection}
    template_evidence_deadline(evidence)
    return evidence
