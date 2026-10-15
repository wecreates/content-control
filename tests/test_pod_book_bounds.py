import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import fitz

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from pod_book_interior import render_book
from pod_common import digest
from pod_interior_preflight import inspect_interior, inspect_pairing
from pod_cover_preflight import inspect_cover
from PIL import Image, ImageChops, ImageStat
from reportlab.pdfgen import canvas as pdfcanvas
from reportlab.lib.utils import ImageReader

class CoverPreflightTests(unittest.TestCase):
    def write_cover(self, path, image, dpi=300, shift=0):
        width,height=[v*72/dpi for v in image.size]
        pdf=pdfcanvas.Canvas(str(path),pagesize=(width,height),invariant=1)
        pdf.drawImage(ImageReader(image),shift*72/dpi,0,width=width,height=height)
        pdf.showPage();pdf.save()

    def test_lossless_cover_passes_at_supported_dpi_and_fractional_point_sizes(self):
        import numpy as np
        with tempfile.TemporaryDirectory() as d:
            for dpi in (300,600,1200):
                image=Image.fromarray(np.random.default_rng(1).integers(0,256,(311,607,3),dtype=np.uint8))
                path=Path(d)/'cover.pdf';self.write_cover(path,image,dpi)
                self.assertTrue(inspect_cover(path,image,dpi))

    def test_single_changed_pixel_fails_even_when_old_mean_error_passes(self):
        original=Image.new('RGB',(600,900),'white')
        with tempfile.TemporaryDirectory() as d:
            for rgb in ((254,255,255),(255,254,255),(255,255,254),(0,0,0)):
                changed=original.copy();changed.putpixel((300,400),rgb)
                self.assertLess(sum(ImageStat.Stat(ImageChops.difference(original,changed)).mean)/3,1)
                path=Path(d)/'cover.pdf';self.write_cover(path,changed)
                with self.subTest(rgb=rgb),self.assertRaisesRegex(ValueError,'COVER_PIXEL_MISMATCH'):
                    inspect_cover(path,original,300)

    def test_missing_detail_and_one_pixel_shift_fail(self):
        original=Image.new('RGB',(600,900),'white')
        original.paste((0,0,0),(300,400,310,410))
        with tempfile.TemporaryDirectory() as d:
            for changed,shift in ((Image.new('RGB',original.size,'white'),0),(original,1)):
                path=Path(d)/'cover.pdf';self.write_cover(path,changed,shift=shift)
                with self.subTest(shift=shift),self.assertRaisesRegex(ValueError,'COVER_PIXEL_MISMATCH'):
                    inspect_cover(path,original,300)

    def test_rotation_crop_and_oversized_page_fail_before_rasterization(self):
        image=Image.new('RGB',(600,900),'white')
        with tempfile.TemporaryDirectory() as d:
            source=Path(d)/'source.pdf';self.write_cover(source,image)
            for edit in (lambda p:p.set_rotation(180),lambda p:p.set_cropbox(fitz.Rect(0,0,140,216)),
                         lambda p:p.set_mediabox(fitz.Rect(0,0,10000,10000))):
                target=Path(d)/'changed.pdf'
                with fitz.open(source) as doc:
                    edit(doc[0]);doc.save(target)
                with patch.object(fitz.Page,'get_pixmap',side_effect=AssertionError('must not rasterize')):
                    with self.assertRaisesRegex(ValueError,'COVER_PAGE_BOX_INVALID'):
                        inspect_cover(target,image,300)

    def test_interactive_content_is_rejected_even_if_pixels_are_unchanged(self):
        image=Image.new('RGB',(600,900),'white')
        with tempfile.TemporaryDirectory() as d:
            source=Path(d)/'source.pdf';self.write_cover(source,image)
            for edit in (lambda p:p.insert_link({'kind':fitz.LINK_URI,'from':fitz.Rect(20,20,30,30),'uri':'https://example.invalid'}),
                         lambda p:p.add_text_annot((20,20),'fixture')):
                target=Path(d)/'changed.pdf'
                with fitz.open(source) as doc:
                    edit(doc[0]);doc.save(target)
                with self.assertRaisesRegex(ValueError,'COVER_CONTENT_UNSUPPORTED'):
                    inspect_cover(target,image,300)

    def test_invalid_dpi_and_page_count_fail(self):
        image=Image.new('RGB',(600,900),'white')
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)/'cover.pdf';self.write_cover(path,image)
            for dpi in (True,299,1201,300.0,float('nan')):
                with self.subTest(dpi=dpi),self.assertRaisesRegex(ValueError,'COVER_SPEC_INVALID'):
                    inspect_cover(path,image,dpi)
            target=Path(d)/'two.pdf'
            with fitz.open(path) as doc:
                doc.new_page(width=144,height=216);doc.save(target)
            with self.assertRaisesRegex(ValueError,'COVER_INVALID'):
                inspect_cover(target,image,300)

