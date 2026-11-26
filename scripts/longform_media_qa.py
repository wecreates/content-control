#!/usr/bin/env python3
import argparse
from fractions import Fraction
import json
from pathlib import Path
import subprocess


def _duration(value):
    try:
        return max(Fraction(str(value)), Fraction(0))
    except (ValueError, ZeroDivisionError):
        return Fraction(0)


def _picture_duration(stream):
    try:
        ticks = int(stream["duration_ts"])
        time_base = Fraction(stream["time_base"])
    except (KeyError, TypeError, ValueError, ZeroDivisionError):
        return _duration(stream.get("duration"))
    return max(ticks * time_base, Fraction(0)) if time_base > 0 else Fraction(0)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--video", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    probe = json.loads(subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", args.video],
        text=True,
    ))
    video = next((stream for stream in probe["streams"] if stream.get("codec_type") == "video"), {})
    audio = next((stream for stream in probe["streams"] if stream.get("codec_type") == "audio"), {})
    container_duration = _duration(probe.get("format", {}).get("duration"))
    picture_duration = _picture_duration(video)
    checks = {
        "video_present": bool(video),
        "audio_present": bool(audio),
        "h264": video.get("codec_name") == "h264",
        "aac": audio.get("codec_name") == "aac",
        "sixteen_by_nine": video.get("width", 0) * 9 == video.get("height", 1) * 16,
        "duration_longform": min(container_duration, picture_duration) >= 300,
        "publication_disabled": True,
    }
    failed = [name for name, passed in checks.items() if not passed]
    report = {
        "schema_version": 1,
        "status": "FAIL" if failed else "PASS",
        "checks": checks,
        "failed_checks": failed,
        "duration_seconds": float(container_duration),
        "picture_duration_seconds": float(picture_duration),
        "publication_enabled": False,
    }
    Path(args.out).write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
    print(json.dumps(report, sort_keys=True))
    raise SystemExit(2 if failed else 0)


if __name__ == "__main__":
    main()
