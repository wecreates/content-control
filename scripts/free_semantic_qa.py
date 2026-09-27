#!/usr/bin/env python3
import argparse, json
from pathlib import Path
import numpy as np
from PIL import Image

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--reference-dir",required=True)
    ap.add_argument("--candidate-dir",required=True)
    ap.add_argument("--output",required=True)
    args=ap.parse_args()

    import torch
    import open_clip

    refs=sorted(Path(args.reference_dir).glob("*.jpg"))+sorted(Path(args.reference_dir).glob("*.png"))
    cands=sorted(Path(args.candidate_dir).glob("*.jpg"))+sorted(Path(args.candidate_dir).glob("*.png"))
    if len(refs)<5 or len(cands)<5:
        raise RuntimeError("insufficient reference/candidate frames")

    device="cpu"
    model,_,preprocess=open_clip.create_model_and_transforms("ViT-B-32",pretrained="laion2b_s34b_b79k",device=device)
    model.eval()

    def emb(paths):
        batch=torch.stack([preprocess(Image.open(p).convert("RGB")) for p in paths]).to(device)
        with torch.no_grad():
            x=model.encode_image(batch)
            x=x/x.norm(dim=-1,keepdim=True)
        return x.cpu()

    re=emb(refs)
    ce=emb(cands)
    sims=(ce@re.T).numpy()
    best=sims.max(axis=1)
    mean_best=float(best.mean())
    global_similarity=float((ce.mean(0)@re.mean(0)).item())

    captions={"reference":[],"candidate":[]}
    florence_status="not_run"
    florence_error=None
    try:
        from transformers import AutoProcessor, AutoModelForCausalLM
        model_id="microsoft/Florence-2-base"
        processor=AutoProcessor.from_pretrained(model_id,trust_remote_code=True)
        fm=AutoModelForCausalLM.from_pretrained(model_id,trust_remote_code=True).to(device)
        fm.eval()
        def caption(path):
            image=Image.open(path).convert("RGB")
            prompt="<MORE_DETAILED_CAPTION>"
            inputs=processor(text=prompt,images=image,return_tensors="pt")
            with torch.no_grad():
                generated=fm.generate(
                    input_ids=inputs["input_ids"].to(device),
                    pixel_values=inputs["pixel_values"].to(device),
                    max_new_tokens=96,
                    num_beams=2,
                    do_sample=False,
                )
            text=processor.batch_decode(generated,skip_special_tokens=False)[0]
            parsed=processor.post_process_generation(text,task=prompt,image_size=(image.width,image.height))
            return str(parsed.get(prompt,parsed))
        for p in refs[::max(1,len(refs)//3)][:3]:
            captions["reference"].append({"file":p.name,"caption":caption(p)})
        for p in cands[::max(1,len(cands)//3)][:3]:
            captions["candidate"].append({"file":p.name,"caption":caption(p)})
        florence_status="PASS"
    except Exception as e:
        florence_status="PARTIAL"
        florence_error=f"{type(e).__name__}: {e}"

    checks={
        "openclip_mean_best_similarity":mean_best>=0.20,
        "openclip_global_similarity":global_similarity>=0.18,
        "florence_completed":florence_status=="PASS",
    }
    # OpenCLIP is the required semantic gate. Florence is an explanatory second opinion:
    # a transient model-load issue must not invalidate deterministic pixel QA.
    verdict="PASS" if checks["openclip_mean_best_similarity"] and checks["openclip_global_similarity"] else "FAIL"
    report={
        "schema_version":1,
        "engine":"openclip-florence-free-qa-v1",
        "openclip_model":"ViT-B-32/laion2b_s34b_b79k",
        "florence_model":"microsoft/Florence-2-base",
        "mean_best_frame_similarity":round(mean_best,6),
        "global_similarity":round(global_similarity,6),
        "best_reference_similarity_by_candidate":[round(float(x),6) for x in best],
        "florence_status":florence_status,
        "florence_error":florence_error,
        "captions":captions,
        "checks":checks,
        "verdict":verdict,
    }
    Path(args.output).write_text(json.dumps(report,indent=2,sort_keys=True)+"\n")
    print(json.dumps(report,sort_keys=True))
    if verdict!="PASS":
        raise SystemExit(3)

if __name__=="__main__":
    main()
