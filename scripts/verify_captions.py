#!/usr/bin/env python3
import hashlib,json,re,sys
from pathlib import Path

vtt=Path(sys.argv[1] if len(sys.argv)>1 else "public-review/episode1-v10-free.vtt")
trans=Path(sys.argv[2] if len(sys.argv)>2 else "state/narration-transcription-health.json")
out=Path(sys.argv[3] if len(sys.argv)>3 else "state/caption-health.json")
t=json.loads(trans.read_text())
health=json.loads(Path("state/content-control-health.json").read_text())
narration=Path("public/audio/episode1-narration.mp3")
def sha256(p):
    h=hashlib.sha256()
    with open(p,"rb") as f:
        for chunk in iter(lambda:f.read(1024*1024),b""): h.update(chunk)
    return h.hexdigest()
text=vtt.read_text(encoding="utf-8")
assert text.startswith("WEBVTT\n")
timings=re.findall(r"(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})",text)
def sec(s):
    h,m,rest=s.split(":"); ss,ms=rest.split(".")
    return int(h)*3600+int(m)*60+int(ss)+int(ms)/1000
pairs=[(sec(a),sec(b)) for a,b in timings]
checks={
 "caption_file_exists":vtt.is_file() and vtt.stat().st_size>100,
 "segment_count_matches":len(pairs)==len(t.get("segments",[])),
 "monotonic":all(a>=0 and b>a and (i==0 or a>=pairs[i-1][1]-0.05) for i,(a,b) in enumerate(pairs)),
 "starts_near_zero":bool(pairs) and pairs[0][0]<=0.5,
 "covers_spoken_audio":bool(pairs) and pairs[-1][1]>=float(t.get("transcribed_duration_seconds",0))-0.25,
 "ends_within_media":bool(pairs) and pairs[-1][1]<=float(t.get("media_duration_seconds",40))+0.25,
 "transcription_source_green":t.get("status")=="PASS",
 "candidate_health_green":health.get("status")=="GREEN",
 "narration_asset_present":narration.is_file() and narration.stat().st_size>1000,
}
report={
 "schema_version":1,
 "status":"PASS" if all(checks.values()) else "FAIL",
 "caption_path":str(vtt),
 "segment_count":len(pairs),
 "caption_end_seconds":pairs[-1][1] if pairs else None,
 "candidate_sha256":health.get("candidate_sha256"),
 "caption_sha256":sha256(vtt),
 "transcription_receipt_sha256":sha256(trans),
 "narration_sha256":sha256(narration) if narration.is_file() else None,
 "checks":checks,
 "failed_checks":[k for k,v in checks.items() if not v],
 "publication_enabled":False,
}
out.write_text(json.dumps(report,indent=2,sort_keys=True)+"\n")
print(json.dumps(report,sort_keys=True))
raise SystemExit(0 if report["status"]=="PASS" else 2)
