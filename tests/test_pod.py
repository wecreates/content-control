import hashlib
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from pod_asset_generator import generate
from pod_market_intake import ProductParser, products, screen
from pod_vision_qa import spatial_checks, ocr, evaluate, qa_receipt, EDITORIAL_CHECKS
from pod_common import digest, canonical, sign
from pod_original_art import create_art
from pod_book_interior import render_book
from pod_book_package import assemble

class PODTests(unittest.TestCase):
    def test_qa_inspects_the_hashed_bytes_when_originals_change(self):
        import pod_vision_qa as qa
        for kdp in (False, True):
            with self.subTest(kdp=kdp):
                source = {}
                observed = []
                original_open = qa.open_raster
                def remember(manifest, root):
                    source['root'] = root
                    with Image.open(root / 'print.png') as image:
                        source['pixel'] = image.convert('RGB').getpixel((0, 0))
                        source['size'] = image.size
                    source['dpi'] = manifest['dpi']
                def replace_then_open(filename, expected_size=None):
                    if not source.get('replaced'):
                        source['replaced'] = True
                        Image.new('RGB', source['size'], 'black').save(
                            source['root'] / 'print.png', dpi=(source['dpi'], source['dpi']))
                        if kdp:
                            (source['root'] / 'cover.pdf').unlink()
                            (source['root'] / 'interior.pdf').unlink()
                    return original_open(filename, expected_size)
                def inspect_pixels(manifest, image, art, text):
                    observed.append(image.getpixel((0, 0)))
                    return True
                with patch('pod_vision_qa.open_raster', side_effect=replace_then_open), \
                     patch('pod_vision_qa.spatial_checks', side_effect=inspect_pixels):
                    result = self.package_result(remember, kdp=kdp)
                self.assertEqual(result['binary_pass'], 1, result)
                self.assertEqual(observed, [source['pixel']])

    def test_qa_oversized_and_mismatched_rasters_fail_before_ocr(self):
        from test_pod_raster_bounds import png_header
        for filename in ('print.png', 'art-mask.png', 'text-mask.png'):
            for size, reason in (((10001, 10000), 'IMAGE_PIXEL_LIMIT'), ((601, 600), 'IMAGE_SIZE_MISMATCH')):
                with self.subTest(filename=filename, size=size):
                    def mutate(manifest, root):
                        png_header(root / filename, size)
                        manifest['files'][filename] = digest(root / filename)
                    result = self.package_result(mutate)
                    self.assertEqual(result['binary_pass'], 0, result)
                    self.assertIn(reason, result['errors'])
                    self.assertNotIn('text', result['checks'])

    def test_similarity_rejects_oversized_reference_before_optional_model_import(self):
        from test_pod_raster_bounds import png_header
        from pod_vision_qa import similarity
        with tempfile.TemporaryDirectory() as tmp:
            candidate, reference = Path(tmp) / 'candidate.png', Path(tmp) / 'reference.png'
            Image.new('RGB', (2, 2)).save(candidate)
            png_header(reference, (10001, 10000))
            with patch.dict(sys.modules, {'torch': None, 'open_clip': None}):
                with self.assertRaisesRegex(ValueError, '^IMAGE_PIXEL_LIMIT$'):
                    similarity(candidate, reference)

    def package_result(self, mutate, kdp=False, dpi=300, rights_ttl=60000, review_patch=None,
                       editorial_patch=None,editorial_present=True,editorial_evaluators=None):
        """Synthetic signed evidence isolates technical QA; it is not approval."""
        import time
        from pod_common import save_json
        with tempfile.TemporaryDirectory() as tmp, patch.dict(os.environ,{'POD_RIGHTS_KEY':'r'*48,'POD_REVIEW_KEY':'v'*48,'POD_EDITORIAL_KEY':'e'*48}):
            root=Path(tmp)/'package'
            src=Path(tmp)/'source.png';Image.new('RGB',(800,400),'white').save(src)
            template=self.template()
            template.update(dpi=dpi,size_inches=[600/dpi,600/dpi])
            if kdp:
                template.update({'platform':'kdp','size_inches':[12+24*.002252+.25,9.25],
                    'kdp':{'binding':'paperback','ink_type':'black','paper_type':'white',
                           'trim_width_inches':6,'spine_width_inches':24*.002252,'bleed_inches':.125,'page_count':24}})
            m=generate(src,template,[],root)
            if kdp:
                font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
                spec={'platform':'kdp','binding':'paperback','ink_type':'black','paper_type':'white',
                    'interior_type':'text_no_bleed','trim_inches':[6,9],
                    'page_count':24,'margins_inches':dict(inside=.375,outside=.25,top=.25,bottom=.25),
                    'font_sha256':digest(font),'font_size_pt':10,'leading_pt':12}
                m=assemble(root,spec,[{'lines':[f'Fixture page {i+1}']} for i in range(24)],font)
            mutate(m,root)
            m['template_sha256']=hashlib.sha256(canonical(m['template']).encode()).hexdigest()
            m.pop('package_sha256')
            m['package_sha256']=hashlib.sha256(canonical(m).encode()).hexdigest()
            save_json(root/'manifest.json',m)
            now=int(time.time()*1000)
            common={'schema_version':1,'issued_at_ms':now-1,'expires_at_ms':now+60000,'package_sha256':m['package_sha256']}
            rights=sign({**common,'expires_at_ms':now+rights_ttl,'audience':'pod:package-rights','status':'PASS','permanently_unpublished':False},'POD_RIGHTS_KEY')
            review=sign({**common,'audience':'pod:competitive-review','reference_sha256':digest(src),
                'evaluator_id':'test-fixture','winner':'candidate','all_dimensions_noninferior':True,
                'swapped_order_consistent':True,'weighted_margin':1,**(review_patch or {})},'POD_REVIEW_KEY')
            editorial=None
            if kdp and editorial_present:
                editorial=sign({**common,'audience':'pod:editorial-review','interior_sha256':m['files'].get('interior.pdf'),
                    'evaluator_id':'synthetic-editor','verdict':'PASS','checks':{k:True for k in EDITORIAL_CHECKS},
                    **(editorial_patch or {})},'POD_EDITORIAL_KEY')
            # OCR is tested independently; these tests isolate package geometry and binding.
            with patch('pod_vision_qa.ocr',return_value=''):
                return evaluate(root,src,rights,review,['test-fixture'],editorial_envelope=editorial,
                    approved_editorial_evaluators=['synthetic-editor'] if editorial_evaluators is None else editorial_evaluators)

    def test_kdp_qa_rejects_local_cover_damage_despite_rebound_hashes(self):
        from reportlab.pdfgen import canvas as pdfcanvas
        from reportlab.lib.utils import ImageReader
        def damage(manifest,root):
            with Image.open(root/'print.png') as source:
                altered=source.convert('RGB')
            altered.putpixel((300,300),(0,0,0))
            width,height=[v*72/manifest['dpi'] for v in altered.size]
            pdf=pdfcanvas.Canvas(str(root/'cover.pdf'),pagesize=(width,height),invariant=1)
            pdf.drawImage(ImageReader(altered),0,0,width=width,height=height)
            pdf.showPage();pdf.save()
            manifest['files']['cover.pdf']=digest(root/'cover.pdf')
        result=self.package_result(damage,kdp=True)
        self.assertEqual(result['binary_pass'],0,result)
        self.assertIn('COVER_PIXEL_MISMATCH',result['errors'])

    def test_kdp_requires_separate_editorial_review(self):
        result=self.package_result(lambda m,r:None,kdp=True,editorial_present=False)
        self.assertEqual(result['binary_pass'],0,result)
        self.assertIn('EDITORIAL_REVIEW_REQUIRED',result['errors'])

    def test_kdp_editorial_scope_and_each_required_check(self):
        patches=[{'package_sha256':'a'*64},{'interior_sha256':'b'*64},{'evaluator_id':'unapproved'},
                 {'verdict':'FAIL'},{'audience':'pod:competitive-review'},
                 {'expires_at_ms':1}, {'checks':{}}]
        for k in EDITORIAL_CHECKS:
            patches.append({'checks':{**{x:True for x in EDITORIAL_CHECKS},k:1}})
        for change in patches:
            with self.subTest(change=change):
                result=self.package_result(lambda m,r:None,kdp=True,editorial_patch=change)
                self.assertEqual(result['binary_pass'],0,result)
        self.assertEqual(self.package_result(lambda m,r:None,kdp=True,editorial_evaluators=[])['binary_pass'],0)

    def test_kdp_editorial_expiry_caps_receipt(self):
        now=1800000000.0
        with patch('pod_common.time.time',return_value=now):
            result=self.package_result(lambda m,r:None,kdp=True,editorial_patch={'expires_at_ms':int(now*1000)+1000})
            self.assertEqual(result['binary_pass'],1,result)
            self.assertTrue(result['checks']['editorial'])
            self.assertEqual(qa_receipt(result,int(now*1000))['expires_at_ms'],int(now*1000)+1000)

    def test_kdp_editorial_expiry_during_comparison_fails(self):
        from pod_common import verified
        now=1800000000.0
        def delayed_review(envelope,key,audience):
            nonlocal now
            if audience=='pod:competitive-review':
                now+=2
            return verified(envelope,key,audience)
        with patch('pod_common.time.time',side_effect=lambda:now),patch('pod_vision_qa.verified',side_effect=delayed_review):
            result=self.package_result(lambda m,r:None,kdp=True,editorial_patch={'expires_at_ms':int(now*1000)+1000})
            self.assertEqual(result['binary_pass'],0,result)
            self.assertIn('EVIDENCE_EXPIRED',result['errors'])

    def test_unbound_masks_fail_before_ocr(self):
        for filename in ('art-mask.png','text-mask.png'):
            with self.subTest(filename=filename):
                result=self.package_result(lambda m,r:m['files'].pop(filename))
                self.assertEqual(result['binary_pass'],0,result)
                self.assertIn('PACKAGE_FILES_REQUIRED',result['errors'])

    def test_unbound_kdp_cover_and_receipt_fail(self):
        for filename in ('cover.pdf','interior.receipt.json'):
            with self.subTest(filename=filename):
                result=self.package_result(lambda m,r:m['files'].pop(filename),kdp=True)
                self.assertEqual(result['binary_pass'],0,result)
                self.assertIn('PACKAGE_FILES_REQUIRED',result['errors'])

    def test_template_physical_dimensions_override_reported_canvas(self):
        result=self.package_result(lambda m,r:m['template'].update(size_inches=[4,4]))
        self.assertEqual(result['binary_pass'],0,result)
        self.assertFalse(result['checks']['resolution'])

    def test_template_dpi_must_match_png_and_manifest(self):
        for mutation in (
            lambda m,r:m.update(dpi=600),
            lambda m,r:m['template'].update(dpi=600,size_inches=[1,1]),
        ):
            result=self.package_result(mutation)
            self.assertEqual(result['binary_pass'],0,result)
            self.assertFalse(result['checks']['resolution'])

    def test_native_ppi_is_recomputed_not_claimed(self):
        result=self.package_result(lambda m,r:m.update(source_size_px=[40,20],effective_native_ppi=1200))
        self.assertEqual(result['binary_pass'],0,result)
        self.assertFalse(result['checks']['resolution'])

    def test_complete_unchanged_packages_pass_technical_binding(self):
        for kdp,dpi in ((False,300),(True,300),(False,600),(False,1200)):
            result=self.package_result(lambda m,r:None,kdp=kdp,dpi=dpi)
            self.assertEqual(result['binary_pass'],1,result)

    def test_kdp_receipt_file_must_match_manifest_receipt(self):
        from pod_common import save_json
        def change(m,root):
            save_json(root/'interior.receipt.json',{'technical_checks_passed':False})
            m['files']['interior.receipt.json']=digest(root/'interior.receipt.json')
        result=self.package_result(change,kdp=True)
        self.assertEqual(result['binary_pass'],0,result)
        self.assertIn('INTERIOR_INVALID',result['errors'])

    def test_kdp_qa_rechecks_actual_interior_despite_passing_receipt(self):
        import fitz
        from pod_common import save_json
        for fault in ('blank','margin','offpage','invisible','rotated','drawing',
                      'white_text','link','embedded','open_action'):
            def change(m,root):
                target=root/'replacement.pdf'
                with fitz.open() as book:
                    for _ in range(24):
                        page=book.new_page(width=432,height=648)
                        if fault!='blank':
                            point=(3,36) if fault=='margin' else (27,700) if fault=='offpage' else (27,36)
                            page.insert_text(point,'Unreviewed layout',fontsize=8,render_mode=3 if fault=='invisible' else 0,
                                             color=(1,1,1) if fault=='white_text' else (0,0,0))
                        if fault=='rotated':page.set_rotation(90)
                        if fault=='drawing':page.draw_rect(fitz.Rect(0,0,5,5))
                        if fault=='link':page.insert_link({'kind':fitz.LINK_URI,'from':fitz.Rect(20,20,30,30),'uri':'https://example.invalid'})
                    if fault=='embedded':book.embfile_add('fixture.txt',b'fixture')
                    if fault=='open_action':book.xref_set_key(book.pdf_catalog(),'OpenAction','<< /S /JavaScript /JS (void 0;) >>')
                    book.save(target)
                target.replace(root/'interior.pdf')
                # Every hash and synthetic authority agrees; only independent
                # inspection of the PDF can catch these layout defects.
                receipt=m['interior']['receipt']
                receipt['interior_sha256']=digest(root/'interior.pdf')
                save_json(root/'interior.receipt.json',receipt)
                for filename in ('interior.pdf','interior.receipt.json'):
                    m['files'][filename]=digest(root/filename)
            with self.subTest(fault=fault):
                result=self.package_result(change,kdp=True)
                self.assertEqual(result['binary_pass'],0,result)
                self.assertTrue(any(e.startswith('INTERIOR_') for e in result['errors']),result)

    def test_kdp_qa_rechecks_cover_interior_pairing(self):
        from pod_common import save_json
        for trim in ([6.5,9],[6,9.5]):
            def change(m,root):
                # Re-render a valid, correctly receipted interior with a different
                # trim. Page count, hashes and independent layout checks still pass.
                spec=m['interior']['template'];spec['trim_inches']=trim
                target=root/'interior.pdf';target.unlink()
                receipt=render_book(spec,[{'lines':[f'Fixture page {i+1}']} for i in range(24)],
                    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',target)
                m['interior']['receipt']=receipt
                save_json(root/'interior.receipt.json',receipt)
                for filename in ('interior.pdf','interior.receipt.json'):
                    m['files'][filename]=digest(root/filename)
            with self.subTest(trim=trim):
                result=self.package_result(change,kdp=True)
                self.assertEqual(result['binary_pass'],0,result)
                self.assertIn('COVER_INTERIOR_MISMATCH',result['errors'])

    def test_kdp_qa_rejects_rebound_paper_profiles_despite_consistent_hashes(self):
        from pod_common import save_json
        for fault in ('cover_paper','both_papers','missing_binding'):
            def change(m,root):
                spec=m['interior']['template'];cover=m['template']['kdp']
                if fault=='missing_binding':
                    spec.pop('binding');cover.pop('binding')
                else:
                    cover['paper_type']='cream'
                    if fault=='both_papers':spec['paper_type']='cream'
                # The PDF bytes, page count, receipt, package hashes and synthetic
                # approvals still agree. Only independent profile/spine QA fails.
                receipt=m['interior']['receipt']
                receipt['template_sha256']=hashlib.sha256(canonical(spec).encode()).hexdigest()
                save_json(root/'interior.receipt.json',receipt)
                m['files']['interior.receipt.json']=digest(root/'interior.receipt.json')
            with self.subTest(fault=fault):
                result=self.package_result(change,kdp=True)
                self.assertEqual(result['binary_pass'],0,result)
                self.assertIn('COVER_INTERIOR_MISMATCH',result['errors'])

    def test_qa_rejects_unsupported_and_mismatched_platforms(self):
        for platform in ('etsy','zazzle'):
            result=self.package_result(lambda m,r:m.update(platform=platform))
            self.assertEqual(result['binary_pass'],0,result)
            self.assertIn('PLATFORM_BLOCKED',result['errors'])

    def test_resolution_rejects_non_numeric_and_boolean_dimensions(self):
        for mutation in (
            lambda m,r:m['template'].update(size_inches=[True,2]),
            lambda m,r:m.update(dpi=True),
            lambda m,r:m.update(source_size_px=[True,400]),
            lambda m,r:m.update(effective_native_ppi='600'),
        ):
            result=self.package_result(mutation)
            self.assertEqual(result['binary_pass'],0,result)

    def test_boolean_is_not_a_competitive_score(self):
        result=self.package_result(lambda m,r:None,review_patch={'weighted_margin':True})
        self.assertEqual(result['binary_pass'],0,result)
        self.assertFalse(result['checks']['competitive'])

    def test_rights_expiring_during_review_do_not_pass(self):
        from pod_common import verified
        now=1800000000.0
        def delayed_review(envelope,key,audience):
            nonlocal now
            if audience=='pod:competitive-review':
                now+=2
            return verified(envelope,key,audience)
        with patch('pod_common.time.time',side_effect=lambda:now),patch('pod_vision_qa.verified',side_effect=delayed_review):
            result=self.package_result(lambda m,r:None,rights_ttl=1000)
            self.assertEqual(result['binary_pass'],0,result)
            self.assertIn('EVIDENCE_EXPIRED',result['errors'])

    def test_qa_receipt_does_not_extend_evidence_lifetime(self):
        now=1800000000000
        for deadline in (now+1,now+60000,now+1800000):
            report={'binary_pass':1,'verdict':'PASS','production_ready':True,'evidence_expires_at_ms':deadline}
            receipt=qa_receipt(report,now)
            self.assertEqual(receipt['expires_at_ms'],min(deadline,now+900000))
            self.assertEqual(receipt['binary_pass'],1)

    def test_qa_receipt_downgrades_expired_or_missing_evidence(self):
        now=1800000000000
        for deadline in (None,True,'1800000000001',now,now-1):
            report={'binary_pass':1,'verdict':'PASS','production_ready':True,'evidence_expires_at_ms':deadline}
            receipt=qa_receipt(report,now)
            self.assertEqual(receipt['binary_pass'],0)
            self.assertEqual(report['verdict'],'FAIL')
            self.assertFalse(report['production_ready'])
            self.assertIn('EVIDENCE_EXPIRED',receipt['errors'])

    def test_evaluation_exports_earliest_evidence_expiry(self):
        now=1800000000.0
        with patch('pod_common.time.time',return_value=now):
            for rights_ttl,review_ttl in ((1000,60000),(60000,1000)):
                result=self.package_result(lambda m,r:None,rights_ttl=rights_ttl,
                    review_patch={'expires_at_ms':int(now*1000)+review_ttl})
                self.assertEqual(result['binary_pass'],1,result)
                self.assertEqual(result['evidence_expires_at_ms'],int(now*1000)+1000)

    def test_qa_requires_independent_review_without_model_download(self):
        import time
        with tempfile.TemporaryDirectory() as tmp, patch.dict(os.environ,{'POD_RIGHTS_KEY':'r'*48,'POD_REVIEW_KEY':'v'*48}):
            src=Path(tmp)/'source.png';Image.new('RGB',(800,400),'white').save(src)
            m=generate(src,self.template(),[],Path(tmp)/'package')
            now=int(time.time()*1000)
            common={'schema_version':1,'issued_at_ms':now-1,'expires_at_ms':now+60000,
                    'package_sha256':m['package_sha256']}
            rights=sign({**common,'audience':'pod:package-rights','status':'PASS','permanently_unpublished':False},'POD_RIGHTS_KEY')
            review=sign({**common,'audience':'pod:competitive-review','reference_sha256':digest(src),
                         'evaluator_id':'test-fixture','winner':'candidate','all_dimensions_noninferior':True,
                         'swapped_order_consistent':True,'weighted_margin':1},'POD_REVIEW_KEY')
            with patch('pod_vision_qa.similarity',side_effect=AssertionError('must not download')):
                result=evaluate(Path(tmp)/'package',src,rights,review,['test-fixture'])
                self.assertEqual(result['verdict'],'PASS',result)
                self.assertEqual(result['openclip']['status'],'NOT_REQUESTED')
                blocked=evaluate(Path(tmp)/'package',src,rights,review,[])
                self.assertEqual(blocked['verdict'],'FAIL')
                self.assertFalse(blocked['checks']['competitive'])

    def test_combined_kdp_package_and_mismatch(self):
        font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
        spec={'platform':'kdp','interior_type':'text_no_bleed','trim_inches':[2,2],
              'page_count':2,'margins_inches':dict(inside=.25,outside=.25,top=.25,bottom=.25),
              'font_sha256':digest(font),'font_size_pt':10,'leading_pt':12}
        template={'platform':'kdp','dpi':300,'size_inches':[4.35,2.25],
                  'art_box_px':[100,100,300,300],'safe_box_px':[25,25,1200,600],
                  'kdp':{'trim_width_inches':2,'spine_width_inches':.1,'bleed_inches':.125,'page_count':2}}
        # Synthetic geometry is a pipeline fixture, not an approved KDP product.
        with tempfile.TemporaryDirectory() as tmp:
            source=Path(tmp)/'art.png'
            create_art({'concept_id':'fixture','size_px':[600,600],
                        'palette':[[0,0,0,255],[80,90,120,255]]},source)
            before=generate(source,template,[],Path(tmp)/'package')
            with self.assertRaisesRegex(ValueError,'COVER_INTERIOR_MISMATCH'):
                assemble(Path(tmp)/'package',{**spec,'page_count':3},[],font)
            result=assemble(Path(tmp)/'package',spec,[{'lines':['First page']},{'lines':['Second page']}],font)
            self.assertNotEqual(before['package_sha256'],result['package_sha256'])
            self.assertEqual(result['files']['interior.pdf'],digest(Path(tmp)/'package/interior.pdf'))
            self.assertFalse(result['publication_enabled'])
            Path(tmp,'package/print.png').write_bytes(b'corrupt')
            with self.assertRaisesRegex(ValueError,'FILE_HASH_MISMATCH'):
                assemble(Path(tmp)/'package',spec,[],font)

    def test_original_art_repeatable_and_concept_specific(self):
        with tempfile.TemporaryDirectory() as tmp:
            spec={'concept_id':'one','size_px':[600,600],'palette':[[0,0,0,255],[80,90,120,255]]}
            a=create_art(spec,Path(tmp)/'a.png');b=create_art(spec,Path(tmp)/'b.png')
            self.assertEqual(a['source_sha256'],b['source_sha256'])
            spec['concept_id']='two';c=create_art(spec,Path(tmp)/'c.png')
            self.assertNotEqual(a['source_sha256'],c['source_sha256'])
    def test_book_content_and_embedded_font(self):
        import fitz
        font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
        spec={'platform':'kdp','interior_type':'text_no_bleed','trim_inches':[6,9],'page_count':2,
              'margins_inches':{'inside':.75,'outside':.5,'top':.5,'bottom':.5},
              'font_sha256':digest(font),'font_size_pt':12,'leading_pt':16}
        with tempfile.TemporaryDirectory() as tmp:
            target=Path(tmp)/'book.pdf'
            result=render_book(spec,[{'lines':['Original page one.']},{'lines':['Original page two.']}],font,target)
            self.assertTrue(result['technical_checks_passed']);self.assertFalse(result['production_ready'])
            with fitz.open(target) as doc:
                self.assertEqual(len(doc),2)
                self.assertTrue(any(f[1]=='ttf' for f in doc[0].get_fonts()))
    def test_book_overflow_blocks(self):
        font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
        spec={'platform':'kdp','interior_type':'text_no_bleed','trim_inches':[6,9],'page_count':1,
              'margins_inches':{'inside':.75,'outside':.5,'top':.5,'bottom':.5},
              'font_sha256':digest(font),'font_size_pt':12,'leading_pt':16}
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaisesRegex(ValueError,'TEXT_OVERFLOW'):
                render_book(spec,[{'lines':['X'*1000]}],font,Path(tmp)/'book.pdf')
    def template(self):
        return {'platform':'redbubble','dpi':300,'size_inches':[2,2],
                'art_box_px':[100,100,400,400],'safe_box_px':[50,50,500,500],
                'background_rgba':[255,255,255,255]}
    def test_no_warp_and_native_ppi(self):
        with tempfile.TemporaryDirectory() as tmp:
            src=Path(tmp)/'source.png';Image.new('RGBA',(800,400),(20,50,90,255)).save(src)
            m=generate(src,self.template(),[],Path(tmp)/'out')
            self.assertEqual(m['placed_size_px'],[400,200]);self.assertGreaterEqual(m['effective_native_ppi'],300)
            with Image.open(Path(tmp)/'out/print.png') as image, Image.open(Path(tmp)/'out/art-mask.png') as art, Image.open(Path(tmp)/'out/text-mask.png') as text:
                self.assertTrue(spatial_checks(m,image,art,text))
    def test_upscale_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            src=Path(tmp)/'source.png';Image.new('RGB',(20,20)).save(src)
            with self.assertRaisesRegex(ValueError,'NATIVE_RESOLUTION'):
                generate(src,self.template(),[],Path(tmp)/'out')
    def test_kdp_pdf_dimensions(self):
        import fitz
        with tempfile.TemporaryDirectory() as tmp:
            src=Path(tmp)/'source.png';Image.new('RGB',(800,400),'blue').save(src)
            t=self.template();t.update({'platform':'kdp','size_inches':[1.75,2],
                'art_box_px':[100,100,300,300],'safe_box_px':[25,25,475,550],
                'kdp':{'trim_width_inches':.75,'spine_width_inches':.1,'bleed_inches':.075,'page_count':100}})
            m=generate(src,t,[],Path(tmp)/'out')
            with fitz.open(Path(tmp)/'out/cover.pdf') as pdf:
                self.assertEqual(len(pdf),1)
                self.assertAlmostEqual(pdf[0].rect.width,1.75*72,places=2)
                self.assertAlmostEqual(pdf[0].rect.height,2*72,places=2)
    def test_kdp_wrong_spine_fails(self):
        t=self.template();t.update({'platform':'kdp','kdp':{'trim_width_inches':1,'spine_width_inches':.2,'bleed_inches':.125,'page_count':100}})
        with self.assertRaisesRegex(ValueError,'KDP_TEMPLATE_INVALID'):
            generate('unused',t,[],'unused')
    def test_etsy_fails(self):
        t=self.template();t['platform']='etsy'
        with self.assertRaisesRegex(ValueError,'PLATFORM_BLOCKED'):
            generate('unused',t,[],'unused')
    def test_unsafe_art_fails(self):
        m={'template':{'safe_box_px':[10,10,80,80]},'source_size_px':[100,100],'placed_size_px':[100,100]}
        self.assertFalse(spatial_checks(m,Image.new('RGB',(100,100)),Image.new('L',(100,100),255),Image.new('L',(100,100),0)))
    def test_text_art_collision_fails(self):
        m={'template':{'safe_box_px':[0,0,100,100]},'source_size_px':[100,100],'placed_size_px':[100,100]}
        self.assertFalse(spatial_checks(m,Image.new('RGB',(100,100)),Image.new('L',(100,100),255),Image.new('L',(100,100),255)))
    def test_registry_missing_country_fails(self):
        self.assertEqual(screen('Original','US','apparel',{},{} )[0],'UNKNOWN')
    def test_related_categories_required(self):
        r={'countries':['US'],'categories':['apparel'],'coverage_verified':True}
        self.assertEqual(screen('Original','US','apparel',r,{})[0],'UNKNOWN')
    def test_word_flag(self):
        r={'countries':['US'],'categories':['apparel'],'coverage_verified':True,'records':[]}
        p={'related_categories_checked':True,'non_trademark_rights_verified':True,'blocked_whole_words':['brand']}
        self.assertEqual(screen('BRAND shirt','US','apparel',r,p)[0],'FAIL')
    def test_mark_flag(self):
        r={'countries':['US'],'categories':['apparel'],'coverage_verified':True,
           'records':[{'word_mark':'Example','countries':['US'],'related_categories':['apparel']}]}
        p={'related_categories_checked':True,'non_trademark_rights_verified':True}
        self.assertEqual(screen('Example shirt','US','apparel',r,p)[0],'UNKNOWN')
    def test_product_parser(self):
        p=ProductParser();p.feed('<script type="application/ld+json">{"@type":"Product","name":"Original"}</script>')
        self.assertEqual(list(products(p.records))[0]['name'],'Original')
    def test_real_ocr(self):
        image=Image.new('RGB',(600,120),'white')
        font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',48)
        ImageDraw.Draw(image).text((20,20),'PRINT READY',font=font,fill='black')
        self.assertEqual(ocr(image),'PRINT READY')
    def test_corrupt_manifest_is_binary_fail(self):
        with tempfile.TemporaryDirectory() as tmp:
            Path(tmp,'manifest.json').write_text('{"package_sha256":"wrong"}')
            result=evaluate(tmp,'unused',{}, {}, [])
            self.assertEqual(result['binary_pass'],0)
            self.assertFalse(result['production_ready'])

if __name__=='__main__':
    unittest.main()
