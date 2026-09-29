#!/usr/bin/env python3
import argparse,json,subprocess,tempfile
from pathlib import Path
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--manifest",required=True);ap.add_argument("--scene-dir",required=True);ap.add_argument("--out",required=True);ap.add_argument("--receipt",required=True);a=ap.parse_args();m=json.loads(Path(a.manifest).read_text());files=[]
 for s in m.get("scenes",[]):
  p=Path(a.scene_dir,f"{s['scene_id']}.mp4")
  if not p.is_file():raise SystemExit(f"missing scene {p}")
  files.append(p)
 Path(a.out).parent.mkdir(parents=True,exist_ok=True)
 with tempfile.NamedTemporaryFile("w",suffix=".txt",delete=False) as f:
  for p in files:f.write("file '"+str(p.resolve()).replace("'","'\\''")+"'\n")
  name=f.name
 subprocess.check_call(["ffmpeg","-y","-f","concat","-safe","0","-i",name,"-c:v","libx264","-crf","20","-pix_fmt","yuv420p","-c:a","aac","-b:a","192k","-movflags","+faststart",a.out],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 r={"schema_version":1,"status":"PASS","scenes":[str(x) for x in files],"master":a.out,"publication_enabled":False};Path(a.receipt).write_text(json.dumps(r,indent=2)+"\n");print(json.dumps({"status":"PASS","scenes":len(files)}))
if __name__=="__main__":main()
