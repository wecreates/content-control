import hashlib
import os
from pathlib import Path
import sys
import tempfile
import unittest
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from pod_asset_generator import generate
from pod_market_intake import ProductParser, products, screen
from pod_vision_qa import spatial_checks, ocr, evaluate
from pod_common import digest, canonical
from pod_original_art import create_art
from pod_book_interior import render_book

class PODTests(unittest.TestCase):
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
