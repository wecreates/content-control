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
                       editorial_patch=None,editorial_present=True,editorial_evaluators=None,target_country='US',
                       template_inputs=True,template_ttl=60000,source_inputs=True,source_ttl=60000,
                       text_layers=None,ocr_text=None,manuscript_inputs=True,font_inputs=True,
                       font_rights_inputs=True,font_rights_patch=None,book_details_inputs=True,
                       book_details_patch=None,interior_spec_patch=None,rights_patch=None):
        """Synthetic signed evidence isolates technical QA; it is not approval."""
        import time
        from pod_common import save_json
        with tempfile.TemporaryDirectory() as tmp, patch.dict(os.environ,{'POD_RIGHTS_KEY':'r'*48,'POD_REVIEW_KEY':'v'*48,'POD_EDITORIAL_KEY':'e'*48,'POD_TEMPLATE_KEY':'t'*48}):
            root=Path(tmp)/'package'
            src=Path(tmp)/'source.png';Image.new('RGB',(800,400),'white').save(src)
            template=self.template()
            template.update(dpi=dpi,size_inches=[600/dpi,600/dpi])
            font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
            render_details={'schema_version':13,'title':'Fixture Book','subtitle':None,
                'author_name':'Fixture Author','language':'en','description':'A practical fixture description.',
                'keywords':['fixture guide'],'primary_marketplace':'amazon.com',
                'list_price':{'marketplace':'amazon.com','currency':'USD','amount_minor':2000},
                'categories':['Nonfiction > Reference'],
                'publishing_rights':'copyright_owner',
                'distribution_rights':{'scope':'individual','territories':['US']},'publication_date':None,
                'release_plan':{'mode':'release_now','date':None},
                'expanded_distribution':False,
                'isbn_source':'kdp_free','isbn':None,
                'imprint':None,'title_page':1,'edition':None,'series':None,
                'contributors':[],
                'low_content':False,
                'primary_audience':{'sexually_explicit':False,'reading_age':None},
                'cover_finish':'matte',
                'ai_generated':{'text':False,'images':False,'translations':False}}
            book_details={**render_details,**(book_details_patch or {})}
            layers=list(text_layers or [])
            if kdp:
                template.update({'platform':'kdp','safe_box_px':[1950,75,1500,2500],
                    'art_box_px':[2100,800,800,400],'size_inches':[12+24*.002252+.25,9.25],
                    'kdp':{'binding':'paperback','ink_type':'black','paper_type':'white',
                           'trim_width_inches':6,'spine_width_inches':24*.002252,'bleed_inches':.125,'page_count':24,
                           'reading_direction':'left_to_right','locale':'en_US','barcode_mode':'amazon_placed'}})
                for text,position in ((render_details['title'],[2100,300]),
                                      (render_details['author_name'],[2100,450])):
                    if not any(layer.get('text')==text for layer in layers):
                        layers.append(dict(font_path=font,font_sha256=digest(font),font_size_px=32,
                            position_px=position,text=text,rgba=[0,0,0,255]))
            m=generate(src,template,layers,root)
            interior_font=None
            book_details_path=None
            if kdp:
                interior_font=font
                spec={'platform':'kdp','binding':'paperback','ink_type':'black','paper_type':'white',
                    'interior_type':'text_no_bleed','trim_inches':[6,9],
                    'page_count':24,'margins_inches':dict(inside=.375,outside=.25,top=.25,bottom=.25),
                    'font_sha256':digest(font),'font_size_pt':10,'leading_pt':12}
                spec.update(interior_spec_patch or {})
                original_pages=[{'lines':[render_details['title'],render_details['author_name']]}]+[
                    {'lines':[f'Fixture page {i+1}']} for i in range(1,24)]
                manuscript=Path(tmp)/'manuscript.json';save_json(manuscript,original_pages)
                if book_details_inputs:
                    book_details_path=Path(tmp)/'book-details.json';save_json(book_details_path,book_details)
                m=assemble(root,spec,original_pages,font)
            mutate(m,root)
            m['template_sha256']=hashlib.sha256(canonical(m['template']).encode()).hexdigest()
            m.pop('package_sha256')
            m['package_sha256']=hashlib.sha256(canonical(m).encode()).hexdigest()
            save_json(root/'manifest.json',m)
            now=int(time.time()*1000)
            common={'schema_version':1,'issued_at_ms':now-1,'expires_at_ms':now+60000,'package_sha256':m['package_sha256']}
            regional_rights={
                'country':'US','territories':['US'],'format':'paperback',
                'publishing_basis':'copyright_owner',
                'categories':book_details.get('categories'),
                'commercial_print_on_demand':True,'original_work':True,
                'rights_holder_verified':True,'revoked':False,
                'authority_event_id':'synthetic-regional-rights',
                'source_evidence_ids':['synthetic-authorship-record'],
                'evidence_sha256':'c'*64}
            rights=sign({**common,'expires_at_ms':now+rights_ttl,
                'audience':'pod:package-rights','status':'PASS',
                'permanently_unpublished':False,'regional_rights':regional_rights,
                **(rights_patch or {})},'POD_RIGHTS_KEY')
            review=sign({**common,'audience':'pod:competitive-review','reference_sha256':digest(src),
                'evaluator_id':'test-fixture','winner':'candidate','all_dimensions_noninferior':True,
                'swapped_order_consistent':True,'weighted_margin':1,**(review_patch or {})},'POD_REVIEW_KEY')
            editorial=None
            font_rights=None
            font_license=None
            if kdp and editorial_present:
                editorial=sign({**common,'audience':'pod:editorial-review','interior_sha256':m['files'].get('interior.pdf'),
                    'manuscript_sha256':hashlib.sha256(canonical(original_pages).encode()).hexdigest(),
                    'evaluator_id':'synthetic-editor','verdict':'PASS','checks':{k:True for k in EDITORIAL_CHECKS},
                    **(editorial_patch or {})},'POD_EDITORIAL_KEY')
            if kdp and font_rights_inputs:
                font_license=Path(tmp)/'font-license.txt'
                font_license.write_bytes(b'synthetic license evidence; not legal approval')
                font_rights=sign({**common,'audience':'pod:font-rights','status':'PASS',
                    'font_sha256':spec['font_sha256'],'license_sha256':digest(font_license),
                    'country':'US','product':'fixture-book','commercial_use':True,
                    'print_on_demand':True,'font_embedding':True,'revoked':False,
                    'license_id':'synthetic-license','licensor':'synthetic-authority',
                    **(font_rights_patch or {})},'POD_RIGHTS_KEY')
            original_templates=None
            source_evidence=None
            if source_inputs:
                asset_rights_path=Path(tmp)/'asset-rights.json'
                text_layers_path=Path(tmp)/'text-layers.json';save_json(text_layers_path,layers)
                save_json(asset_rights_path,sign({**common,'expires_at_ms':now+source_ttl,
                    'audience':'pod:asset-rights','status':'PASS','source_sha256':digest(src),
                    'text_layers_sha256':hashlib.sha256(canonical(layers).encode()).hexdigest()},'POD_RIGHTS_KEY'))
                source_evidence={'source':src,'rights':asset_rights_path,'text_layers':text_layers_path}
            if kdp and template_inputs:
                from datetime import datetime,timezone
                from test_pod_kdp_interior_template_import import archive_bytes as interior_archive_bytes, MEMBER
                common_template={**common,'expires_at_ms':now+template_ttl,'product':'fixture-book','country':'US',
                    'official_source_verified':True,'source_url':'https://example.invalid/synthetic-template-authority',
                    'source_sha256':'27915e7cfe7b7eb14b17044e996a8152440836f26e562130ea85a7b61a9ab6ac',
                    'observed_at':datetime.fromtimestamp(now/1000,timezone.utc).isoformat()}
                interior_source=Path(tmp)/'interior-template-source.zip'
                interior_source.write_bytes(interior_archive_bytes())
                interior_template={**common_template,'source_sha256':digest(interior_source),
                    'source_member':MEMBER}
                cover_path=Path(tmp)/'cover-template.json';interior_path=Path(tmp)/'interior-template.json'
                save_json(cover_path,sign({**common_template,'audience':'pod:template','template':m['template']},'POD_TEMPLATE_KEY'))
                save_json(interior_path,sign({**interior_template,'audience':'pod:interior-template','template':m['interior']['template']},'POD_TEMPLATE_KEY'))
                original_templates={'cover':cover_path,'interior':interior_path,
                    'source':Path(__file__).resolve().parents[1]/'integrations/pod/templates/kdp/2026-10-20/paperback-6x9-24-bw-white-en_US.zip',
                    'interiorSource':interior_source}
            # OCR is tested independently; return each exact generated layer,
            # followed by the full-art reading, to isolate package bindings.
            readings=[layer['text'] for layer in m['expected_text']]
            intended='\n'.join(readings)
            values=iter([*readings, intended if ocr_text is None else ocr_text])
            with patch('pod_vision_qa.ocr',side_effect=lambda *args,**kwargs:next(values)):
                return evaluate(root,src,rights,review,['test-fixture'],editorial_envelope=editorial,
                    approved_editorial_evaluators=['synthetic-editor'] if editorial_evaluators is None else editorial_evaluators,
                    target_country=target_country,template_evidence=original_templates,target_product='fixture-book',
                    source_evidence=source_evidence,manuscript=manuscript if kdp and manuscript_inputs else None,
                    interior_font=interior_font if kdp and font_inputs else None,
                    font_rights_envelope=font_rights,font_license=font_license,
                    book_details=book_details_path)

    def test_kdp_cover_and_interior_print_options_must_match(self):
        for patch_value in ({'binding':'hardcover'},{'ink_type':'premium_color'},
                            {'paper_type':'cream'}):
            with self.subTest(interior=patch_value):
                with self.assertRaisesRegex(ValueError,'COVER_INTERIOR_MISMATCH'):
                    self.package_result(lambda m,r:None,kdp=True,
                        interior_spec_patch=patch_value)

    def test_kdp_requires_book_details_matching_front_cover_and_title_page(self):
        missing=self.package_result(lambda m,r:None,kdp=True,book_details_inputs=False)
        self.assertEqual(missing['binary_pass'],0,missing)
        self.assertIn('KDP_BOOK_DETAILS_REQUIRED',missing['errors'])
        valid=self.package_result(lambda m,r:None,kdp=True)
        self.assertEqual(valid['binary_pass'],1,valid)
        self.assertTrue(valid['checks']['book_details'])
        self.assertEqual(len(valid['book_details_sha256']),64)
        for patch_value in ({'title':'Other Title'},{'author_name':'Other Author'},
                            {'language':'fr'},{'title_page':3}):
            with self.subTest(details=patch_value):
                failed=self.package_result(lambda m,r:None,kdp=True,
                    book_details_patch=patch_value)
                self.assertEqual(failed['binary_pass'],0,failed)
                self.assertTrue(any(code in failed['errors'] for code in
                    ('KDP_BOOK_DETAILS_INVALID','KDP_BOOK_DETAILS_MISMATCH')))

    def test_kdp_book_details_reject_template_placeholder(self):
        from pod_common import save_json
        from pod_interior_preflight import inspect_book_details
        with tempfile.TemporaryDirectory() as tmp:
            details={'schema_version':13,'title':'Fixture Book','subtitle':None,
                'author_name':'Fixture Author','language':'en','description':'A practical fixture description.',
                'keywords':['fixture guide'],'primary_marketplace':'amazon.com',
                'list_price':{'marketplace':'amazon.com','currency':'USD','amount_minor':2000},
                'categories':['Nonfiction > Reference'],
                'publishing_rights':'copyright_owner',
                'distribution_rights':{'scope':'individual','territories':['US']},'publication_date':None,
                'release_plan':{'mode':'release_now','date':None},
                'expanded_distribution':False,
                'isbn_source':'kdp_free','isbn':None,
                'imprint':None,'title_page':1,'edition':None,'series':None,
                'contributors':[],
                'low_content':False,
                'primary_audience':{'sexually_explicit':False,'reading_age':None},
                'cover_finish':'matte',
                'ai_generated':{'text':False,'images':False,'translations':False}}
            detail_path=Path(tmp)/'details.json';save_json(detail_path,details)
            pages=[{'lines':['Fixture Book','Fixture Author']},{'lines':['Type here']}]
            manuscript=Path(tmp)/'pages.json';save_json(manuscript,pages)
            manifest={'platform':'kdp','expected_text':[
                {'text':'Fixture Book','box_px':[2100,300,2400,350]},
                {'text':'Fixture Author','box_px':[2100,450,2400,500]}],
                'template':{'platform':'kdp','dpi':300,'size_inches':[12.304048,9.25],
                    'kdp':{'locale':'en_US','reading_direction':'left_to_right',
                           'trim_width_inches':6,'spine_width_inches':.054048,
                           'bleed_inches':.125}}}
            with self.assertRaisesRegex(ValueError,'KDP_TEMPLATE_PLACEHOLDER'):
                inspect_book_details(detail_path,manifest,manuscript)

    def test_kdp_book_details_require_distinct_cover_fields(self):
        from pod_common import save_json
        from pod_interior_preflight import inspect_book_details
        with tempfile.TemporaryDirectory() as tmp:
            details={'schema_version':13,'title':'Same','subtitle':None,
                'author_name':'Same','language':'en','description':'A practical fixture description.',
                'keywords':['fixture guide'],'primary_marketplace':'amazon.com',
                'list_price':{'marketplace':'amazon.com','currency':'USD','amount_minor':2000},
                'categories':['Nonfiction > Reference'],
                'publishing_rights':'copyright_owner',
                'distribution_rights':{'scope':'individual','territories':['US']},'publication_date':None,
                'release_plan':{'mode':'release_now','date':None},
                'expanded_distribution':False,
                'isbn_source':'kdp_free','isbn':None,
                'imprint':None,'title_page':1,'edition':None,'series':None,
                'contributors':[],
                'low_content':False,
                'primary_audience':{'sexually_explicit':False,'reading_age':None},
                'cover_finish':'matte',
                'ai_generated':{'text':False,'images':False,'translations':False}}
            detail_path=Path(tmp)/'details.json';save_json(detail_path,details)
            manuscript=Path(tmp)/'pages.json';save_json(manuscript,[{'lines':['Same','Same']}])
            manifest={'platform':'kdp','expected_text':[
                {'text':'Same','box_px':[2100,300,2400,350]}],
                'template':{'platform':'kdp','dpi':300,'size_inches':[12.304048,9.25],
                    'kdp':{'locale':'en_US','reading_direction':'left_to_right',
                           'trim_width_inches':6,'spine_width_inches':.054048,
                           'bleed_inches':.125}}}
            with self.assertRaisesRegex(ValueError,'KDP_BOOK_DETAILS_MISMATCH'):
                inspect_book_details(detail_path,manifest,manuscript)

    def test_kdp_book_details_reject_prohibited_metadata(self):
        from pod_common import save_json
        from pod_interior_preflight import inspect_book_details

        base={'schema_version':13,'title':'Fixture Book','subtitle':None,
            'author_name':'Fixture Author','language':'en','description':'A practical fixture description.',
                'keywords':['fixture guide'],'primary_marketplace':'amazon.com',
                'list_price':{'marketplace':'amazon.com','currency':'USD','amount_minor':2000},
                'categories':['Nonfiction > Reference'],
                'publishing_rights':'copyright_owner',
                'distribution_rights':{'scope':'individual','territories':['US']},'publication_date':None,
                'release_plan':{'mode':'release_now','date':None},
                'expanded_distribution':False,
                'isbn_source':'kdp_free','isbn':None,
            'imprint':None,'title_page':1,'edition':None,'series':None,
            'contributors':[],
            'low_content':False,
            'primary_audience':{'sexually_explicit':False,'reading_age':None},
            'cover_finish':'matte',
            'ai_generated':{'text':False,'images':False,'translations':False}}
        invalid=(
            {'title':'n/a'},
            {'title':'!!!'},
            {'title':'<b>Fixture Book</b>'},
            {'author_name':'Fixture <i>Author</i>'},
            {'title':'T'*100,'subtitle':'S'*101},
        )
        with tempfile.TemporaryDirectory() as tmp:
            detail_path=Path(tmp)/'details.json'
            manuscript=Path(tmp)/'pages.json'
            for patch_value in invalid:
                with self.subTest(details=patch_value):
                    details={**base,**patch_value}
                    fields=[details['title']]
                    if details['subtitle'] is not None:
                        fields.append(details['subtitle'])
                    fields.append(details['author_name'])
                    save_json(detail_path,details)
                    save_json(manuscript,[{'lines':fields}])
                    manifest={'platform':'kdp','expected_text':[
                        {'text':text,'box_px':[2100,300+i*100,2600,350+i*100]}
                        for i,text in enumerate(fields)],
                        'template':{'platform':'kdp','dpi':300,
                            'size_inches':[12.304048,9.25],
                            'kdp':{'locale':'en_US','reading_direction':'left_to_right',
                                   'trim_width_inches':6,'spine_width_inches':.054048,
                                   'bleed_inches':.125}}}
                    with self.assertRaisesRegex(ValueError,'KDP_BOOK_DETAILS_INVALID'):
                        inspect_book_details(detail_path,manifest,manuscript)

    def test_kdp_book_details_bind_edition_series_and_contributors(self):
        from pod_common import save_json
        from pod_interior_preflight import inspect_book_details

        details={'schema_version':13,'title':'Fixture Book','subtitle':None,
            'author_name':'Fixture Author','language':'en','description':'A practical fixture description.',
                'keywords':['fixture guide'],'primary_marketplace':'amazon.com',
                'list_price':{'marketplace':'amazon.com','currency':'USD','amount_minor':2000},
                'categories':['Nonfiction > Reference'],
                'publishing_rights':'copyright_owner',
                'distribution_rights':{'scope':'individual','territories':['US']},'publication_date':None,
                'release_plan':{'mode':'release_now','date':None},
                'expanded_distribution':False,
                'isbn_source':'kdp_free','isbn':None,
            'imprint':None,'title_page':1,
            'edition':{'number':2,'display_text':'2nd Edition'},
            'series':{'title':'Fixture Series','number':3,
                      'display_text':'Fixture Series, Volume 3'},
            'contributors':[{'role':'Editor','name':'Fixture Editor'},
                            {'role':'Illustrator','name':'Fixture Artist'}],
            'low_content':False,
            'primary_audience':{'sexually_explicit':False,'reading_age':None},
            'cover_finish':'matte',
            'ai_generated':{'text':False,'images':False,'translations':False}}
        manifest={'platform':'kdp','expected_text':[
            {'text':'Fixture Book','box_px':[2100,300,2400,350]},
            {'text':'Fixture Author','box_px':[2100,450,2400,500]}],
            'template':{'platform':'kdp','dpi':300,'size_inches':[12.304048,9.25],
                'kdp':{'locale':'en_US','reading_direction':'left_to_right',
                       'trim_width_inches':6,'spine_width_inches':.054048,
                       'bleed_inches':.125}}}
        pages=[{'lines':['Fixture Book','Fixture Author']},
               {'lines':['2nd Edition','Fixture Series, Volume 3',
                         'Fixture Editor','Fixture Artist']}]
        with tempfile.TemporaryDirectory() as tmp:
            detail_path=Path(tmp)/'details.json'
            manuscript=Path(tmp)/'pages.json'
            save_json(detail_path,details);save_json(manuscript,pages)
            self.assertEqual(len(inspect_book_details(detail_path,manifest,manuscript)),64)

            invalid=(
                {'edition':{'number':0,'display_text':'0th Edition'}},
                {'edition':{'number':True,'display_text':'1st Edition'}},
                {'edition':{'number':2,'display_text':'1st Edition'}},
                {'series':{'title':'Fixture Series'}},
                {'series':{'title':'Other Series','number':3,
                           'display_text':'Fixture Series, Volume 3'}},
                {'series':{'title':'Fixture Series','number':4,
                           'display_text':'Fixture Series, Volume 3'}},
                {'contributors':[{'role':'Editor','name':'Fixture Editor'}]*2},
                {'contributors':[{'role':'Editor','name':f'Contributor {i}'} for i in range(10)]},
            )
            for patch_value in invalid:
                with self.subTest(details=patch_value):
                    save_json(detail_path,{**details,**patch_value})
                    with self.assertRaisesRegex(ValueError,'KDP_BOOK_DETAILS_INVALID'):
                        inspect_book_details(detail_path,manifest,manuscript)

            save_json(detail_path,details)
            save_json(manuscript,pages[:1])
            with self.assertRaisesRegex(ValueError,'KDP_BOOK_DETAILS_MISMATCH'):
                inspect_book_details(detail_path,manifest,manuscript)

    def test_kdp_book_details_validate_isbn_and_imprint(self):
        from pod_common import save_json
        from pod_interior_preflight import inspect_book_details

        base={'schema_version':13,'title':'Fixture Book','subtitle':None,
            'author_name':'Fixture Author','language':'en','description':'A practical fixture description.',
                'keywords':['fixture guide'],'primary_marketplace':'amazon.com',
                'list_price':{'marketplace':'amazon.com','currency':'USD','amount_minor':2000},
                'categories':['Nonfiction > Reference'],
                'publishing_rights':'copyright_owner',
                'distribution_rights':{'scope':'individual','territories':['US']},'publication_date':None,
                'release_plan':{'mode':'release_now','date':None},
                'expanded_distribution':False,
                'isbn_source':'kdp_free','isbn':None,
            'imprint':None,'title_page':1,'edition':None,'series':None,
            'contributors':[],
            'low_content':False,
            'primary_audience':{'sexually_explicit':False,'reading_age':None},
            'cover_finish':'matte',
            'ai_generated':{'text':False,'images':False,'translations':False}}
        manifest={'platform':'kdp','expected_text':[
            {'text':'Fixture Book','box_px':[2100,300,2400,350]},
            {'text':'Fixture Author','box_px':[2100,450,2400,500]}],
            'template':{'platform':'kdp','dpi':300,'size_inches':[12.304048,9.25],
                'kdp':{'locale':'en_US','reading_direction':'left_to_right',
                       'trim_width_inches':6,'spine_width_inches':.054048,
                       'bleed_inches':.125}}}
        valid_isbn='ISBN-13: 978-0-306-40615-7'
        with tempfile.TemporaryDirectory() as tmp:
            detail_path=Path(tmp)/'details.json'
            manuscript=Path(tmp)/'pages.json'
            save_json(detail_path,base)
            save_json(manuscript,[{'lines':['Fixture Book','Fixture Author']}])
            self.assertEqual(len(inspect_book_details(detail_path,manifest,manuscript)),64)

            details={**base,'isbn_source':'owned','isbn':valid_isbn,
                     'imprint':'Fixture Press'}
            save_json(detail_path,details)
            save_json(manuscript,[{'lines':['Fixture Book','Fixture Author']},
                                  {'lines':[valid_isbn,'Fixture Press']}])
            self.assertEqual(len(inspect_book_details(detail_path,manifest,manuscript)),64)

            invalid=(
                {'isbn_source':'invalid'},
                {'isbn_source':'owned'},
                {'isbn':valid_isbn},
                {'imprint':'Fixture Press'},
                {'isbn_source':'owned','isbn':valid_isbn},
                {'isbn_source':'owned','imprint':'Fixture Press'},
                {'isbn':'not-an-isbn'},
                {'isbn':'ISBN-13: 978-0-306-40615-8'},
                {'isbn':'ISBN-13: 123-0-306-40615-6'},
                {'imprint':'unknown'},
                {'imprint':'!!!'},
                {'imprint':'<b>Fixture Press</b>'},
                {'imprint':'P'*101},
            )
            for patch_value in invalid:
                with self.subTest(details=patch_value):
                    save_json(detail_path,{**base,**patch_value})
                    value=next(iter(patch_value.values()))
                    save_json(manuscript,[{'lines':['Fixture Book','Fixture Author']},
                                          {'lines':[value]}])
                    with self.assertRaisesRegex(ValueError,'KDP_BOOK_DETAILS_INVALID'):
                        inspect_book_details(detail_path,manifest,manuscript)

    def test_kdp_book_details_bind_discovery_metadata(self):
        valid=self.package_result(lambda m,r:None,kdp=True)
        self.assertEqual(valid['binary_pass'],1,valid)
        invalid=(
            {'schema_version':11},
            {'description':None},
            {'description':'D'*4001},
            {'description':'Visit https://example.com for details'},
            {'description':'<b>Promotional copy</b>'},
            {'keywords':['one']*2},
            {'keywords':[f'keyword {index}' for index in range(8)]},
            {'keywords':['<b>keyword</b>']},
            {'primary_marketplace':'amazon.co.uk'},
            {'categories':[]},
            {'categories':['One','Two','Three','Four']},
            {'categories':['Reference','reference']},
            {'publishing_rights':'public_domain'},
        )
        for patch_value in invalid:
            with self.subTest(details=patch_value):
                failed=self.package_result(lambda m,r:None,kdp=True,
                    book_details_patch=patch_value)
                self.assertEqual(failed['binary_pass'],0,failed)
                self.assertIn('KDP_BOOK_DETAILS_INVALID',failed['errors'])

    def test_kdp_book_details_require_substantive_book_lane(self):
        valid=self.package_result(lambda m,r:None,kdp=True)
        self.assertEqual(valid['binary_pass'],1,valid)
        for value in (True,None,0,1,'false',{},[]):
            with self.subTest(low_content=value):
                failed=self.package_result(lambda m,r:None,kdp=True,
                    book_details_patch={'low_content':value})
                self.assertEqual(failed['binary_pass'],0,failed)
                self.assertIn('KDP_BOOK_DETAILS_INVALID',failed['errors'])

    def test_kdp_book_details_bind_new_release_setup(self):
        valid=self.package_result(lambda m,r:None,kdp=True)
        self.assertEqual(valid['binary_pass'],1,valid)
        invalid=(
            {'publication_date':'2026-10-21'},
            {'publication_date':False},
            {'release_plan':None},
            {'release_plan':{'mode':'release_now'}},
            {'release_plan':{'mode':'release_now','date':'2026-11-01'}},
            {'release_plan':{'mode':'scheduled','date':'2026-11-01'}},
            {'release_plan':{'mode':'release_now','date':None,'extra':True}},
        )
        for patch_value in invalid:
            with self.subTest(details=patch_value):
                failed=self.package_result(lambda m,r:None,kdp=True,
                    book_details_patch=patch_value)
                self.assertEqual(failed['binary_pass'],0,failed)
                self.assertIn('KDP_BOOK_DETAILS_INVALID',failed['errors'])

    def test_kdp_book_details_bind_individual_us_distribution_rights(self):
        valid=self.package_result(lambda m,r:None,kdp=True)
        self.assertEqual(valid['binary_pass'],1,valid)
        invalid=(
            None,
            'US',
            {'scope':'worldwide','territories':['US']},
            {'scope':'individual','territories':[]},
            {'scope':'individual','territories':['CA']},
            {'scope':'individual','territories':['US','CA']},
            {'scope':'individual','territories':['US'],'extra':True},
        )
        for value in invalid:
            with self.subTest(distribution_rights=value):
                failed=self.package_result(lambda m,r:None,kdp=True,
                    book_details_patch={'distribution_rights':value})
                self.assertEqual(failed['binary_pass'],0,failed)
                self.assertIn('KDP_BOOK_DETAILS_INVALID',failed['errors'])

    def test_kdp_requires_current_scoped_regional_rights_evidence(self):
        from pod_vision_qa import inspect_regional_rights
        details={'publishing_rights':'copyright_owner',
                 'categories':['Nonfiction > Reference']}
        valid={'country':'US','territories':['US'],'format':'paperback',
               'publishing_basis':'copyright_owner',
               'categories':['Nonfiction > Reference'],
               'commercial_print_on_demand':True,'original_work':True,
               'rights_holder_verified':True,'revoked':False,
               'authority_event_id':'synthetic-regional-rights',
               'source_evidence_ids':['synthetic-authorship-record'],
               'evidence_sha256':'c'*64}
        self.assertEqual(inspect_regional_rights(
            {'regional_rights':valid},details,'US'),valid)
        invalid=[
            None,
            {**valid,'extra':True},
            {**valid,'country':'CA'},
            {**valid,'territories':['CA']},
            {**valid,'format':'hardcover'},
            {**valid,'publishing_basis':'public_domain'},
            {**valid,'categories':['Fiction > General']},
            {**valid,'commercial_print_on_demand':False},
            {**valid,'original_work':False},
            {**valid,'rights_holder_verified':False},
            {**valid,'revoked':True},
            {**valid,'authority_event_id':''},
            {**valid,'source_evidence_ids':[]},
            {**valid,'source_evidence_ids':['duplicate','duplicate']},
            {**valid,'source_evidence_ids':[1]},
            {**valid,'evidence_sha256':'C'*64},
        ]
        for regional in invalid:
            with self.subTest(regional=regional):
                with self.assertRaisesRegex(ValueError,'KDP_REGIONAL_RIGHTS_REQUIRED'):
                    inspect_regional_rights(
                        {'regional_rights':regional},details,'US')
        valid_package=self.package_result(lambda m,r:None,kdp=True)
        self.assertEqual(valid_package['binary_pass'],1,valid_package)
        self.assertTrue(valid_package['checks']['regional_rights'])
        self.assertEqual(valid_package['regional_rights_event_id'],
                         'synthetic-regional-rights')
        self.assertEqual(valid_package['regional_rights_evidence_sha256'],'c'*64)
        legacy=self.package_result(lambda m,r:None,kdp=True,
            rights_patch={'regional_rights':None})
        self.assertEqual(legacy['binary_pass'],0,legacy)
        self.assertIn('KDP_REGIONAL_RIGHTS_REQUIRED',legacy['errors'])
    def test_kdp_book_details_require_expanded_distribution_opt_out(self):
        disabled=self.package_result(lambda m,r:None,kdp=True)
        self.assertEqual(disabled['binary_pass'],1,disabled)
        for value in (True,None,0,1,'false',{},[]):
            with self.subTest(expanded_distribution=value):
                failed=self.package_result(lambda m,r:None,kdp=True,
                    book_details_patch={'expanded_distribution':value})
                self.assertEqual(failed['binary_pass'],0,failed)
                self.assertIn('KDP_BOOK_DETAILS_INVALID',failed['errors'])

    def test_kdp_book_details_bind_primary_list_price(self):
        valid=self.package_result(lambda m,r:None,kdp=True)
        alternate=self.package_result(lambda m,r:None,kdp=True,
            book_details_patch={'list_price':{
                'marketplace':'amazon.com','currency':'USD','amount_minor':1999}})
        self.assertEqual(valid['binary_pass'],1,valid)
        self.assertEqual(valid['list_price'],
            {'marketplace':'amazon.com','currency':'USD','amount_minor':2000})
        self.assertEqual(alternate['binary_pass'],1,alternate)
        self.assertNotEqual(valid['book_details_sha256'],
                            alternate['book_details_sha256'])
        invalid=(
            None,
            {},
            {'marketplace':'amazon.com','currency':'USD'},
            {'marketplace':'amazon.com','currency':'USD','amount_minor':0},
            {'marketplace':'amazon.com','currency':'USD','amount_minor':-1},
            {'marketplace':'amazon.com','currency':'USD','amount_minor':25001},
            {'marketplace':'amazon.com','currency':'USD','amount_minor':20.0},
            {'marketplace':'amazon.com','currency':'USD','amount_minor':True},
            {'marketplace':'amazon.com','currency':'EUR','amount_minor':2000},
            {'marketplace':'amazon.co.uk','currency':'USD','amount_minor':2000},
            {'marketplace':'amazon.com','currency':'USD','amount_minor':2000,
             'extra':True},
        )
        for value in invalid:
            with self.subTest(list_price=value):
                failed=self.package_result(lambda m,r:None,kdp=True,
                    book_details_patch={'list_price':value})
                self.assertEqual(failed['binary_pass'],0,failed)
                self.assertIn('KDP_BOOK_DETAILS_INVALID',failed['errors'])

    def test_kdp_book_details_bind_primary_audience(self):
        general=self.package_result(lambda m,r:None,kdp=True)
        explicit=self.package_result(lambda m,r:None,kdp=True,
            book_details_patch={'primary_audience':{
                'sexually_explicit':True,
                'reading_age':{'minimum':13,'maximum':17}}})
        self.assertEqual(general['binary_pass'],1,general)
        self.assertEqual(explicit['binary_pass'],1,explicit)
        self.assertNotEqual(general['book_details_sha256'],
                            explicit['book_details_sha256'])
        for minimum,maximum in ((0,2),(3,5),(6,8),(9,12),(13,17)):
            with self.subTest(reading_age=(minimum,maximum)):
                valid=self.package_result(lambda m,r:None,kdp=True,
                    book_details_patch={'primary_audience':{
                        'sexually_explicit':False,
                        'reading_age':{'minimum':minimum,'maximum':maximum}}})
                self.assertEqual(valid['binary_pass'],1,valid)
        invalid=(
            None,
            {},
            {'sexually_explicit':False},
            {'sexually_explicit':'false','reading_age':None},
            {'sexually_explicit':False,'reading_age':{}},
            {'sexually_explicit':False,
             'reading_age':{'minimum':3,'maximum':8}},
            {'sexually_explicit':False,
             'reading_age':{'minimum':True,'maximum':2}},
            {'sexually_explicit':False,'reading_age':None,'extra':False},
        )
        for value in invalid:
            with self.subTest(primary_audience=value):
                failed=self.package_result(lambda m,r:None,kdp=True,
                    book_details_patch={'primary_audience':value})
                self.assertEqual(failed['binary_pass'],0,failed)
                self.assertIn('KDP_BOOK_DETAILS_INVALID',failed['errors'])

    def test_kdp_book_details_bind_cover_finish(self):
        matte=self.package_result(lambda m,r:None,kdp=True)
        glossy=self.package_result(lambda m,r:None,kdp=True,
            book_details_patch={'cover_finish':'glossy'})
        self.assertEqual(matte['binary_pass'],1,matte)
        self.assertEqual(glossy['binary_pass'],1,glossy)
        self.assertNotEqual(matte['book_details_sha256'],glossy['book_details_sha256'])
        for value in (None,'Matte','satin',True,[],{}):
            with self.subTest(cover_finish=value):
                failed=self.package_result(lambda m,r:None,kdp=True,
                    book_details_patch={'cover_finish':value})
                self.assertEqual(failed['binary_pass'],0,failed)
                self.assertIn('KDP_BOOK_DETAILS_INVALID',failed['errors'])

    def test_kdp_book_details_require_ai_generated_disclosure(self):
        from pod_common import save_json
        from pod_interior_preflight import inspect_book_details

        base={'schema_version':13,'title':'Fixture Book','subtitle':None,
            'author_name':'Fixture Author','language':'en','description':'A practical fixture description.',
                'keywords':['fixture guide'],'primary_marketplace':'amazon.com',
                'list_price':{'marketplace':'amazon.com','currency':'USD','amount_minor':2000},
                'categories':['Nonfiction > Reference'],
                'publishing_rights':'copyright_owner',
                'distribution_rights':{'scope':'individual','territories':['US']},'publication_date':None,
                'release_plan':{'mode':'release_now','date':None},
                'expanded_distribution':False,
                'isbn_source':'kdp_free','isbn':None,
            'imprint':None,'title_page':1,'edition':None,'series':None,
            'contributors':[],
            'low_content':False,
            'primary_audience':{'sexually_explicit':False,'reading_age':None},
            'cover_finish':'matte'}
        manifest={'platform':'kdp','expected_text':[
            {'text':'Fixture Book','box_px':[2100,300,2400,350]},
            {'text':'Fixture Author','box_px':[2100,450,2400,500]}],
            'template':{'platform':'kdp','dpi':300,'size_inches':[12.304048,9.25],
                'kdp':{'locale':'en_US','reading_direction':'left_to_right',
                       'trim_width_inches':6,'spine_width_inches':.054048,
                       'bleed_inches':.125}}}
        pages=[{'lines':['Fixture Book','Fixture Author']}]
        valid={'text':True,'images':True,'translations':False}
        invalid=(
            None,
            {},
            {'text':False,'images':False},
            {'text':False,'images':False,'translations':False,'audio':False},
            {'text':'false','images':False,'translations':False},
            {'text':0,'images':False,'translations':False},
        )
        with tempfile.TemporaryDirectory() as tmp:
            detail_path=Path(tmp)/'details.json'
            manuscript=Path(tmp)/'pages.json'
            save_json(manuscript,pages)
            save_json(detail_path,{**base,'ai_generated':valid})
            self.assertEqual(len(inspect_book_details(detail_path,manifest,manuscript)),64)
            save_json(detail_path,{**base,'schema_version':3,'ai_generated':valid})
            with self.assertRaisesRegex(ValueError,'KDP_BOOK_DETAILS_INVALID'):
                inspect_book_details(detail_path,manifest,manuscript)
            for disclosure in invalid:
                with self.subTest(disclosure=disclosure):
                    save_json(detail_path,{**base,'ai_generated':disclosure})
                    with self.assertRaisesRegex(ValueError,'KDP_BOOK_DETAILS_INVALID'):
                        inspect_book_details(detail_path,manifest,manuscript)

    def test_kdp_original_manuscript_is_required_and_editorial_hash_must_match(self):
        missing=self.package_result(lambda m,r:None,kdp=True,manuscript_inputs=False)
        self.assertEqual(missing['binary_pass'],0)
        self.assertIn('MANUSCRIPT_REQUIRED',missing['errors'])
        for sha in (None,'0'*64,'A'*64,['a'*64]):
            result=self.package_result(lambda m,r:None,kdp=True,editorial_patch={'manuscript_sha256':sha})
            self.assertEqual(result['binary_pass'],0,result)
            self.assertFalse(result['checks']['manuscript_provenance'])
        valid=self.package_result(lambda m,r:None,kdp=True)
        self.assertEqual(valid['binary_pass'],1,valid)
        self.assertTrue(valid['checks']['manuscript_provenance'])

    def test_kdp_original_font_source_is_required_and_reported(self):
        missing=self.package_result(lambda m,r:None,kdp=True,font_inputs=False)
        self.assertEqual(missing['binary_pass'],0,missing)
        self.assertIn('INTERIOR_FONT_SOURCE_REQUIRED',missing['errors'])
        valid=self.package_result(lambda m,r:None,kdp=True)
        self.assertEqual(valid['binary_pass'],1,valid)
        self.assertTrue(valid['checks']['source_font'])
        self.assertEqual(valid['font_sha256'],valid['font_sha256'].lower())
        self.assertEqual(len(valid['font_sha256']),64)

    def test_kdp_current_scoped_font_rights_and_retained_license_are_required(self):
        missing=self.package_result(lambda m,r:None,kdp=True,font_rights_inputs=False)
        self.assertEqual(missing['binary_pass'],0,missing)
        self.assertIn('FONT_RIGHTS_REQUIRED',missing['errors'])
        for patch in ({'font_sha256':'0'*64},{'license_sha256':'0'*64},{'country':'CA'},
                      {'product':'other'},{'commercial_use':False},{'print_on_demand':False},
                      {'font_embedding':False},{'revoked':True},{'license_id':''},{'licensor':' unknown '}):
            result=self.package_result(lambda m,r:None,kdp=True,font_rights_patch=patch)
            self.assertEqual(result['binary_pass'],0,result)
            self.assertIn('FONT_RIGHTS_INVALID',result['errors'])
        valid=self.package_result(lambda m,r:None,kdp=True)
        self.assertEqual(valid['binary_pass'],1,valid)
        self.assertTrue(valid['checks']['font_rights'])
        self.assertEqual(valid['font_license_id'],'synthetic-license')
        self.assertEqual(len(valid['font_license_sha256']),64)

    def test_rebound_substituted_interior_text_does_not_match_original_manuscript(self):
        from pod_common import save_json
        def substitute(m,root):
            target=root/'substituted.pdf'
            receipt=render_book(m['interior']['template'],
                [{'lines':[f'Substituted page {i+1}']} for i in range(24)],
                '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',target)
            target.replace(root/'interior.pdf')
            m['interior']['receipt']=receipt;save_json(root/'interior.receipt.json',receipt)
            for name in ('interior.pdf','interior.receipt.json'):m['files'][name]=digest(root/name)
        result=self.package_result(substitute,kdp=True)
        self.assertEqual(result['binary_pass'],0,result)
        self.assertIn('MANUSCRIPT_TEXT_MISMATCH',result['errors'])

    def test_kdp_original_title_fonts_and_all_rendered_pixels_pass_independent_preflight(self):
        font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
        layer=dict(font_path=font,font_sha256=digest(font),font_size_px=32,
            position_px=[2300,600],text='Title',rgba=[0,0,0,255])
        result=self.package_result(lambda m,r:None,kdp=True,text_layers=[layer])
        self.assertEqual(result['binary_pass'],1,result)
        self.assertTrue(result['checks']['text_provenance'])
        self.assertTrue(result['checks']['print_preflight'])
        self.assertEqual(result['cover_color_space'],'DeviceCMYK')
        approved=[layer]
        for text,position in (('Fixture Book',[2100,300]),('Fixture Author',[2100,450])):
            approved.append(dict(font_path=font,font_sha256=digest(font),font_size_px=32,
                position_px=position,text=text,rgba=[0,0,0,255]))
        self.assertEqual(result['text_layers_sha256'],
            hashlib.sha256(canonical(approved).encode()).hexdigest())

    def test_qa_rejects_unapproved_text_masks_even_with_rebound_artifact_hashes(self):
        def hidden(manifest,root):
            with Image.open(root/'print.png') as image:
                image.putpixel((500,500),(255,0,255,255));image.save(root/'print.png',dpi=(300,300))
            with Image.open(root/'text-mask.png') as mask:
                mask.putpixel((500,500),255);mask.save(root/'text-mask.png')
            for name in ('print.png','text-mask.png'):manifest['files'][name]=digest(root/name)
        result=self.package_result(hidden)
        self.assertEqual(result['binary_pass'],0,result)
        self.assertTrue(result['checks']['geometry'])
        self.assertTrue(result['checks']['text'])
        self.assertIn('TEXT_MASK_MISMATCH',result['errors'])

    def test_qa_requires_original_source_and_rejects_plausible_inflated_native_resolution(self):
        for kdp in (False,True):
            missing=self.package_result(lambda m,r:None,kdp=kdp,source_inputs=False)
            self.assertEqual(missing['binary_pass'],0)
            self.assertIn('SOURCE_EVIDENCE_REQUIRED',missing['errors'])
            def inflate(m,r):
                m.update(source_size_px=[1600,800],effective_native_ppi=min(
                    1600*m['dpi']/m['placed_size_px'][0],800*m['dpi']/m['placed_size_px'][1]))
            forged=self.package_result(inflate,kdp=kdp)
            self.assertEqual(forged['binary_pass'],0)
            self.assertTrue(forged['checks']['resolution'])
            self.assertIn('SOURCE_LAYOUT_INVALID',forged['errors'])

    def test_original_source_approval_caps_receipt_and_is_rechecked_after_review(self):
        import time
        from pod_common import verified as real_verified
        clock=[time.time()];expire=[False]
        def review(*args,**kwargs):
            value=real_verified(*args,**kwargs)
            if expire[0] and args[2]=='pod:competitive-review':clock[0]+=2
            return value
        with patch('pod_vision_qa.time.time',side_effect=lambda:clock[0]),patch('pod_vision_qa.verified',side_effect=review):
            valid=self.package_result(lambda m,r:None,source_ttl=1000)
            self.assertEqual(valid['binary_pass'],1,valid)
            self.assertTrue(valid['checks']['original_source'])
            self.assertEqual(qa_receipt(valid,int(clock[0]*1000))['expires_at_ms'],int(clock[0]*1000)+1000)
            expire[0]=True
            failed=self.package_result(lambda m,r:None,source_ttl=1000)
            self.assertEqual(failed['binary_pass'],0)
            self.assertIn('SOURCE_RIGHTS_INVALID',failed['errors'])

    def test_kdp_qa_requires_original_template_inputs_and_caps_receipt_at_template_expiry(self):
        import time
        from pod_vision_qa import qa_receipt
        with patch('pod_vision_qa.time.time',return_value=time.time()):
            now=int(time.time()*1000)
            missing=self.package_result(lambda m,r:None,kdp=True,template_inputs=False)
            self.assertEqual(missing['binary_pass'],0)
            self.assertIn('KDP_TEMPLATE_PROVENANCE_REQUIRED',missing['errors'])
            valid=self.package_result(lambda m,r:None,kdp=True,template_ttl=1000)
            self.assertEqual(valid['binary_pass'],1,valid)
            self.assertTrue(valid['checks']['template_provenance'])
            self.assertEqual(qa_receipt(valid,now)['expires_at_ms'],now+1000)

    def test_kdp_template_expiring_during_comparative_review_cannot_pass(self):
        import time
        from pod_common import verified as real_verified
        clock=[time.time()]
        def review(*args,**kwargs):
            value=real_verified(*args,**kwargs)
            if args[2]=='pod:competitive-review':clock[0]+=2
            return value
        with patch('pod_vision_qa.time.time',side_effect=lambda:clock[0]),patch('pod_vision_qa.verified',side_effect=review):
            result=self.package_result(lambda m,r:None,kdp=True,template_ttl=1000)
        self.assertEqual(result['binary_pass'],0)
        self.assertIn('KDP_TEMPLATE_PROVENANCE_INVALID',result['errors'])

    def test_kdp_qa_requires_host_target_and_does_not_trust_package_country_or_locale(self):
        def claimed_country(manifest,root):
            manifest['country']='US';manifest['target_country']='US'
            manifest['template']['kdp'].update(country='US',locale='en_US')
        for country in (None,'JP','CA','us',['US'],True):
            with self.subTest(country=country):
                result=self.package_result(claimed_country,kdp=True,target_country=country)
                self.assertEqual(result['binary_pass'],0)
                self.assertIn('KDP_PRINT_OPTIONS_UNSUPPORTED',result['errors'])
        result=self.package_result(claimed_country,kdp=True,target_country='US')
        self.assertEqual(result['binary_pass'],1,result)
        self.assertEqual(result['target_country'],'US')

    def test_kdp_qa_rejects_barcode_overlap_despite_rebound_masks_and_package(self):
        from pod_common import save_json
        from pod_cover_regions import barcode_region_px
        for filename in ('text-mask.png','art-mask.png'):
            def overlap(manifest,root):
                import math
                template=manifest['template'];dpi=template['dpi'];edge=math.ceil(.25*dpi)
                template['safe_box_px']=[edge,edge,*[math.floor((v-.25)*dpi)-edge for v in template['size_inches']]]
                _,box=barcode_region_px(manifest['template'])
                with Image.open(root/filename) as source:mask=source.convert('L')
                mask.putpixel((box[0],box[1]),1);mask.save(root/filename)
                manifest['files'][filename]=digest(root/filename)
            with self.subTest(mask=filename):
                result=self.package_result(overlap,kdp=True)
                self.assertEqual(result['binary_pass'],0)
                self.assertTrue(result['checks']['geometry'])
                self.assertIn('COVER_BARCODE_CONTENT_INVALID',result['errors'])

    def test_kdp_qa_rejects_local_cover_damage_despite_rebound_hashes(self):
        from reportlab.pdfgen import canvas as pdfcanvas
        from reportlab.lib.utils import ImageReader
        def damage(manifest,root):
            with Image.open(root/'print.png') as source:
                altered=source.convert('RGB')
            altered.putpixel((300,300),(0,0,0))
            width,height=[v*72/manifest['dpi'] for v in altered.size]
            pdf=pdfcanvas.Canvas(str(root/'cover.pdf'),pagesize=(width,height),invariant=1)
            pdf.drawImage(ImageReader(altered.convert('CMYK')),0,0,width=width,height=height)
            pdf.showPage();pdf.save()
            manifest['files']['cover.pdf']=digest(root/'cover.pdf')
        result=self.package_result(damage,kdp=True)
        self.assertEqual(result['binary_pass'],0,result)
        self.assertIn('COVER_PIXEL_MISMATCH',result['errors'])

    def test_kdp_qa_requires_declared_device_cmyk_cover(self):
        for value in (None,'RGB','devicecmyk',True,[]):
            def mutate(manifest,root):
                if value is None:
                    manifest.pop('cover_color_space',None)
                else:
                    manifest['cover_color_space']=value
            with self.subTest(value=value):
                result=self.package_result(mutate,kdp=True)
                self.assertEqual(result['binary_pass'],0,result)
                self.assertIn('COVER_COLOR_SPACE_INVALID',result['errors'])

    def test_kdp_qa_rejects_undersized_margins_despite_rebound_receipts(self):
        from pod_common import save_json
        for field,value in (('inside',.374999),('outside',.249999),('top',.249999),('bottom',.249999)):
            def mutate(manifest,root):
                spec=manifest['interior']['template']
                spec['margins_inches'][field]=value
                receipt=manifest['interior']['receipt']
                receipt['template_sha256']=hashlib.sha256(canonical(spec).encode()).hexdigest()
                save_json(root/'interior.receipt.json',receipt)
                manifest['files']['interior.receipt.json']=digest(root/'interior.receipt.json')
            with self.subTest(field=field):
                result=self.package_result(mutate,kdp=True)
                self.assertEqual(result['binary_pass'],0,result)
                self.assertIn('INTERIOR_MARGIN_SPEC_INVALID',result['errors'])


    def test_kdp_qa_rejects_spine_text_despite_rebound_mask_and_package(self):
        import math
        for position in ('spine','back_fold','front_fold','back_safe','front_safe'):
            def mutate(manifest,root):
                t=manifest['template'];dpi=t['dpi'];k=t['kdp']
                with Image.open(root/'text-mask.png') as source:
                    mask=source.convert('L')
                # A compliant outer safe box cannot authorize spine/fold text.
                t['safe_box_px']=[75,75,math.floor((t['size_inches'][0]-.25)*dpi)-75,
                                  math.floor((t['size_inches'][1]-.25)*dpi)-75]
                left=(.125+k['trim_width_inches'])*dpi
                right=left+k['spine_width_inches']*dpi
                x={'spine':round((left+right)/2),'back_fold':math.floor(left-.0625*dpi),
                   'front_fold':math.ceil(right+.0625*dpi)-1,
                   'back_safe':math.floor(left-.0625*dpi)-1,
                   'front_safe':math.ceil(right+.0625*dpi)}[position]
                mask.putpixel((x,150),255);mask.save(root/'text-mask.png')
                manifest['files']['text-mask.png']=digest(root/'text-mask.png')
            with self.subTest(position=position):
                result=self.package_result(mutate,kdp=True)
                if position.endswith('_safe'):
                    # Outside the fold restriction, but still an unapproved
                    # mask pixel without an original text layer or glyph.
                    self.assertEqual(result['binary_pass'],0,result)
                    self.assertIn('TEXT_MASK_MISMATCH',result['errors'])
                    self.assertTrue(result['checks']['print_preflight'],result)
                else:
                    self.assertEqual(result['binary_pass'],0,result)
                    self.assertIn('COVER_SPINE_TEXT_INVALID',result['errors'])
                self.assertTrue(result['checks']['geometry'],result)

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

    def test_kdp_qa_rejects_small_delivered_font_despite_rebound_receipt(self):
        from pod_common import save_json
        def change(m,root):
            spec=m['interior']['template'];target=root/'interior.pdf';target.unlink()
            receipt=render_book({**spec,'font_size_pt':6},
                [{'lines':[f'Fixture page {i+1}']} for i in range(24)],
                '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',target)
            self.assertTrue(receipt['technical_checks_passed'])
            # Rebind the synthetic receipt to the declared 10pt specification;
            # all stored hashes and approvals agree, but the PDF contains 6pt.
            receipt['template_sha256']=hashlib.sha256(canonical(spec).encode()).hexdigest()
            m['interior']['receipt']=receipt;save_json(root/'interior.receipt.json',receipt)
            for filename in ('interior.pdf','interior.receipt.json'):
                m['files'][filename]=digest(root/filename)
        result=self.package_result(change,kdp=True)
        self.assertEqual(result['binary_pass'],0,result)
        self.assertIn('INTERIOR_FONT_SIZE_INVALID',result['errors'])

    def test_kdp_qa_rejects_unembedded_font_despite_rebound_receipt(self):
        import fitz
        from pod_common import save_json
        def change(m,root):
            target=root/'replacement.pdf'
            with fitz.open() as book:
                for i in range(24):
                    page=book.new_page(width=432,height=648)
                    page.insert_text((40,55),f'Fixture page {i+1}',fontsize=10)
                book.save(target)
            target.replace(root/'interior.pdf')
            receipt=m['interior']['receipt']
            receipt['interior_sha256']=digest(root/'interior.pdf')
            save_json(root/'interior.receipt.json',receipt)
            for filename in ('interior.pdf','interior.receipt.json'):
                m['files'][filename]=digest(root/filename)
        result=self.package_result(change,kdp=True)
        self.assertEqual(result['binary_pass'],0,result)
        self.assertIn('INTERIOR_FONT_EMBEDDING_REQUIRED',result['errors'])

    def test_kdp_safe_box_edge_rejected_after_hashes_and_approvals_are_rebound(self):
        for box in ([74,75,500,500],[75,74,500,500],[75,75,3542,500],[75,75,500,2626]):
            with self.subTest(box=box):
                result=self.package_result(lambda m,r:m['template'].update(safe_box_px=box),kdp=True)
                self.assertEqual(result['binary_pass'],0,result)
                self.assertFalse(result['checks']['geometry'])

    def test_kdp_spatial_edges_and_actual_critical_pixels(self):
        import math
        for dpi in (300,600,1200):
            inches=[2.001,2.003];w,h=[math.ceil(v*dpi) for v in inches]
            edge=math.ceil(.25*dpi);right,bottom=[math.floor((v-.25)*dpi) for v in inches]
            safe_box=[edge,edge,right-edge,bottom-edge]
            m={'platform':'kdp','template':{'dpi':dpi,'size_inches':inches,'safe_box_px':safe_box},
               'source_size_px':[100,100],'placed_size_px':[100,100]}
            image=Image.new('RGB',(w,h),'white');art=Image.new('L',(w,h),0);text=Image.new('L',(w,h),0)
            art.putpixel((edge,edge),255)
            self.assertTrue(spatial_checks(m,image,art,text))
            for critical in (0,'false',[],None):
                m['template']['art_is_critical']=critical
                self.assertFalse(spatial_checks(m,image,art,text))
            m['template'].pop('art_is_critical')
            for box in ([edge-1,edge,right-edge,bottom-edge],[edge,edge-1,right-edge,bottom-edge],
                        [edge,edge,right-edge+1,bottom-edge],[edge,edge,right-edge,bottom-edge+1]):
                m['template']['safe_box_px']=box
                self.assertFalse(spatial_checks(m,image,art,text))
            m['template']['safe_box_px']=safe_box
            art.putpixel((edge-1,edge),255)
            self.assertFalse(spatial_checks(m,image,art,text))
            m['template']['art_is_critical']=False
            self.assertTrue(spatial_checks(m,image,art,text))
            text.putpixel((edge-1,edge),255)
            self.assertFalse(spatial_checks(m,image,art,text))

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
            from pod_common import save_json
            asset_rights=Path(tmp)/'asset-rights.json'
            text_layers=Path(tmp)/'text-layers.json';save_json(text_layers,[])
            save_json(asset_rights,sign({**common,'audience':'pod:asset-rights','status':'PASS',
                'source_sha256':digest(src),'text_layers_sha256':hashlib.sha256(canonical([]).encode()).hexdigest()},'POD_RIGHTS_KEY'))
            originals={'source':src,'rights':asset_rights,'text_layers':text_layers}
            with patch('pod_vision_qa.similarity',side_effect=AssertionError('must not download')):
                result=evaluate(Path(tmp)/'package',src,rights,review,['test-fixture'],source_evidence=originals)
                self.assertEqual(result['verdict'],'PASS',result)
                self.assertEqual(result['openclip']['status'],'NOT_REQUESTED')
                blocked=evaluate(Path(tmp)/'package',src,rights,review,[],source_evidence=originals)
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
                self.assertEqual(pdf[0].get_images(full=True)[0][5],'DeviceCMYK')
            self.assertEqual(m['cover_color_space'],'DeviceCMYK')
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
