#!/usr/bin/env python3
import argparse, json
from pathlib import Path
import numpy as np
from PIL import Image
import torch
import open_clip

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--reference-dir",required=True)
    ap.add_argument("--candidate-dir",required=True)
    ap.add_argument("--output",required=True)
    a=ap.parse_args()

    refs=sorted(Path(a.reference_dir).glob("ref-*.jpg"))
    cands=sorted(Path(a.candidate_dir).glob("cand-*.jpg"))
    if len(refs)<10 or len(cands)<8:
        raise RuntimeError("insufficient semantic QA frames")

    device="cpu"
    model,_,preprocess=open_clip.create_model_and_transforms(
        "ViT-B-32",pretrained="laion2b_s34b_b79k",device=device
    )
    model.eval()

    def encode(paths):
        batch=torch.stack([preprocess(Image.open(p).convert("RGB")) for p in paths]).to(device)
        with torch.no_grad():
            z=model.encode_image(batch)
            z=z/z.norm(dim=-1,keepdim=True)
        return z.cpu()

    re=encode(refs)
    ce=encode(cands)
    sims=(ce@re.T).numpy()
    best=sims.max(axis=1)
    mean_best=float(best.mean())
    global_similarity=float((ce.mean(0)@re.mean(0)).item())

    florence={"status":"PARTIAL","captions":{"reference":[],"candidate":[]},"error":None}
    try:
        from transformers import AutoProcessor, AutoModelForCausalLM
        mid="microsoft/Florence-2-base"
        processor=AutoProcessor.from_pretrained(mid,trust_remote_code=True)
        fm=AutoModelForCausalLM.from_pretrained(mid,trust_remote_code=True).to(device)
        fm.eval()
        def caption(p):
            im=Image.open(p).convert("RGB")
            prompt="<MORE_DETAILED_CAPTION>"
            inp=processor(text=prompt,images=im,return_tensors="pt")
            with torch.no_grad():
                out=fm.generate(
                    input_ids=inp["input_ids"].to(device),
                    pixel_values=inp["pixel_values"].to(device),
                    max_new_tokens=72,
                    num_beams=2,
                    do_sample=False,
                )
            raw=processor.batch_decode(out,skip_special_tokens=False)[0]
            parsed=processor.post_process_generation(
                raw,task=prompt,image_size=(im.width,im.height)
            )
            return str(parsed.get(prompt,parsed))
        for p in [refs[0],refs[len(refs)//2],refs[-1]]:
            florence["captions"]["reference"].append({"file":p.name,"caption":caption(p)})
        for p in [cands[0],cands[len(cands)//2],cands[-1]]:
            florence["captions"]["candidate"].append({"file":p.name,"caption":caption(p)})
        florence["status"]="PASS"
    except Exception as e:
        florence["error"]=f"{type(e).__name__}: {e}"

    checks={
        "openclip_mean_best_similarity":mean_best>=0.20,
        "openclip_global_similarity":global_similarity>=0.18,
    }
    report={
        "schema_version":1,
        "engine":"openclip-florence-free-qa-v1",
        "openclip_model":"ViT-B-32/laion2b_s34b_b79k",
        "florence_model":"microsoft/Florence-2-base",
        "mean_best_frame_similarity":mean_best,
        "global_similarity":global_similarity,
        "best_reference_similarity_by_candidate":[float(x) for x in best],
        "florence":florence,
        "checks":checks,
        "verdict":"PASS" if all(checks.values()) else "FAIL",
    }
    Path(a.output).write_text(json.dumps(report,indent=2,sort_keys=True)+"\n")
    print(json.dumps(report,sort_keys=True))
    if report["verdict"]!="PASS": raise SystemExit(3)

if __name__=="__main__": main()
