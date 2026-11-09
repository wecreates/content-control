"""Bounded real local Kokoro smoke; objective audio evidence is not voice approval."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
try:
    from scripts.timed_free_voice import build
except ModuleNotFoundError:
    from timed_free_voice import build


def smoke(out_dir):
    lines = [('narrator', 'This is the narrator voice check.'),
             ('dave', 'This is Dave speaking in his own voice.'),
             ('points_monk', 'This is the Points Monk voice check.')]
    source = {'publication_enabled': False, 'scenes': [
        {'id': speaker, 'start': i*7, 'end': (i+1)*7,
         'audio': {'dialogue': [{'speaker': speaker, 'text': text}]}}
        for i, (speaker, text) in enumerate(lines)]}
    root = Path(out_dir)
    result = build(source, root)
    audio = root/'voice.wav'
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-i', str(audio), '-f', 'null', '-'],
                   check=True, capture_output=True, text=True, timeout=60)
    probe = subprocess.run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(audio)],
                           check=True, capture_output=True, text=True, timeout=30)
    receipt = {'status': 'GENERATED_PENDING_LISTENING_REVIEW', 'provider': 'kokoro',
               'model_repository': 'hexgrad/Kokoro-82M', 'provider_calls': 0,
               'publication_enabled': False, 'production_approved': False,
               'full_av_review': False, 'transcript_verified': False,
               'full_audio_decode': True, 'voice_assignments': result['voice_assignments'],
               'audio_sha256': hashlib.sha256(audio.read_bytes()).hexdigest(),
               'requested_text_sha256': hashlib.sha256(json.dumps(lines, separators=(',', ':')).encode()).hexdigest(),
               'requested_lines': [{'speaker': speaker, 'text': text} for speaker, text in lines],
               'source_sha256': {name: hashlib.sha256((Path(__file__).parent/name).read_bytes()).hexdigest() for name in ['timed_free_voice.py', 'v2_free_voice.py', 'v2_audio_assemble.py', 'smoke_timed_free_voice.py']},
               'clips': result['manifest']['clips'], 'probe': json.loads(probe.stdout),
               'scope': 'Actual local synthesis and full decode; requested text hashes are not ASR or listening proof'}
    (root/'smoke-receipt.json').write_text(json.dumps(receipt, indent=2)+'\n')
    return receipt


if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--out-dir', required=True)
    args = parser.parse_args()
    print(json.dumps(smoke(args.out_dir)))
