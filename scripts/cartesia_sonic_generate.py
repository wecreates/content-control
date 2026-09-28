#!/usr/bin/env python3
import argparse,json,os,subprocess,tempfile,urllib.request
from pathlib import Path
from scripts.voice_provider import CARTESIA_ENV

API="https://api.cartesia.ai/tts/bytes"
VERSION="2026-08-14"

def map_emotion(tone):
    tone=(tone or "").lower()
    if "anxious" in tone or "excited" in tone: return "surprise:high"
    if "deadpan" in tone or "calm" in tone: return "curiosity:low"
    if "mischievous" in tone: return "positivity:high"
    if "sad" in tone: return "sadness:high"
    if "angry" in tone: return "anger:high"
    return "curiosity:low"

def build_payload(text,voice_id,speed=1.0,emotion=None):
    cfg={"volume":1.0,"speed":float(speed)}
    if emotion: cfg["emotion"]=emotion
    return {
      "model_id":"sonic-3.6",
      "transcript":text,
      "voice":voice_id,
      "output_format":{"container":"wav","encoding":"pcm_s16le","sample_rate":44100},
      "language":"en",
      "normalization":"auto",
      "generation_config":cfg,
    }

def split_segments(segments):
    return [dict(x) for x in segments if (x.get("text") or "").strip()]

def request_audio(api_key,payload,out):
    req=urllib.request.Request(
      API,
      data=json.dumps(payload).encode(),
      headers={
        "Authorization":"Bearer "+api_key,
        "Cartesia-Version":VERSION,
        "Content-Type":"application/json",
        "Accept":"audio/wav",
      },
      method="POST",
    )
    with urllib.request.urlopen(req,timeout=180) as r:
        out.write_bytes(r.read())

def concat_wav(parts,out):
    if len(parts)==1:
        out.write_bytes(parts[0].read_bytes());return
    with tempfile.TemporaryDirectory() as td:
        listing=Path(td)/"list.txt"
        listing.write_text("\n".join(f"file '{p.resolve()}'" for p in parts)+"\n")
        subprocess.run([
          "ffmpeg","-y","-f","concat","-safe","0","-i",str(listing),
          "-c:a","pcm_s16le","-ar","44100",str(out)
        ],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--dialogue",required=True)
    ap.add_argument("--out",required=True)
    ap.add_argument("--receipt",required=True)
    a=ap.parse_args()
    dialogue=json.loads(Path(a.dialogue).read_text())
    api_key=os.environ.get("CARTESIA_API_KEY","")
    receipt={"schema_version":1,"provider":"cartesia","model_id":"sonic-3.6","publication_enabled":False}
    try:
        if not api_key: raise RuntimeError("missing CARTESIA_API_KEY")
        segs=split_segments(dialogue.get("segments",[]))
        if not segs: raise RuntimeError("no dialogue segments")
        out=Path(a.out);out.parent.mkdir(parents=True,exist_ok=True)
        parts=[]
        with tempfile.TemporaryDirectory() as td:
            for i,s in enumerate(segs):
                speaker=s.get("speaker","narrator")
                voice_id=os.environ.get(CARTESIA_ENV[speaker],"")
                if not voice_id: raise RuntimeError(f"missing {CARTESIA_ENV[speaker]}")
                perf=s.get("performance") or {}
                tone=perf.get("tone","")
                pace=float(perf.get("pace",1.0) or 1.0)
                p=Path(td)/f"part-{i:03d}.wav"
                request_audio(api_key,build_payload(s.get("text",""),voice_id,pace,map_emotion(tone)),p)
                parts.append(p)
            concat_wav(parts,out)
        probe=subprocess.run(["ffprobe","-v","error","-select_streams","a:0","-show_entries","stream=codec_name,sample_rate,channels","-show_entries","format=duration","-of","json",str(out)],check=True,capture_output=True,text=True)
        receipt.update({"status":"PASS","selected_provider":"cartesia","output":str(out),"segments":len(segs),"probe":json.loads(probe.stdout)})
    except Exception as e:
        receipt.update({"status":"FALLBACK_REQUIRED","selected_provider":"fallback","fallback_required":True,"error":str(e)})
    Path(a.receipt).parent.mkdir(parents=True,exist_ok=True)
    Path(a.receipt).write_text(json.dumps(receipt,indent=2,sort_keys=True)+"\n")
    print(json.dumps(receipt,sort_keys=True))
    raise SystemExit(0)

if __name__=="__main__":
    main()
