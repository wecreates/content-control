import hashlib
import os
from pathlib import Path
import stat
import subprocess
import sys
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))

from pod_kdp_interior_template_import import inspect_interior_template_archive


DOCUMENT = b'''<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
 <w:body><w:p/><w:sectPr><w:pgSz w:w="8640" w:h="12960"/>
 <w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="1080"
  w:header="504" w:footer="504" w:gutter="0"/></w:sectPr></w:body>
</w:document>'''
SETTINGS = b'''<?xml version="1.0" encoding="UTF-8"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
 <w:mirrorMargins/><w:evenAndOddHeaders/>
</w:settings>'''
TYPES = b'''<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
 <Override PartName="/word/document.xml"
  ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>'''
MEMBER = 'English/English/6 x 9 inch (15.24 x 22.86 cm).docx'


def archive_bytes(document=DOCUMENT, settings=SETTINGS, types=TYPES, *, member=MEMBER, extra=None):
    import io
    docx = io.BytesIO()
    with zipfile.ZipFile(docx, 'w', zipfile.ZIP_DEFLATED) as archive:
        archive.writestr('word/', b'')
        archive.writestr('[Content_Types].xml', types)
        archive.writestr('word/document.xml', document)
        archive.writestr('word/settings.xml', settings)
        if extra:
            for name, body in extra:
                archive.writestr(name, body)
    outer = io.BytesIO()
    with zipfile.ZipFile(outer, 'w', zipfile.ZIP_DEFLATED) as archive:
        archive.writestr('English/', b'')
        archive.writestr('English/English/', b'')
        archive.writestr(member, docx.getvalue())
    return outer.getvalue()


class KdpInteriorTemplateImportTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / 'English.zip'

    def write(self, data):
        self.path.write_bytes(data)
        return hashlib.sha256(data).hexdigest()

    def inspect(self, data=None, **kwargs):
        data = archive_bytes() if data is None else data
        digest = self.write(data)
        return inspect_interior_template_archive(
            self.path, kwargs.get('trim', [6, 9]),
            kwargs.get('sha', digest), kwargs.get('member', MEMBER))

    def test_exact_archive_member_and_layout_are_reported_without_approval(self):
        result = self.inspect()
        self.assertEqual(result['trim_inches'], [6.0, 9.0])
        self.assertEqual(result['margins_inches']['left'], .75)
        self.assertEqual(result['margins_inches']['right'], .5)
        self.assertTrue(result['mirror_margins'])
        self.assertFalse(result['source_authority_verified'])
        self.assertFalse(result['production_template_approved'])
        self.assertFalse(result['publication_enabled'])

    def test_hash_member_and_profile_must_match(self):
        for change in (
                {'sha': '0' * 64}, {'sha': 'A' * 64},
                {'member': 'English/English/other.docx'},
                {'member': '../template.docx'}, {'member': 'template.txt'},
                {'trim': [5, 8]}, {'trim': [6]}, {'trim': [6, float('nan')]}):
            with self.subTest(change=change), self.assertRaises(ValueError):
                self.inspect(**change)

    def test_layout_requires_matching_page_size_safe_margins_and_mirroring(self):
        changes = [
            DOCUMENT.replace(b'8640', b'7200', 1),
            DOCUMENT.replace(b'w:left="1080"', b'w:left="360"'),
            DOCUMENT.replace(b'w:right="720"', b'w:right="180"'),
            DOCUMENT.replace(b'w:gutter="0"', b'w:gutter="1"'),
            DOCUMENT.replace(b'<w:sectPr>', b'<w:sectPr><w:sectPr/>'),
        ]
        for document in changes:
            with self.subTest(document=document), self.assertRaisesRegex(
                    ValueError, '^KDP_INTERIOR_TEMPLATE_LAYOUT_INVALID$'):
                self.inspect(archive_bytes(document=document))
        with self.assertRaisesRegex(ValueError, '^KDP_INTERIOR_TEMPLATE_LAYOUT_INVALID$'):
            self.inspect(archive_bytes(settings=SETTINGS.replace(b'<w:mirrorMargins/>', b'')))

    def test_archive_and_docx_structure_fail_closed(self):
        import io
        for data in (b'not zip', archive_bytes(extra=[('../escape', b'x')]),
                     archive_bytes(types=b'<Types/>')):
            with self.subTest(size=len(data)), self.assertRaises(ValueError):
                self.inspect(data)
        docx = io.BytesIO()
        with zipfile.ZipFile(docx, 'w', zipfile.ZIP_DEFLATED) as archive:
            archive.writestr('[Content_Types].xml', TYPES)
            archive.writestr('word/document.xml', DOCUMENT)
        outer = io.BytesIO()
        with zipfile.ZipFile(outer, 'w', zipfile.ZIP_DEFLATED) as archive:
            archive.writestr(MEMBER, docx.getvalue())
        with self.assertRaisesRegex(ValueError, '^KDP_INTERIOR_TEMPLATE_DOCX_INVALID$'):
            self.inspect(outer.getvalue())

    @unittest.skipUnless(hasattr(os, 'mkfifo'), 'FIFO unavailable')
    def test_regular_file_and_size_bounds_precede_zip_parsing(self):
        link = Path(self.temp.name) / 'link.zip'
        data = archive_bytes(); self.write(data); link.symlink_to(self.path)
        with self.assertRaises(ValueError):
            inspect_interior_template_archive(link, [6, 9], hashlib.sha256(data).hexdigest(), MEMBER)
        fifo = Path(self.temp.name) / 'fifo'; os.mkfifo(fifo)
        with self.assertRaises(ValueError):
            inspect_interior_template_archive(fifo, [6, 9], '0' * 64, MEMBER)
        self.path.write_bytes(b'x' * (16 * 1024 * 1024 + 1))
        with self.assertRaisesRegex(ValueError, '^KDP_INTERIOR_TEMPLATE_ARCHIVE_SIZE_INVALID$'):
            inspect_interior_template_archive(self.path, [6, 9], '0' * 64, MEMBER)

    def test_cli_emits_bounded_pass_or_blocked_json(self):
        data = archive_bytes(); digest = self.write(data)
        script = ROOT / 'scripts/pod_kdp_interior_template_import.py'
        args = [sys.executable, script, '--archive', self.path,
                '--trim-width', '6', '--trim-height', '9',
                '--expected-sha256', digest, '--source-member', MEMBER]
        passed = subprocess.run(args, text=True, capture_output=True, timeout=10)
        self.assertEqual(passed.returncode, 0, passed.stderr)
        self.assertIn('"kind":"kdp-interior-template-source-inspection"', passed.stdout)
        blocked = subprocess.run(args[:-3] + ['0' * 64, '--source-member', MEMBER],
                                 text=True, capture_output=True, timeout=10)
        self.assertEqual(blocked.returncode, 2)
        self.assertIn('"publication_enabled":false', blocked.stdout)


if __name__ == '__main__':
    unittest.main()
