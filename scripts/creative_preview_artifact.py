"""Prepare and verify an artifact-only V2 creative render; never accept or publish it."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import subprocess

APPROVED_BRANCHES = {
    'codex/v2-grounded-staging-20261121',
    'codex/v2-typography-framing-preview',
}
SOURCE_RUN = 44821511267
INPUT_HASHES = {
    'ccsd.json': 'c9f74a5a1157f54ecaebac0cb9f7b0f0dd2038f9fdf89bb25f9d3c827826d4aa',
    'captions.json': 'e258408012cea9e0cfd58eda29ea32a7dfc1e73d76af67a13bb1c7f654e84462',
    'mix/mix.wav': 'aa2507be6e3c61b8149541e2449c3746ec027b80df3ba9bdb04066bcd70aad0b',
    'render/v2-boss-fight.mp4': 'feec786c87a0f811dd6793f0108d15e34b57308a83666f987c294f8cdfa2cc25',
}


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def validate_source(branch, commit):
    if branch not in APPROVED_BRANCHES or not re.fullmatch(r'[0-9a-f]{40}', commit):
        raise ValueError('exact commit and approved same-repository creative branch required')


def verify_inputs(artifact):
    artifact = Path(artifact).resolve()
    for name, expected in INPUT_HASHES.items():
        path = artifact / name
        if not path.is_file() or path.is_symlink() or sha(path) != expected:
            raise ValueError(f'original artifact identity mismatch: {name}')
    ccsd = json.loads((artifact / 'ccsd.json').read_text())
    captions = json.loads((artifact / 'captions.json').read_text())
    if ccsd.get('publication_enabled') is not False or captions.get('publication_enabled') is not False:
        raise ValueError('publication must remain disabled')
    if captions.get('status') != 'PASS' or ccsd.get('caption_track') != captions:
        raise ValueError('original observed caption track required')
    return ccsd


def audio_hash(video):
    result = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(video), '-map', '0:a:0',
                             '-c:a', 'copy', '-f', 'adts', '-'],
                            capture_output=True, check=True, timeout=30)
    if not result.stdout:
        raise ValueError('encoded audio missing')
    return hashlib.sha256(result.stdout).hexdigest()


def prepare(artifact, out, branch, commit, grounded=False, typography=False):
    validate_source(branch, commit)
    ccsd = verify_inputs(artifact)
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    props = {'ccsd': ccsd, 'groundedPreview': grounded, 'stylePreview': typography}
    (out / 'props.json').write_text(json.dumps(props, indent=2) + '\n')


def receipt(artifact, out, branch, commit, workflow_sha):
    validate_source(branch, commit)
    ccsd = verify_inputs(artifact)
    out = Path(out)
    video = out / 'creative-preview.mp4'
    probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams',
                                               '-show_format', '-of', 'json', str(video)], timeout=30))
    streams = probe['streams']
    visual = next(s for s in streams if s['codec_type'] == 'video')
    audio = next(s for s in streams if s['codec_type'] == 'audio')
    expected_frames = math.ceil(max(s['end'] for s in ccsd['scenes']) * 24)
    if (visual['width'], visual['height'], visual['r_frame_rate']) != (720, 1280, '24/1'):
        raise ValueError('unexpected video geometry or frame rate')
    if int(visual['nb_frames']) != expected_frames:
        raise ValueError('render must cover the complete original scene timeline')
    original_audio = audio_hash(Path(artifact) / 'render/v2-boss-fight.mp4')
    if audio_hash(video) != original_audio:
        raise ValueError('approved encoded audio changed')
    props = json.loads((out / 'props.json').read_text())
    if props.get('ccsd') != ccsd:
        raise ValueError('caption or scene inputs changed during render')
    result = {
        'schema_version': 1, 'status': 'RENDERED_AWAITING_CREATIVE_REVIEW',
        'scope': 'Branch render and encoded-media integrity only; no creative acceptance',
        'source_branch': branch, 'source_commit': commit, 'workflow_commit': workflow_sha,
        'source_run_id': SOURCE_RUN, 'input_sha256': INPUT_HASHES,
        'preview_flags': {k: props[k] for k in ('groundedPreview', 'stylePreview')},
        'candidate_sha256': sha(video), 'props_sha256': sha(out / 'props.json'),
        'encoded_audio_sha256': original_audio, 'video_frames': expected_frames,
        'video_duration_seconds': float(visual['duration']),
        'audio_duration_seconds': float(audio['duration']),
        'publication_enabled': False, 'production_approved': False, 'provider_calls': 0,
    }
    (out / 'receipt.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, sort_keys=True))


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('operation', choices=['guard', 'prepare', 'receipt'])
    p.add_argument('--branch', required=True)
    p.add_argument('--commit', required=True)
    p.add_argument('--artifact', default='original')
    p.add_argument('--out', default='preview')
    p.add_argument('--grounded', action='store_true')
    p.add_argument('--typography', action='store_true')
    p.add_argument('--workflow-sha', default='')
    a = p.parse_args()
    validate_source(a.branch, a.commit)
    if a.operation == 'guard':
        ref = f'refs/heads/{a.branch}'
        row = subprocess.check_output(['git', 'ls-remote', '--heads',
            'https://github.com/wecreates/content-control.git', ref], text=True, timeout=30).strip()
        if row != a.commit + '\t' + ref:
            raise ValueError('requested commit is not the current approved branch head')
    elif a.operation == 'prepare':
        prepare(a.artifact, a.out, a.branch, a.commit, a.grounded, a.typography)
    else:
        receipt(a.artifact, a.out, a.branch, a.commit, a.workflow_sha)


if __name__ == '__main__':
    main()
