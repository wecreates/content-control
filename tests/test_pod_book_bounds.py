import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import fitz

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from pod_book_interior import render_book
import pod_book_interior as book_renderer
from pod_common import digest
from pod_interior_preflight import inspect_interior, inspect_pairing
from pod_cover_preflight import inspect_cover
from PIL import Image, ImageChops, ImageStat
from reportlab.pdfgen import canvas as pdfcanvas
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont



class SpineTextTests(unittest.TestCase):
    def fixture(self,count=80,dpi=300):
        import math
        spine=count*.002252;width=1.001
        template={'platform':'kdp','dpi':dpi,'size_inches':[2*width+spine+.25,1.253],
                  'kdp':{'page_count':count,'trim_width_inches':width,
                         'spine_width_inches':spine,'bleed_inches':.125}}
        mask=Image.new('L',tuple(math.ceil(v*dpi) for v in template['size_inches']),0)
        left=(.125+width)*dpi;right=left+spine*dpi;gap=.0625*dpi
        return template,mask,(math.floor(left-gap),math.ceil(left+gap),
                              math.floor(right-gap),math.ceil(right+gap))

    def test_short_spines_reject_text_but_allow_front_and_back(self):
        from pod_cover_preflight import inspect_spine_text
        for count in (24,78):
            for dpi in (300,600,1200):
                template,mask,(back,start,end,front)=self.fixture(count,dpi)
                mask.putpixel((back-1,100),255);mask.putpixel((front,100),255)
                self.assertTrue(inspect_spine_text(template,mask))
                for x in (back,round((start+end)/2),front-1):
                    bad=mask.copy();bad.putpixel((x,100),1)
                    with self.subTest(count=count,dpi=dpi,x=x),self.assertRaisesRegex(ValueError,'^COVER_SPINE_TEXT_INVALID$'):
                        inspect_spine_text(template,bad)

    def test_spine_text_requires_inner_clearance_and_fold_variance(self):
        from pod_cover_preflight import inspect_spine_text
        for count in (80,82,150):
            for dpi in (300,600,1200):
                template,mask,(back,start,end,front)=self.fixture(count,dpi)
                for x in (back-1,start,end-1,front):
                    mask.putpixel((x,100),255)
                self.assertTrue(inspect_spine_text(template,mask))
                for x in (back,start-1,end,front-1):
                    bad=mask.copy();bad.putpixel((x,100),1)
                    with self.subTest(count=count,dpi=dpi,x=x),self.assertRaisesRegex(ValueError,'^COVER_SPINE_TEXT_INVALID$'):
                        inspect_spine_text(template,bad)

    def test_spine_check_rejects_malformed_geometry_and_mask(self):
        import copy
        from pod_cover_preflight import inspect_spine_text
        template,mask,_=self.fixture()
        mutations=[lambda t:t.pop('kdp'),lambda t:t.update(platform='redbubble'),
                   lambda t:t.update(dpi=True),lambda t:t.update(size_inches=[1,1])]
        mutations += [lambda t,key=key,value=value:t['kdp'].update({key:value})
                      for key in ('page_count','trim_width_inches','spine_width_inches','bleed_inches')
                      for value in (None,True,'80',float('nan'),float('inf'),0,-1)]
        mutations += [lambda t:t['kdp'].update(page_count=79),lambda t:t['kdp'].update(page_count=830)]
        for mutate in mutations:
            bad=copy.deepcopy(template);mutate(bad)
            with self.subTest(template=bad),self.assertRaisesRegex(ValueError,'^COVER_SPINE_SPEC_INVALID$'):
                inspect_spine_text(bad,mask)
        for bad in (mask.convert('RGB'),Image.new('L',(mask.width+1,mask.height))):
            with self.assertRaisesRegex(ValueError,'^COVER_SPINE_SPEC_INVALID$'):
                inspect_spine_text(template,bad)


