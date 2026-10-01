#!/usr/bin/env python3
import argparse,json,shutil,subprocess,tempfile
from pathlib import Path
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--dialogue",required=True);ap.add_argument("--out",required=True);ap.add_argument("--receipt",required=True);a=ap.parse_args();d=json.loads(Path(a.dialogue).read_text());text=" ".join(x.get("text","") for x in d.get("segments",[]) if x.get("text"))
 out=Path(a.out);out.parent.mkdir(parents=True,exist_ok=True);provider=None
 try:
  if shutil.which("espeak-ng") or shutil.which("espeak"):
   exe=shutil.which("espeak-ng") or shutil.which("espeak");tmp=out.with_suffix(".raw.wav");subprocess.run([exe,"-s","185","-w",str(tmp),text],check=True);subprocess.run(["ffmpeg","-y","-i",str(tmp),"-ar","44100","-ac","2",str(out)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);provider="espeak"
  else: raise RuntimeError("no local TTS engine available")
  r={"schema_version":1,"status":"PASS","provider":provider,"quality_tier":"fallback_preview","output":str(out),"publication_enabled":False}
 except Exception as e:r={"schema_version":1,"status":"FAIL","error":str(e),"publication_enabled":False}
 Path(a.receipt).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps(r));raise SystemExit(0 if r["status"]=="PASS" else 2)
if __name__=="__main__":main()
