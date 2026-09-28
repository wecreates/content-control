#!/usr/bin/env python3
import argparse,json,cv2,torch
from pathlib import Path
from PIL import Image
import open_clip

def extract_frame(video,time,out):
    cap=cv2.VideoCapture(str(video));cap.set(cv2.CAP_PROP_POS_MSEC,float(time)*1000);ok,fr=cap.read();cap.release()
    if not ok:return False
    cv2.imwrite(str(out),fr);return True

def review(video,ccsd,outdir):
    outdir=Path(outdir);outdir.mkdir(parents=True,exist_ok=True)
    scenes=ccsd.get("scenes",[])
    model,_,preprocess=open_clip.create_model_and_transforms("ViT-B-32",pretrained="laion2b_s34b_b79k",device="cpu")
    tokenizer=open_clip.get_tokenizer("ViT-B-32");model.eval()
    rows=[];blocking=[]
    for i,s in enumerate(scenes):
        mid=(float(s.get("start",0))+float(s.get("end",0)))/2
        p=outdir/f"scene-{i:03d}.jpg"
        if not extract_frame(video,mid,p):
            rows.append({"scene_id":s.get("id"),"status":"NO_FRAME","similarity":0});blocking.append(s.get("id"));continue
        chars=" ".join(x.get("id","") for x in s.get("characters",[]))
        props=" ".join(x.get("id","") for x in s.get("props",[]))
        env=(s.get("environment") or {}).get("id","white_stage")
        beat=(s.get("story") or {}).get("beat","finance story")
        prompt=f"simple black stick figure animation, {chars}, {props}, {env}, {beat}"
        im=preprocess(Image.open(p).convert("RGB")).unsqueeze(0)
        tok=tokenizer([prompt])
        with torch.no_grad():
            iz=model.encode_image(im);tz=model.encode_text(tok);iz=iz/iz.norm(dim=-1,keepdim=True);tz=tz/tz.norm(dim=-1,keepdim=True);sim=float((iz@tz.T).item())
        status="PASS" if sim>=.12 else "NOTE"
        note=None if status=="PASS" else "animatic frame weakly matches expected scene semantics; inspect staging/readability"
        rows.append({"scene_id":s.get("id"),"time":round(mid,3),"similarity":round(sim,4),"status":status,"note":note,"prompt":prompt})
    return {"schema_version":1,"status":"PASS","shots":rows,"blocking":blocking,"publication_enabled":False}

def main():
    ap=argparse.ArgumentParser();ap.add_argument("--video",required=True);ap.add_argument("--ccsd",required=True);ap.add_argument("--frames",required=True);ap.add_argument("--out",required=True);a=ap.parse_args()
    r=review(a.video,json.loads(Path(a.ccsd).read_text()),a.frames);Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":r["status"],"shots":len(r["shots"]),"notes":sum(x["status"]!="PASS" for x in r["shots"])}))
if __name__=="__main__":main()
