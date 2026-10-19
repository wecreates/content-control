"""Execute workflow blocks offline: synthetic test-pattern/tone + schema fixtures.

No real media review, creative approval, credentials, or API calls. GitHub artifact
transport is simulated locally; the actual workflow commands are executed.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = (ROOT / '.github/workflows/exact-av-review.yml').read_text()


def job(name):
    return re.search(rf'^  {re.escape(name)}:\n(.*?)(?=^  [^ ]|\Z)', WORKFLOW, re.M | re.S).group(1)


def step(name, section='prepare-or-validate'):
    return re.search(rf'^      - name: {re.escape(name)}\n(.*?)(?=^      - |\Z)',
                     job(section), re.M | re.S).group(1)


def script(name, section='prepare-or-validate'):
    body = step(name, section)
    block = re.search(r'^        run: \|\n((?:          .*\n|\n)*)', body, re.M)
    if block:
        return '\n'.join(line[10:] for line in block.group(1).splitlines())
    return re.search(r'^        run: (.+)$', body, re.M).group(1)


class ExactAVWorkflowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fixtures = tempfile.TemporaryDirectory(prefix='synthetic-exact-av-fixture-')
        cls.fixture = Path(cls.fixtures.name) / 'SYNTHETIC-TEST-ONLY.mp4'
        subprocess.run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=160x240:rate=12',
                        '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=16000', '-t', '1',
                        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', str(cls.fixture)],
                       check=True, capture_output=True, timeout=30)
        cls.digest = hashlib.sha256(cls.fixture.read_bytes()).hexdigest()
        cls.checks = json.loads(subprocess.check_output(['node', '--input-type=module', '-e',
            "import {CREATIVE_CHECKS} from './creative-handoff.js';console.log(JSON.stringify(CREATIVE_CHECKS))"], cwd=ROOT, text=True))

    @classmethod
    def tearDownClass(cls):
        cls.fixtures.cleanup()

    def setUp(self):
        self.work = tempfile.TemporaryDirectory(prefix='synthetic-exact-av-workflow-')
        self.addCleanup(self.work.cleanup)
        self.root = Path(self.work.name)
        for relative in ('scripts/exact_av_review.mjs', 'scripts/comparison_sessions.mjs', 'creative-handoff.js', 'social-intake.js', 'scripts/offline_av_review.py',
                         'scripts/gemini_free_av_review.py', 'control/gemini-free-av-policy.json'):
            target = self.root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / relative, target)
        (self.root / 'receipts').mkdir()
        (self.root / 'receipts/EXACT_AV_REVIEW_v49.json').write_text(json.dumps({
            'synthetic_fixture_only': True, 'verdict': 'PASS', 'complete_end_to_end_review': True}))
        (self.root / 'package.json').write_text('{"type":"module"}')
        self.bin = self.root / 'fake-bin'
        self.bin.mkdir()
        gh = self.bin / 'gh'
        gh.write_text('#!/bin/sh\nset -eu\n[ "$#" = 2 ]\n[ "$1" = api ]\n'
                      '[ "$2" = "repos/wecreates/content-control/actions/runs/$RUN_ID" ]\ncat "$SYNTHETIC_RUN_JSON"\n')
        gh.chmod(0o755)
        self.run_json = self.root / 'synthetic-run.json'
        self.env = {'PATH': str(self.bin) + os.pathsep + os.environ['PATH'], 'HOME': str(self.root),
                    'LANG': 'C.UTF-8', 'LC_ALL': 'C.UTF-8', 'RUNNER_TEMP': str(self.root),
                    'GITHUB_ENV': str(self.root / 'environment'), 'GITHUB_OUTPUT': str(self.root / 'outputs'),
                    'GITHUB_RUN_ID': '9001', 'GITHUB_RUN_ATTEMPT': '2', 'GH_REPO': 'wecreates/content-control',
                    'RUN_ID': '123', 'SOURCE_RUN_ID': '123', 'REVIEW_FORMAT': 'short', 'REVIEW_PATH': '',
                    'SYNTHETIC_RUN_JSON': str(self.run_json), 'PUBLICATION_ENABLED': 'false'}
        self.stages = {name: 'skipped' for name in ('source', 'download', 'prepare', 'offline', 'validate')}
        for command in (['git', 'init', '-q'], ['git', 'config', 'user.email', 'synthetic@example.invalid'],
                        ['git', 'config', 'user.name', 'Synthetic offline fixture']):
            subprocess.run(command, cwd=self.root, env=self.env, check=True)
        self.source_run()
        self.execute('Initialize isolated current review receipts')
        self.receipts = Path(self.env['REVIEW_RECEIPTS_DIR'])

    def execute(self, name, outcome=None, section='prepare-or-validate'):
        result = subprocess.run(['bash', '-eo', 'pipefail', '-c', script(name, section)],
                                cwd=self.root, env=self.env, capture_output=True, text=True, timeout=30)
        env_file = Path(self.env['GITHUB_ENV'])
        if env_file.exists():
            self.env.update(line.split('=', 1) for line in env_file.read_text().splitlines())
        if outcome:
            self.stages[outcome] = 'success' if result.returncode == 0 else 'failure'
        else:
            self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        return result

    def output(self, key):
        return dict(line.split('=', 1) for line in Path(self.env['GITHUB_OUTPUT']).read_text().splitlines()).get(key, '')

    def source_run(self, **changes):
        data = {'id': 123, 'repository': {'full_name': 'wecreates/content-control'},
                'head_repository': {'full_name': 'wecreates/content-control'}, 'head_branch': 'main',
                'path': '.github/workflows/production-execution.yml', 'event': 'workflow_dispatch',
                'status': 'completed', 'conclusion': 'failure', 'head_sha': 'a' * 40}
        data.update(changes)
        self.run_json.write_text(json.dumps(data))

    def prepare(self, download=True, media_bytes=None):
        result = self.execute('Validate production provenance', 'source')
        if result.returncode:
            return result
        # Explicitly synthetic replacement for actions/download-artifact.
        if not download:
            self.stages['download'] = 'failure'
            return None
        self.env['MEDIA_PATH'] = self.output('media')
        target = self.root / self.env['MEDIA_PATH']
        target.parent.mkdir(parents=True, exist_ok=True)
        if media_bytes is None:
            shutil.copyfile(self.fixture, target)
        else:
            target.write_bytes(media_bytes)
        self.stages['download'] = 'success'
        result = self.execute('Prepare current exact audiovisual review', 'prepare')
        self.env['EXPECTED_SHA256'] = self.output('candidate_sha256')
        return result

    def offline(self):
        return self.execute('Build free local audiovisual inspection package', 'offline')

    def aggregate(self):
        self.env.update({key.upper() + '_OUTCOME': value for key, value in self.stages.items()})
        self.execute('Record current review attempt outcome')
        result = json.loads((self.receipts / 'review-workflow.json').read_text())
        self.assertIs(result['publication_enabled'], False)
        self.assertIs(result['production_approved'], False)
        self.assertEqual(result['workflow_run_id'], '9001')
        self.assertEqual(result['workflow_run_attempt'], '2')
        return result

    def valid_review(self):
        duration = json.loads((self.receipts / 'review-request.json').read_text())['media']['duration_seconds']
        return {'synthetic_fixture_only': True, 'candidate_sha256': self.digest, 'duration_seconds': duration,
                'status': 'PASS', 'method': 'rendered_video_review', 'full_video_review': True, 'full_audio_review': True,
                'publication_enabled': False,
                'reviewer': {'identity': 'SYNTHETIC TEST ONLY, not actual review',
                             'method': 'Synthetic schema fixture, no real playback inspection',
                             'evidence': 'Synthetic offline workflow test evidence identifier'},
                'reviewed_intervals': [[0, duration]],
                'checks': {name: {'pass': True, 'evidence': 'Synthetic schema evidence, not creative approval'} for name in self.checks},
                'comparisons': [{'artifact_sha256': hashlib.sha256(('SYNTHETIC '+url).encode()).hexdigest(),
                                 'duration_seconds': 5, 'reviewed_intervals': [[0,5]],
                                 'video_observation': 'SYNTHETIC visual fixture observation',
                                 'audio_observation': 'SYNTHETIC audio fixture observation',
                                 'url': url, 'full_video_review': True, 'full_audio_review': True,
                                 'access_scope': 'full audiovisual review',
                                 'observation': 'Synthetic schema fixture, never actual reference observation',
                                 'applied_difference': 'Synthetic comparison evidence, no creative approval'}
                                for url in ('https://youtube.com/watch?v=abcdefghijk', 'https://youtube.com/watch?v=lmnopqrstuv')],
                'findings': [], 'critical_count': 0, 'major_count': 0, 'unresolved_issues': []}

    def review_file(self, data, path='reviews/synthetic.json', committed=True):
        target = self.root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(data if isinstance(data, str) else json.dumps(data))
        if committed:
            subprocess.run(['git', 'add', '--', path], cwd=self.root, env=self.env, check=True)
            subprocess.run(['git', 'commit', '-qm', 'Synthetic fixture only'], cwd=self.root, env=self.env, check=True)
        self.env['REVIEW_PATH'] = path
        return target

    def validate(self):
        return self.execute('Validate supplied review against exact media and existing handoff gate', 'validate')

    def test_normal_preparation_uses_exact_source_and_current_receipts_only(self):
        self.assertEqual(self.prepare().returncode, 0)
        self.assertEqual(self.output('artifact'), 'production-state-short')
        self.assertEqual(self.offline().returncode, 0)
        result = self.aggregate()
        self.assertEqual(result['status'], 'REVIEW_REQUIRED')
        self.assertIs(result['review_evidence_validated'], False)
        self.assertEqual(result['candidate_sha256'], self.digest)
        self.assertFalse((self.receipts / 'EXACT_AV_REVIEW_v49.json').exists())
        self.assertTrue((self.root / 'receipts/EXACT_AV_REVIEW_v49.json').exists())
        offline = json.loads((self.receipts / 'offline-review/evidence.json').read_text())
        self.assertIs(offline['full_audio_review'], False)
        self.assertIs(offline['full_video_review'], False)

    def test_v2_and_long_source_materialize_expected_media(self):
        for format_name, workflow, artifact, media in (
                ('v2', 'content-control-v2.yml', 'content-control-v2-acceptance', 'render/v2-boss-fight.mp4'),
                ('long', 'production-execution.yml', 'production-state-long', 'candidate.mp4')):
            with self.subTest(format=format_name):
                self.env['REVIEW_FORMAT'] = format_name
                self.source_run(path='.github/workflows/' + workflow)
                self.assertEqual(self.prepare().returncode, 0)
                self.assertEqual(self.output('artifact'), artifact)
                self.assertEqual(self.output('media'), 'review-input/current/' + media)
                self.assertEqual(self.output('candidate_sha256'), self.digest)

    def test_missing_download_produces_current_blocker_without_historical_pass(self):
        self.prepare(download=False)
        result = self.aggregate()
        self.assertEqual(result['status'], 'BLOCKED')
        self.assertEqual(result['stage_outcomes']['download'], 'failure')
        self.assertFalse((self.receipts / 'EXACT_AV_REVIEW_v49.json').exists())
        self.assertIs(result['review_evidence_validated'], False)

    def test_untrusted_source_stops_before_download(self):
        self.source_run(head_repository={'full_name': 'untrusted/fork'})
        self.assertNotEqual(self.prepare().returncode, 0)
        self.assertEqual(self.aggregate()['status'], 'BLOCKED')
        self.assertEqual(self.stages['download'], 'skipped')

    def test_malformed_source_metadata_has_current_failure_receipt(self):
        self.run_json.write_text('{broken')
        self.assertNotEqual(self.prepare().returncode, 0)
        self.assertEqual(self.aggregate()['status'], 'BLOCKED')

    def test_inaccessible_media_cannot_produce_a_review_request(self):
        result = self.prepare(media_bytes=b'SYNTHETIC CORRUPT MEDIA, NOT A VIDEO')
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.aggregate()['status'], 'BLOCKED')
        self.assertFalse((self.receipts / 'review-request.json').exists())

    def test_retained_repair_with_mismatched_bytes_stops_before_offline_review(self):
        self.env.update(RUN_ID='38583366384', SOURCE_RUN_ID='38583366384')
        self.source_run(id=38583366384, event='pull_request', conclusion='success',
                        path='.github/workflows/retained-visual-repair.yml',
                        head_sha='b8f22d0be0cd0e2196a892eea07a904898dc43eb')
        result = self.prepare()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Recovered repair media hash mismatch', result.stderr)
        self.assertEqual(self.aggregate()['status'], 'BLOCKED')
        self.assertFalse((self.receipts / 'review-request.json').exists())

    def test_worker_failure_cannot_be_aggregated_as_prepared(self):
        self.assertEqual(self.prepare().returncode, 0)
        executable = self.bin / 'ffmpeg'
        executable.write_text('#!/bin/sh\necho "synthetic worker failure" >&2\nexit 93\n')
        executable.chmod(0o755)
        self.assertNotEqual(self.offline().returncode, 0)
        result = self.aggregate()
        self.assertEqual(result['status'], 'BLOCKED')
        self.assertEqual(result['stage_outcomes']['offline'], 'failure')

    def test_committed_synthetic_schema_fixture_validates_without_creative_approval(self):
        self.prepare()
        self.assertEqual(self.offline().returncode, 0)
        self.review_file(self.valid_review())
        self.assertEqual(self.validate().returncode, 0)
        result = self.aggregate()
        self.assertEqual(result['status'], 'VALIDATED_REVIEW')
        self.assertIs(result['review_evidence_validated'], True)
        self.assertIn('Does not perform or authenticate creative review', result['scope'])

    def test_untracked_artifact_reviewer_json_is_rejected(self):
        self.prepare()
        self.review_file(self.valid_review(), 'review-input/current/reviewer.json', committed=False)
        result = self.validate()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Committed repository JSON review required', result.stderr)
        self.assertEqual(self.aggregate()['status'], 'BLOCKED')

    def test_modified_committed_review_cannot_replace_checked_out_evidence(self):
        self.prepare()
        path = self.review_file(self.valid_review())
        path.write_text(path.read_text() + '\n')
        result = self.validate()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('must match the checked-out commit', result.stderr)

    def test_inaccessible_stale_and_malformed_reviews_fail_closed(self):
        self.prepare()
        self.assertEqual(self.offline().returncode, 0)
        inaccessible = self.valid_review()
        inaccessible.update(status='BLOCKED', full_audio_review=False, reviewed_intervals=[])
        stale = self.valid_review()
        stale['candidate_sha256'] = 'b' * 64
        for index, review in enumerate((inaccessible, stale, '{broken')):
            with self.subTest(case=index):
                self.review_file(review, f'reviews/synthetic-{index}.json')
                self.assertNotEqual(self.validate().returncode, 0)
                self.assertEqual(self.aggregate()['status'], 'BLOCKED')
                receipt = json.loads((self.receipts / 'review-validation.json').read_text())
                self.assertEqual(receipt['status'], 'BLOCKED')
                self.assertIs(receipt['ready'], False)

    def test_success_outcomes_cannot_cover_stale_or_malformed_worker_receipts(self):
        self.prepare()
        self.assertEqual(self.offline().returncode, 0)
        target = self.receipts / 'offline-review/evidence.json'
        original = json.loads(target.read_text())
        for malformed in ({**original, 'candidate_sha256': 'b' * 64}, [], '{broken',
                          {**original, 'production_approved': True}):
            with self.subTest(receipt=type(malformed).__name__):
                target.write_text(malformed if isinstance(malformed, str) else json.dumps(malformed))
                self.assertEqual(self.aggregate()['status'], 'BLOCKED')

    def test_disabled_diagnostic_identity_is_an_explicit_nonapproving_receipt(self):
        self.prepare()
        self.execute('Record disabled API identity configuration')
        receipt = json.loads((self.receipts / 'gemini-av-diagnostic.json').read_text())
        self.assertEqual(receipt['status'], 'BLOCKED')
        self.assertEqual(receipt['reason'], 'approved_short_lived_project_read_identity_not_configured')
        for name in ('ready', 'publication_enabled', 'production_approved', 'full_audio_review', 'full_video_review'):
            self.assertIs(receipt[name], False)

    def test_artifact_and_diagnostic_wiring_remains_exact_and_isolated(self):
        current = job('prepare-or-validate')
        self.assertIn('name: ${{ steps.source.outputs.artifact }}', current)
        self.assertIn('run-id: ${{ inputs.production_run_id }}', current)
        self.assertIn('path: review-input/current', current)
        preserve = step('Preserve review preparation and validation only')
        self.assertIn("if: always() && steps.review_workspace.outcome == 'success'", preserve)
        self.assertIn('path: ${{ steps.review_workspace.outputs.receipts }}', preserve)
        self.assertNotIn('path: receipts/', preserve)
        diagnostic = job('free-api-diagnostic')
        self.assertIn('needs: [tests, prepare-or-validate]', diagnostic)
        self.assertIn('EXPECTED_SHA256: ${{ needs.prepare-or-validate.outputs.candidate_sha256 }}', diagnostic)
        self.assertIn('MEDIA_PATH: ${{ needs.prepare-or-validate.outputs.media }}', diagnostic)
        self.assertIn('--expected-sha256 "$EXPECTED_SHA256"', diagnostic)
        self.assertIn('name: ${{ needs.prepare-or-validate.outputs.artifact }}', diagnostic)
        self.assertIn('inputs.run_free_api_diagnostic', diagnostic)
        self.assertNotIn('secrets.GEMINI_API_KEY', current)
        self.assertNotIn('id-token: write', current)
        self.assertNotIn('gemini-av-diagnostic.json', script('Record current review attempt outcome'))


if __name__ == '__main__':
    unittest.main()
