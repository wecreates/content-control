#!/usr/bin/env python3
import argparse,difflib,json,re
from collections import Counter
from pathlib import Path

def norm(s):
    return " ".join(re.sub(r"[^a-z0-9']+"," ",(s or "").lower()).split())

def expected_text(manifest):
    return " ".join((x.get("text") or "").strip() for x in manifest.get("segments",[]) if (x.get("text") or "").strip())

def token_recall(expected,actual):
    e=norm(expected).split();a=norm(actual).split()
    ec,ac=Counter(e),Counter(a)
    matched=sum(min(n,ac[t]) for t,n in ec.items())
    return matched/max(1,sum(ec.values()))

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--audio",required=True)
    ap.add_argument("--manifest",required=True)
    ap.add_argument("--out",required=True)
    ap.add_argument("--model",default="base.en")
    a=ap.parse_args()

    manifest=json.loads(Path(a.manifest).read_text())
    expected=expected_text(manifest)
    from faster_whisper import WhisperModel
    model=WhisperModel(a.model,device="cpu",compute_type="int8")
    segments,info=model.transcribe(a.audio,language="en",beam_size=5,vad_filter=True,condition_on_previous_text=True)
    parts=[];end=0.0
    for s in segments:
        txt=s.text.strip()
        if txt:
            parts.append(txt);end=max(end,float(s.end))
    actual=" ".join(parts)
    ne,na=norm(expected),norm(actual)
    sim=difflib.SequenceMatcher(None,ne,na).ratio()
    recall=token_recall(expected,actual)
    checks={
      "transcript_nonempty":len(actual.split())>=max(3,int(len(expected.split())*.5)),
      "sequence_similarity_ok":sim>=.72,
      "token_recall_ok":recall>=.82,
    }
    status="PASS" if all(checks.values()) else "FAIL"
    r={"schema_version":1,"status":status,"expected_text":expected,"actual_transcript":actual,"transcript_similarity":round(sim,6),"semantic_recall":round(recall,6),"duration_seconds":round(end,3),"audio_pass":True,"checks":checks,"failed_checks":[k for k,v in checks.items() if not v],"publication_enabled":False}
    Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n")
    print(json.dumps({"status":status,"transcript_similarity":r["transcript_similarity"],"semantic_recall":r["semantic_recall"]},sort_keys=True))
    raise SystemExit(0 if status=="PASS" else 2)

if __name__=="__main__":
    main()
