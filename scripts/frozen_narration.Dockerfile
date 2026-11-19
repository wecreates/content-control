# Official python:3.12.14-trixie amd64 manifest, verified via Docker Hub tag API.
FROM python@sha256:6dc02694c53fde08b0e39de9273a708d2f2a612f77dc173a64835c3f7a40ee35
RUN test "$(dpkg --print-architecture)" = amd64 \
 && test "$(python --version)" = 'Python 3.12.14' \
 && apt-get update \
 && apt-get install -y --no-install-recommends \
      ffmpeg=7:7.1.5-0+deb13u1 \
      libavcodec61=7:7.1.5-0+deb13u1 \
      libavdevice61=7:7.1.5-0+deb13u1 \
      libavfilter10=7:7.1.5-0+deb13u1 \
      libavformat61=7:7.1.5-0+deb13u1 \
      libavutil59=7:7.1.5-0+deb13u1 \
      libpostproc58=7:7.1.5-0+deb13u1 \
      libswresample5=7:7.1.5-0+deb13u1 \
      libswscale8=7:7.1.5-0+deb13u1 \
      libmp3lame0=3.100-6+b3 \
 && python -m pip install --no-cache-dir --only-binary=:all: numpy==2.3.5 \
 && python -c 'import numpy; assert numpy.__version__ == "2.3.5"' \
 && echo 'e8a8d46f5225f3062cec7c07fb145d58ae73c603cb740dcd5bad34bfb54e455a  /usr/bin/ffmpeg' | sha256sum -c - \
 && echo '98d0d7579c760053242a1deac2ebe335b8f8636f44235580f05b732f5fa207bb  /usr/lib/x86_64-linux-gnu/libmp3lame.so.0.0.0' | sha256sum -c - \
 && rm -rf /var/lib/apt/lists/*
ENV PYTHONDONTWRITEBYTECODE=1
ENTRYPOINT ["python", "/input/runtime.py"]
