"""Expose hash-verified registry media tools without Ubuntu package downloads.

Install requirements-media-runtime.txt with --require-hashes --only-binary=:all:
after npm ci. Linux x86_64 only; unknown versions/platforms fail closed.
"""
import argparse
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import platform
import struct
import subprocess
import tempfile
import wave

FFMPEG_SHA = 'e7e7fb30477f717e6f55f9180a70386c62677ef8a4d4d1a5d948f4098aa3eb99'
FFPROBE_SHA = '3bad619e6da4abbd8fc13f46b08e869c28f38852a8a4f168579eef23b96eae1d'

def verified_executable(path, expected):
    path = Path(path).resolve(strict=True)
    if not path.is_file() or not os.access(path, os.X_OK):
        raise RuntimeError('Media executable missing or not executable')
    with path.open('rb') as stream:
        actual = hashlib.file_digest(stream, 'sha256').hexdigest()
    if actual != expected:
        raise RuntimeError('Media executable hash mismatch: ' + path.name)
    return path

def probe(ffmpeg, ffprobe):
    versions = {}
    for name, path in [('ffmpeg', ffmpeg), ('ffprobe', ffprobe)]:
        versions[name] = subprocess.check_output([str(path), '-version'], timeout=15, text=True).splitlines()[0]
    with tempfile.TemporaryDirectory() as folder:
        source, target = Path(folder)/'source.wav', Path(folder)/'normalized.wav'
        with wave.open(str(source), 'wb') as out:
            out.setparams((1, 2, 16000, 0, 'NONE', 'not compressed'))
            out.writeframes(struct.pack('<h', 8192)*1600)
        decoded = subprocess.check_output([str(ffmpeg), '-nostdin', '-v', 'error', '-i', str(source), '-map', '0:a:0', '-vn', '-ac', '1', '-ar', '16000', '-f', 'f32le', 'pipe:1'], timeout=15)
        if len(decoded) != 6400 or any(abs(x-.25)>1e-6 for x in struct.unpack('<1600f', decoded)):
            raise RuntimeError('Exact float32 transcription decode failed')
        subprocess.run([str(ffmpeg), '-nostdin', '-v', 'error', '-i', str(source), '-ar', '44100', '-ac', '2', '-c:a', 'pcm_s16le', str(target)], check=True, timeout=15)
        stream = json.loads(subprocess.check_output([str(ffprobe), '-v', 'error', '-show_streams', '-of', 'json', str(target)], timeout=15))['streams'][0]
        if (stream['codec_name'], stream['sample_rate'], stream['channels']) != ('pcm_s16le', '44100', 2):
            raise RuntimeError('PCM normalization failed')
    return {'status': 'PASS', 'versions': versions, 'float32_decode_samples': 1600}

def setup(repo, destination):
    if platform.system() != 'Linux' or platform.machine() not in ('x86_64', 'AMD64'):
        raise RuntimeError('Pinned media runtime supports Linux x86_64 only')
    if importlib.metadata.version('imageio-ffmpeg') != '0.6.0':
        raise RuntimeError('Unexpected imageio-ffmpeg version')
    import imageio_ffmpeg
    # Deliberately do not honor IMAGEIO_FFMPEG_EXE or a PATH fallback.
    ffmpeg = verified_executable(Path(imageio_ffmpeg.__file__).parent/'binaries/ffmpeg-linux-x86_64-v7.0.2', FFMPEG_SHA)
    package = Path(repo)/'node_modules/@remotion/compositor-linux-x64-gnu'
    if json.loads((package/'package.json').read_text()).get('version') != '4.0.529':
        raise RuntimeError('Unexpected pinned Remotion compositor version')
    ffprobe = verified_executable(package/'ffprobe', FFPROBE_SHA)
    receipt = probe(ffmpeg, ffprobe)
    destination = Path(destination).absolute()
    # Never overwrite another runtime or existing link.
    destination.mkdir(parents=True, exist_ok=False)
    for name, source in [('ffmpeg', ffmpeg), ('ffprobe', ffprobe)]:
        (destination/name).symlink_to(source)
    receipt.update(bin_directory=str(destination), ffmpeg_sha256=FFMPEG_SHA, ffprobe_sha256=FFPROBE_SHA,
                   provenance='Hash-pinned official PyPI imageio-ffmpeg 0.6.0 wheel and npm-locked Remotion 4.0.529 compositor',
                   licenses={'imageio_ffmpeg': 'BSD-2-Clause', 'bundled_ffmpeg': 'GPL-3.0-or-later'})
    return receipt

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--repo', default='.')
    parser.add_argument('--bin-dir', required=True)
    parser.add_argument('--github-path', action='store_true')
    args = parser.parse_args()
    receipt = setup(args.repo, args.bin_dir)
    if args.github_path:
        with open(os.environ['GITHUB_PATH'], 'a') as out:
            out.write(receipt['bin_directory']+'\n')
    print(json.dumps(receipt, indent=2))

if __name__ == '__main__':
    main()