class CalculatorArchiveTests(unittest.TestCase):
    archive=Path(__file__).resolve().parents[1]/'integrations/pod/templates/kdp/2026-10-20/paperback-6x9-24-bw-white-en_US.zip'
    sha='27915e7cfe7b7eb14b17044e996a8152440836f26e562130ea85a7b61a9ab6ac'

    def profile(self):
        return dict(binding='paperback',ink_type='black',paper_type='white',
                    reading_direction='left_to_right',trim_inches=[6,9],page_count=24,locale='en_US')

    def entries(self):
        import zipfile
        with zipfile.ZipFile(self.archive) as z:
            return [(i.filename,z.read(i)) for i in z.infolist()]

    def check_archive(self, entries, reason, compression=None):
        import hashlib,zipfile
        from pod_kdp_template_import import inspect_template_archive
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'source.zip'
            with zipfile.ZipFile(p,'w',compression=zipfile.ZIP_DEFLATED if compression is None else compression) as z:
                for name,data in entries:
                    z.writestr(name,data)
            sha=hashlib.sha256(p.read_bytes()).hexdigest()
            with self.assertRaisesRegex(ValueError,'^'+reason+'$'):
                inspect_template_archive(p,self.profile(),sha)
            self.assertEqual(list(Path(d).iterdir()),[p])

    def test_retained_official_archive_identity_profile_and_no_approval(self):
        from pod_kdp_template_import import inspect_template_archive
        report=inspect_template_archive(self.archive,self.profile(),self.sha)
        self.assertEqual(report['archive_bytes'],288195)
        self.assertEqual(report['guide']['png_size_px'],[7383,5550])
        self.assertEqual(report['guide']['pdf_page_box_pt'],[0,0,886,666])
        self.assertEqual(report['guide']['declared_cover_inches'],[12.304048,9.25])
        self.assertEqual(len(report['members']),3)
        self.assertEqual(report,inspect_template_archive(self.archive,self.profile(),self.sha))
        self.assertFalse(report['source_authority_verified'])
        self.assertFalse(report['production_template_approved'])
        self.assertFalse(report['publication_enabled'])

    def test_archive_requires_expected_hash_and_supported_explicit_profile(self):
        from pod_kdp_template_import import inspect_template_archive
        for sha,reason in ((None,'KDP_TEMPLATE_HASH_REQUIRED'),('A'*64,'KDP_TEMPLATE_HASH_REQUIRED'),
                           ('0'*64,'KDP_TEMPLATE_HASH_MISMATCH')):
            with self.subTest(sha=sha),self.assertRaisesRegex(ValueError,'^'+reason+'$'):
                inspect_template_archive(self.archive,self.profile(),sha)
        for field,values in (('binding',(None,'hardcover')),('paper_type',(True,[],'color')),
                             ('locale',('ja_JP',None)),('page_count',(True,23,25,830)),
                             ('trim_inches',([True,9],[10**400,9],[float('nan'),9],[6,float('inf')]))):
            for value in values:
                profile=self.profile();profile[field]=value
                with self.subTest(field=field,value=value),self.assertRaisesRegex(ValueError,'^KDP_TEMPLATE_PROFILE_INVALID$'):
                    inspect_template_archive(self.archive,profile,self.sha)
        profile=self.profile();profile['country']='US'
        with self.assertRaisesRegex(ValueError,'^KDP_TEMPLATE_PROFILE_INVALID$'):
            inspect_template_archive(self.archive,profile,self.sha)

    def test_archive_rejects_duplicate_extra_traversing_and_link_entries(self):
        import stat,zipfile
        original=self.entries()
        for entries in (original+[original[0]],original+[('../escape',b'x')],
                        [('nested/'+name,data) for name,data in original]):
            self.check_archive(entries,'KDP_TEMPLATE_ARCHIVE_INVALID')
        name,data=original[0];link=zipfile.ZipInfo(name)
        link.create_system=3;link.external_attr=(stat.S_IFLNK|0o777)<<16
        self.check_archive([(link,data)]+original[1:],'KDP_TEMPLATE_ARCHIVE_INVALID')
        self.check_archive(original,'KDP_TEMPLATE_ARCHIVE_INVALID',zipfile.ZIP_BZIP2)

    def test_archive_declared_expansion_limits_precede_pdf_parsing(self):
        original=self.entries()
        self.check_archive([(name,b'x'*(16*1024*1024+1) if name=='readme.txt' else data)
                            for name,data in original],'KDP_TEMPLATE_ARCHIVE_INVALID')
        self.check_archive([(name,b'x'*(11*1024*1024)) for name,_ in original],
                           'KDP_TEMPLATE_ARCHIVE_INVALID')

    def test_archive_rejects_wrong_pdf_geometry_and_profile_text(self):
        original=self.entries()
        for size in ((100,100),(886,666)):
            with fitz.open() as doc:
                page=doc.new_page(width=size[0],height=size[1])
                page.insert_text((10,30),'Wrong guide profile')
                pdf=doc.tobytes()
            self.check_archive([(name,pdf if name.endswith('.pdf') else data) for name,data in original],
                               'KDP_TEMPLATE_GUIDE_INVALID')

    def test_archive_rejects_wrong_png_dimensions_crc_and_readme(self):
        import io
        original=self.entries();buf=io.BytesIO()
        Image.new('RGB',(1,1)).save(buf,format='PNG',dpi=(600,600))
        png=next(data for name,data in original if name.endswith('.png'))
        bad=bytearray(png);bad[png.index(b'IDAT')+10]^=1
        for data in (buf.getvalue(),bytes(bad)):
            self.check_archive([(name,data if name.endswith('.png') else body) for name,body in original],
                               'KDP_TEMPLATE_RASTER_INVALID')
        for data in (b'',b'\xff',b'x'*65537):
            # Empty members are rejected at the archive layer.
            self.check_archive([(name,data if name=='readme.txt' else body) for name,body in original],
                               'KDP_TEMPLATE_ARCHIVE_INVALID' if not data else 'KDP_TEMPLATE_README_INVALID')

    def test_archive_rejects_truncated_bytes_even_with_rebound_hash(self):
        import hashlib
        from pod_kdp_template_import import inspect_template_archive
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'source.zip';data=self.archive.read_bytes()[:-32];p.write_bytes(data)
            with self.assertRaisesRegex(ValueError,'^KDP_TEMPLATE_ARCHIVE_INVALID$'):
                inspect_template_archive(p,self.profile(),hashlib.sha256(data).hexdigest())

    def test_offline_import_cli_emits_inspection_only(self):
        import json,subprocess
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'profile.json';p.write_text(json.dumps(self.profile()))
            result=subprocess.run([sys.executable,str(Path(__file__).resolve().parents[1]/'scripts/pod_kdp_template_import.py'),
                                   '--archive',str(self.archive),'--profile',str(p),'--expected-sha256',self.sha],
                                  capture_output=True,text=True,timeout=30)
            self.assertEqual(result.returncode,0,result.stderr)
            report=json.loads(result.stdout)
            self.assertEqual(report['archive_sha256'],self.sha)
            self.assertFalse(report['production_template_approved'])

    def test_inline_profile_cli_binds_retained_guide_to_requested_book(self):
        import json,subprocess
        script=str(Path(__file__).resolve().parents[1]/'scripts/pod_kdp_template_import.py')
        for patch,reason in (({},None),({'page_count':26},'KDP_TEMPLATE_ARCHIVE_INVALID'),
                             ({'paper_type':'cream'},'KDP_TEMPLATE_ARCHIVE_INVALID'),
                             ({'trim_inches':[5,8]},'KDP_TEMPLATE_ARCHIVE_INVALID'),
                             ({'reading_direction':'right_to_left'},'KDP_TEMPLATE_PROFILE_INVALID'),
                             ({'locale':'ja_JP'},'KDP_TEMPLATE_PROFILE_INVALID')):
            profile={**self.profile(),**patch}
            result=subprocess.run([sys.executable,script,'--archive',str(self.archive),
                                   '--profile-json',json.dumps(profile),'--expected-sha256',self.sha],
                                  capture_output=True,text=True,timeout=30)
            report=json.loads(result.stdout)
            with self.subTest(patch=patch):
                self.assertEqual(result.returncode,2 if reason else 0,result.stderr)
                self.assertFalse(report['publication_enabled'])
                if reason:
                    self.assertEqual(report['reason_code'],reason)
                else:
                    self.assertEqual(report['profile'],profile)
                    self.assertFalse(report['production_template_approved'])

    def test_inline_profile_parser_rejects_ambiguous_and_oversized_json(self):
        import json
        from pod_kdp_template_import import profile_json
        self.assertEqual(profile_json(json.dumps(self.profile())),self.profile())
        for text in ('{"page_count":24,"page_count":26}',
                     '{"locale":"en_US","loca\\u006ce":"ja_JP"}',
                     '{"trim_inches":[NaN,9]}','{"trim_inches":[Infinity,9]}',
                     'x'*4097,'"'+'é'*2048+'"','{','\ufeff{}'):
            with self.subTest(text=text[:80]),self.assertRaisesRegex(ValueError,'^KDP_TEMPLATE_PROFILE_INVALID$'):
                profile_json(text)

    def test_worker_invokes_real_inspector_before_synthetic_generation(self):
        # Actual Node coordinator -> actual Python archive inspector. The later
        # rendering sentinels and signatures are synthetic, never live approval.
        import json,subprocess
        repository=Path(__file__).resolve().parents[1]
        worker=(repository/'scripts/pod_production_worker.mjs').as_uri()
        code=r'''
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const {produceOnce}=await import(process.argv[1]);
const root=process.argv[2],archive=process.argv[3],count=Number(process.argv[4]);
const key='synthetic-profile-bridge-key-'.repeat(2);
const sign=value=>{const payload=JSON.stringify({schema_version:1,issued_at_ms:Date.now()-1,
 expires_at_ms:Date.now()+300000,...value});return {payload,signature:crypto.createHmac('sha256',key).update(payload).digest('hex')};};
const spine=count*.002252,scope={product:'fixture-book',country:'US'};
const record={...scope,official_source_verified:true,source_url:'https://example.org/synthetic-acquisition',
 source_sha256:'27915e7cfe7b7eb14b17044e996a8152440836f26e562130ea85a7b61a9ab6ac',observed_at:new Date().toISOString()};
const cover={platform:'kdp',dpi:300,size_inches:[12+spine+.25,9.25],safe_box_px:[75,75,500,500],
 kdp:{binding:'paperback',ink_type:'black',paper_type:'white',page_count:count,
 trim_width_inches:6,spine_width_inches:spine,bleed_inches:.125,reading_direction:'left_to_right',locale:'en_US'}};
const interior={platform:'kdp',binding:'paperback',ink_type:'black',paper_type:'white',interior_type:'text_no_bleed',
 page_count:count,trim_inches:[6,9],font_size_pt:10,margins_inches:{inside:.375,outside:.25,top:.25,bottom:.25}};
await fs.writeFile(path.join(root,'cover.json'),JSON.stringify(sign({...record,audience:'pod:template',template:cover})));
await fs.writeFile(path.join(root,'interior.json'),JSON.stringify(sign({...record,audience:'pod:interior-template',template:interior})));
const brief={id:'fixture',account_id:'a',business_id:'b',platform:'kdp',destination_platform:'kdp',mode:'PRELAUNCH'};
let held=0,cleaned=0;
const result=await produceOnce({root,upstreamKey:key,env:{...process.env,POD_PYTHON:process.argv[5],
 POD_PRODUCTION_ENABLED:'true',POD_TEMPLATE_KEY:key,PUBLICATION_ENABLED:'false',POD_PUBLICATION_ENABLED:'false'},
 db:{claimProduction:async()=>({id:brief.id,brief}),assertProducible:async()=>{},failProduction:async()=>{},holdProduction:async()=>{held++;}},
 resolveGrant:async()=>sign({audience:'content-control:pod',job_id:brief.id,account_id:'a',business_id:'b',platform:'kdp',
 max_mode:'PRELAUNCH',production_permission:true,publication_permission:false,revoked:false}),
 resolveTask:async()=>({rights_verified:true,templateScope:scope,template:path.join(root,'cover.json'),templateSource:archive,
 source:'unused',textLayers:'unused',assetRights:'unused',reference:'unused',output:path.join(root,'output'),
 interior:{template:path.join(root,'interior.json'),pages:'unused',font:'unused'},cleanup:async()=>{cleaned++;}})});
const started=await fs.stat(path.join(root,'started')).then(()=>true,()=>false);
console.log(JSON.stringify({result,started,held,cleaned}));
'''
        for count in (24,26):
            with self.subTest(page_count=count),tempfile.TemporaryDirectory() as d:
                root=Path(d);scripts=root/'scripts';scripts.mkdir();(root/'output').mkdir()
                (scripts/'pod_kdp_template_import.py').symlink_to(repository/'scripts/pod_kdp_template_import.py')
                (scripts/'pod_asset_generator.py').write_text(
                    "from pathlib import Path\nPath('started').write_text('yes')\n"
                    "Path('output/manifest.json').write_text('{\"files\":{},\"package_sha256\":\"'+'a'*64+'\"}')\n")
                (scripts/'pod_book_package.py').write_text('pass\n')
                result=subprocess.run(['node','--input-type=module','-e',code,worker,str(root),str(self.archive),str(count),sys.executable],
                                      capture_output=True,text=True,timeout=30)
                self.assertEqual(result.returncode,0,result.stderr)
                report=json.loads(result.stdout)
                self.assertEqual(report['result']['status'],'REVIEW_REQUIRED' if count==24 else 'BLOCKED')
                self.assertEqual(report['started'],count==24)
                self.assertEqual(report['held'],1 if count==24 else 0)
                self.assertEqual(report['cleaned'],1)
                if count==26:
                    self.assertEqual(report['result']['reason_code'],'KDP_TEMPLATE_ARCHIVE_INVALID')