class BookBoundsTests(unittest.TestCase):
    def test_independent_preflight_rejects_white_gray_and_colored_text(self):
        for color in ((1,1,1),(.9,.9,.9),(.2,.2,.2),(1,0,0)):
            with self.subTest(color=color),self.assertRaisesRegex(ValueError,'INTERIOR_TEXT_COLOR_UNSUPPORTED'):
                self.inspect_fixture(lambda page:page.insert_text((27,36),'gyp',color=color))

    def test_cover_pairing_dimensions_and_strict_numeric_values(self):
        import copy
        _,spec=self.spec()
        cover={'platform':'kdp','size_inches':[4.35,2.25],
               'kdp':{'trim_width_inches':2,'spine_width_inches':.1,'bleed_inches':.125,'page_count':1}}
        self.assertTrue(inspect_pairing(spec,cover))
        changes=[lambda c:c.update(platform='redbubble'),lambda c:c.update(size_inches=[4.4,2.25]),
                 lambda c:c.update(size_inches=[4.35,2.5]),lambda c:c['kdp'].update(trim_width_inches=1.5),
                 lambda c:c['kdp'].update(page_count=2),lambda c:c['kdp'].update(page_count=True)]
        changes += [lambda c,key=key,v=v:c['kdp'].update({key:v})
                    for key in ('trim_width_inches','spine_width_inches','bleed_inches')
                    for v in (True,float('nan'),float('inf'),-1,'0.1')]
        for change in changes:
            candidate=copy.deepcopy(cover);change(candidate)
            with self.subTest(candidate=candidate),self.assertRaisesRegex(ValueError,'COVER_INTERIOR_MISMATCH'):
                inspect_pairing(spec,candidate)

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

class StaticPDFPolicyTests(unittest.TestCase):
    def check_mutation(self, edit=None, save_options=None, expected='CONTENT_UNSUPPORTED'):
        # Both actual delivered formats use the same document/page policy.
        with tempfile.TemporaryDirectory() as d:
            for kind in ('INTERIOR','COVER'):
                source=Path(d)/(kind+'-source.pdf');target=Path(d)/(kind+'-changed.pdf')
                if kind=='INTERIOR':
                    font,spec=BookBoundsTests().spec()
                    render_book(spec,[{'lines':['gyp']}],font,source)
                    inspect=lambda p:inspect_interior(p,spec)
                else:
                    image=Image.new('RGB',(600,900),'white')
                    CoverPreflightTests().write_cover(source,image)
                    inspect=lambda p:inspect_cover(p,image,300)
                self.assertTrue(inspect(source))
                with fitz.open(source) as doc:
                    if edit:edit(doc)
                    doc.save(target,**(save_options or {}))
                with self.subTest(kind=kind),self.assertRaisesRegex(ValueError,kind+'_'+expected):
                    inspect(target)

    def test_embedded_files_and_links_rejected_for_both_formats(self):
        for edit in (lambda doc:doc.embfile_add('fixture.txt',b'fixture'),
                     lambda doc:doc[0].insert_link({'kind':fitz.LINK_URI,
                         'from':fitz.Rect(20,20,30,30),'uri':'https://example.invalid'})):
            self.check_mutation(edit)

    def test_catalog_behavior_and_optional_content_rejected(self):
        fixtures={'OpenAction':'<< /S /JavaScript /JS (void 0;) >>',
                  'AA':'<< /WC << /S /JavaScript /JS (void 0;) >> >>',
                  'Names':'<< /JavaScript << /Names [(fixture) << /S /JavaScript /JS (void 0;) >>] >> >>',
                  'AcroForm':'<< /Fields [] >>','OCProperties':'<< /OCGs [] >>',
                  'Collection':'<< /Type /Collection /View /D >>','AF':'[]','Outlines':'<< /Type /Outlines /Count 0 >>'}
        for key,value in fixtures.items():
            with self.subTest(key=key):
                self.check_mutation(lambda doc:doc.xref_set_key(doc.pdf_catalog(),key,value))

    def test_indirect_and_escaped_catalog_action_rejected(self):
        def edit(doc):
            action=doc.get_new_xref()
            doc.update_object(action,'<< /S /JavaScript /JS (void 0;) >>')
            catalog=doc.pdf_catalog()
            value=doc.xref_object(catalog).rstrip()
            doc.update_object(catalog,value[:-2]+f' /Open#41ction {action} 0 R >>')
        self.check_mutation(edit)

    def test_page_actions_and_unrecognized_annotations_rejected(self):
        for key,value in (('AA','<< /O << /S /JavaScript /JS (void 0;) >> >>'),
                          ('AF','[]'),('PresSteps','<< >>'),
                          ('Annots','[<< /Type /Annot /Subtype /Unknown /Rect [20 20 30 30] >>]')):
            with self.subTest(key=key):
                self.check_mutation(lambda doc:doc.xref_set_key(doc[0].xref,key,value))

    def test_encrypted_pdf_rejected_even_without_user_password(self):
        for user_password in ('','fixture-user'):
            self.check_mutation(save_options={'encryption':fitz.PDF_ENCRYPT_AES_256,
                'owner_pw':'fixture-owner','user_pw':user_password},expected='INVALID')

    def test_literal_action_names_in_metadata_are_not_pdf_actions(self):
        with tempfile.TemporaryDirectory() as d:
            font,spec=BookBoundsTests().spec();source=Path(d)/'source.pdf';target=Path(d)/'result.pdf'
            render_book(spec,[{'lines':['gyp']}],font,source)
            with fitz.open(source) as doc:
                doc.set_metadata({'subject':'/OpenAction /JavaScript /Annots'});doc.save(target)
            self.assertTrue(inspect_interior(target,spec))


if __name__=='__main__':
    unittest.main()
