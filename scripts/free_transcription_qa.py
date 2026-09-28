#!/usr/bin/env python3
import argparse,json,re,difflib
from collections import Counter
from pathlib import Path
import av

STOP={
  "the","a","an","and","or","to","of","in","on","for","with","that","this","it",
  "is","are","was","were","be","been","you","your","i","we","they","he","she",
  "just","has","have","had","only","when","if"
}

def norm(s):
    s=s.lower().replace("’","'").replace("“",'"').replace("”",'"')
    s=re.sub(r"[^a-z0-9']+"," ",s)
    return " ".join(s.split())

def tokens(s):
    return [x for x in norm(s).split() if x not in STOP and len(x)>1]

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--audio",required=True)
    ap.add_argument("--contract",required=True)
    ap.add_argument("--output",required=True)
    ap.add_argument("--model",default="tiny.en")
    a=ap.parse_args()

    from faster_whisper import WhisperModel
    from importlib.metadata import version

    contract=json.loads(Path(a.contract).read_text())
    expected=contract["narration_text"]

    model=WhisperModel(a.model,device="cpu",compute_type="int8")
    segments,info=model.transcribe(
        a.audio,
        language="en",
        beam_size=5,
        vad_filter=True,
        condition_on_previous_text=True,
    )
    segs=[]
    actual_parts=[]
    for s in segments:
        text=s.text.strip()
        if text:
            actual_parts.append(text)
            segs.append({"start":round(float(s.start),3),"end":round(float(s.end),3),"text":text})
    actual=" ".join(actual_parts).strip()

    ne,na=norm(expected),norm(actual)
    sequence_ratio=difflib.SequenceMatcher(None,ne,na).ratio()

    et=tokens(expected); at=tokens(actual)
    ec,ac=Counter(et),Counter(at)
    matched=sum(min(n,ac[t]) for t,n in ec.items())
    token_recall=matched/max(1,sum(ec.values()))

    semantic_groups=[
      ["dave","premium","card"],
      ["annual","fee"],
      ["chad"],
      ["eighty","80"],
      ["twenty","20","credit"],
      ["points","monk"],
      ["buy","thing","anyway"],
      ["saving","money"],
      ["value","purchase"],
      ["subtract","fee"],
      ["math","wins"]
    ]
    alow=na
    semantic_hits=[]
    for group in semantic_groups:
        hit=any(re.search(r"(?<![a-z0-9])"+re.escape(term)+r"(?![a-z0-9])",alow) for term in group)
        semantic_hits.append({"terms":group,"pass":hit})
    semantic_recall=sum(x["pass"] for x in semantic_hits)/len(semantic_hits)

    segment_end=max((s["end"] for s in segs),default=0.0)
    with av.open(a.audio) as container:
        media_duration=float(container.duration/1_000_000) if container.duration is not None else segment_end
    coverage_ratio=segment_end/media_duration if media_duration>0 else 0.0
    checks={
      "transcript_nonempty":len(actual.split())>=40,
      "sequence_similarity_ok":sequence_ratio>=0.62,
      "content_token_recall_ok":token_recall>=0.68,
      "semantic_recall_ok":semantic_recall>=0.82,
      "duration_plausible":20.0<=media_duration<=40.0,
      "transcript_coverage_ok":coverage_ratio>=0.70,
      "publication_disabled":contract.get("publication_enabled") is False,
    }
    status="PASS" if all(checks.values()) else "FAIL"
    report={
      "schema_version":1,
      "status":status,
      "engine":"faster-whisper",
      "faster_whisper_version":version("faster-whisper"),
      "model":a.model,
      "language":getattr(info,"language","en"),
      "language_probability":getattr(info,"language_probability",None),
      "expected_text":expected,
      "actual_transcript":actual,
      "segments":segs,
      "sequence_similarity":round(sequence_ratio,6),
      "content_token_recall":round(token_recall,6),
      "semantic_recall":round(semantic_recall,6),
      "semantic_hits":semantic_hits,
      "transcribed_duration_seconds":round(segment_end,3),
      "media_duration_seconds":round(media_duration,3),
      "transcript_coverage_ratio":round(coverage_ratio,6),
      "checks":checks,
      "failed_checks":[k for k,v in checks.items() if not v],
      "publication_enabled":False,
    }
    Path(a.output).write_text(json.dumps(report,indent=2,sort_keys=True)+"\n")
    print(json.dumps({k:report[k] for k in ["status","sequence_similarity","content_token_recall","semantic_recall","transcribed_duration_seconds"]},sort_keys=True))
    if status!="PASS":
        raise SystemExit(2)

if __name__=="__main__":
    main()
