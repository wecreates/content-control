"""Run the existing free V2 production stages with crash-safe, verifiable resume.

python scripts/v2_execution.py --ccsd projects/v2/amex-vs-chase-boss-fight/ccsd.json --workdir state/production
Local workdir must be retained by the host between runs. This does not publish.
"""
import argparse
import contextlib
import fcntl
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]


def sha(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def atomic_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(dir=path.parent, prefix='.checkpoint-')
    try:
        with os.fdopen(fd, 'w') as stream:
            json.dump(value, stream, indent=2, allow_nan=False)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


class StageRunner:
    def __init__(self, workdir):
        self.root = Path(workdir).resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        self.path = self.root / 'execution.json'
        self.executed = set()
        try:
            self.state = json.loads(self.path.read_text()) if self.path.exists() else {'schema_version': 1, 'stages': {}}
            if not isinstance(self.state, dict) or self.state.get('schema_version') != 1 or not isinstance(self.state.get('stages'), dict):
                raise ValueError('Malformed execution state')
            for record in self.state['stages'].values():
                if not isinstance(record, dict) or record.get('status') not in ('RUNNING', 'PASS', 'FAILED'):
                    raise ValueError('Malformed stage record')
                for key in ('attempts', 'previous_attempts'):
                    value = record.get(key, 0)
                    if type(value) is not int or value < 0:
                        raise ValueError('Malformed attempt counter')
                for key in ('inputs', 'outputs'):
                    values = record.get(key, {})
                    if not isinstance(values, dict) or any(not isinstance(p, str) or not isinstance(h, str) or len(h) != 64 or any(c not in '0123456789abcdef' for c in h) for p, h in values.items()):
                        raise ValueError('Malformed hash manifest')
                if record['status'] == 'PASS' and (not record.get('inputs') or not record.get('outputs')):
                    raise ValueError('Passing stage lacks evidence')
                if any(not Path(p).resolve().is_relative_to(self.root) for p in record.get('outputs', {})):
                    raise ValueError('Stage output escapes job directory')
        except (ValueError, OSError) as error:
            atomic_json(self.root / 'execution-blocked.json', {'status': 'BLOCKED', 'reason': str(error), 'publication_enabled': False, 'production_approved': False})
            raise
        (self.root / 'execution-blocked.json').unlink(missing_ok=True)
        self.state.update(publication_enabled=False, production_approved=False, status='RUNNING')
        self.save()

    def rebuilt_media(self):
        return bool({"render", "mux"} & self.executed)

    def save(self):
        atomic_json(self.path, self.state)

    def stage(self, name, inputs, action, attempts=1, force=False):
        try:
            fingerprint = {str(Path(p).resolve()): sha(p) for p in [Path(__file__), *inputs]}
        except OSError as error:
            self.state.update(status='BLOCKED', error=str(error))
            self.save()
            raise
        old = self.state['stages'].get(name, {})
        valid = old.get('status') == 'PASS' and old.get('inputs') == fingerprint and bool(old.get('outputs'))
        valid = valid and all(Path(p).is_file() and sha(p) == h for p, h in old.get('outputs', {}).items())
        if valid and not force:
            print(json.dumps({'stage': name, 'event': 'REUSED', 'outputs_verified': len(old['outputs'])}), flush=True)
            return old
        self.executed.add(name)
        record = {'status': 'RUNNING', 'inputs': fingerprint, 'attempts': 0, 'previous_attempts': old.get('previous_attempts', 0) + old.get('attempts', 0)}
        self.state['stages'][name] = record
        for attempt in range(1, attempts + 1):
            record.update(status='RUNNING', attempts=attempt, started=time.time())
            self.save()
            print(json.dumps({'stage': name, 'event': 'START', 'attempt': attempt}), flush=True)
            try:
                paths = action()
                if not paths or any(not Path(p).is_file() or Path(p).stat().st_size == 0 for p in paths):
                    raise ValueError('Stage did not produce nonempty outputs')
                if any(sha(p) != h for p, h in fingerprint.items()):
                    raise ValueError('Stage inputs changed during execution')
                record.update(status='PASS', outputs={str(Path(p).resolve()): sha(p) for p in paths}, ended=time.time())
                self.save()
                print(json.dumps({'stage': name, 'event': 'PASS', 'elapsed_seconds': round(record['ended'] - record['started'], 3)}), flush=True)
                return record
            except Exception as error:
                record.update(status='FAILED', error=str(error), ended=time.time())
                self.state['status'] = 'BLOCKED'
                self.save()
                print(json.dumps({'stage': name, 'event': 'FAILED', 'attempt': attempt, 'error_type': type(error).__name__}), flush=True)
                # Only process errors/timeouts are transient; policy/data failures fail closed.
                if attempt == attempts or not isinstance(error, (subprocess.CalledProcessError, subprocess.TimeoutExpired)):
                    raise


@contextlib.contextmanager
def job_lock(workdir):
    Path(workdir).mkdir(parents=True, exist_ok=True)
    with (Path(workdir) / 'execution.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        yield


def execute(ccsd_path, workdir, composition="StudioAnimatic"):
    if composition not in ("StudioAnimatic", "StudioLong"):
        raise ValueError("Unsupported composition")
    ccsd_path = Path(ccsd_path).resolve()
    ccsd = json.loads(ccsd_path.read_text())
    if ccsd.get('publication_enabled') is not False:
        raise ValueError('Publication must be explicitly disabled')
    if not ccsd.get('scenes'):
        raise ValueError('Scenes are required')
    with job_lock(workdir):
        runner = StageRunner(workdir)
        w = runner.root
        clips, mixdir = w / 'clips', w / 'mix'
        voice, silent, final = w / 'voice.wav', w / 'silent.mp4', w / 'candidate.mp4'
        props, qa = w / 'props.json', w / 'media-qa.json'
        scripts = ROOT / 'scripts'

        def command(name, args, outputs, timeout=1800, check=True):
            with (w / (name + '.log')).open('a') as log:
                result = subprocess.run([str(a) for a in args], cwd=ROOT, stdout=log, stderr=log, timeout=timeout)
            if check:
                result.check_returncode()
            return outputs

        def python(name, args, outputs):
            return command(name, [sys.executable, scripts / (name + '.py'), *args], outputs)

        def generate():
            python('v2_free_voice', ['--ccsd', ccsd_path, '--out-dir', clips], [clips / 'approved-manifest.json'])
            manifest = json.loads((clips / 'approved-manifest.json').read_text())
            paths = [(clips / item['file']).resolve() for item in manifest['clips']]
            if any(not p.is_relative_to(clips) for p in paths):
                raise ValueError('Clip outside job directory')
            return [clips / 'approved-manifest.json', *paths]

        voice_record = runner.stage('voice', [ccsd_path, scripts / 'v2_free_voice.py', ROOT / 'control/free-voice-policy.json', ROOT / 'control/audio-sync-policy.json'], generate)
        runner.stage('assembly', [ccsd_path, scripts / 'v2_audio_assemble.py', *voice_record['outputs']], lambda: python('v2_audio_assemble', ['--ccsd', ccsd_path, '--manifest', clips / 'approved-manifest.json', '--out', voice, '--receipt', w / 'assembly.json'], [voice, w / 'assembly.json']))
        stems = [ROOT / 'public/audio' / name for name in ('episode1-music.mp3', 'episode1-sfx-1.mp3', 'episode1-sfx-2.mp3')]
        runner.stage('mix', [ccsd_path, voice, scripts / 'v2_sound_mix.py', *stems], lambda: python('v2_sound_mix', ['--ccsd', ccsd_path, '--voice', voice, '--out-dir', mixdir, '--receipt', w / 'mix.json'], [mixdir / 'mix.wav', w / 'mix.json']))
        contract, transcript, captions = w / 'transcription-contract.json', w / 'transcription.json', w / 'captions.json'
        def transcription_contract():
            lines = [d['text'] for scene in sorted(ccsd['scenes'], key=lambda s: s['start']) for d in scene.get('audio', {}).get('dialogue', [])]
            atomic_json(contract, {'publication_enabled': False, 'narration_text': ' '.join(lines), 'expected_duration_seconds': max(s['end'] for s in ccsd['scenes'])})
            return [contract]
        runner.stage('transcription_contract', [ccsd_path], transcription_contract)
        transcription_options = ['--model', 'medium.en', '--spoken-numbers'] if composition == 'StudioLong' else ['--model', 'small.en']
        runner.stage('transcription', [voice, contract, scripts / 'free_transcription_qa.py', ROOT / 'requirements-transcription.txt'], lambda: python('free_transcription_qa', ['--audio', voice, '--contract', contract, '--output', transcript, *transcription_options], [transcript]))
        if composition == 'StudioLong':
            observed = w / 'transcription-repaired.json'
            runner.stage('recognition_repair', [ccsd_path, voice, transcript, w / 'assembly.json', scripts / 'v2_transcription_repair.py', scripts / 'free_transcription_qa.py'], lambda: python('v2_transcription_repair', ['--ccsd', ccsd_path, '--transcription', transcript, '--assembly', w / 'assembly.json', '--audio', voice, '--out', observed], [observed]))
            transcript = observed
        runner.stage('captions', [ccsd_path, voice, transcript, scripts / 'v2_captions.py'], lambda: python('v2_captions', ['--ccsd', ccsd_path, '--transcription', transcript, '--audio', voice, '--out', captions], [captions]))
        runner.stage('caption_frames', [ccsd_path, captions, scripts / 'verify_caption_frames.mjs', ROOT / 'remotion/ObservedCaptions.mjs'], lambda: command('caption_frames', ['node', scripts / 'verify_caption_frames.mjs', '--ccsd', ccsd_path, '--captions', captions, '--out', w / 'caption-frames.json'], [w / 'caption-frames.json']))
        def render_props():
            track = json.loads(captions.read_text())
            if track.get('status') != 'PASS':
                raise ValueError('Observed captions required')
            atomic_json(props, {'ccsd': {**ccsd, 'caption_track': track}})
            return [props]
        runner.stage('props', [ccsd_path, captions], render_props)
        selection = w / 'composition.json'
        render_concurrency = 2 if os.environ.get('GITHUB_ACTIONS') == 'true' else 1
        selected = {'composition': composition, 'render_concurrency': render_concurrency}
        if not selection.exists() or json.loads(selection.read_text()) != selected:
            atomic_json(selection, selected)
        render_inputs = [selection, props, ROOT / 'package-lock.json', *sorted((ROOT / 'remotion').rglob('*.*')), *sorted(p for p in (ROOT / 'public').rglob('*') if p.is_file())]
        render_inputs += sorted(ROOT.glob('remotion.config.*'))

        def render(force=False):
            runner.stage('render', render_inputs, lambda: command('render', [ROOT / 'node_modules/.bin/remotion', 'render', 'remotion/studio-animatic-index.jsx', composition, silent, '--props=' + str(props), '--codec=h264', '--crf=18', '--concurrency=' + str(render_concurrency)], [silent], timeout=7200), attempts=2, force=force)
            runner.stage('mux', [silent, mixdir / 'mix.wav'], lambda: command('mux', ['ffmpeg', '-nostdin', '-y', '-i', silent, '-i', mixdir / 'mix.wav', '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', final], [final]), attempts=2, force=force)

        def inspect():
            qa.unlink(missing_ok=True)
            command('qa', [sys.executable, scripts / 'production_reality_media_qa.py', '--video', final, '--ccsd', ccsd_path, '--out', qa], [qa], check=False)
            report = json.loads(qa.read_text())
            if report.get('candidate_sha256') != sha(final):
                raise ValueError('QA receipt does not match candidate')
            if report.get('status') != 'PASS' or not report.get('checks') or not all(v is True for v in report['checks'].values()):
                raise ValueError('Media QA failed: ' + ', '.join(k for k, v in report.get('checks', {}).items() if v is not True))
            return [qa]

        render()
        for repair in range(2):
            try:
                runner.stage('qa', [final, ccsd_path, scripts / 'production_reality_media_qa.py'], inspect, force=bool(repair) or runner.rebuilt_media())
                break
            except ValueError:
                report = json.loads(qa.read_text()) if qa.exists() else {}
                failed = {k for k, v in report.get('checks', {}).items() if v is not True}
                if repair or not failed or not failed <= {'decodes', 'complete_av_decode', 'audio_present', 'audio_audible', 'audio_covers_video', 'duration_match'}:
                    raise
                # One genuine rebuild/retest for corrupt or incomplete media, never creative certification.
                render(force=True)
        try:
            from scripts.production_memory import identity_sources
        except ModuleNotFoundError:
            from production_memory import identity_sources
        memory_inputs = [scripts / 'production_memory.py', ccsd_path, final, qa, *voice_record['outputs'], *[ROOT / name for name in identity_sources()]]
        if ccsd.get('source_script'):
            source_script = (ROOT / ccsd['source_script']).resolve()
            if not source_script.is_relative_to(ROOT):
                raise ValueError('Source script outside repository')
            memory_inputs.append(source_script)
        memory_path = w / 'memory.json'
        baseline_args = ['--baseline', memory_path] if memory_path.exists() else []
        runner.stage('memory', memory_inputs, lambda: python('production_memory', ['--ccsd', ccsd_path, '--manifest', clips / 'approved-manifest.json', '--candidate', final, '--qa', qa, '--out', memory_path, *baseline_args], [memory_path]))
        metadata = ccsd_path.parent / 'metadata.json'
        package_receipt = w / 'review-package.json'
        def review_package():
            python('production_package', ['--ccsd', ccsd_path, '--metadata', metadata, '--candidate', final, '--qa', qa, '--captions', captions, '--audio', voice, '--out-dir', w / 'review-packages', '--receipt', package_receipt], [package_receipt])
            package = json.loads(package_receipt.read_text())
            paths = [Path(item['path']).resolve() for item in package['outputs'].values()]
            paths.append(Path(package['manifest_path']).resolve())
            if any(not path.is_relative_to(w) for path in paths):
                raise ValueError('Package output outside job directory')
            return [package_receipt, *paths]
        runner.stage('package', [ccsd_path, metadata, final, qa, captions, voice, ROOT / 'control/long-form-showrunner.json', scripts / 'production_package.py', scripts / 'verify_caption_frames.mjs', ROOT / 'remotion/ObservedCaptions.mjs'], review_package)
        runner.state.update(status='REVIEW_CANDIDATE', candidate=str(final), candidate_sha256=sha(final), creative_review='PENDING', audio_listening_review='PENDING')
        runner.save()
        return runner.state


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ccsd', required=True)
    parser.add_argument('--workdir', required=True)
    parser.add_argument('--composition', choices=['StudioAnimatic', 'StudioLong'], default='StudioAnimatic')
    args = parser.parse_args()
    try:
        result = execute(args.ccsd, args.workdir, args.composition)
        print(json.dumps({k: v for k, v in result.items() if k != 'stages'}))
        return 0
    except Exception as error:
        failure = {'status': 'BLOCKED', 'reason': str(error), 'publication_enabled': False, 'production_approved': False}
        try:
            with job_lock(args.workdir):
                directory = Path(args.workdir)
                atomic_json(directory / 'execution-blocked.json', failure)
                state_path = directory / 'execution.json'
                if state_path.exists():
                    state = json.loads(state_path.read_text())
                    if isinstance(state, dict) and state.get('schema_version') == 1 and isinstance(state.get('stages'), dict):
                        state.update(failure)
                        atomic_json(state_path, state)
        except (OSError, ValueError):
            # Never modify another active execution, nor destroy a malformed file.
            pass
        print(json.dumps(failure), file=sys.stderr)
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
