#!/usr/bin/env python3
import argparse,json,re,subprocess
from pathlib import Path

def run(cmd):
    return subprocess.run(cmd,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=False)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--video",required=True)
    ap.add_argument("--output",required=True)
    a=ap.parse_args()
    video=Path(a.video)
    if not video.is_file():
        raise SystemExit("missing video")

    probe=run(["ffprobe","-v","error","-select_streams","a:0","-show_entries",
               "stream=codec_name,sample_rate,channels:format=duration","-of","json",str(video)])
    if probe.returncode!=0:
        raise SystemExit(probe.stderr)
    pdata=json.loads(probe.stdout or "{}")
    streams=pdata.get("streams",[])
    if not streams:
        raise SystemExit("no audio stream")
    s=streams[0]
    duration=float(pdata.get("format",{}).get("duration") or 0)
    sample_rate=int(s.get("sample_rate") or 0)
    channels=int(s.get("channels") or 0)

    vol=run(["ffmpeg","-hide_banner","-nostats","-i",str(video),"-map","0:a:0",
             "-af","volumedetect","-f","null","-"])
    text=vol.stderr
    mm=re.search(r"mean_volume:\s*(-?\d+(?:\.\d+)?) dB",text)
    mx=re.search(r"max_volume:\s*(-?\d+(?:\.\d+)?) dB",text)
    mean_volume=float(mm.group(1)) if mm else None
    max_volume=float(mx.group(1)) if mx else None

    sil=run(["ffmpeg","-hide_banner","-nostats","-i",str(video),"-map","0:a:0",
             "-af","silencedetect=noise=-45dB:d=2.5","-f","null","-"])
    silence_durations=[float(x) for x in re.findall(r"silence_duration:\s*(\d+(?:\.\d+)?)",sil.stderr)]
    max_silence=max(silence_durations) if silence_durations else 0.0

    checks={
        "duration_match":29.5<=duration<=30.5,
        "sample_rate_ok":sample_rate>=32000,
        "channels_ok":channels in (1,2),
        "volume_metrics_present":mean_volume is not None and max_volume is not None,
        "not_too_quiet":mean_volume is not None and mean_volume>=-40.0 and max_volume is not None and max_volume>=-10.0,
        "clipping_headroom_ok":max_volume is not None and max_volume<=0.1,
        "no_excessive_long_silence":max_silence<=5.0,
    }
    verdict="PASS" if all(checks.values()) else "FAIL"
    report={
        "schema_version":1,
        "engine":"ffmpeg-free-audio-qa-v1",
        "duration_seconds":duration,
        "codec":s.get("codec_name"),
        "sample_rate_hz":sample_rate,
        "channels":channels,
        "mean_volume_db":mean_volume,
        "max_volume_db":max_volume,
        "long_silence_durations_seconds":silence_durations,
        "max_long_silence_seconds":max_silence,
        "checks":checks,
        "verdict":verdict,
    }
    Path(a.output).write_text(json.dumps(report,indent=2,sort_keys=True)+"\n")
    print(json.dumps(report,sort_keys=True))
    if verdict!="PASS":
        raise SystemExit(5)

if __name__=="__main__":
    main()
