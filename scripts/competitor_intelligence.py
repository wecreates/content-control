#!/usr/bin/env python3
import argparse, datetime, json, os, pathlib, re, statistics, subprocess, tempfile, time, urllib.request, urllib.error, random

ROOT = pathlib.Path(__file__).resolve().parents[1]
CONFIG = ROOT / "control" / "competitor-intelligence-v1.json"
OUTDIR = ROOT / "state" / "competitor-intelligence-v1"

def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

def run(cmd):
    return subprocess.run(cmd, check=True, text=True, capture_output=True)

def ffprobe_duration(path):
    p = run(["ffprobe","-v","error","-show_entries","format=duration","-of","default=nw=1:nk=1",str(path)])
    return float(p.stdout.strip())

def resolve_target(target):
    if target.get("url"):
        return target["url"]
    q = target["search_query"]
    p = run(["yt-dlp","--print","webpage_url","--skip-download",f"ytsearch1:{q}"])
    url = p.stdout.strip().splitlines()[0]
    if not url.startswith("http"):
        raise RuntimeError(f"Could not resolve {q}")
    return url

def download_video(url, work):
    template = str(work / "video.%(ext)s")
    run(["yt-dlp","--no-playlist","-f","bestvideo[height<=720]+bestaudio/best[height<=720]","--merge-output-format","mp4","-o",template,url])
    vids = [p for p in work.glob("video.*") if p.suffix.lower() in {".mp4",".mkv",".webm",".mov"}]
    if not vids:
        raise RuntimeError("video download missing")
    return vids[0]

def download_subtitles(url, work):
    subprocess.run(["yt-dlp","--skip-download","--write-subs","--write-auto-subs","--sub-langs","en,en-US,en-GB","--sub-format","vtt","-o",str(work/"subs"),url],check=False,text=True,capture_output=True)
    files = list(work.glob("subs*.vtt"))
    return files[0] if files else None

def scene_cuts(path, threshold=0.32):
    p = subprocess.run(["ffmpeg","-hide_banner","-i",str(path),"-filter:v",f"select='gt(scene,{threshold})',showinfo","-f","null","-"],text=True,capture_output=True)
    pts=[]
    for line in p.stderr.splitlines():
        m=re.search(r"pts_time:([0-9.]+)",line)
        if m:
            pts.append(float(m.group(1)))
    return pts

def transcript_stats(vtt_path):
    if not vtt_path:
        return {"present":False,"word_count":None,"cue_count":None}
    text=vtt_path.read_text(errors="ignore")
    spoken=re.sub(r"WEBVTT|\d\d:\d\d:[0-9.]+\s+-->.*|<[^>]+>|\d+\n"," ",text)
    words=re.findall(r"\b[\w’'-]+\b",spoken)
    return {"present":True,"word_count":len(words),"cue_count":text.count("-->")}

def gemini_upload(path,key):
    meta=json.dumps({"file":{"display_name":path.name}}).encode()
    req=urllib.request.Request("https://generativelanguage.googleapis.com/upload/v1beta/files?key="+key,data=meta,headers={"X-Goog-Upload-Protocol":"resumable","X-Goog-Upload-Command":"start","X-Goog-Upload-Header-Content-Length":str(path.stat().st_size),"X-Goog-Upload-Header-Content-Type":"video/mp4","Content-Type":"application/json"})
    with urllib.request.urlopen(req,timeout=60) as r:
        upload_url=r.headers["X-Goog-Upload-URL"]
    req=urllib.request.Request(upload_url,data=path.read_bytes(),headers={"Content-Length":str(path.stat().st_size),"X-Goog-Upload-Offset":"0","X-Goog-Upload-Command":"upload, finalize"})
    with urllib.request.urlopen(req,timeout=600) as r:
        f=json.loads(r.read())["file"]
    for _ in range(120):
        with urllib.request.urlopen(urllib.request.Request("https://generativelanguage.googleapis.com/v1beta/files?pageSize=100",headers={"x-goog-api-key":key}),timeout=30) as r:
            listing=json.loads(r.read())
        cur=next((x for x in listing.get("files",[]) if x.get("name")==f.get("name")),{})
        if cur.get("state")=="ACTIVE":
            return cur
        if cur.get("state")=="FAILED":
            raise RuntimeError(cur)
        time.sleep(5)
    raise RuntimeError("Gemini processing timeout")

PROMPT = """
Watch this exact competitor video from beginning to end with audio. Analyze it as a senior YouTube animation creative director and retention editor. This is private competitive research only. Do not reproduce copyrighted dialogue, exact jokes, shot sequences, character designs, or distinctive creator assets.

Return strict JSON only with:
{
  "complete_end_to_end_review": true,
  "opening": {"first_3_seconds":"","promise_by_15_seconds":"","hook_mechanisms":[],"intro_length_sec":0.0},
  "pacing": {"overall":"","estimated_meaningful_visual_change_sec":0.0,"slow_ranges":[],"high_energy_ranges":[]},
  "motion": {"character_action":"","camera_motion":"","kinetic_text":"","object_choreography":"","physical_cause_effect":"","static_hold_policy":""},
  "story": {"structure":[],"stakes":"","escalation":"","callbacks":[],"ending_payoff":""},
  "humor": {"cadence":"","mechanisms":[],"visual_vs_verbal_balance":"","deadpan_or_reaction_timing":""},
  "sound": {"music_role":"","sfx_role":"","silence_role":"","sync_notes":""},
  "retention_resets": [{"start_sec":0.0,"type":"","description":""}],
  "timestamped_patterns": [{"start_sec":0.0,"end_sec":0.0,"pattern":"","why_it_works":"","transferable_principle":""}],
  "distinctive_creator_elements_not_to_copy": [],
  "transferable_principles": [],
  "credit_card_adaptation_ideas": []
}
Be concrete and timestamped. Focus on transferable mechanics for an original motion-graphics/stick-animation finance channel.
"""

