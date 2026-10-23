import copy
import json
import os
from pathlib import Path
import shutil
import stat
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'scripts'))
import pod_review_package as review
import pod_output_attempt as attempts
import pod_asset_generator as assets
import pod_book_package as books
from pod_original_art import create_art
from pod_common import digest
from PIL import Image
from reportlab.pdfgen import canvas as pdfcanvas


class ReviewRecoveryTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory(); self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name); self.output = self.root/'review'
        self.font = Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
        self.spec = {'publication_enabled':False, 'paid_generation_enabled':False, 'platform':'kdp',
            'metadata':{'title':'Recovery fixture', 'author':'Fixture', 'language':'en',
                'description':'Synthetic review fixture', 'keywords':['fixture'],
                'ai_generated':{'text':False, 'images':False, 'translations':False}},
            'original_art':{'concept_id':'recovery-fixture', 'size_px':[600,600],
                'palette':[[0,0,0,255],[80,90,120,255]]},
            'cover_template':{'platform':'kdp','dpi':300,'size_inches':[4.35,2.25],
                'art_box_px':[100,100,300,300],'safe_box_px':[25,25,1200,600],
                'kdp':{'trim_width_inches':2,'spine_width_inches':.1,'bleed_inches':.125,'page_count':2}},
            'interior':{'template':{'platform':'kdp','interior_type':'text_no_bleed',
                'trim_inches':[2,2], 'page_count':2,
                'margins_inches':dict(inside=.25,outside=.25,top=.25,bottom=.25),
                'font_size_pt':10,'leading_pt':12}, 'pages':[{'lines':['First page']},{'lines':['Second page']}]}}

    def run_review(self, spec=None): return review.prepare(spec or self.spec, self.font, self.output)

    def test_stage_failures_remove_partial_attempt_and_allow_exact_retry(self):
        expected_hash = None
        for stage in ('create_art','generate','assemble','manifest.json','result.json'):
            with self.subTest(stage=stage):
                self.output = self.root/stage
                target = stage if hasattr(review,stage) else 'save_json'
                original = getattr(review,target)
                def fail_after_write(*args, **kwargs):
                    value = original(*args, **kwargs)
                    if target != 'save_json' or Path(args[0]).name == stage:
                        raise RuntimeError('injected stage failure')
                    return value
                with patch.object(review,target,side_effect=fail_after_write):
                    with self.assertRaisesRegex(RuntimeError,'injected stage failure'): self.run_review()
                self.assertFalse(self.output.exists())
                result = self.run_review()
                self.assertEqual(result['status'],'REVIEW_REQUIRED')
                self.assertFalse(result['publication_enabled'])
                self.assertEqual(json.loads((self.output/'result.json').read_text()),result)
                if expected_hash is None: expected_hash = result['package_sha256']
                self.assertEqual(result['package_sha256'], expected_hash)
                shutil.rmtree(self.output)

    def test_review_package_tree_is_private_with_permissive_umask(self):
        previous = os.umask(0)
        try:
            self.run_review()
        finally:
            os.umask(previous)
        for path in (self.output, *(item for item in self.output.rglob('*')
                                    if item.is_dir())):
            with self.subTest(directory=path.relative_to(self.output)):
                self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o700)
        for path in (item for item in self.output.rglob('*') if item.is_file()):
            with self.subTest(file=path.relative_to(self.output)):
                self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)

    def test_invalid_worker_font_layer_can_be_corrected_at_same_destination(self):
        bad = copy.deepcopy(self.spec); bad['text_layers']=[{'font_path':'untrusted'}]
        with self.assertRaisesRegex(ValueError,'FONT_IS_WORKER_OWNED'): self.run_review(bad)
        self.assertFalse(self.output.exists())
        self.assertEqual(self.run_review()['status'],'REVIEW_REQUIRED')

    def test_keyboard_interrupt_also_cleans_owned_attempt(self):
        def interrupt(*args, **kwargs):
            (self.output/'partial').write_bytes(b'fixture')
            raise KeyboardInterrupt()
        with patch.object(review,'create_art',side_effect=interrupt):
            with self.assertRaises(KeyboardInterrupt): self.run_review()
        self.assertFalse(self.output.exists())

    def test_cleanup_failure_preserves_original_error_and_marks_manual_recovery(self):
        failure = RuntimeError('original stage error')
        def fail(*args, **kwargs):
            (self.output/'partial').write_bytes(b'fixture')
            raise failure
        with patch.object(review,'create_art',side_effect=fail), \
             patch.object(attempts.shutil,'rmtree',side_effect=PermissionError('fixture')):
            with self.assertRaises(RuntimeError) as caught: self.run_review()
        self.assertIs(caught.exception,failure)
        self.assertIn('REVIEW_OUTPUT_CLEANUP_FAILED',failure.__notes__)
        self.assertEqual((self.output/'partial').read_bytes(),b'fixture')

    def test_existing_directory_and_symlink_are_preserved(self):
        self.output.mkdir(); marker=self.output/'existing'; marker.write_bytes(b'keep')
        with self.assertRaises(FileExistsError): self.run_review()
        self.assertEqual(marker.read_bytes(),b'keep')
        moved=self.root/'existing'; self.output.rename(moved); self.output.symlink_to(moved, target_is_directory=True)
        with self.assertRaises(FileExistsError): self.run_review()
        self.assertTrue(self.output.is_symlink()); self.assertEqual((moved/'existing').read_bytes(),b'keep')

    def test_replacement_directory_is_preserved_on_failure(self):
        def replace(*args, **kwargs):
            self.output.rename(self.root/'moved-attempt')
            self.output.mkdir(); (self.output/'concurrent').write_bytes(b'keep')
            raise RuntimeError('replacement fixture')
        with patch.object(review,'create_art',side_effect=replace):
            with self.assertRaisesRegex(RuntimeError,'replacement fixture'): self.run_review()
        self.assertEqual((self.output/'concurrent').read_bytes(),b'keep')

    def test_replacement_symlink_target_is_preserved_on_failure(self):
        other=self.root/'other'; other.mkdir(); (other/'concurrent').write_bytes(b'keep')
        def replace(*args, **kwargs):
            self.output.rename(self.root/'moved-attempt')
            self.output.symlink_to(other, target_is_directory=True)
            raise RuntimeError('replacement fixture')
        with patch.object(review,'create_art',side_effect=replace):
            with self.assertRaisesRegex(RuntimeError,'replacement fixture'): self.run_review()
        self.assertTrue(self.output.is_symlink()); self.assertEqual((other/'concurrent').read_bytes(),b'keep')

    def test_successful_stage_cannot_hide_replaced_output_directory(self):
        moved=self.root/'moved-success'
        original=review.save_json
        def replace_after_result(path,value):
            result=original(path,value)
            if Path(path).name=='result.json':
                self.output.rename(moved)
                self.output.mkdir()
                (self.output/'concurrent').write_bytes(b'keep')
            return result
        with patch.object(review,'save_json',side_effect=replace_after_result):
            with self.assertRaisesRegex(RuntimeError,'^OUTPUT_REPLACED$'): self.run_review()
        self.assertEqual((self.output/'concurrent').read_bytes(),b'keep')
        self.assertTrue((moved/'result.json').is_file())

    def test_directory_swap_during_acquisition_never_enters_attempt(self):
        moved=self.root/'moved-acquisition'
        original=attempts.os.open
        swapped=False
        def replace_before_open(path,*args,**kwargs):
            nonlocal swapped
            if Path(path)==self.output and not swapped:
                swapped=True
                self.output.rename(moved)
                self.output.mkdir()
                (self.output/'concurrent').write_bytes(b'keep')
            return original(path,*args,**kwargs)
        with patch.object(attempts.os,'open',side_effect=replace_before_open):
            with self.assertRaisesRegex(RuntimeError,'^OUTPUT_REPLACED$'):
                with attempts.output_attempt(self.output):
                    self.fail('replaced attempt must not be entered')
        self.assertEqual((self.output/'concurrent').read_bytes(),b'keep')
        self.assertTrue(moved.is_dir())


