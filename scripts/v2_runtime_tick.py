#!/usr/bin/env python3
import hashlib,json,os,subprocess,time
from pathlib import Path
from scripts.v2_orchestrator import build_plan,derive_metrics,creative_gate

ROOT=Path(__file__).resolve().parents[1]
CCSD=ROOT/"projects/v2/amex-vs-chase-boss-fight/ccsd.json"
OUT=ROOT/"public-review/v2-boss-fight.mp4"
HEALTH=ROOT/"state/v2-health.json"
WORK=ROOT/"state/v2-live"

def run(cmd):
    return subprocess.run(cmd,cwd=ROOT,check=True,text=True,capture_output=True)

def tick():
    if os.getenv("PUBLICATION_ENABLED","false").lower()=="true":
        raise RuntimeError("V2 refuses publication-enabled execution")
    WORK.mkdir(parents=True,exist_ok=True);OUT.parent.mkdir(parents=True,exist_ok=True);HEALTH.parent.mkdir(parents=True,exist_ok=True)
    ccsd=json.loads(CCSD.read_text());metrics=derive_metrics(ccsd);creative=creative_gate(metrics)
    if not creative["pass"]:
        HEALTH.write_text(json.dumps({"status":"BLOCKED","publication_enabled":False,"creative_qa":False,"metrics":metrics},indent=2)+"\n")
        return {"status":"BLOCKED","reason":"creative_qa","metrics":metrics}
    dialogue=WORK/"dialogue.json";voice=WORK/"voice.wav";silent=WORK/"silent.mp4";receipt=WORK/"media-qa.json"
    run(["python","scripts/ccsd_voice_manifest.py","--ccsd",str(CCSD),"--out",str(dialogue)])
    run(["python","scripts/local_tts_fallback.py","--dialogue",str(dialogue),"--out",str(voice),"--receipt",str(WORK/"voice.json")])
    props=json.dumps({"ccsd":ccsd},separators=(",",":"))
    run(["npx","remotion","render","remotion/studio-animatic-index.jsx","StudioAnimatic",str(silent),"--props="+props,"--codec=h264","--crf=18","--concurrency=1"])
    run(["ffmpeg","-y","-i",str(silent),"-i",str(voice),"-map","0:v:0","-map","1:a:0","-c:v","copy","-c:a","aac","-b:a","192k","-af","apad","-shortest",str(OUT)])
    run(["python","scripts/production_reality_media_qa.py","--video",str(OUT),"--ccsd",str(CCSD),"--out",str(receipt)])
    media=json.loads(receipt.read_text())
    technical=media.get("status") in ("PASS","GREEN")
    digest=hashlib.sha256(OUT.read_bytes()).hexdigest()
    status="READY" if technical and creative["pass"] else "BLOCKED"
    health={"status":status,"publication_enabled":False,"technical_qa":technical,"creative_qa":creative["pass"],"candidate_sha256":digest,"metrics":metrics,"media_qa":media,"updated_at":int(time.time())}
    HEALTH.write_text(json.dumps(health,indent=2)+"\n")
    return health

if __name__=="__main__":
    try: print(json.dumps(tick()))
    except Exception as e:
        HEALTH.parent.mkdir(parents=True,exist_ok=True)
        HEALTH.write_text(json.dumps({"status":"BLOCKED","publication_enabled":False,"error":str(e),"updated_at":int(time.time())},indent=2)+"\n")
        raise
