"""Snapshot existing continuity/asset memory after technical QA; never approve creativity."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def sha(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def read(path):
    return json.loads(Path(path).read_text())


def local(root, value):
    path = (root / value).resolve()
    if not path.is_relative_to(root.resolve()) or not path.is_file():
        raise ValueError('Missing or external memory source: ' + str(value))
    return path


def identity_sources(root=ROOT):
    lock = read(root / 'control/character-board-lock-v1.json')
    paths = ['control/character-board-lock-v1.json', 'control/free-voice-policy.json']
    paths += [lock[key] for key in ('canonical_board', 'character_system', 'bible', 'renderer_backed_board_component', 'renderer_backed_board_entrypoint')]
    return {name: sha(local(root, name)) for name in paths}


def snapshot(ccsd_path, manifest_path, candidate, qa_path, root=ROOT, baseline=None):
    root = Path(root).resolve()
    doc, manifest, qa = read(ccsd_path), read(manifest_path), read(qa_path)
    lock = read(root / 'control/character-board-lock-v1.json')
    policy = read(root / 'control/free-voice-policy.json')
    bible = read(local(root, lock['bible']))
    if any(item.get('publication_enabled') is not False for item in (doc, manifest, qa, lock, policy, bible)):
        raise ValueError('Publication must remain disabled')
    checks = qa.get('checks', {})
    required = {'decodes', 'complete_av_decode', 'audio_present', 'audio_audible', 'audio_covers_video', 'duration_match', 'no_black', 'no_duplicate_run', 'motion_alive', 'safe_border', 'publication_disabled'}
    if qa.get('status') != 'PASS' or not required <= checks.keys() or any(value is not True for value in checks.values()):
        raise ValueError('Complete technical media QA required')
    digest = sha(candidate)
    if qa.get('candidate_sha256') != digest:
        raise ValueError('QA candidate hash mismatch')
    sources = identity_sources(root)
    if baseline is not None and baseline.get('identity_sources') != sources:
        raise ValueError('Character identity or voice policy drift; explicit new baseline required')
    voices = policy['voices']
    if policy.get('paid_providers_enabled') is not False or policy.get('paid_network_requests_allowed') is not False:
        raise ValueError('Free voice policy required')
    if manifest.get('provider') != policy['primary']['provider'] or manifest.get('model_id') != policy['primary']['model_id']:
        raise ValueError('Voice provider mismatch')
    for assignments in (doc.get('voice_assignments', {}), manifest.get('voice_assignments', {})):
        if any(speaker not in voices or voices[speaker] != voice for speaker, voice in assignments.items()):
            raise ValueError('Voice assignment drift')
    entries, assets, dialogue = [], {}, []
    scenes = sorted(doc.get('scenes', []), key=lambda scene: float(scene['start']))
    if not scenes:
        raise ValueError('Scene memory cannot be empty')
    for scene in scenes:
        characters = scene.get('characters', [])
        for character in characters:
            identity = character['id']
            if identity not in lock['characters'] or identity not in bible['characters']:
                raise ValueError('Unknown locked character: ' + identity)
            canonical = bible['characters'][identity]
            for key in ('silhouette', 'motion_signature', 'forbidden_drift'):
                if key in character and character[key] != canonical.get(key):
                    raise ValueError('Character identity drift: ' + identity + '.' + key)
            assets['character:' + identity] = {'id': identity, 'type': 'character', 'identity_source': lock['bible']}
        props = scene.get('props', [])
        for prop in props:
            assets['prop:' + prop['id']] = {'id': prop['id'], 'type': 'prop', 'representation': 'scene_declaration'}
        environment = (scene.get('environment') or {}).get('id')
        if environment:
            assets['environment:' + environment] = {'id': environment, 'type': 'environment', 'representation': 'scene_declaration'}
        for line in scene.get('audio', {}).get('dialogue', []):
            if line.get('text', '').strip():
                dialogue.append((scene['id'], line))
        entries.append({'source': str(Path(ccsd_path).resolve()), 'scene_id': scene['id'], 'characters': [c['id'] for c in characters], 'props': [p['id'] for p in props], 'environment': environment, 'callbacks': (scene.get('continuity') or {}).get('callbacks', []), 'camera': scene.get('camera', {}), 'motion': [c.get('motion_clip') for c in characters if c.get('motion_clip')]})
    clips = manifest.get('clips', [])
    if not dialogue or len(clips) != len(dialogue):
        raise ValueError('One verified clip per dialogue required')
    clip_sources = {}
    for (scene_id, line), clip in zip(dialogue, clips):
        speaker = line['speaker']
        voice = voices.get(speaker)
        if not voice or manifest.get('voice_assignments', {}).get(speaker) != voice or clip.get('voice_id') != voice:
            raise ValueError('Voice assignment drift or nonverbal speaker')
        if clip.get('scene_id') != scene_id or clip.get('speaker') != speaker or clip.get('text_sha256') != hashlib.sha256(line['text'].strip().encode()).hexdigest():
            raise ValueError('Voice clip does not match script')
        clip_path = local(Path(manifest_path).resolve().parent, clip['file'])
        if sha(clip_path) != clip.get('audio_sha256'):
            raise ValueError('Voice clip hash mismatch')
        clip_sources[str(clip_path)] = sha(clip_path)
    source_references = {}
    if doc.get('source_script'):
        source = local(root, doc['source_script'])
        source_references[doc['source_script']] = sha(source)
        if doc.get('source_sha256') and doc['source_sha256'] != sha(source):
            raise ValueError('Source script hash mismatch')
    return {'schema_version': 1, 'entries': entries, 'scene_count': len(entries), 'assets': list(assets.values()), 'identity_sources': sources, 'source_references': source_references, 'clip_sources': clip_sources, 'ccsd_sha256': sha(ccsd_path), 'manifest_sha256': sha(manifest_path), 'qa_sha256': sha(qa_path), 'candidate_sha256': digest, 'project_id': doc.get('project_id'), 'status': 'TECHNICAL_QA_MEMORY_SNAPSHOT', 'technical_qa': 'PASS', 'visual_identity_review': 'PENDING', 'creative_review': 'PENDING', 'successful_hooks': [], 'production_approved': False, 'publication_enabled': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for flag in ('ccsd', 'manifest', 'candidate', 'qa', 'out'):
        parser.add_argument('--' + flag, required=True)
    parser.add_argument('--baseline')
    args = parser.parse_args()
    result = snapshot(args.ccsd, args.manifest, args.candidate, args.qa, baseline=read(args.baseline) if args.baseline else None)
    out = Path(args.out); out.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(dir=out.parent, prefix='.memory-')
    try:
        with os.fdopen(fd, 'w') as stream:
            json.dump(result, stream, indent=2, allow_nan=False)
            stream.flush(); os.fsync(stream.fileno())
        os.replace(name, out)
    finally:
        if os.path.exists(name): os.unlink(name)
    print(json.dumps({'status': result['status'], 'scene_count': result['scene_count'], 'production_approved': False, 'publication_enabled': False}))


if __name__ == '__main__':
    main()
