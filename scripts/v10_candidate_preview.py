"""Hosted branch-only compute diagnostic. No artifact upload or retained media."""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys

OUT = Path('candidate-preview')
VIDEO = OUT / 'episode1-v10-canonical-candidate.mp4'
ORIGINAL_AUDIO = Path('public/audio/episode1-narration.mp3')
AUDIO = OUT / 'public/audio/episode1-narration.mp3'
GENERATED_SHA = 'c2b633f1c509fec43be6fd75d365b6335ca273e8beb6be6c5552bbb3cd24cd57'
GENERATED_WAV_SHA = 'e6576e6936e914c1614282cdaf8f1b4ba96428ef1e9b2b9c2e75bb732af2f14f'
RAW = OUT / 'narration-transcription-raw.json'
DERIVED = OUT / 'narration-transcription-health.json'
VTT = OUT / 'episode1-v10-canonical-candidate.vtt'
EXPECTED_VTT = '74a0dd136a20307af284fc6229297a2e093b428890a4b3b43b4e909e5eb541e9'
CONTROLS = ['scripts/v10_candidate_preview.py', 'scripts/v10_candidate_preview_inputs.json',
            '.github/workflows/v10-canonical-candidate-preview.yml']
UNRUN = ['deterministic_visual', 'semantic_visual', 'canonical_verify_captions_requires_green',
         'canonical_regression_acceptance', 'browser_smoke', 'production_runtime_provenance',
         'live_deployment', 'full_audiovisual_review', 'listening_acceptance']

