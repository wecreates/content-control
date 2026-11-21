#!/usr/bin/env python3
"""Produce a local, unpublished review packet using the existing picture pipeline."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import signal
import shutil
import subprocess
import sys
import time

try:
    from scripts.caption_contract import object_from, snapshot, validate_sources, render_vtt, parse_vtt, sha, write_atomic
    from scripts.verify_episode1_sync import verify as verify_sync
except ModuleNotFoundError:
    from caption_contract import object_from, snapshot, validate_sources, render_vtt, parse_vtt, sha, write_atomic
    from verify_episode1_sync import verify as verify_sync

ROOT = Path(__file__).resolve().parents[1]
SOURCES = (
    'package.json', 'package-lock.json', 'requirements-transcription.txt', 'requirements-picture-render.txt',
    'remotion/V9ArticulatedVisual.jsx', 'remotion/episode1-picture-timeline.mjs',
    'state/episode1-factual-contract.json', 'state/episode1-sync-contract.json',
    'public/audio/episode1-narration.mp3', 'public/audio/episode1-music.mp3',
    'public/audio/episode1-sfx-1.mp3', 'public/audio/episode1-sfx-2.mp3',
    'scripts/produce_episode1_review.py', 'scripts/render_episode1_pictures.mjs',
    'scripts/free_transcription_qa.py', 'scripts/caption_contract.py',
    'scripts/build_verified_captions.py', 'scripts/verify_muxed_narration.py',
    'scripts/review_smoke_inputs.py', 'scripts/free_mobile_compat_qa.py', 'scripts/free_audio_qa.py',
    'scripts/verify_episode1_sync.py',
)


def digest(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def stamp():
    return datetime.now(timezone.utc).isoformat()


def write_json(path, data):
    write_atomic(path, json.dumps(data, indent=2, sort_keys=True) + '\n')


def source_hashes(root):
    return {name: digest(root / name) for name in SOURCES}


def run_command(command, *, cwd, log, deadline, env):
    """One shared deadline; terminate the complete renderer/FFmpeg process group."""
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise TimeoutError('Production deadline exhausted')
    with Path(log).open('wb') as output:
        process = subprocess.Popen(command, cwd=cwd, env=env, stdout=output,
                                   stderr=subprocess.STDOUT, start_new_session=True)
        try:
            result = process.wait(timeout=remaining)
        except (subprocess.TimeoutExpired, KeyboardInterrupt):
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            process.wait()
            raise TimeoutError('Production deadline interrupted ' + Path(command[0]).name)
    if result:
        raise RuntimeError(f'{Path(command[0]).name} exited {result}; see {Path(log).name}')


def validate_bindings(directory, contract, narration, sources_before, sources_after):
    """Receipts cannot certify other bytes, incomplete stages or changed inputs."""
    if sources_before != sources_after:
        raise ValueError('Source inputs changed during production')
    candidate = digest(directory / 'video.mp4')
    transcript = object_from(snapshot(directory / 'narration-transcription.json'))
    cues, narration_hash = validate_sources(contract, transcript, narration)
    vtt = snapshot(directory / 'captions.vtt')
    if parse_vtt(vtt.decode()) != parse_vtt(render_vtt(cues)):
        raise ValueError('Captions no longer match observed narration')
    rendered = object_from(snapshot(directory / 'video.mp4.json'))
    encoded = object_from(snapshot(directory / 'encoded-verification.json'))
    mobile = object_from(snapshot(directory / 'mobile-verification.json'))
    audio = object_from(snapshot(directory / 'audio-verification.json'))
    if (rendered.get('video_sha256') != candidate
            or rendered.get('narration_sha256') != narration_hash
            or rendered.get('caption_sha256') != sha(vtt)
            or rendered.get('publication_enabled') is not False
            or rendered.get('production_approved') is not False):
        raise ValueError('Renderer receipt does not bind this candidate and captions')
    if (encoded.get('status') != 'PASS' or encoded.get('candidate_sha256') != candidate
            or encoded.get('contract_sha256') != sources_before['state/episode1-factual-contract.json']
            or encoded.get('transcription_receipt_sha256') != digest(directory / 'encoded-transcription.json')
            or encoded.get('publication_enabled') is not False
            or encoded.get('production_approved') is not False):
        raise ValueError('Encoded narration verification is not bound to this run')
    if mobile.get('status') != 'PASS' or mobile.get('publication_enabled') is not False:
        raise ValueError('Mobile compatibility verification did not pass')
    if (audio.get('verdict') != 'PASS' or audio.get('candidate_sha256') != candidate
            or audio.get('publication_enabled') is not False or audio.get('production_approved') is not False):
        raise ValueError('Technical audio verification is not bound to this candidate')
    return candidate


def produce(output, *, python=sys.executable, picture_python=None, timeout=900, root=ROOT):
    output = Path(output).absolute()
    # Every run owns a new directory. Never overwrite canonical files or old PASS.
    output.mkdir(parents=True, exist_ok=False)
    receipt = {'schema_version': 1, 'status': 'BLOCKED', 'started_at': stamp(),
               'publication_enabled': False, 'production_approved': False,
               'full_av_review': False, 'technical_status': 'PENDING', 'steps': [],
               'scope': 'Existing approved Episode1 inputs to an unpublished picture cut; human audiovisual and competitor review still required'}
    deadline = time.monotonic() + timeout
    before = None
    stage = 'preflight'
    write_json(output / 'run.json', receipt)
    try:
        if os.environ.get('PUBLICATION_ENABLED', 'false').lower() != 'false':
            raise ValueError('PUBLICATION_ENABLED must be false')
        if not 30 <= timeout <= 1800:
            raise ValueError('Deadline must be between 30 and 1800 seconds')
        # Subcommands operate in the repository only for relative input paths;
        # all their outputs are explicit files inside this fresh directory.
        before = source_hashes(root)
        receipt['source_sha256'] = before
        contract = object_from(snapshot(root / 'state/episode1-factual-contract.json'))
        if contract.get('status') != 'ACTIVE' or contract.get('publication_enabled') is not False:
            raise ValueError('Active publication-disabled factual contract required')
        env = dict(os.environ, PUBLICATION_ENABLED='false', PYTHONDONTWRITEBYTECODE='1',
                   HF_HUB_OFFLINE='1', TRANSFORMERS_OFFLINE='1',
                   PICTURE_TEMP_DIR=str(output / '.render-work'))
        if picture_python:
            env['PICTURE_PYTHON'] = picture_python

        def run(name, command):
            nonlocal stage
            stage = name
            entry = {'name': name, 'status': 'RUNNING', 'started_at': stamp(),
                     'command': list(map(str, command)), 'log': name + '.log'}
            receipt['steps'].append(entry)
            write_json(output / 'run.json', receipt)
            run_command(list(map(str, command)), cwd=root, log=output / entry['log'], deadline=deadline, env=env)
            entry.update(status='PASS', finished_at=stamp())

        run('runtime', [python, '-c', 'import sys,importlib.metadata as m; print(sys.version); print("faster-whisper",m.version("faster-whisper"))'])
        run('node', ['node', '--version'])
        run('ffmpeg', ['ffmpeg', '-version'])
        stage = 'source-sync'
        sync = verify_sync(root)
        write_json(output / 'source-sync.json', sync)
        if sync.get('status') != 'PASS':
            raise ValueError('Source timeline or retention checks failed')
        transcription = [python, 'scripts/free_transcription_qa.py', '--contract',
                         'state/episode1-factual-contract.json', '--model', 'base.en', '--spoken-numbers']
        run('narration', transcription + ['--audio', 'public/audio/episode1-narration.mp3', '--output', output / 'narration-transcription.json'])
        run('captions', [python, 'scripts/build_verified_captions.py', output / 'narration-transcription.json', output / 'captions.vtt'])
        run('render', ['node', 'scripts/render_episode1_pictures.mjs', output / 'video.mp4', output / 'captions.vtt'])
        # Record identity before QA; later binding rejects any replacement.
        rendered_hash = digest(output / 'video.mp4')
        run('decode', ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-nostdin', '-xerror', '-i', output / 'video.mp4', '-map', '0:v:0', '-map', '0:a:0', '-f', 'null', '-'])
        run('mobile', [python, 'scripts/free_mobile_compat_qa.py', '--video', output / 'video.mp4', '--output', output / 'mobile-verification.json'])
        run('audio', [python, 'scripts/free_audio_qa.py', '--video', output / 'video.mp4', '--output', output / 'audio-verification.json'])
        run('encoded-transcription', transcription + ['--audio', output / 'video.mp4', '--output', output / 'encoded-transcription.json'])
        run('encoded-verification', [python, 'scripts/verify_muxed_narration.py', '--video', output / 'video.mp4', '--contract', 'state/episode1-factual-contract.json', '--transcription', output / 'encoded-transcription.json', '--output', output / 'encoded-verification.json'])
        stage = 'final-binding'
        candidate = validate_bindings(output, contract, snapshot(root / 'public/audio/episode1-narration.mp3', 128 * 1024 * 1024), before, source_hashes(root))
        if candidate != rendered_hash:
            raise ValueError('Candidate changed during technical verification')
        if time.monotonic() > deadline:
            raise TimeoutError('Production deadline exhausted before final binding')
        write_atomic(output / 'REVIEW.md', '# Unpublished picture cut awaiting review\n\n'
                     f'Candidate SHA-256: `{candidate}`\n\n'
                     'Open video.mp4 and watch/listen to all 30 seconds. Check caption readability and placement, '
                     'visual and spoken synchronization, narration performance, mix, pacing and factual presentation. '
                     'Technical checks do not replace that review or competitor comparison. Publishing and production approval are disabled.\n\n'
                     'Approved narration:\n\n' + contract['narration_text'] + '\n')
        receipt.update(status='AWAITING_REVIEW', technical_status='PASS', candidate_sha256=candidate,
                       caption_sha256=digest(output / 'captions.vtt'),
                       artifacts_sha256={p.name: digest(p) for p in output.iterdir() if p.is_file() and p.name != 'run.json'},
                       source_inputs_unchanged=True)
    except (OSError, ValueError, RuntimeError, TimeoutError, KeyError, TypeError, subprocess.SubprocessError) as error:
        receipt.update(status='BLOCKED', technical_status='FAIL', failed_step=stage, reason=str(error))
        for entry in receipt['steps']:
            if entry['status'] == 'RUNNING':
                entry.update(status='FAIL', finished_at=stamp())
        # Leave partial output and logs for diagnosis, never label them accepted.
        receipt['partial_outputs_retained'] = True
        if before is not None:
            try:
                receipt['source_inputs_unchanged'] = before == source_hashes(root)
            except OSError:
                receipt['source_inputs_unchanged'] = False
    finally:
        # This fresh run exclusively owns the renderer scratch directory.
        try:
            if (output / '.render-work').exists():
                shutil.rmtree(output / '.render-work')
            receipt['renderer_scratch_cleaned'] = True
        except OSError as error:
            receipt.update(status='BLOCKED', technical_status='FAIL', failed_step='cleanup',
                           reason=str(error), renderer_scratch_cleaned=False)
        receipt['finished_at'] = stamp()
        write_json(output / 'run.json', receipt)
    return receipt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, help='New local directory, never an existing run')
    parser.add_argument('--python', default=sys.executable, help='Existing Python with pinned transcription runtime')
    parser.add_argument('--picture-python', help='Existing Python with CairoSVG for the renderer')
    parser.add_argument('--timeout', type=int, default=900, help='Total wall-clock budget, 30..1800 seconds')
    args = parser.parse_args()
    try:
        result = produce(args.output, python=args.python, picture_python=args.picture_python, timeout=args.timeout)
    except OSError as error:
        print(json.dumps({'status': 'BLOCKED', 'reason': str(error), 'publication_enabled': False}))
        return 2
    print(json.dumps(result, sort_keys=True))
    return 0 if result['status'] == 'AWAITING_REVIEW' else 2


if __name__ == '__main__':
    raise SystemExit(main())
