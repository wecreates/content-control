# Pinned Linux media tools

This build-only runtime replaces Ubuntu FFmpeg downloads on Linux x86_64 runners.
It does not install voices, call providers, change quality thresholds, or approve media.

After `npm ci`:

```sh
python -m pip install --require-hashes --only-binary=:all: -r requirements-media-runtime.txt
python scripts/setup_pinned_media_runtime.py --bin-dir "$RUNNER_TEMP/content-control-media-bin" --github-path
```

`--github-path` exposes the verified tools to later GitHub Actions steps. For local
tests, omit that flag and explicitly prepend the returned directory to PATH.
Use a fresh directory. The helper refuses overwrites, unknown platforms, package
versions, binary hashes, or failed real decode/normalization probes. It does not
honor an external `IMAGEIO_FFMPEG_EXE` override.

## Provenance and licenses

- Official [PyPI imageio-ffmpeg 0.6.0 release](https://pypi.org/project/imageio-ffmpeg/0.6.0/), Linux x86_64 wheel; SHA-256 is locked in the requirements file.
- The [imageio wrapper license](https://github.com/imageio/imageio-ffmpeg/blob/v0.6.0/LICENSE) is BSD-2-Clause.
- Its bundled FFmpeg reports version 7.0.2-static, built with GPL/version3 enabled, and GPL-3.0-or-later in `ffmpeg -L`. The helper also verifies the executable hash. No executable is downloaded from an arbitrary binary URL.
- ffprobe comes from the existing npm-lock-pinned `@remotion/compositor-linux-x64-gnu` 4.0.529 package and is independently hash-verified.

Keep executable binaries and their package directories out of generated-media
artifacts. Existing package license notices remain with the installed tools.
The runtime receipt prints versions, hashes, and license identifiers for diagnosis.

## Checks

The helper verifies all 1,600 decoded float32 sample values from a known PCM input,
and 44.1 kHz stereo PCM16 normalization through the actual ffprobe executable.
The regression suite also runs actual H.264/AAC fixture generation, full AV decode,
silence/short-audio rejection, and the unchanged production media-QA checks.
Kokoro synthesis still requires its existing espeak/runtime dependencies separately.