class InteriorEmbeddingTests(unittest.TestCase):
    def test_renderer_references_only_embedded_fonts(self):
        font,spec=BookBoundsTests().spec()
        with tempfile.TemporaryDirectory() as d:
            target=Path(d)/'book.pdf';render_book(spec,[{'lines':['Embedded text']}],font,target)
            with fitz.open(target) as doc:
                fonts=doc[0].get_fonts(full=True)
                self.assertTrue(fonts)
                self.assertTrue(all(doc.extract_font(f[0])[3] for f in fonts))
            self.assertTrue(inspect_interior(target,spec))

    def test_unembedded_fonts_and_mixed_resources_are_rejected(self):
        font,spec=BookBoundsTests().spec()
        pdfmetrics.registerFont(TTFont('EmbeddingFixture',font))
        for mode in ('builtin','mixed','unused_builtin'):
            with self.subTest(mode=mode),tempfile.TemporaryDirectory() as d:
                target=Path(d)/'book.pdf'
                pdf=pdfcanvas.Canvas(str(target),pagesize=(144,144),invariant=1)
                if mode!='builtin':
                    pdf.setFont('EmbeddingFixture',12);pdf.drawString(27,108,'Embedded')
                    if mode=='mixed':
                        pdf.setFont('Helvetica',12);pdf.drawString(27,84,'Builtin')
                else:
                    pdf.setFont('Helvetica',12);pdf.drawString(27,108,'Builtin')
                pdf.showPage();pdf.save()
                with fitz.open(target) as doc:
                    self.assertTrue(doc[0].get_text().strip())
                    self.assertTrue(any(not doc.extract_font(f[0])[3] for f in doc[0].get_fonts(full=True)))
                with self.assertRaisesRegex(ValueError,'^INTERIOR_FONT_EMBEDDING_REQUIRED$'):
                    inspect_interior(target,spec)


    def test_unused_font_with_corrupt_program_is_rejected(self):
        font,spec=BookBoundsTests().spec()
        with tempfile.TemporaryDirectory() as d:
            source=Path(d)/'source.pdf';target=Path(d)/'changed.pdf'
            render_book(spec,[{'lines':['Embedded text']}],font,source)
            with fitz.open(source) as doc:
                original=next(f[0] for f in doc[0].get_fonts(full=True) if f[1]=='ttf')
                descriptor=int(doc.xref_get_key(original,'FontDescriptor')[1].split()[0])
                bad_stream=doc.get_new_xref();doc.update_object(bad_stream,'<< >>')
                doc.update_stream(bad_stream,b'\x00\x01\x00\x00truncated-program')
                bad_descriptor=doc.get_new_xref();doc.update_object(bad_descriptor,doc.xref_object(descriptor))
                doc.xref_set_key(bad_descriptor,'FontFile2',f'{bad_stream} 0 R')
                bad_font=doc.get_new_xref();doc.update_object(bad_font,doc.xref_object(original))
                doc.xref_set_key(bad_font,'FontDescriptor',f'{bad_descriptor} 0 R')
                resources=int(doc.xref_get_key(doc[0].xref,'Resources/Font')[1].split()[0])
                doc.xref_set_key(resources,'Unused',f'{bad_font} 0 R')
                doc.save(target)
            with fitz.open(source) as a,fitz.open(target) as b:
                self.assertEqual(a[0].get_text(),b[0].get_text())
                self.assertEqual(a[0].get_pixmap().samples,b[0].get_pixmap().samples)
            with self.assertRaisesRegex(ValueError,'^INTERIOR_FONT_EMBEDDING_INVALID$'):
                inspect_interior(target,spec)


