"""Permitted JSON-LD intake plus local regional registry screening. No access bypass."""
import argparse
import difflib
import hashlib
import io
import json
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from decimal import Decimal, InvalidOperation
from html.parser import HTMLParser
from pathlib import Path
import cv2
import numpy as np
from pod_common import PLATFORMS, canonical, read_json, save_json, verified, sign
from pod_raster import open_raster

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise ValueError('REDIRECT_BLOCKED')

MAX_SOURCE_BYTES = 2 * 1024 * 1024
MAX_REFERENCE_BYTES = 16 * 1024 * 1024  # Existing artifact-store object ceiling.

def validate_source_url(url, approved_hosts):
    if (not isinstance(url, str) or not isinstance(approved_hosts, list)
            or not approved_hosts or not all(isinstance(host, str) and host for host in approved_hosts)):
        raise ValueError('SOURCE_NOT_APPROVED')
    u = urllib.parse.urlparse(url)
    if u.scheme != 'https' or u.hostname not in approved_hosts or u.username or u.password or u.port not in (None, 443):
        raise ValueError('SOURCE_NOT_APPROVED')

def fetch_market(url, approved_hosts):
    validate_source_url(url, approved_hosts)
    request = urllib.request.Request(url, headers={'User-Agent': 'CYZOR-POD-Research/1.0'})
    with urllib.request.build_opener(NoRedirect).open(request, timeout=20) as response:
        data = response.read(MAX_SOURCE_BYTES + 1)
    if len(data) > MAX_SOURCE_BYTES:
        raise ValueError('SOURCE_TOO_LARGE')
    return data.decode('utf-8', errors='strict')

class ProductParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.capture = False
        self.text = []
        self.records = []
    def handle_starttag(self, tag, attrs):
        if tag == 'script' and dict(attrs).get('type') == 'application/ld+json':
            self.capture = True
            self.text = []
    def handle_data(self, text):
        if self.capture:
            self.text.append(text)
    def handle_endtag(self, tag):
        if tag == 'script' and self.capture:
            self.capture = False
            try:
                self.records.append(json.loads(''.join(self.text)))
            except json.JSONDecodeError:
                pass

def products(value):
    if isinstance(value, list):
        for item in value:
            yield from products(item)
    elif isinstance(value, dict):
        kind = value.get('@type', [])
        if kind == 'Product' or isinstance(kind, list) and 'Product' in kind:
            yield value
        for key in ('@graph', 'itemListElement', 'item'):
            if key in value:
                yield from products(value[key])

def normalize(text):
    return unicodedata.normalize('NFC', str(text)).casefold().strip()

def text_list(value, allow_empty=False):
    return (isinstance(value, list) and (allow_empty or bool(value)) and
            all(isinstance(item, str) and bool(item.strip()) for item in value))

def screen(text, country, category, registry, policy):
    # Registry/policy are signature-verified upstream, never supplied by a generator.
    # A signature authenticates bytes, not their schema or registry completeness.
    if (not isinstance(registry, dict) or
            not text_list(registry.get('countries')) or
            not text_list(registry.get('categories')) or
            not isinstance(registry.get('records'), list)):
        return 'UNKNOWN', ['REGISTRY_SCHEMA_INVALID']
    for record in registry['records']:
        if (not isinstance(record, dict) or
                not isinstance(record.get('word_mark'), str) or
                not record['word_mark'].strip() or
                not text_list(record.get('countries')) or
                not text_list(record.get('related_categories'))):
            return 'UNKNOWN', ['REGISTRY_SCHEMA_INVALID']
    if (not isinstance(policy, dict) or
            any(not text_list(policy.get(key, []), allow_empty=True)
                for key in ('blocked_terms', 'blocked_whole_words'))):
        return 'UNKNOWN', ['RIGHTS_POLICY_SCHEMA_INVALID']
    if country not in registry.get('countries', []) or category not in registry.get('categories', []):
        return 'UNKNOWN', ['REGISTRY_COVERAGE_MISSING']
    if registry.get('coverage_verified') is not True or policy.get('related_categories_checked') is not True:
        return 'UNKNOWN', ['REGIONAL_COVERAGE_UNVERIFIED']
    if policy.get('non_trademark_rights_verified') is not True:
        return 'UNKNOWN', ['COPYRIGHT_FONT_LIKENESS_UNVERIFIED']
    if not isinstance(text, str):
        return 'UNKNOWN', ['TEXT_INVALID']
    text = normalize(text)
    if not text or len(text) > 2000:
        return 'UNKNOWN', ['TEXT_INVALID']
    for term in policy.get('blocked_terms', []):
        if normalize(term) and normalize(term) in text:
            return 'FAIL', ['DEFENSIVE_TERM_MATCH']
    # Trusted policy regex only; use a bounded literal/word pattern grammar, no arbitrary regex.
    for term in policy.get('blocked_whole_words', []):
        if re.search(r'(?<!\w)' + re.escape(normalize(term)) + r'(?!\w)', text):
            return 'FAIL', ['LOCALIZED_WORD_MATCH']
    for record in registry.get('records', []):
        if country not in record.get('countries', []) or category not in record.get('related_categories', []):
            continue
        mark = normalize(record.get('word_mark', ''))
        if not mark:
            continue
        if mark in text or difflib.SequenceMatcher(None, mark, text).ratio() >= .8:
            return 'UNKNOWN', ['POTENTIAL_MARK_CONFLICT']
    return 'PASS', []

