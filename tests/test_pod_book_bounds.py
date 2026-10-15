import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import fitz

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from pod_book_interior import render_book
from pod_common import digest

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
            with fitz.open(target) as pdf:
                for i,page in enumerate(pdf):
                    spans=[s for b in page.get_text('dict')['blocks'] for l in b.get('lines',[]) for s in l['spans']]
                    self.assertAlmostEqual(min(s['bbox'][0] for s in spans),27 if i==0 else 18,places=2)
                    self.assertLessEqual(max(s['bbox'][3] for s in spans),117)

if __name__=='__main__':
    unittest.main()