class InteriorFontSizeTests(unittest.TestCase):
    def fixture(self, root, sizes, scale=1, mixed=False, rotate=0):
        _,spec=BookBoundsTests().spec()
        spec['page_count']=len(sizes)
        target=root/'font-size.pdf'
        font,_=BookBoundsTests().spec();pdfmetrics.registerFont(TTFont('SizeFixture',font))
        pdf=pdfcanvas.Canvas(str(target),pagesize=(144,144),invariant=1,initialFontName='SizeFixture')
        for size in sizes:
            pdf.saveState();pdf.translate(27,100);pdf.rotate(rotate)
            pdf.scale(*(scale if isinstance(scale,tuple) else (scale,scale)))
            pdf.setFont('SizeFixture',size);pdf.drawString(0,0,'Delivered text')
            pdf.restoreState()
            if mixed:
                pdf.setFont('SizeFixture',12);pdf.drawString(27,75,'Readable text')
            pdf.showPage()
        pdf.save()
        return target,spec

    def test_undersized_delivered_text_rejected_despite_larger_declared_font(self):
        for size in (1,6,6.99):
            with self.subTest(size=size),tempfile.TemporaryDirectory() as d:
                target,spec=self.fixture(Path(d),[size])
                self.assertEqual(spec['font_size_pt'],12)
                with fitz.open(target) as doc:
                    self.assertEqual(doc[0].get_text().strip(),'Delivered text')
                    self.assertTrue(all(c[1]>0 for t in doc[0].get_texttrace() for c in t['chars']))
                with self.assertRaisesRegex(ValueError,'^INTERIOR_FONT_SIZE_INVALID$'):
                    inspect_interior(target,spec)

    def test_small_text_is_rejected_on_later_pages_and_beside_valid_text(self):
        for sizes,mixed in (([12,6],False),([6],True)):
            with self.subTest(sizes=sizes,mixed=mixed),tempfile.TemporaryDirectory() as d:
                target,spec=self.fixture(Path(d),sizes,mixed=mixed)
                with self.assertRaisesRegex(ValueError,'^INTERIOR_FONT_SIZE_INVALID$'):
                    inspect_interior(target,spec)

    def test_transformed_font_is_measured_in_delivered_page_space(self):
        with tempfile.TemporaryDirectory() as d:
            target,spec=self.fixture(Path(d),[12],scale=.5)
            with fitz.open(target) as doc:
                self.assertAlmostEqual(doc[0].get_texttrace()[0]['size'],6)
            with self.assertRaisesRegex(ValueError,'^INTERIOR_FONT_SIZE_INVALID$'):
                inspect_interior(target,spec)

    def test_vertical_compression_cannot_hide_behind_trace_font_size(self):
        for scale in ((1,.5),(.5,1)):
            with self.subTest(scale=scale),tempfile.TemporaryDirectory() as d:
                target,spec=self.fixture(Path(d),[12],scale=scale)
                with self.assertRaisesRegex(ValueError,'^INTERIOR_FONT_SIZE_INVALID$'):
                    inspect_interior(target,spec)

    def test_rotated_text_requires_a_separately_supported_contract(self):
        with tempfile.TemporaryDirectory() as d:
            target,spec=self.fixture(Path(d),[7],rotate=5)
            with self.assertRaisesRegex(ValueError,'^INTERIOR_TEXT_TRANSFORM_UNSUPPORTED$'):
                inspect_interior(target,spec)

    def test_exact_minimum_and_larger_delivered_fonts_pass(self):
        for size,scale in ((7,1),(14,.5),(8,1),(12,1)):
            with self.subTest(size=size,scale=scale),tempfile.TemporaryDirectory() as d:
                target,spec=self.fixture(Path(d),[size],scale=scale)
                self.assertTrue(inspect_interior(target,spec))


