"""First-party consumer fixtures only: no upstream import or child execution."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import repository_editorial as target
import repository_v2_handoff as entrypoint

class ConsumerTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name);self.handoff=self.root/'handoff';self.handoff.mkdir()
        (self.root/'public-review').mkdir();(self.root/'state').mkdir()
        (self.root/'public-review/v2-draft.mp4').write_bytes(b'explicit synthetic media')
        self.write(self.handoff/'transcript-input.json',{'transcript':{'segments':[{'text':'An actual observed opening.'}]}})
        (self.handoff/'teaser.srt').write_text('1\n00:00:00,000 --> 00:00:02,000\nObserved text.\n')
        m={'candidate_sha256':target.sha(self.root/'public-review/v2-draft.mp4'),'build_run_id':'fixture-run','build_source_commit':'a'*40,'publication_enabled':False,'production_approved':False,'teaser_end_seconds':2,'inputs':{n:target.sha(self.handoff/n) for n in ('transcript-input.json','teaser.srt')}}
        self.write(self.handoff/'handoff.json',m)
        self.write(self.root/'state/v2-production-status.json',{**m,'run_id':m['build_run_id'],'source_commit':m['build_source_commit']})
        self.calls=[];self.mode=None
    def write(self,p,data):p.write_text(json.dumps(data))
    def worker(self,argv,**options):
        self.assertEqual(Path(argv[1]),self.root/'scripts/repository_tools.py')
        self.assertEqual(options['env']['PUBLICATION_ENABLED'],'false');self.assertNotIn('HOME',options['env']);self.assertEqual(options['timeout'],660)
        job=target.read(argv[2]);self.calls.append(job['operation']);self.assertFalse(job['publication_enabled']);self.assertFalse(job['paid_generation_enabled'])
        if self.mode=='process':raise RuntimeError('secret fixture error')
        output=Path(job['output']);tool=job['tool'];op=job['operation']
        if tool=='youtube-agent-skill':
            self.write(output,{'status':'PASS','execution_status':'PASS','exit_code':0,'upstream_revision':target.PINS[tool],'input_sha256':target.sha(job['input']),'operation':op,'publication_enabled':False,'paid_generation_enabled':False,'production_ready':False,'findings':{'valid':False,'issues':['fixture weak hook']}})
        else:output.write_bytes(b'fixture derivative '+op.encode())
        r={'status':'PASS','publication_enabled':False,'tool':tool,'operation':op,'revision':target.PINS[tool],'output_sha256':target.sha(output),'media':{'duration':2,'streams':[{'codec_type':'video'}]}}
        if self.mode=='pin':r['revision']='main'
        if self.mode=='output':r['output_sha256']='0'*64
        self.write(Path(str(output)+'.receipt.json'),r)
        if self.mode=='input':Path(job['input']).write_bytes(b'changed')
    def run_consumer(self):
        with patch.object(target,'preflight'),patch.object(target.subprocess,'run',side_effect=self.worker):return target.execute(self.root,self.handoff,self.root/'money',self.root/'runtime',authorized=True)
    def test_existing_bridge_five_operations_and_bound_review_with_negative_findings(self):
        report=self.run_consumer()
        self.assertEqual(self.calls,['hook-score','edit-plan','chapters','clip','captions'])
        self.assertFalse(report['operations'][0]['findings']['valid']);self.assertFalse(report['production_approved']);self.assertFalse(report['publication_enabled'])
        self.assertEqual(target.read(self.handoff/'editorial-review.json'),report)
    def test_disabled_has_no_process_or_attempt(self):
        with patch.object(target.subprocess,'run') as run:
            with self.assertRaises(ValueError):target.execute(self.root,self.handoff,self.root,self.root)
            run.assert_not_called()
        self.assertFalse((self.handoff/'editorial-local-attempt').exists())
    def test_source_drift_blocks_before_worker(self):
        (self.root/'public-review/v2-draft.mp4').write_bytes(b'changed')
        with self.assertRaises(ValueError):self.run_consumer()
        self.assertEqual(self.calls,[])
    def test_replay_does_not_run_again(self):
        self.run_consumer()
        with self.assertRaises(FileExistsError):self.run_consumer()
        self.assertEqual(len(self.calls),5)
    def test_failure_stops_and_no_success_receipt(self):
        self.mode='process'
        with self.assertRaisesRegex(ValueError,'EDITORIAL_OPERATION_FAILED_OR_UNVERIFIED'):self.run_consumer()
        self.assertEqual(len(self.calls),1);self.assertFalse((self.handoff/'editorial-review.json').exists())
        self.assertNotIn('secret',(self.handoff/'editorial-local-attempt/blocked.json').read_text())
    def test_wrong_pin_receipt_rejects(self):
        self.mode='pin'
        with self.assertRaises(ValueError):self.run_consumer()
        self.assertEqual(len(self.calls),1)
    def test_wrong_output_hash_rejects(self):
        self.mode='output'
        with self.assertRaises(ValueError):self.run_consumer()
    def test_input_mutation_rejects(self):
        self.mode='input'
        with self.assertRaises(ValueError):self.run_consumer()
    def test_missing_actual_worker_blocks(self):
        with self.assertRaises(FileNotFoundError):target.preflight(self.root/'not-installed')
    def test_invalid_matching_build_identities_reject_before_dispatch(self):
        original=target.read(self.handoff/'handoff.json');state=target.read(self.root/'state/v2-production-status.json')
        for field,current_field in [('build_run_id','run_id'),('build_source_commit','source_commit')]:
            for value in (None,'',[],{},42,True,' ', 'bad/identity'):
                with self.subTest(field=field,value=value):
                    self.write(self.handoff/'handoff.json',{**original,field:value});self.write(self.root/'state/v2-production-status.json',{**state,current_field:value})
                    with self.assertRaises(ValueError):self.run_consumer()
                    self.assertEqual(self.calls,[]);self.assertFalse((self.handoff/'editorial-local-attempt').exists())
            missing=dict(original);missing.pop(field);missing_state=dict(state);missing_state.pop(current_field)
            self.write(self.handoff/'handoff.json',missing);self.write(self.root/'state/v2-production-status.json',missing_state)
            with self.assertRaises(ValueError):self.run_consumer()
            self.assertEqual(self.calls,[])
    def test_existing_handoff_entrypoint_preview_never_executes(self):
        argv=['repository_v2_handoff.py','editorial-preview','--root',str(self.root),'--out',str(self.handoff)]
        with patch('sys.argv',argv),patch('builtins.print') as output,patch.object(target,'execute') as execute:
            entrypoint.main();execute.assert_not_called()
            self.assertEqual(json.loads(output.call_args.args[0])['status'],'INPUTS_VERIFIED_EXECUTION_DISABLED')
    def test_existing_entrypoint_routes_only_explicit_editorial_mode(self):
        argv=['repository_v2_handoff.py','editorial-execute','--root',str(self.root),'--out',str(self.handoff),'--money-factory',str(self.root/'money'),'--runtime',str(self.root/'runtime'),'--execute-reviewed-local']
        with patch('sys.argv',argv),patch('builtins.print'),patch.object(target,'execute',return_value={'candidate_sha256':'fixture','status':'FIXTURE'}) as execute:
            entrypoint.main();self.assertTrue(execute.call_args.kwargs['authorized'])

if __name__=='__main__':unittest.main()