def analyze_reference(image_path):
    # Validate dimensions/frame count before decoding. Keep the validated file
    # open through conversion rather than reopening a potentially replaced path.
    with open_raster(image_path) as image:
        w, h = image.size
        with image.convert('L') as grayscale:
            pixels = np.array(grayscale)
    edges = cv2.Canny(pixels, 80, 180)
    components, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    boxes = [cv2.boundingRect(c) for c in components if cv2.contourArea(c) > 16]
    return {'display_pixels': [w, h], 'edge_density': float(np.mean(edges > 0)),
            'normalized_regions': [[x/w, y/h, bw/w, bh/h] for x, y, bw, bh in boxes],
            'print_dimensions': None, 'font_identity': None,
            'limitation': 'Displayed pixels and edges do not establish original print geometry or aesthetic quality.'}

def run(args):
    if args.platform not in PLATFORMS:
        raise ValueError('PLATFORM_BLOCKED')
    registry_envelope = read_json(args.registry)
    policy_envelope = read_json(args.policy)
    registry = verified(registry_envelope, 'POD_REGISTRY_KEY', 'pod:registry')
    policy = verified(policy_envelope, 'POD_RIGHTS_KEY', 'pod:rights-policy')
    text_hash = hashlib.sha256(args.text.encode()).hexdigest()
    if policy.get('text_sha256') != text_hash or policy.get('country') != args.country or policy.get('category') != args.category:
        raise ValueError('RIGHTS_POLICY_SCOPE_MISMATCH')
    state, reasons = screen(args.text, args.country, args.category, registry, policy)
    result = {'schema_version': 1, 'platform': args.platform, 'country': args.country,
              'category': args.category, 'rights_state': state,
              'permanently_unpublished': state != 'PASS', 'reason_codes': reasons,
              'publication_enabled': False}
    if state != 'PASS':
        return result
    if not args.source_policy:
        raise ValueError('SOURCE_POLICY_REQUIRED')
    source_envelope = read_json(args.source_policy)
    sources = verified(source_envelope, 'POD_SOURCE_KEY', 'pod:source-policy')
    if sources.get('collection_authorized') is not True:
        raise ValueError('SOURCE_NOT_AUTHORIZED')
    validate_source_url(args.url, sources.get('approved_hosts'))
    if args.html:
        # Offline imports need the same authorization as live collection, plus
        # a trusted binding of the exact saved bytes to their original URL.
        with Path(args.html).open('rb') as source:
            data = source.read(MAX_SOURCE_BYTES + 1)
        if len(data) > MAX_SOURCE_BYTES:
            raise ValueError('SOURCE_TOO_LARGE')
        snapshot = sources.get('snapshot')
        if (not isinstance(snapshot, dict) or snapshot.get('source_url') != args.url
                or snapshot.get('sha256') != hashlib.sha256(data).hexdigest()):
            raise ValueError('SOURCE_SNAPSHOT_MISMATCH')
        html = data.decode('utf-8', errors='strict')
    else:
        html = fetch_market(args.url, sources.get('approved_hosts', []))
    parser = ProductParser()
    parser.feed(html)
    found = list(products(parser.records))
    if not found:
        raise ValueError('SOURCE_SCHEMA_UNSUPPORTED')
    extracted = []
    for item in found[:50]:
        offer = item.get('offers', {})
        if isinstance(offer, list):
            offer = offer[0] if offer else {}
        try:
            # Preserve source decimal/currency; no universal two-decimal currency assumption.
            price = str(Decimal(str(offer['price'])))
            if not Decimal(price).is_finite() or Decimal(price) < 0:
                price = None
        except (KeyError, InvalidOperation):
            price = None
        extracted.append({'name': item.get('name'), 'price_decimal': price,
                          'currency': offer.get('priceCurrency'), 'tags': item.get('keywords'),
                          'rank': None, 'search_volume': None})
    # Analyze and identify exactly the same bounded byte snapshot. The path may
    # be replaced, overwritten or removed during vision work; never rehash it.
    with Path(args.reference).open('rb') as source:
        reference = source.read(MAX_REFERENCE_BYTES + 1)
    if len(reference) > MAX_REFERENCE_BYTES:
        raise ValueError('REFERENCE_TOO_LARGE')
    if not reference:
        raise ValueError('REFERENCE_EMPTY')
    with io.BytesIO(reference) as snapshot:
        visual = analyze_reference(snapshot)
    result.update({'observations': extracted, 'source_url': args.url,
                   'collection_authorized': True,
                   'source_policy_sha256': hashlib.sha256(canonical(sources).encode()).hexdigest(),
                   'source_sha256': hashlib.sha256(html.encode()).hexdigest(),
                   'reference_sha256': hashlib.sha256(reference).hexdigest(), 'visual': visual,
                   'outcompete_spec': {'intended_text': args.text,
                     'original_art_required': True, 'exact_text_ocr_required': True,
                     'critical_content_outside_safe_area_px': 0,
                     'hypotheses': ['Increase readable hierarchy', 'Reduce competing focal elements'],
                     'reference_is_not_a_production_asset': True}})
    # Fetching, analysis and hashing can outlive any of the input authorities.
    # Revalidate the exact snapshots used above, never replacement files.
    for envelope, key, audience in (
            (registry_envelope, 'POD_REGISTRY_KEY', 'pod:registry'),
            (policy_envelope, 'POD_RIGHTS_KEY', 'pod:rights-policy'),
            (source_envelope, 'POD_SOURCE_KEY', 'pod:source-policy')):
        verified(envelope, key, audience)
    result['evidence_expires_at_ms'] = min(
        registry['expires_at_ms'], policy['expires_at_ms'], sources['expires_at_ms'])
    return result