class InteriorGlyphTests(unittest.TestCase):
    def fixture(self, root, lines, mapped_missing=False):
        font, spec = BookBoundsTests().spec()
        spec['page_count'] = len(lines)
        pdfmetrics.registerFont(TTFont('GlyphFixture', font))
        source = root/'source.pdf'
        pdf = pdfcanvas.Canvas(str(source), pagesize=(144,144), invariant=1, initialFontName='GlyphFixture')
        for line in lines:
            pdf.setFont('GlyphFixture',12)
            pdf.drawString(27,108,line)
            pdf.showPage()
        pdf.save()
        if mapped_missing:
            target = root/'mapped.pdf'
            with fitz.open(source) as doc:
                changed = False
                for font_info in doc[0].get_fonts():
                    kind, value = doc.xref_get_key(font_info[0], 'ToUnicode')
                    if kind == 'xref':
                        ref = int(value.split()[0]); data = doc.xref_stream(ref)
                        if b'<00> <0000>' in data:
                            doc.update_stream(ref,data.replace(b'<00> <0000>',b'<00> <4E2D>'))
                            changed = True
                self.assertTrue(changed)
                doc.save(target)
            return target, spec
        return source, spec

    def test_missing_glyph_rejected_in_actual_delivered_pdf(self):
        with tempfile.TemporaryDirectory() as tmp:
            path, spec = self.fixture(Path(tmp), ['A中B'])
            with fitz.open(path) as doc:
                self.assertTrue(any(c[1] == 0 for t in doc[0].get_texttrace() for c in t['chars']))
            with self.assertRaisesRegex(ValueError, '^INTERIOR_GLYPH_MISSING$'):
                inspect_interior(path,spec)

    def test_correct_unicode_extraction_cannot_hide_missing_glyph(self):
        with tempfile.TemporaryDirectory() as tmp:
            path, spec = self.fixture(Path(tmp), ['A中B'], mapped_missing=True)
            with fitz.open(path) as doc:
                self.assertEqual(doc[0].get_text().splitlines(), ['A中B'])
                self.assertIn((ord('中'),0),[(c[0],c[1]) for t in doc[0].get_texttrace() for c in t['chars']])
            with self.assertRaisesRegex(ValueError, '^INTERIOR_GLYPH_MISSING$'):
                inspect_interior(path,spec)

    def test_later_page_missing_glyph_is_not_hidden_by_valid_first_page(self):
        with tempfile.TemporaryDirectory() as tmp:
            path, spec = self.fixture(Path(tmp), ['Valid text','A中B'])
            with self.assertRaisesRegex(ValueError, '^INTERIOR_GLYPH_MISSING$'):
                inspect_interior(path,spec)

    def test_supported_unicode_and_literal_replacement_glyph_remain_valid(self):
        with tempfile.TemporaryDirectory() as tmp:
            path, spec = self.fixture(Path(tmp), ['É Ω Ж � fi ﬁ'])
            with fitz.open(path) as doc:
                chars = [c for t in doc[0].get_texttrace() for c in t['chars']]
                self.assertTrue(any(c[0] == 0xfffd and c[1] > 0 for c in chars))
                self.assertTrue(all(c[1] != 0 for c in chars))
            self.assertTrue(inspect_interior(path,spec))

