#!/usr/bin/env python3
import argparse,json,os,subprocess,hashlib
from pathlib import Path

def sha(p):
    h=hashlib.sha256();h.update(Path(p).read_bytes());return h.hexdigest()

def generate(manifest,config,outdir):
    key=os.getenv(config["credentials"]["api_key_env"])
    if not key:
        return {"schema_version":1,"status":"NOT_CONFIGURED","reason":"CARTESIA_API_KEY missing","publication_enabled":False}
    from cartesia import Cartesia
    client=Cartesia(api_key=key)
    out=Path(outdir);out.mkdir(parents=True,exist_ok=True)
    rows=[]
    for i,seg in enumerate(manifest.get("segments",[])):
        speaker=seg["speaker"];text=seg["text"].strip()
        if not text: continue
        if any(tok in text.lower() for tok in ["sfx:","whoosh","door slam","coin ping"]):
            raise RuntimeError(f"spoken SFX blocked for {speaker}")
        role=(config["roles"].get(speaker) or config["roles"]["narrator"])
        vid=os.getenv(role["voice_id_env"]) or role["voice_id_default"]
        path=out/f"{i:03d}-{speaker}.wav"
        response=client.tts.generate(model_id=config["production_default"]["model_id"],transcript=text,voice=vid,output_format=config["output"],language=role.get("language","en"))
        response.write_to_file(str(path))
        probe=json.loads(subprocess.check_output(["ffprobe","-v","error","-show_streams","-show_format","-of","json",str(path)],text=True))
        dur=float(probe["format"]["duration"])
        rows.append({"index":i,"speaker":speaker,"text":text,"start":float(seg.get("start",0) or 0),"voice_id":vid,"path":str(path),"duration_seconds":round(dur,3),"sha256":sha(path)})
    return {"schema_version":1,"status":"PASS" if rows else "EMPTY","provider":"cartesia","model_id":config["production_default"]["model_id"],"segments":rows,"publication_enabled":False}

def main():
    ap=argparse.ArgumentParser();ap.add_argument("--manifest",required=True);ap.add_argument("--config",default="control/voice-engine-v3.json");ap.add_argument("--out-dir",required=True);ap.add_argument("--receipt",required=True);a=ap.parse_args()
    r=generate(json.loads(Path(a.manifest).read_text()),json.loads(Path(a.config).read_text()),a.out_dir)
    Path(a.receipt).parent.mkdir(parents=True,exist_ok=True);Path(a.receipt).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n")
    print(json.dumps({"status":r["status"],"provider":r.get("provider"),"segments":len(r.get("segments",[]))},sort_keys=True))
if __name__=="__main__":main()