def gemini_analyze(file_uri,key):
    body={"model":"gemini-3.8-flash","input":[{"type":"video","uri":file_uri,"mime_type":"video/mp4","processing":"agentic"},{"type":"text","text":PROMPT}]}
    for model in ["gemini-3.8-flash","gemini-3-flash-preview"]:
        body["model"]=model
        for attempt in range(5):
            req=urllib.request.Request("https://generativelanguage.googleapis.com/v1beta/interactions",data=json.dumps(body).encode(),headers={"Content-Type":"application/json","x-goog-api-key":key})
            try:
                with urllib.request.urlopen(req,timeout=1200) as r:
                    obj=json.loads(r.read())
                texts=[]
                for step in obj.get("steps",[]):
                    if step.get("type")=="model_output":
                        for item in step.get("content",[]):
                            if item.get("type")=="text":
                                texts.append(item.get("text",""))
                raw=("\n".join(texts) or obj.get("output_text","")).strip()
                if raw.startswith("```"):
                    raw=raw.strip("`")
                    raw=re.sub(r"^json\s*","",raw)
                data=json.loads(raw)
                assert data["complete_end_to_end_review"] is True
                return data
            except (urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as e:
                if isinstance(e,urllib.error.HTTPError) and e.code not in (429,500,502,503,504):
                    raise
                time.sleep(min(60,3*(2**attempt))+random.random()*2)
    raise RuntimeError("all Gemini analysis routes failed")

def analyze_one(creator,role,target,key):
    url=resolve_target(target)
    with tempfile.TemporaryDirectory() as td:
        work=pathlib.Path(td)
        video=download_video(url,work)
        duration=ffprobe_duration(video)
        subs=download_subtitles(url,work)
        cuts=scene_cuts(video)
        gf=gemini_upload(video,key)
        creative=gemini_analyze(gf["uri"],key)
        return {
            "creator":creator,
            "role":role,
            "title":target.get("title"),
            "resolved_url":url,
            "duration_sec":duration,
            "scene_cut_count":len(cuts),
            "scene_cuts_per_min":round(len(cuts)/(duration/60),2) if duration else 0,
            "scene_cut_timestamps":cuts,
            "transcript":transcript_stats(subs),
            "creative_analysis":creative,
            "analyzed_at":now()
        }

def synthesize(rows):
    cuts=[r["scene_cuts_per_min"] for r in rows]
    return {
        "video_count":len(rows),
        "creators":sorted({r["creator"] for r in rows}),
        "scene_cuts_per_min":{"median":statistics.median(cuts),"mean":round(statistics.mean(cuts),2),"min":min(cuts),"max":max(cuts)},
        "episode1_required_changes":[
            "No slide-deck visual grammar",
            "Cold open creates physical conflict or reversal immediately",
            "Alex continuously acts on or reacts to the finance world",
            "Every explanation uses visual cause/effect, not matching illustration only",
            "Comedic escalation and callbacks are structural glue",
            "Chapter resets change location, problem, or energy",
            "Sound punctuates contact, reveals, failures, and jokes",
            "Ending pays off an opening object or conflict"
        ]
    }

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--limit",type=int,default=0)
    args=ap.parse_args()
    key=os.environ.get("GEMINI_API_KEY")
    if not key:
        raise RuntimeError("GEMINI_API_KEY missing")
    cfg=json.load(open(CONFIG))
    OUTDIR.mkdir(parents=True,exist_ok=True)
    jobs=[(c["creator"],c["role"],t) for c in cfg["creators"] for t in c["targets"]]
    if args.limit:
        jobs=jobs[:args.limit]
    rows=[]; failures=[]
    for i,(creator,role,target) in enumerate(jobs,1):
        try:
            row=analyze_one(creator,role,target,key)
            rows.append(row)
            safe=re.sub(r"[^a-z0-9]+","-",creator.lower()).strip("-")
            (OUTDIR/f"{i:02d}-{safe}.json").write_text(json.dumps(row,indent=2,sort_keys=True)+"\n")
            print(json.dumps({"status":"PASS","creator":creator,"title":target.get("title"),"cuts_per_min":row["scene_cuts_per_min"]}))
        except Exception as e:
            failures.append({"creator":creator,"title":target.get("title"),"error":str(e)})
            print(json.dumps({"status":"FAIL","creator":creator,"error":str(e)}))
    if not rows:
        raise RuntimeError(f"no competitor analyses succeeded: {failures}")
    summary={"schema_version":1,"status":"COMPLETE" if not failures else "PARTIAL","publication_enabled":False,"videos_analyzed":len(rows),"videos_failed":len(failures),"failures":failures,"benchmark":synthesize(rows),"completed_at":now()}
    (OUTDIR/"benchmark.json").write_text(json.dumps(summary,indent=2,sort_keys=True)+"\n")
    print(json.dumps(summary,sort_keys=True))

if __name__=="__main__":
    main()
