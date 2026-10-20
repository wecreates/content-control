"""Offline inspection of a retained official KDP manuscript-template archive.

This authenticates and inspects captured bytes. It never downloads a template,
mints source authority, or approves a production manuscript.
"""
import argparse
import hashlib
import io
import math
import re
import stat
import sys
import zipfile
from xml.etree import ElementTree

from pod_common import canonical, open_regular_binary


MAX_ARCHIVE_BYTES = 16 * 1024 * 1024
MAX_MEMBER_BYTES = 16 * 1024 * 1024
MAX_TOTAL_BYTES = 32 * 1024 * 1024
MAX_ENTRIES = 128
W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'


def _members(data, *, limit, required=()):
    result = {}
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            entries = archive.infolist()
            if not entries or len(entries) > limit or len({entry.filename for entry in entries}) != len(entries):
                raise ValueError()
            total = 0
            for entry in entries:
                kind = stat.S_IFMT(entry.external_attr >> 16)
                name = entry.filename
                if (not isinstance(name, str) or not name or
                        name.startswith(('/', '\\')) or '\\' in name or
                        entry.flag_bits & 1 or
                        entry.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED) or
                        entry.file_size > MAX_MEMBER_BYTES):
                    raise ValueError()
                parts = name.rstrip('/').split('/')
                if (not parts or any(part in ('', '.', '..') for part in parts) or
                        (entry.is_dir() and (not name.endswith('/') or kind not in (0, stat.S_IFDIR))) or
                        (not entry.is_dir() and
                         (kind not in (0, stat.S_IFREG) or entry.file_size <= 0))):
                    raise ValueError()
                if entry.is_dir():
                    continue
                total += entry.file_size
                if total > MAX_TOTAL_BYTES:
                    raise ValueError()
                with archive.open(entry) as source:
                    body = source.read(MAX_MEMBER_BYTES + 1)
                if len(body) != entry.file_size or not body:
                    raise ValueError()
                result[name] = body
    except ValueError:
        raise
    except Exception:
        raise ValueError() from None
    if any(name not in result for name in required):
        raise ValueError()
    return result


def _root(data):
    try:
        return ElementTree.fromstring(data)
    except Exception:
        raise ValueError('KDP_INTERIOR_TEMPLATE_DOCX_INVALID') from None


def inspect_interior_template_archive(path, trim_inches, expected_sha256, source_member):
    if (not isinstance(trim_inches, list) or len(trim_inches) != 2 or
            any(type(value) not in (int, float) or not math.isfinite(value) or value <= 0
                for value in trim_inches)):
        raise ValueError('KDP_INTERIOR_TEMPLATE_PROFILE_INVALID')
    if (not isinstance(expected_sha256, str) or
            re.fullmatch('[a-f0-9]{64}', expected_sha256) is None):
        raise ValueError('KDP_INTERIOR_TEMPLATE_HASH_REQUIRED')
    if (not isinstance(source_member, str) or not 1 <= len(source_member) <= 512 or
            source_member.startswith(('/', '\\')) or '\\' in source_member or
            any(part in ('', '.', '..') for part in source_member.split('/')) or
            not source_member.lower().endswith('.docx')):
        raise ValueError('KDP_INTERIOR_TEMPLATE_MEMBER_INVALID')
    try:
        with open_regular_binary(path) as source:
            captured = source.read(MAX_ARCHIVE_BYTES + 1)
    except (OSError, ValueError):
        raise ValueError('KDP_INTERIOR_TEMPLATE_ARCHIVE_INVALID') from None
    if not 0 < len(captured) <= MAX_ARCHIVE_BYTES:
        raise ValueError('KDP_INTERIOR_TEMPLATE_ARCHIVE_SIZE_INVALID')
    archive_sha256 = hashlib.sha256(captured).hexdigest()
    if archive_sha256 != expected_sha256:
        raise ValueError('KDP_INTERIOR_TEMPLATE_HASH_MISMATCH')
    try:
        outer = _members(captured, limit=MAX_ENTRIES)
        document_bytes = outer[source_member]
    except KeyError:
        raise ValueError('KDP_INTERIOR_TEMPLATE_MEMBER_INVALID') from None
    except ValueError:
        raise ValueError('KDP_INTERIOR_TEMPLATE_ARCHIVE_INVALID') from None
    try:
        docx = _members(document_bytes, limit=MAX_ENTRIES,
                        required=('[Content_Types].xml', 'word/document.xml', 'word/settings.xml'))
    except ValueError:
        raise ValueError('KDP_INTERIOR_TEMPLATE_DOCX_INVALID') from None
    content_types = _root(docx['[Content_Types].xml'])
    if not any(element.attrib.get('PartName') == '/word/document.xml' and
               element.attrib.get('ContentType') ==
               'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml'
               for element in content_types):
        raise ValueError('KDP_INTERIOR_TEMPLATE_DOCX_INVALID')
    document = _root(docx['word/document.xml'])
    settings = _root(docx['word/settings.xml'])
    sections = document.findall('.//' + W + 'sectPr')
    if len(sections) != 1 or settings.find('.//' + W + 'mirrorMargins') is None:
        raise ValueError('KDP_INTERIOR_TEMPLATE_LAYOUT_INVALID')
    size = sections[0].find(W + 'pgSz')
    margins = sections[0].find(W + 'pgMar')
    try:
        width = int(size.attrib[W + 'w']) / 1440
        height = int(size.attrib[W + 'h']) / 1440
        values = {name: int(margins.attrib[W + name]) / 1440
                  for name in ('top', 'right', 'bottom', 'left', 'gutter')}
    except (AttributeError, KeyError, TypeError, ValueError, OverflowError):
        raise ValueError('KDP_INTERIOR_TEMPLATE_LAYOUT_INVALID') from None
    if (any(abs(actual - expected) > 1 / 1440
            for actual, expected in zip((width, height), trim_inches)) or
            min(values['top'], values['right'], values['bottom']) < .25 or
            values['left'] < .375 or values['gutter'] != 0):
        raise ValueError('KDP_INTERIOR_TEMPLATE_LAYOUT_INVALID')
    return {
        'schema_version': 1,
        'kind': 'kdp-interior-template-source-inspection',
        'archive_sha256': archive_sha256,
        'archive_bytes': len(captured),
        'source_member': source_member,
        'member_sha256': hashlib.sha256(document_bytes).hexdigest(),
        'member_bytes': len(document_bytes),
        'trim_inches': [width, height],
        'margins_inches': values,
        'mirror_margins': True,
        'source_authority_verified': False,
        'production_template_approved': False,
        'publication_enabled': False,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--archive', required=True)
    parser.add_argument('--trim-width', required=True, type=float)
    parser.add_argument('--trim-height', required=True, type=float)
    parser.add_argument('--expected-sha256', required=True)
    parser.add_argument('--source-member', required=True)
    args = parser.parse_args()
    try:
        result = inspect_interior_template_archive(
            args.archive, [args.trim_width, args.trim_height],
            args.expected_sha256, args.source_member)
        print(canonical(result))
        return 0
    except Exception as exc:
        reason = str(exc) if isinstance(exc, ValueError) and str(exc).startswith(
            'KDP_INTERIOR_TEMPLATE_') else 'KDP_INTERIOR_TEMPLATE_IMPORT_BLOCKED'
        print(canonical({'status': 'BLOCKED', 'reason_code': reason,
                         'publication_enabled': False}))
        return 2


if __name__ == '__main__':
    sys.exit(main())
