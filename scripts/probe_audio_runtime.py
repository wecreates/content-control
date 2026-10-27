"""Fail before synthesis unless the installed audio tools support our exact formats."""
import json
from pathlib import Path
import shutil
import struct
import subprocess
import tempfile
import wave


def probe(require_espeak=True):
    names = ['ffmpeg', 'ffprobe'] + (['espeak-ng'] if require_espeak else [])
    paths = {name: shutil.which(name) for name in names}
    if not all(paths.values()):
        raise RuntimeError('Missing audio executables: ' + ', '.join(k for k,v in paths.items() if not v))
    versions = {}
    for name, path in paths.items():
        result = subprocess.run([path, '--version' if name == 'espeak-ng' else '-version'], capture_output=True, check=True, timeout=15)
        versions[name] = result.stdout.decode().splitlines()[0]
    with tempfile.TemporaryDirectory() as folder:
        source = Path(folder)/'input.wav'
        with wave.open(str(source), 'wb') as out:
            out.setparams((1, 2, 16000, 0, 'NONE', 'not compressed'))
            out.writeframes(struct.pack('<h', 8192)*1600)
        # Same float32 output and rate as free_transcription_qa; no precision fallback.
        decoded = subprocess.run([paths['ffmpeg'], '-nostdin', '-v', 'error', '-i', str(source), '-map', '0:a:0', '-vn', '-ac', '1', '-ar', '16000', '-f', 'f32le', 'pipe:1'], capture_output=True, check=True, timeout=15).stdout
        if len(decoded) != 6400 or any(abs(x-.25)>1e-6 for x in struct.unpack('<1600f', decoded)):
            raise RuntimeError('Float32 transcription decode failed')
        target = Path(folder)/'normalized.wav'
        subprocess.run([paths['ffmpeg'], '-nostdin', '-v', 'error', '-y', '-i', str(source), '-ar', '44100', '-ac', '2', '-c:a', 'pcm_s16le', str(target)], capture_output=True, check=True, timeout=15)
        info = json.loads(subprocess.run([paths['ffprobe'], '-v', 'error', '-show_streams', '-of', 'json', str(target)], capture_output=True, check=True, timeout=15).stdout)
        stream = info['streams'][0]
        if (stream['codec_name'], stream['sample_rate'], stream['channels']) != ('pcm_s16le', '44100', 2):
            raise RuntimeError('Voice PCM normalization failed')
    return {'status':'PASS', 'executables':paths, 'versions':versions, 'float32_decode_samples':1600}


if __name__ == '__main__':
    print(json.dumps(probe(), indent=2))
