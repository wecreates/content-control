#!/usr/bin/env python3
import argparse,hashlib,json,math,os,re,subprocess,tempfile
from pathlib import Path

SCOPE="Technical audio diagnostics only; successful decoding and metrics do not certify listening, creative quality, synchronization, or competitor comparison."

def safe_output(video, output):
    if output.is_symlink():
        raise ValueError("Output must not be a symlink")
    if output.resolve()==video.resolve() or output.exists() and video.exists() and output.samefile(video):
        raise ValueError("Output must not overwrite the input video")
    if output.exists() and not output.is_file():
        raise ValueError("Output must be a regular file")
    return output.resolve()

def write_report(video, output, report):
    output=safe_output(video,output)
    temporary=None
    try:
        with tempfile.NamedTemporaryFile(mode="w",encoding="utf-8",dir=output.parent,
                                         prefix=".audio-qa-",suffix=".json",delete=False) as stream:
            temporary=Path(stream.name)
            stream.write(json.dumps(report,indent=2,sort_keys=True,allow_nan=False)+"\n")
        safe_output(video,output)
        os.replace(temporary,output)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)

def media_hash(video):
    with video.open("rb") as stream:
        return hashlib.file_digest(stream,"sha256").hexdigest()

def run(cmd):
    # Keep credentials, FFREPORT and user runtime hooks out of media subprocesses.
    environment={key:value for key,value in os.environ.items()
                 if key.upper() in {"PATH","SYSTEMROOT","WINDIR","TMP","TEMP","TMPDIR"}}
    environment.update({"LANG":"C","LC_ALL":"C"})
    return subprocess.run(cmd,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=False,
                          timeout=30 if cmd[0]=="ffprobe" else 600,env=environment)

def positive_seconds(value):
    seconds=float(value)
    if not math.isfinite(seconds) or seconds<=0:
        raise argparse.ArgumentTypeError("duration must be a finite positive number of seconds")
    return seconds

def finite_number(value):
    try:
        value=float(value)
    except (TypeError, ValueError):
        return None
    return value if math.isfinite(value) else None

def volume_metrics(log):
    # Input tags are echoed with indentation. Only accept one named filter's
    # complete, unambiguous pair of metrics at the beginning of actual log lines.
    rows=re.findall(r"^\[(Parsed_volumedetect_\d+ @ (?:0x)?[0-9a-fA-F]+)\] (mean_volume|max_volume):\s*(\S+) dB[ \t]*$",log,re.MULTILINE)
    if len(rows)!=2 or len({row[0] for row in rows})!=1 or {row[1] for row in rows}!={"mean_volume","max_volume"}:
        return None,None
    metrics={name:finite_number(value) for _,name,value in rows}
    return metrics["mean_volume"],metrics["max_volume"]

