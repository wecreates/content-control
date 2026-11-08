"""Reconstruction-only container entrypoint; fixed input/output paths, no network calls."""
import hashlib
import json
from pathlib import Path
import platform
import subprocess
import sys

BASE = 'python@sha256:6dc02694c53fde08b0e39de9273a708d2f2a612f77dc173a64835c3f7a40ee35'
PACKAGES = ['ffmpeg', 'libavcodec61', 'libavdevice61', 'libavfilter10', 'libavformat61',
            'libavutil59', 'libpostproc58', 'libswresample5', 'libswscale8', 'libmp3lame0']
BINARIES = {'ffmpeg': ('/usr/bin/ffmpeg', 'e8a8d46f5225f3062cec7c07fb145d58ae73c603cb740dcd5bad34bfb54e455a'),
            'libmp3lame': ('/usr/lib/x86_64-linux-gnu/libmp3lame.so.0.0.0', '98d0d7579c760053242a1deac2ebe335b8f8636f44235580f05b732f5fa207bb')}

def main():
    report = {'status': 'BLOCKED', 'base_image_reference': BASE, 'python': platform.python_version(),
              'network': 'none', 'packages': {}, 'binaries_sha256': {}}
    try:
        import numpy
        report['numpy'] = numpy.__version__
        for name in PACKAGES:
            version = subprocess.check_output(['dpkg-query', '-W', '-f=${Version}', name], text=True).strip()
            report['packages'][name] = version
            expected = '3.100-6+b3' if name == 'libmp3lame0' else '7:7.1.5-0+deb13u1'
            if version != expected:
                raise ValueError('Pinned package version mismatch')
        for name, (path, expected) in BINARIES.items():
            actual = hashlib.sha256(Path(path).read_bytes()).hexdigest()
            report['binaries_sha256'][name] = actual
            if actual != expected:
                raise ValueError('Pinned binary mismatch')
        if report['python'] != '3.12.14' or report['numpy'] != '2.3.5':
            raise ValueError('Pinned Python or NumPy version mismatch')
        report['status'] = 'RUNTIME_IDENTITIES_VERIFIED'
    except (OSError, ValueError, ImportError, subprocess.CalledProcessError):
        report['reason'] = 'Runtime identity verification failed'
    Path('/output/runtime.json').write_text(json.dumps(report, sort_keys=True) + '\n')
    if report['status'] != 'RUNTIME_IDENTITIES_VERIFIED':
        return 2
    return subprocess.run([sys.executable, '/input/regenerate.py', '--source', '/input/original.mp3',
                           '--output-dir', '/output/result'], check=False).returncode

if __name__ == '__main__':
    raise SystemExit(main())