class InteriorClippingTests(unittest.TestCase):
    def fixture(self, root, mode):
        _, spec = BookBoundsTests().spec()
        target = root/(mode+'.pdf')
        font,_=BookBoundsTests().spec();pdfmetrics.registerFont(TTFont('ClipFixture',font))
        pdf = pdfcanvas.Canvas(str(target), pagesize=(144,144), invariant=1, initialFontName='ClipFixture')
        pdf.saveState()
        if mode in ('partial','hidden','hole'):
            path = pdf.beginPath()
            if mode == 'hole':
                path.rect(0,0,144,144)
                path.rect(40,96,20,24)
            else:
                path.rect(0,0,40 if mode == 'partial' else 10,144)
            pdf.clipPath(path,stroke=0,fill=0,fillMode=0)
        pdf.setFont('ClipFixture',12)
        pdf.drawString(27,108,'Clipped text')
        pdf.restoreState()
        if mode == 'hidden':
            pdf.setFont('ClipFixture',12)
            pdf.drawString(27,84,'Visible text')
        pdf.showPage();pdf.save()
        return target,spec

    def test_partial_clip_rejected_when_text_is_still_extractable(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);normal,_=self.fixture(root,'normal');clipped,spec=self.fixture(root,'partial')
            with fitz.open(normal) as original, fitz.open(clipped) as edited:
                self.assertEqual(edited[0].get_text().strip(),'Cli')
                self.assertEqual(edited[0].get_drawings(),[])
                original_ink=sum(p<250 for p in original[0].get_pixmap(colorspace=fitz.csGRAY).samples)
                clipped_ink=sum(p<250 for p in edited[0].get_pixmap(colorspace=fitz.csGRAY).samples)
                self.assertGreater(clipped_ink,0)
                self.assertLess(clipped_ink,original_ink)
            with self.assertRaisesRegex(ValueError,'^INTERIOR_CONTENT_UNSUPPORTED$'):
                inspect_interior(clipped,spec)

    def test_hidden_line_cannot_pass_alongside_visible_text(self):
        with tempfile.TemporaryDirectory() as tmp:
            path,spec=self.fixture(Path(tmp),'hidden')
            with fitz.open(path) as doc:
                self.assertEqual(doc[0].get_text().strip(),'Visible text')
                self.assertEqual(len(doc[0].get_texttrace()),2)
            with self.assertRaisesRegex(ValueError,'^INTERIOR_CONTENT_UNSUPPORTED$'):
                inspect_interior(path,spec)

    def test_even_odd_hole_rejected_despite_full_page_clip_bounds(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);normal,_=self.fixture(root,'normal');path,spec=self.fixture(root,'hole')
            with fitz.open(normal) as original, fitz.open(path) as edited:
                clips=[p for p in edited[0].get_drawings(extended=True) if p['type']=='clip']
                self.assertEqual(len(clips),1)
                self.assertEqual(clips[0]['scissor'],edited[0].rect)
                self.assertNotEqual(original[0].get_pixmap().samples,edited[0].get_pixmap().samples)
            with self.assertRaisesRegex(ValueError,'^INTERIOR_CONTENT_UNSUPPORTED$'):
                inspect_interior(path,spec)

    def test_save_restore_without_clipping_remains_supported(self):
        with tempfile.TemporaryDirectory() as tmp:
            path,spec=self.fixture(Path(tmp),'normal')
            self.assertTrue(inspect_interior(path,spec))


class BookFontSnapshotTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.font = self.root / 'font.ttf'
        self.font.write_bytes(Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf').read_bytes())
        self.spec = {'platform': 'kdp', 'interior_type': 'text_no_bleed', 'trim_inches': [2, 2],
            'page_count': 1, 'margins_inches': dict(inside=.25, outside=.25, top=.25, bottom=.25),
            'font_sha256': digest(self.font), 'font_size_pt': 10, 'leading_pt': 12}
        self.pages = [{'lines': ['Original text']}]
        self.output = self.root / 'book.pdf'

    def test_font_mutation_after_verification_cannot_replace_embedded_typeface(self):
        for mutation in ('overwrite', 'delete'):
            with self.subTest(mutation=mutation):
                self.font.write_bytes(Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf').read_bytes())
                real_font = book_renderer.TTFont
                def mutate_then_load(name, source):
                    if mutation == 'overwrite':
                        self.font.write_bytes(b'unverified typeface')
                    else:
                        self.font.unlink()
                    return real_font(name, source)
                target = self.root / (mutation + '.pdf')
                with patch.object(book_renderer, 'TTFont', side_effect=mutate_then_load):
                    receipt = render_book(self.spec, self.pages, self.font, target)
                self.assertTrue(receipt['technical_checks_passed'])
                self.assertFalse(receipt['production_ready'])
                with fitz.open(target) as pdf:
                    self.assertEqual(pdf[0].get_text().splitlines(), ['Original text'])
                    self.assertTrue(any(font[1] == 'ttf' for font in pdf[0].get_fonts()))

    def test_font_ceiling_blocks_before_parser_and_pdf_creation(self):
        with patch.object(book_renderer, 'MAX_FONT_BYTES', self.font.stat().st_size - 1, create=True), patch.object(
                book_renderer, 'TTFont', side_effect=AssertionError('font parser reached')):
            with self.assertRaisesRegex(ValueError, '^FONT_BYTES_INVALID$'):
                render_book(self.spec, self.pages, self.font, self.output)
        self.assertFalse(self.output.exists())

    def test_exact_font_ceiling_can_produce_a_verified_pdf(self):
        with patch.object(book_renderer, 'MAX_FONT_BYTES', self.font.stat().st_size, create=True):
            result = render_book(self.spec, self.pages, self.font, self.output)
        self.assertTrue(result['technical_checks_passed'])

    def test_empty_font_with_matching_digest_never_reaches_parser(self):
        self.font.write_bytes(b'')
        self.spec['font_sha256'] = digest(self.font)
        with patch.object(book_renderer, 'TTFont', side_effect=AssertionError('font parser reached')):
            with self.assertRaisesRegex(ValueError, '^FONT_BYTES_INVALID$'):
                render_book(self.spec, self.pages, self.font, self.output)
        self.assertFalse(self.output.exists())

    def test_wrong_font_identity_blocks_before_parser_and_pdf_creation(self):
        self.spec['font_sha256'] = '0' * 64
        with patch.object(book_renderer, 'TTFont', side_effect=AssertionError('font parser reached')):
            with self.assertRaisesRegex(ValueError, '^FONT_HASH_MISMATCH$'):
                render_book(self.spec, self.pages, self.font, self.output)
        self.assertFalse(self.output.exists())


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

    def production_pair(self, count=24, paper='white'):
        # Synthetic specifications only; no actual template or rights approval.
        spec={'platform':'kdp','binding':'paperback','ink_type':'black',
              'paper_type':paper,'trim_inches':[6,9],'page_count':count,
              'margins_inches':dict(inside=.875,outside=.25,top=.25,bottom=.25)}
        spine=count*{'white':.002252,'cream':.0025,'groundwood':.00235}[paper]
        cover={'platform':'kdp','size_inches':[12+spine+.25,9.25],
               'kdp':{'binding':'paperback','ink_type':'black','paper_type':paper,
                      'trim_width_inches':6,'spine_width_inches':spine,'bleed_inches':.125,'page_count':count}}
        return spec,cover

    def test_pairing_enforces_each_gutter_band_and_exact_no_bleed_minima(self):
        for count,minimum in ((24,.375),(150,.375),(152,.5),(300,.5),(302,.625),
                              (500,.625),(502,.75),(700,.75),(702,.875),(828,.875)):
            spec,cover=self.production_pair(count)
            spec['margins_inches']=dict(inside=minimum,outside=.25,top=.25,bottom=.25)
            with self.subTest(count=count,valid=True):
                self.assertTrue(inspect_pairing(spec,cover))
            for field in ('inside','outside','top','bottom'):
                candidate={**spec,'margins_inches':{**spec['margins_inches']}}
                candidate['margins_inches'][field]-=.000001
                with self.subTest(count=count,field=field),self.assertRaisesRegex(
                        ValueError,'^INTERIOR_MARGIN_SPEC_INVALID$'):
                    inspect_pairing(candidate,cover)

    def test_pairing_rejects_missing_malformed_and_consuming_margins(self):
        import copy
        spec,cover=self.production_pair()
        for value in (None,True,[],{},'0.375'):
            candidate=copy.deepcopy(spec);candidate['margins_inches']=value
            with self.subTest(margins=value),self.assertRaisesRegex(ValueError,'^INTERIOR_MARGIN_SPEC_INVALID$'):
                inspect_pairing(candidate,cover)
        for field in ('inside','outside','top','bottom'):
            for value in (None,True,'0.5',float('nan'),float('inf'),-1,0):
                candidate=copy.deepcopy(spec);candidate['margins_inches'][field]=value
                with self.subTest(field=field,value=value),self.assertRaisesRegex(ValueError,'^INTERIOR_MARGIN_SPEC_INVALID$'):
                    inspect_pairing(candidate,cover)
            candidate=copy.deepcopy(spec);candidate['margins_inches'].pop(field)
            with self.subTest(missing=field),self.assertRaisesRegex(ValueError,'^INTERIOR_MARGIN_SPEC_INVALID$'):
                inspect_pairing(candidate,cover)
        candidate=copy.deepcopy(spec);candidate.pop('margins_inches')
        with self.assertRaisesRegex(ValueError,'^INTERIOR_MARGIN_SPEC_INVALID$'):
            inspect_pairing(candidate,cover)
        for margins in (dict(inside=5.75,outside=.25,top=.25,bottom=.25),
                        dict(inside=5.751,outside=.25,top=.25,bottom=.25),
                        dict(inside=.375,outside=.25,top=8.75,bottom=.25),
                        dict(inside=.375,outside=.25,top=8.751,bottom=.25)):
            with self.subTest(margins=margins),self.assertRaisesRegex(ValueError,'^INTERIOR_MARGIN_SPEC_INVALID$'):
                inspect_pairing({**spec,'margins_inches':margins},cover)

    def test_cover_pairing_dimensions_and_strict_numeric_values(self):
        import copy
        spec,cover=self.production_pair()
        self.assertTrue(inspect_pairing(spec,cover))
        changes=[lambda c:c.update(platform='redbubble'),lambda c:c.update(size_inches=[12.4,9.25]),
                 lambda c:c.update(size_inches=[12.304048,9.5]),lambda c:c['kdp'].update(trim_width_inches=5),
                 lambda c:c['kdp'].update(page_count=26),lambda c:c['kdp'].update(page_count=True)]
        changes += [lambda c,key=key,v=v:c['kdp'].update({key:v})
                    for key in ('trim_width_inches','spine_width_inches','bleed_inches')
                    for v in (True,float('nan'),float('inf'),-1,'0.1')]
        for change in changes:
            candidate=copy.deepcopy(cover);change(candidate)
            with self.subTest(candidate=candidate),self.assertRaisesRegex(ValueError,'COVER_INTERIOR_MISMATCH'):
                inspect_pairing(spec,candidate)

    def test_pairing_independently_rejects_missing_malformed_and_wrong_paper_profiles(self):
        import copy
        for field,wrong in [('binding','hardcover'),('ink_type','color'),('paper_type','cream')]:
            for value in (None,True,[wrong],wrong):
                for target in ('interior','cover'):
                    spec,cover=self.production_pair()
                    (spec if target=='interior' else cover['kdp'])[field]=value
                    with self.subTest(field=field,value=value,target=target),self.assertRaisesRegex(ValueError,'COVER_INTERIOR_MISMATCH'):
                        inspect_pairing(spec,cover)
            spec,cover=self.production_pair();spec.pop(field);cover['kdp'].pop(field)
            with self.subTest(missing=field),self.assertRaisesRegex(ValueError,'COVER_INTERIOR_MISMATCH'):
                inspect_pairing(spec,cover)
        spec,cover=self.production_pair();spec['paper_type']=cover['kdp']['paper_type']='cream'
        # Dimensions and count remain internally consistent with the wrong spine.
        with self.assertRaisesRegex(ValueError,'COVER_INTERIOR_MISMATCH'):
            inspect_pairing(spec,cover)
        spec,cover=self.production_pair();cover['kdp']['bleed_inches']=.1
        cover['size_inches']=[12+cover['kdp']['spine_width_inches']+.2,9.2]
        with self.assertRaisesRegex(ValueError,'COVER_INTERIOR_MISMATCH'):
            inspect_pairing(spec,cover)

    def test_pairing_rejects_small_and_odd_counts_without_padding(self):
        for count in (2,23,25,827,830):
            spec,cover=self.production_pair(count)
            with self.subTest(count=count),self.assertRaisesRegex(ValueError,'COVER_INTERIOR_MISMATCH'):
                inspect_pairing(spec,cover)

    def test_each_paper_pairs_with_a_real_even_page_interior(self):
        font,base=self.spec()
        for paper in ('white','cream','groundwood'):
            spec,cover=self.production_pair(paper=paper)
            spec={**base,**spec,'margins_inches':dict(inside=.375,outside=.25,top=.25,bottom=.25)}
            with tempfile.TemporaryDirectory() as d:
                target=Path(d)/'book.pdf'
                receipt=render_book(spec,[{'lines':[f'Fixture page {i+1}']} for i in range(24)],font,target)
                self.assertEqual(receipt['page_count'],24)
                self.assertTrue(inspect_pairing(spec,cover))
                self.assertTrue(inspect_interior(target,spec))
                with fitz.open(target) as doc:
                    self.assertEqual(len(doc),24)
                    self.assertTrue(all(page.get_text().strip() for page in doc))

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
    def test_print_boxes_cannot_change_delivered_geometry(self):
        # These boxes do not change the ordinary preview raster or extraction,
        # but must not specify a different print region from this static subset.
        for box in ('trimbox', 'bleedbox', 'artbox'):
            def edit(doc):
                page = doc[0]
                before = page.get_pixmap().samples
                text = page.get_text()
                getattr(page, 'set_' + box)(fitz.Rect(10, 10, 100, 100))
                self.assertEqual(page.get_pixmap().samples, before)
                self.assertEqual(page.get_text(), text)
            with self.subTest(box=box):
                self.check_mutation(edit, expected='PAGE_BOX_INVALID')

    def test_explicit_full_page_print_boxes_remain_supported(self):
        with tempfile.TemporaryDirectory() as d:
            for kind in ('INTERIOR', 'COVER'):
                source = Path(d) / (kind + '-source.pdf')
                target = Path(d) / (kind + '-boxes.pdf')
                if kind == 'INTERIOR':
                    font, spec = BookBoundsTests().spec()
                    render_book(spec, [{'lines': ['gyp']}], font, source)
                    inspect = lambda p: inspect_interior(p, spec)
                else:
                    image = Image.new('RGB', (600, 900), 'white')
                    CoverPreflightTests().write_cover(source, image)
                    inspect = lambda p: inspect_cover(p, image, 300)
                with fitz.open(source) as doc:
                    page = doc[0]
                    for box in ('trimbox', 'bleedbox', 'artbox'):
                        getattr(page, 'set_' + box)(page.cropbox)
                    doc.save(target)
                with self.subTest(kind=kind):
                    self.assertTrue(inspect(target))

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