def main():
    p = argparse.ArgumentParser()
    for name in ('platform', 'country', 'category', 'text', 'registry', 'policy', 'reference', 'output'):
        p.add_argument('--'+name, required=True)
    p.add_argument('--url')
    p.add_argument('--html')
    p.add_argument('--source-policy')
    p.add_argument('--signed-output')
    p.add_argument('--concept-id')
    p.add_argument('--business-id')
    args = p.parse_args()
    try:
        result = run(args)
        now = int(time.time() * 1000)
        if result.get('rights_state') == 'PASS' and result['evidence_expires_at_ms'] <= now:
            raise ValueError('EVIDENCE_EXPIRED')
    except Exception as exc:
        result = {'schema_version': 1, 'rights_state': 'UNKNOWN', 'permanently_unpublished': True,
                  'publication_enabled': False, 'reason_codes': [type(exc).__name__], 'status': 'BLOCKED'}
    if args.signed_output:
        if not args.concept_id or not args.business_id:
            raise ValueError('CONCEPT_ID_AND_BUSINESS_ID_REQUIRED')
        now=int(time.time()*1000)
        expires = now + 900000
        if result.get('rights_state') == 'PASS':
            expires = min(expires, result['evidence_expires_at_ms'])
        fingerprint=hashlib.sha256(canonical([normalize(args.text),args.country,args.category]).encode()).hexdigest()
        envelope=sign({**result,'schema_version':1,'audience':'content-control:pod:intake',
                       'issued_at_ms':now,'expires_at_ms':expires,'concept_id':args.concept_id,
                       'business_id':args.business_id,'fingerprint':fingerprint},'POD_INTAKE_KEY')
        save_json(args.signed_output,envelope)
    save_json(args.output, result)
    print(canonical(result))
    return 0 if result.get('rights_state') == 'PASS' else 2

if __name__ == '__main__':
    sys.exit(main())

