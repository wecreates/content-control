import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import fitz

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from pod_book_interior import render_book
from pod_common import digest
from pod_interior_preflight import inspect_interior

class BookBoundsTests(unittest.TestCase):
    def spec(self):
        font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
        return font,{'platform':'kdp','interior_type':'text_no_bleed','trim_inches':[2,2],
            'page_count':1,'margins_inches':dict(inside=.25,outside=.25,top=.25,bottom=.375),
            'font_sha256':digest(font),'font_size_pt':12,'leading_pt':14.5}

    def test_descenders_cannot_cross_bottom_margin(self):
        font,spec=self.spec()
        with tempfile.TemporaryDirectory() as d:
            # Final baseline is exactly 27pt: old checks passed while actual
            # glyph bounds extended 2.88pt into the bottom margin.
            with self.assertRaisesRegex(ValueError,'TEXT_OVERFLOW'):
                render_book(spec,[{'lines':['gyp']*7}],font,Path(d)/'book.pdf')

    def test_actual_pdf_bounds_are_checked_independently(self):
        font,spec=self.spec()
        with tempfile.TemporaryDirectory() as d,patch('pod_book_interior.pdfmetrics.getAscentDescent',return_value=(0,0)):
            with self.assertRaisesRegex(ValueError,'PDF_TEXT_BOUNDS_FAILED'):
                render_book(spec,[{'lines':['gyp']*7}],font,Path(d)/'book.pdf')

    def test_valid_descenders_and_mirrored_margins_pass(self):
        font,spec=self.spec();spec['page_count']=2
        spec['margins_inches'].update(inside=.375,outside=.25)
        with tempfile.TemporaryDirectory() as d:
            target=Path(d)/'book.pdf'
            receipt=render_book(spec,[{'lines':['gyp']*6}]*2,font,target)
            self.assertTrue(receipt['technical_checks_passed'])
            self.assertFalse(receipt['production_ready'])
            self.assertEqual(receipt['editorial_review'],'UNASSESSED')
            self.assertTrue(inspect_interior(target,spec))
            with fitz.open(target) as pdf:
                for i,page in enumerate(pdf):
                    spans=[s for b in page.get_text('dict')['blocks'] for l in b.get('lines',[]) for s in l['spans']]
                    self.assertAlmostEqual(min(s['bbox'][0] for s in spans),27 if i==0 else 18,places=2)
                    self.assertLessEqual(max(s['bbox'][3] for s in spans),117)

    def inspect_fixture(self, edit, change_spec=None):
        _,spec=self.spec()
        if change_spec:
            change_spec(spec)
        with tempfile.TemporaryDirectory() as d:
            target=Path(d)/'book.pdf'
            with fitz.open() as book:
                page=book.new_page(width=144,height=144)
                edit(page)
                book.save(target)
            return inspect_interior(target,spec)

    def test_independent_preflight_rejects_margin_and_offpage_text(self):
        for point in ((3,36),(110,36),(27,8),(27,125),(27,170)):
            with self.subTest(point=point),self.assertRaisesRegex(ValueError,'INTERIOR_(TEXT_BOUNDS_FAILED|TEXT_REQUIRED)'):
                self.inspect_fixture(lambda page:page.insert_text(point,'gyp',fontsize=12))

    def test_independent_preflight_rejects_blank_and_invisible_pages(self):
        with self.assertRaisesRegex(ValueError,'INTERIOR_TEXT_REQUIRED'):
            self.inspect_fixture(lambda page:None)
        for mode in (1,2,3):
            with self.subTest(mode=mode),self.assertRaisesRegex(ValueError,'INTERIOR_TEXT_NOT_VISIBLE'):
                self.inspect_fixture(lambda page:page.insert_text((27,36),'gyp',render_mode=mode))

    def test_independent_preflight_rejects_invalid_spec(self):
        mutations=[lambda s:s.update(page_count=True),lambda s:s.update(trim_inches=[True,2]),
                   lambda s:s.update(interior_type='image_bleed')]
        mutations += [lambda s,v=v:s['margins_inches'].update(top=v) for v in (True,0,-1,float('nan'),float('inf'))]
        for change in mutations:
            with self.subTest(change=change),self.assertRaises(ValueError):
                self.inspect_fixture(lambda page:page.insert_text((27,36),'gyp'),change)

    def test_independent_preflight_rejects_rotation_and_crop(self):
        def rotate(page):
            page.insert_text((27,36),'gyp');page.set_rotation(90)
        def crop(page):
            page.insert_text((27,36),'gyp');page.set_cropbox(fitz.Rect(0,0,140,144))
        for edit in (rotate,crop):
            with self.subTest(edit=edit),self.assertRaisesRegex(ValueError,'INTERIOR_PAGE_BOX_INVALID'):
                self.inspect_fixture(edit)

    def test_independent_preflight_rejects_unsupported_graphics(self):
        def edit(page):
            page.insert_text((27,36),'gyp')
            page.draw_rect(fitz.Rect(0,0,5,5))
        with self.assertRaisesRegex(ValueError,'INTERIOR_CONTENT_UNSUPPORTED'):
            self.inspect_fixture(edit)

    def test_independent_preflight_detects_wrong_even_page_gutter(self):
        _,spec=self.spec();spec['page_count']=2
        spec['margins_inches'].update(inside=.5,outside=.25)
        with tempfile.TemporaryDirectory() as d:
            target=Path(d)/'book.pdf'
            with fitz.open() as book:
                book.new_page(width=144,height=144).insert_text((36,36),'gyp')
                book.new_page(width=144,height=144).insert_text((110,36),'gyp')
                book.save(target)
            with self.assertRaisesRegex(ValueError,'INTERIOR_TEXT_BOUNDS_FAILED'):
                inspect_interior(target,spec)

if __name__=='__main__':
    unittest.main()