class AssetRecoveryTests(unittest.TestCase):
    def setUp(self):
        ReviewRecoveryTests.setUp(self)
        self.source=self.root/'source.png'
        create_art(self.spec['original_art'],self.source)

    def run_asset(self,layers=None):
        return assets.generate(self.source,self.spec['cover_template'],layers or [],self.output)

    def test_asset_late_encoder_hash_and_manifest_failures_allow_exact_retry(self):
        expected=None
        for stage in ('print.png','art-mask.png','text-mask.png','cover.pdf','digest','manifest.json'):
            with self.subTest(stage=stage):
                self.output=self.root/stage
                if stage.endswith('.png'):
                    target='PIL.Image.Image.save'; original=Image.Image.save
                    def fail(*args,**kwargs):
                        value=original(*args,**kwargs)
                        if Path(args[1]).name==stage: raise RuntimeError('asset stage fixture')
                        return value
                elif stage=='cover.pdf':
                    target='reportlab.pdfgen.canvas.Canvas.save'; original=pdfcanvas.Canvas.save
                    def fail(*args,**kwargs):
                        original(*args,**kwargs)
                        raise RuntimeError('asset stage fixture')
                else:
                    target='pod_asset_generator.'+('digest' if stage=='digest' else 'save_json')
                    original=assets.digest if stage=='digest' else assets.save_json
                    def fail(*args,**kwargs):
                        original(*args,**kwargs)
                        raise RuntimeError('asset stage fixture')
                with patch(target,side_effect=fail,autospec=True):
                    with self.assertRaisesRegex(RuntimeError,'^asset stage fixture$'): self.run_asset()
                self.assertFalse(self.output.exists())
                manifest=self.run_asset()
                self.assertFalse(manifest['publication_enabled'])
                self.assertEqual(json.loads((self.output/'manifest.json').read_text()),manifest)
                for name,sha in manifest['files'].items(): self.assertEqual(digest(self.output/name),sha)
                if expected is None: expected=manifest['package_sha256']
                self.assertEqual(manifest['package_sha256'],expected)
                shutil.rmtree(self.output)

    def test_asset_corrected_font_can_retry_for_all_five_platforms(self):
        for platform in ('kdp','redbubble','teepublic','zazzle','spreadshirt'):
            with self.subTest(platform=platform):
                self.output=self.root/platform
                self.spec['cover_template']['platform']=platform
                layer={'font_path':str(self.font),'font_sha256':'0'*64,'font_size_px':16,
                       'position_px':[20,20],'text':'Fixture','rgba':[0,0,0,255]}
                with self.assertRaisesRegex(ValueError,'^FONT_HASH_MISMATCH$'): self.run_asset([layer])
                self.assertFalse(self.output.exists())
                manifest=self.run_asset([{**layer,'font_sha256':digest(self.font)}])
                self.assertEqual(manifest['platform'],platform)
                self.assertFalse(manifest['publication_enabled'])
                self.assertEqual(manifest['expected_text'][0]['text'],'Fixture')

    def test_asset_interrupt_cleans_owned_attempt(self):
        def interrupt(*args,**kwargs):
            (self.output/'partial').write_bytes(b'fixture')
            raise KeyboardInterrupt()
        with patch('PIL.Image.Image.save',side_effect=interrupt):
            with self.assertRaises(KeyboardInterrupt): self.run_asset()
        self.assertFalse(self.output.exists())

    def test_asset_existing_directory_and_symlink_are_preserved(self):
        self.output.mkdir(); (self.output/'existing').write_bytes(b'keep')
        with self.assertRaises(FileExistsError): self.run_asset()
        self.assertEqual((self.output/'existing').read_bytes(),b'keep')
        moved=self.root/'existing'; self.output.rename(moved)
        self.output.symlink_to(moved,target_is_directory=True)
        with self.assertRaises(FileExistsError): self.run_asset()
        self.assertTrue(self.output.is_symlink())
        self.assertEqual((moved/'existing').read_bytes(),b'keep')

    def test_asset_replacement_directory_is_preserved(self):
        def replace(*args,**kwargs):
            self.output.rename(self.root/'moved-attempt')
            self.output.mkdir(); (self.output/'concurrent').write_bytes(b'keep')
            raise RuntimeError('replacement fixture')
        with patch.object(assets,'save_json',side_effect=replace):
            with self.assertRaisesRegex(RuntimeError,'^replacement fixture$'): self.run_asset()
        self.assertEqual((self.output/'concurrent').read_bytes(),b'keep')

    def test_asset_replacement_symlink_is_preserved(self):
        other=self.root/'other'; other.mkdir(); (other/'concurrent').write_bytes(b'keep')
        def replace(*args,**kwargs):
            self.output.rename(self.root/'moved-attempt')
            self.output.symlink_to(other,target_is_directory=True)
            raise RuntimeError('replacement fixture')
        with patch.object(assets,'save_json',side_effect=replace):
            with self.assertRaisesRegex(RuntimeError,'^replacement fixture$'): self.run_asset()
        self.assertTrue(self.output.is_symlink())
        self.assertEqual((other/'concurrent').read_bytes(),b'keep')

    def test_asset_cleanup_denial_retains_original_failure_and_files(self):
        failure=RuntimeError('asset original fixture')
        with patch.object(assets,'save_json',side_effect=failure), \
             patch('shutil.rmtree',side_effect=PermissionError('fixture')):
            with self.assertRaises(RuntimeError) as caught: self.run_asset()
        self.assertIs(caught.exception,failure)
        self.assertIn('ASSET_OUTPUT_CLEANUP_FAILED',getattr(failure,'__notes__',[]))
        self.assertTrue((self.output/'print.png').is_file())