def silence_metrics(log):
    lines=re.findall(r"^\[(?:Parsed_)?silencedetect(?:_\d+)? @ (?:0x)?[0-9a-fA-F]+\] (silence_[^\n]*)$",log,re.MULTILINE)
    durations=[]
    pending=False
    valid=True
    for line in lines:
        start=re.fullmatch(r"silence_start:\s*(\S+)[ \t]*",line)
        end=re.fullmatch(r"silence_end:\s*(\S+) \| silence_duration:\s*(\S+)[ \t]*",line)
        if start:
            value=finite_number(start.group(1))
            valid=valid and not pending and value is not None and value>=0
            pending=True
        elif end:
            end_time,duration=map(finite_number,end.groups())
            valid=valid and pending and end_time is not None and end_time>=0 and duration is not None and duration>=0
            if duration is not None and duration>=0:
                durations.append(duration)
            pending=False
        else:
            valid=False
    return durations,valid and not pending

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--video",required=True)
    ap.add_argument("--output",required=True)
    ap.add_argument("--expected-duration-seconds",type=positive_seconds,default=30.0,
                    help="Expected timeline duration; defaults to the existing 30-second episode contract")
    a=ap.parse_args()
    video=Path(a.video)
    output=safe_output(video,Path(a.output))
    # A failed or interrupted new run must never leave an older PASS at its target.
    write_report(video,output,{
        "schema_version":1,"engine":"ffmpeg-free-audio-qa-v1","verdict":"FAIL",
        "checks":{"analysis_complete":False},"reason":"Analysis incomplete or interrupted",
        "production_approved":False,"publication_enabled":False,"full_audio_review":False,
        "scope":SCOPE,
    })
    if not video.is_file():
        raise SystemExit("missing video")
    source_hash=media_hash(video)

    probe=run(["ffprobe","-v","error","-protocol_whitelist","file","-select_streams","a:0","-show_entries",
               "stream=codec_name,sample_rate,channels:format=duration","-of","json",str(video)])
    if probe.returncode!=0:
        raise SystemExit(probe.stderr)
    pdata=json.loads(probe.stdout or "{}")
    streams=pdata.get("streams",[]) if isinstance(pdata,dict) else []
    if not isinstance(streams,list) or not streams or not isinstance(streams[0],dict) or not streams[0].get("codec_name"):
        raise SystemExit("no usable audio stream")
    s=streams[0]
    duration=finite_number(pdata.get("format",{}).get("duration"))
    if duration is None or duration<=0:
        duration=None
    sample_rate=int(s.get("sample_rate") or 0)
    channels=int(s.get("channels") or 0)

    vol=run(["ffmpeg","-nostdin","-hide_banner","-nostats","-xerror","-err_detect","explode","-protocol_whitelist","file","-i",str(video),"-map","0:a:0",
             "-af","volumedetect","-f","null","-"])
    text=vol.stderr
    mean_volume,max_volume=volume_metrics(text)

    sil=run(["ffmpeg","-nostdin","-hide_banner","-nostats","-xerror","-err_detect","explode","-protocol_whitelist","file","-i",str(video),"-map","0:a:0",
             "-af","silencedetect=noise=-45dB:d=2.5","-f","null","-"])
    silence_durations,silence_metrics_valid=silence_metrics(sil.stderr)
    max_silence=max(silence_durations) if silence_durations else 0.0
    if media_hash(video)!=source_hash:
        raise ValueError("Video changed during audio analysis")

    checks={
        "analysis_complete":True,
        "duration_match":duration is not None and abs(duration-a.expected_duration_seconds)<=0.5,
        "sample_rate_ok":sample_rate>=32000,
        "channels_ok":channels in (1,2),
        "volume_analysis_succeeded":vol.returncode==0,
        "silence_analysis_succeeded":sil.returncode==0,
        "silence_metrics_valid":silence_metrics_valid,
        "volume_metrics_present":mean_volume is not None and max_volume is not None,
        "not_too_quiet":mean_volume is not None and mean_volume>=-40.0 and max_volume is not None and max_volume>=-10.0,
        "clipping_headroom_ok":max_volume is not None and max_volume<=0.1,
        "no_excessive_long_silence":max_silence<=5.0,
    }
    verdict="PASS" if all(checks.values()) else "FAIL"
    report={
        "schema_version":1,
        "engine":"ffmpeg-free-audio-qa-v1",
        "candidate_sha256":source_hash,
        "duration_seconds":duration,
        "expected_duration_seconds":a.expected_duration_seconds,
        "duration_tolerance_seconds":0.5,
        "codec":s.get("codec_name"),
        "sample_rate_hz":sample_rate,
        "channels":channels,
        "mean_volume_db":mean_volume,
        "max_volume_db":max_volume,
        "long_silence_durations_seconds":silence_durations,
        "max_long_silence_seconds":max_silence,
        "checks":checks,
        "verdict":verdict,
        "production_approved":False,
        "publication_enabled":False,
        "full_audio_review":False,
        "scope":SCOPE,
    }
    write_report(video,output,report)
    print(json.dumps(report,sort_keys=True,allow_nan=False))
    if verdict!="PASS":
        raise SystemExit(5)

if __name__=="__main__":
    main()