def digest(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()

def save(path, value):
    Path(path).write_text(json.dumps(value, indent=2, sort_keys=True) + '\n')

def identity(env):
    sha = env.get('EXPECTED_SOURCE_SHA', '')
    if (env.get('GITHUB_ACTIONS') != 'true' or env.get('RUNNER_ENVIRONMENT') != 'github-hosted'
            or env.get('GITHUB_EVENT_NAME') != 'pull_request'
            or env.get('GITHUB_REPOSITORY') != 'wecreates/content-control'
            or env.get('SOURCE_REPOSITORY') != 'wecreates/content-control'
            or env.get('BASE_REPOSITORY') != 'wecreates/content-control'
            or env.get('BASE_REF') != 'main'
            or env.get('SOURCE_REF') != 'candidate/v10-canonical-preview-20261108'
            or not re.fullmatch('[0-9a-f]{40}', sha)):
        raise ValueError('Only same-repository allowlisted PR hosted previews are allowed')
    return dict(source_commit=sha, source_ref=env['SOURCE_REF'], repository=env['GITHUB_REPOSITORY'],
                run_id=env['GITHUB_RUN_ID'], run_attempt=env['GITHUB_RUN_ATTEMPT'])

def sources():
    require(not list(Path('.').glob('remotion.config.*')), 'Unreviewed automatic Remotion config is forbidden')
    expected = json.loads(Path('scripts/v10_candidate_preview_inputs.json').read_text())
    if (OUT / 'inputs.json').exists():
        frozen = json.loads((OUT / 'inputs.json').read_text())
        require(expected == frozen['source_hashes'], 'Reviewed source pins changed after guard')
        for path, sha in frozen['control_hashes'].items():
            require(digest(path) == sha, 'Preview control changed after guard: ' + path)
    for path, sha in expected.items():
        p = Path(path)
        if p.is_symlink() or not p.is_file() or digest(p) != sha:
            raise ValueError('Reviewed source mismatch: ' + path)
    return expected

def guard():
    ident = identity(os.environ)
    if subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip() != ident['source_commit']:
        raise ValueError('Checkout SHA mismatch')
    bound = sources()
    OUT.mkdir(exist_ok=False)  # Never reuse prior receipts or recursively delete files.
    prior = Path('public-review/episode1-v10-free.mp4')
    save(OUT / 'inputs.json', dict(**ident, source_hashes=bound,
         control_hashes={path: digest(path) for path in CONTROLS},
         previous_video_sha256=digest(prior) if prior.is_file() else None))
    save(OUT / 'gates.json', {})

def command(args, cwd=None):
    # Child tools may print large transcripts/receipts; retain their text only ephemerally.
    # This log is deliberately outside the evidence set because later commands append it.
    with Path('candidate-preview-command.log').open('a') as log:
        subprocess.run(args, check=True, cwd=cwd, stdout=log, stderr=subprocess.STDOUT)

def artifact_hashes():
    return {str(p): digest(p) for p in sorted(OUT.rglob('*'))
            if p.is_file() and p.name not in {'gates.json', 'manifest.json'}}

def require(condition, reason):
    if not condition:
        raise ValueError(reason)

def gate(name, args, receipt=None, key='status'):
    gates = json.loads((OUT / 'gates.json').read_text())
    gates[name] = {'status': 'INCOMPLETE'}
    save(OUT / 'gates.json', gates)
    try:
        bound_sources = sources()
        before = artifact_hashes()
        args() if callable(args) else command(args)
        sources()
        for path, sha in before.items():
            require(digest(path) == sha, 'Gate modified prior evidence: ' + path)
        if receipt is not None and json.loads(Path(receipt).read_text()).get(key) != 'PASS':
            raise ValueError(name + ' receipt is not PASS')
    except Exception:
        gates[name] = {'status': 'FAIL'}
        save(OUT / 'gates.json', gates)
        raise
    gates[name] = {'status': 'PASS', 'source_sha256': bound_sources, 'artifact_sha256': artifact_hashes()}
    save(OUT / 'gates.json', gates)

def generated_identity():
    require(AUDIO.is_file() and not AUDIO.is_symlink() and digest(AUDIO) == GENERATED_SHA,
            'Generated narration differs from frozen repaired bytes')
    contract = OUT / 'state/episode1-factual-contract.json'
    require(contract.is_file() and digest(contract) == digest('state/episode1-factual-contract.json'),
            'Isolated contract differs from reviewed draft')

def reconstruction_container_args(work):
    return ['docker', 'run', '--rm', '--platform', 'linux/amd64',
            '--network', 'none', '--read-only', '--cap-drop', 'ALL',
            '--security-opt', 'no-new-privileges', '--pids-limit', '128',
            '--memory', '2g', '--cpus', '2', '--user', str(os.getuid()) + ':' + str(os.getgid()),
            '--mount', 'type=bind,source=' + str(ORIGINAL_AUDIO.resolve()) + ',target=/input/original.mp3,readonly',
            '--mount', 'type=bind,source=' + str(Path('scripts/regenerate_frozen_narration.py').resolve()) + ',target=/input/regenerate.py,readonly',
            '--mount', 'type=bind,source=' + str(Path('scripts/frozen_narration_runtime.py').resolve()) + ',target=/input/runtime.py,readonly',
            '--mount', 'type=bind,source=' + str(work.resolve()) + ',target=/output',
            'v10-frozen-narration:local']

def regenerate_audio():
    generated = OUT / 'regenerated-audio'
    # Dedicated reconstruction-only container: no browser, secrets, host socket or network.
    # The only writable mount is a new output directory; original media/helper are read-only.
    work = OUT / 'regeneration-work'
    work.mkdir(exist_ok=False)
    args = reconstruction_container_args(work)
    try:
        command(args)
    finally:
        # Preserve bounded runtime and failure diagnostics even if reconstruction fails.
        runtime = work / 'runtime.json'
        if runtime.is_file() and not runtime.is_symlink():
            runtime.rename(OUT / 'encoder-runtime.json')
        result = work / 'result'
        if result.is_dir() and not result.is_symlink():
            require(not generated.exists(), 'Refusing to replace regeneration output')
            result.rename(generated)
    receipt = json.loads((generated / 'regeneration-receipt.json').read_text())
    require(receipt.get('status') == 'FROZEN_BYTES_REPRODUCED', 'Exact regeneration did not pass')
    mp3 = generated / 'narration-currency-edit-candidate.mp3'
    wav = generated / 'narration-currency-edit-candidate.wav'
    require(digest(mp3) == GENERATED_SHA and digest(wav) == GENERATED_WAV_SHA,
            'Generated WAV/MP3 frozen hash mismatch')
    AUDIO.parent.mkdir(parents=True, exist_ok=False)
    shutil.copyfile(mp3, AUDIO)
    contract = OUT / 'state/episode1-factual-contract.json'
    contract.parent.mkdir(exist_ok=False)
    shutil.copyfile('state/episode1-factual-contract.json', contract)
    generated_identity()

def build_isolated_captions():
    # Absolute, unchanged script plus explicit isolated working root. No import hooks or gate monkeypatch.
    command([sys.executable, str(Path('scripts/build_verified_captions.py').resolve()),
             str(DERIVED.resolve()), str(VTT.resolve())], cwd=OUT.resolve())

def run():
    identity(os.environ)
    sources()
    for name in ['test_observed_sentence_segments.py', 'test_transcription_audio_identity.py', 'test_word_timed_workflow.py', 'test_candidate_preview.py']:
        gate('offline_' + name.removeprefix('test_').removesuffix('.py'),
             [sys.executable, '-m', 'unittest', 'discover', '-s', 'tests', '-p', name, '-v'])
    gate('canonical_visual_source', ['node', 'tests/v10-canonical-source.test.mjs'])
    gate('regenerate_frozen_audio', regenerate_audio)
    gate('fresh_asr', [sys.executable, 'scripts/free_transcription_qa.py', '--audio', str(AUDIO),
        '--contract', str(OUT / 'state/episode1-factual-contract.json'), '--output', str(RAW),
        '--model', 'base.en', '--spoken-numbers', '--full-audio'], RAW)
    segmentation = [sys.executable, 'scripts/segment_observed_words.py', '--receipt', str(RAW),
                    '--audio', str(AUDIO), '--output', str(DERIVED)]
    gate('observed_segmentation', segmentation, DERIVED)
    gate('retained_raw_verification', segmentation + ['--verify'])
    gate('caption_source_words_timing', build_isolated_captions)
    gate('reviewed_caption_hash', lambda: require(digest(VTT) == EXPECTED_VTT,
         'Fresh captions differ from reviewed word timing; review required'))
    def mono_probe():
        probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-of', 'json', str(AUDIO)]))
        require(len(probe['streams']) == 1 and probe['streams'][0].get('channels') == 1,
                'Frozen source must be mono before explicit duplication')
    gate('mono_source_probe', mono_probe)
    sources()  # Original repository audio and reviewed JSX must stay unchanged.
    generated_identity()  # Distinct generated c2b633 pin immediately before render.
    gate('fresh_remotion_render', ['node_modules/.bin/remotion', 'render', 'remotion/v10-index.jsx',
        'Episode1V10FinalProof', str(OUT / 'raw-remotion.mp4'), '--codec', 'h264', '--crf', '18', '--concurrency', '2',
        '--public-dir', str((OUT / 'public').resolve())])
    generated_identity()
    # Unity-gain mono duplication; resample without speech stretching; append silence.
    gate('finalize_media', ['ffmpeg', '-n', '-i', str(OUT / 'raw-remotion.mp4'), '-i', str(AUDIO),
        '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
        '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.1',
        '-af', 'pan=stereo|c0=c0|c1=c0,aresample=48000,apad,atrim=duration=30',
        '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-t', '30', '-movflags', '+faststart', str(VIDEO)])
    gate('new_candidate_identity', lambda: require(digest(VIDEO) !=
         json.loads((OUT / 'inputs.json').read_text())['previous_video_sha256'],
         'New render must have a new candidate SHA'))
    command(['ffmpeg', '-n', '-i', str(VIDEO), '-map', '0:a:0', '-c:a', 'pcm_s16le', str(OUT / 'final-audio.wav')])
    gate('mobile', [sys.executable, 'scripts/free_mobile_compat_qa.py', '--video', str(VIDEO), '--output', str(OUT / 'mobile.json')], OUT / 'mobile.json')
    gate('audio', [sys.executable, 'scripts/free_audio_qa.py', '--video', str(VIDEO), '--output', str(OUT / 'audio.json')], OUT / 'audio.json', 'verdict')
    sources()

def encoder_runtime_diagnostic():
    path = OUT / 'encoder-runtime.json'
    if not path.is_file() or path.is_symlink() or path.stat().st_size > 16384:
        return {'status': 'NO_VALID_RUNTIME_RECEIPT'}
    try:
        raw = json.loads(path.read_text())
        require(isinstance(raw, dict), 'Invalid runtime receipt')
    except (OSError, ValueError):
        return {'status': 'INVALID_RUNTIME_RECEIPT'}
    result = {'status': raw.get('status') if raw.get('status') in {'BLOCKED', 'RUNTIME_IDENTITIES_VERIFIED'} else 'INVALID_STATUS'}
    base = raw.get('base_image_reference')
    if isinstance(base, str) and re.fullmatch('python@sha256:[0-9a-f]{64}', base):
        result['base_image_reference'] = base
    for key, pattern in [('packages', r'[0-9A-Za-z.:+~_-]{1,64}'), ('binaries_sha256', '[0-9a-f]{64}')]:
        allowed = {'ffmpeg', 'libavcodec61', 'libavdevice61', 'libavfilter10', 'libavformat61',
                   'libavutil59', 'libpostproc58', 'libswresample5', 'libswscale8', 'libmp3lame0'} if key == 'packages' else {'ffmpeg', 'libmp3lame'}
        values = raw.get(key, {})
        result[key] = {k: v for k, v in values.items() if k in allowed and isinstance(v, str) and re.fullmatch(pattern, v)} if isinstance(values, dict) else {}
    return result

def regeneration_diagnostic():
    """Bounded, scalar-only allowlist. No transcript, recipe, file contents or full receipt."""
    receipt_path = OUT / 'regenerated-audio/regeneration-receipt.json'
    if not receipt_path.exists():
        return {'status': 'NO_RECEIPT'}
    if receipt_path.is_symlink() or receipt_path.stat().st_size > 32768:
        return {'status': 'INVALID_RECEIPT'}
    try:
        receipt = json.loads(receipt_path.read_text())
    except (OSError, ValueError):
        return {'status': 'INVALID_RECEIPT'}
    if not isinstance(receipt, dict):
        return {'status': 'INVALID_RECEIPT'}
    status = receipt.get('status')
    result = {'status': status if status in {'BLOCKED', 'FROZEN_BYTES_REPRODUCED'} else 'INVALID_STATUS'}
    # Reasons are mapped to fixed phrases, never copied from arbitrary process stderr.
    reason = receipt.get('reason')
    known_reasons = {
        'Frozen WAV hash mismatch': 'Frozen WAV hash mismatch; decoder/Numpy/platform differences may prevent exact reproduction',
        'Frozen MP3 hash mismatch': 'Frozen MP3 hash mismatch; FFmpeg/libmp3lame build or metadata differences may prevent exact reproduction',
        'Original repository audio SHA-256 mismatch': 'Original repository audio SHA-256 mismatch',
        'Original source changed during regeneration': 'Original source changed during regeneration',
        'FFmpeg failed:': 'FFmpeg execution failed',
        'Invalid decoded PCM': 'Invalid decoded PCM',
        'Nonfinite decoded samples': 'Nonfinite decoded samples',
        'No module named': 'A required Python dependency is unavailable',
    }
    if isinstance(reason, str):
        result['reason'] = next((text for prefix, text in known_reasons.items() if reason.startswith(prefix)),
                                'Regeneration failed; unrecognized detail omitted')
    for key in ['expected_wav_sha256', 'observed_wav_sha256', 'expected_mp3_sha256', 'observed_mp3_sha256']:
        value = receipt.get(key)
        if isinstance(value, str) and re.fullmatch('[0-9a-f]{64}', value):
            result[key] = value
    for key in ['numpy', 'python']:
        value = receipt.get(key)
        if isinstance(value, str) and re.fullmatch(r'[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}(?:[a-z0-9.+-]{0,16})?', value):
            result[key] = value
    version = receipt.get('ffmpeg_version')
    if isinstance(version, str):
        first = version.splitlines()[0] if version.splitlines() else ''
        # First version line only, bounded and restricted to ordinary version/build characters.
        if first.startswith('ffmpeg version ') and len(first) <= 240 and re.fullmatch(r'[A-Za-z0-9 ._+:/()=-]+', first):
            result['ffmpeg_version_first_line'] = first
    return result

def manifest():
    ident = identity(os.environ)
    gates = json.loads((OUT / 'gates.json').read_text())
    try:
        sources()
        if gates.get('regenerate_frozen_audio', {}).get('status') == 'PASS':
            generated_identity()
        for name, result in list(gates.items()):
            if result.get('status') == 'PASS':
                for path, sha in {**result.get('source_sha256', {}), **result.get('artifact_sha256', {})}.items():
                    require(digest(path) == sha, 'Evidence changed after gate ' + name + ': ' + path)
        gates['source_identity_at_sealing'] = {'status': 'PASS'}
    except Exception as exc:
        gates['source_identity_at_sealing'] = {'status': 'FAIL', 'reason': str(exc)}
    for name in ['offline_observed_sentence_segments', 'offline_transcription_audio_identity',
                 'offline_word_timed_workflow', 'offline_candidate_preview', 'canonical_visual_source', 'regenerate_frozen_audio', 'fresh_asr', 'observed_segmentation', 'retained_raw_verification',
                 'caption_source_words_timing', 'reviewed_caption_hash', 'mono_source_probe',
                 'new_candidate_identity', 'fresh_remotion_render', 'finalize_media', 'mobile', 'audio']:
        gates.setdefault(name, {'status': 'NOT_RUN'})
    for name in UNRUN:
        gates[name] = {'status': 'NOT_RUN'}
    files = {str(p.relative_to(OUT)): digest(p) for p in sorted(OUT.rglob('*')) if p.is_file() and p.name != 'manifest.json'}
    report = dict(**ident, status='COMPUTE_DIAGNOSTIC_ONLY_INCOMPLETE_ACCEPTANCE',
        job_status=os.environ.get('PREVIEW_JOB_STATUS', 'unknown'), production_ready=False,
        publication_enabled=False, media_retained=False, reviewable_video_available=False,
        creative_acceptance='UNASSESSED', listening_acceptance='UNASSESSED',
        candidate_sha256=files.get(VIDEO.name), gates=gates, files_sha256=files,
        scope='Compute diagnostic only; media is ephemeral and unavailable for review; no canonical GREEN, promotion, publication or artistic approval.')
    save(OUT / 'manifest.json', report)
    # Ordinary compact text only. Never print file contents, media, base64, transcripts or raw receipts.
    compact = {k: v for k, v in report.items() if k not in {'gates', 'scope'}}
    compact['gates'] = {name: result['status'] for name, result in gates.items()}
    compact['manifest_sha256'] = digest(OUT / 'manifest.json')
    compact['regeneration'] = regeneration_diagnostic()
    compact['encoder_runtime'] = encoder_runtime_diagnostic()
    text = json.dumps(compact, sort_keys=True, separators=(',', ':'))
    print(text)
    summary = os.environ.get('GITHUB_STEP_SUMMARY')
    if summary:
        with Path(summary).open('a') as stream:
            stream.write('V10 compute-only diagnostic: no retained or reviewable media.\n\n' + text + '\n')
    if gates['source_identity_at_sealing']['status'] != 'PASS':
        raise SystemExit(2)

if __name__ == '__main__':
    {'guard': guard, 'run': run, 'manifest': manifest}[sys.argv[1]]()