class BookAssemblyRecoveryTests(unittest.TestCase):
    def setUp(self):
        ReviewRecoveryTests.setUp(self)
        self.source=self.root/'source.png';self.package=self.root/'package'
        create_art(self.spec['original_art'],self.source)
        assets.generate(self.source,self.spec['cover_template'],[],self.package)
        self.book_spec={**self.spec['interior']['template'],'font_sha256':digest(self.font)}
        self.pages=self.spec['interior']['pages']
        self.original_manifest=(self.package/'manifest.json').read_bytes()

    def run_assembly(self):
        return books.assemble(self.package,self.book_spec,self.pages,self.font)

    def assert_clean_attempt(self):
        self.assertEqual((self.package/'manifest.json').read_bytes(),self.original_manifest)
        self.assertFalse((self.package/'interior.pdf').exists())
        self.assertFalse((self.package/'interior.receipt.json').exists())
        self.assertEqual(list(self.package.glob('.pod-book-*')),[])

    def assert_retry(self):
        result=self.run_assembly()
        self.assertEqual(result['files']['interior.pdf'],digest(self.package/'interior.pdf'))
        self.assertEqual(result['files']['interior.receipt.json'],digest(self.package/'interior.receipt.json'))
        self.assertEqual(json.loads((self.package/'manifest.json').read_text()),result)

    def test_receipt_link_and_manifest_failures_leave_original_package_retryable(self):
        original_save=books.save_json
        def fail_receipt(path,value):
            original_save(path,value)
            if Path(path).name=='interior.receipt.json':
                raise RuntimeError('receipt fixture')
        with patch.object(books,'save_json',side_effect=fail_receipt):
            with self.assertRaisesRegex(RuntimeError,'^receipt fixture$'):self.run_assembly()
        self.assert_clean_attempt();self.assert_retry()

        for stage in ('link','manifest'):
            with self.subTest(stage=stage):
                shutil.rmtree(self.package)
                assets.generate(self.source,self.spec['cover_template'],[],self.package)
                self.original_manifest=(self.package/'manifest.json').read_bytes()
                if stage=='link':
                    original_link=books._link_staged
                    def fail_link(stage_fd,root_fd,name):
                        if name=='interior.receipt.json':raise RuntimeError('link fixture')
                        return original_link(stage_fd,root_fd,name)
                    target=patch.object(books,'_link_staged',side_effect=fail_link)
                    reason='link fixture'
                else:
                    target=patch.object(books,'_commit_manifest',side_effect=RuntimeError('manifest fixture'))
                    reason='manifest fixture'
                with target:
                    with self.assertRaisesRegex(RuntimeError,'^'+reason+'$'):self.run_assembly()
                self.assert_clean_attempt();self.assert_retry()

    def test_cleanup_never_deletes_a_concurrent_replacement(self):
        original_link=books._link_staged
        def replace_then_fail(stage_fd,root_fd,name):
            if name=='interior.receipt.json':
                os.unlink('interior.pdf',dir_fd=root_fd)
                fd=os.open('interior.pdf',os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600,dir_fd=root_fd)
                try:os.write(fd,b'concurrent')
                finally:os.close(fd)
                raise RuntimeError('replacement fixture')
            return original_link(stage_fd,root_fd,name)
        with patch.object(books,'_link_staged',side_effect=replace_then_fail):
            with self.assertRaisesRegex(RuntimeError,'^replacement fixture$'):self.run_assembly()
        self.assertEqual((self.package/'interior.pdf').read_bytes(),b'concurrent')
        self.assertFalse((self.package/'interior.receipt.json').exists())
        self.assertEqual((self.package/'manifest.json').read_bytes(),self.original_manifest)
        self.assertEqual(list(self.package.glob('.pod-book-*')),[])

    def test_concurrent_manifest_replacement_is_preserved(self):
        original_commit=books._commit_manifest
        concurrent=b'{"concurrent":true}\n'
        def replace_manifest(stage_fd,root_fd,identity,contents):
            os.unlink('manifest.json',dir_fd=root_fd)
            fd=os.open('manifest.json',os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600,dir_fd=root_fd)
            try:os.write(fd,concurrent)
            finally:os.close(fd)
            return original_commit(stage_fd,root_fd,identity,contents)
        with patch.object(books,'_commit_manifest',side_effect=replace_manifest):
            with self.assertRaisesRegex(ValueError,'^MANIFEST_CHANGED$'):self.run_assembly()
        self.assertEqual((self.package/'manifest.json').read_bytes(),concurrent)
        self.assertFalse((self.package/'interior.pdf').exists())
        self.assertFalse((self.package/'interior.receipt.json').exists())
        self.assertEqual(list(self.package.glob('.pod-book-*')),[])


if __name__ == '__main__': unittest.main()

