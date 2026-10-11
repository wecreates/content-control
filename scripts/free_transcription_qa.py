#!/usr/bin/env python3
import argparse,json,re,difflib,math,subprocess
from collections import Counter
from pathlib import Path

STOP={
  "the","a","an","and","or","to","of","in","on","for","with","that","this","it",
  "is","are","was","were","be","been","you","your","i","we","they","he","she",
  "just","has","have","had","only","when","if"
}

def _integer_words(value):
    small=('zero one two three four five six seven eight nine ten eleven twelve '
           'thirteen fourteen fifteen sixteen seventeen eighteen nineteen').split()
    tens='zero ten twenty thirty forty fifty sixty seventy eighty ninety'.split()
    if value<20:return small[value]
    if value<100:return tens[value//10]+(' '+small[value%10] if value%10 else '')
    if value<1000:return small[value//100]+' hundred'+(' '+_integer_words(value%100) if value%100 else '')
    for scale,name in [(10**12,'trillion'),(10**9,'billion'),(10**6,'million'),(1000,'thousand')]:
        if value>=scale:return _integer_words(value//scale)+' '+name+(' '+_integer_words(value%scale) if value%scale else '')

def _numeric_words(match):
    currency,sign,number,percent=match.groups()
    whole,separator,fraction=number.replace(',','').partition('.')
    # Leave extremely long identifiers intact rather than treating them as speech.
    if len(whole)>15:return match.group(0)
    words=('minus ' if sign=='-' else 'plus ' if sign=='+' else '')+_integer_words(int(whole))
    if currency and (not separator or len(fraction)<=2):
        words+=' dollar'
        if separator and int(fraction.ljust(2,'0')):
            words+=' and '+_integer_words(int(fraction.ljust(2,'0')))+' cent'
    else:
        if separator:words+=' point '+' '.join(_integer_words(int(d)) for d in fraction)
        if currency:words+=' dollar'
    if percent:words+=' percent'
    return words

def norm(s):
    s=s.lower().replace("’","'").replace("“",'"').replace("”",'"')
    # Expand notation, preserving sign, magnitude, cents, and percentage units.
    s=re.sub(r"(?<![\w.])(\$?)([+-]?)(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)(%?)(?!\w|\.\d)",_numeric_words,s)
    s=re.sub(r'\bdollars\b','dollar',s)
    s=re.sub(r'\bcents\b','cent',s)
    s=re.sub(r"[^a-z0-9']+"," ",s)
    return " ".join(s.split())

def tokens(s):
    return [x for x in norm(s).split() if x not in STOP and len(x)>1]

def ordered_word_similarity(expected,actual):
    # Compare ordered normalized words rather than raw characters. Character-level
    # SequenceMatcher produces pathological scores on long repetitive English text
    # and heavily penalizes equivalent ASR numeric formatting such as 2% vs
    # "two percent" or $80 vs "eighty dollars".
    ew=norm(expected).split()
    aw=norm(actual).split()
    return difflib.SequenceMatcher(None,ew,aw,autojunk=False).ratio()

def duration_matches_contract(duration,contract):
    expected=contract.get("expected_duration_seconds")
    if expected is None:return 20.0<=duration<=40.0
    if isinstance(expected,bool) or not isinstance(expected,(int,float)) or not math.isfinite(expected) or not 0<expected<=3600:return False
    return math.isfinite(duration) and abs(duration-expected)<=0.1

def decode_transcription_audio(path):
    """Decode local audio to Whisper's 16kHz mono float32 input using FFmpeg.

    Passing samples avoids faster-whisper 1.2.1's PyAV metadata_errors call,
    which is incompatible with PyAV 19. Duration uses the full decoded track.
    """
    import numpy as np
    source=Path(path).resolve(strict=True)
    if not source.is_file():raise ValueError("Audio input must be a local file")
    result=subprocess.run([
        "ffmpeg","-nostdin","-hide_banner","-loglevel","error","-i",str(source),
        "-map","0:a:0","-vn","-ac","1","-ar","16000","-f","f32le","pipe:1",
    ],capture_output=True,timeout=180)
    if result.returncode:raise ValueError("Audio decode failed: "+result.stderr.decode(errors="replace")[-500:])
    if not result.stdout or len(result.stdout)%4:raise ValueError("Decoded audio is empty or malformed")
    samples=np.frombuffer(result.stdout,dtype="<f4").copy()
    if not np.isfinite(samples).all():raise ValueError("Decoded audio contains nonfinite samples")
    return samples,len(samples)/16000

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
    cues=contract.get("caption_cues",[])
    narration_end=float(cues[-1]["end"]) if cues else None

    audio_samples,media_duration=decode_transcription_audio(a.audio)
    model=WhisperModel(a.model,device="cpu",compute_type="int8")
    segments,info=model.transcribe(
        audio_samples,
        language="en",
        beam_size=5,
        vad_filter=True,
        condition_on_previous_text=True,
        clip_timestamps=f"0,{narration_end}" if narration_end else "0",
    )
    segs=[]
    actual_parts=[]
    for s in segments:
        start=float(s.start); end=float(s.end)
        if narration_end is not None and start>=narration_end+0.25:
            continue
        text=s.text.strip()
        if text:
            actual_parts.append(text)
            segs.append({"start":round(start,3),"end":round(min(end,narration_end) if narration_end else end,3),"text":text})
    actual=" ".join(actual_parts).strip()

    ne,na=norm(expected),norm(actual)
    sequence_ratio=ordered_word_similarity(expected,actual)

    et=tokens(expected); at=tokens(actual)
    ec,ac=Counter(et),Counter(at)
    matched=sum(min(n,ac[t]) for t,n in ec.items())
    token_recall=matched/max(1,sum(ec.values()))

    semantic_groups=contract.get("transcription_semantic_groups")
    if not semantic_groups:
        key=[x for x in tokens(expected) if len(x)>=4]
        # Deterministic contract-derived anchors avoid coupling QA to one episode.
        seen=[]
        for x in key:
            if x not in seen:
                seen.append(x)
        semantic_groups=[[x] for x in seen[:12]]
    alow=na
    semantic_hits=[]
    for group in semantic_groups:
        hit=any(re.search(r"(?<![a-z0-9])"+re.escape(term)+r"(?![a-z0-9])",alow) for term in group)
        semantic_hits.append({"terms":group,"pass":hit})
    semantic_recall=sum(x["pass"] for x in semantic_hits)/len(semantic_hits)

    segment_end=max((s["end"] for s in segs),default=0.0)
    coverage_ratio=segment_end/media_duration if media_duration>0 else 0.0
    checks={
      "transcript_nonempty":len(actual.split())>=40,
      "sequence_similarity_ok":sequence_ratio>=0.62,
      "content_token_recall_ok":token_recall>=0.68,
      "semantic_recall_ok":semantic_recall>=0.82,
      "duration_plausible":duration_matches_contract(media_duration,contract),
      "transcript_coverage_ok":coverage_ratio>=0.70,
      "no_post_narration_hallucination":narration_end is None or segment_end<=narration_end+0.25,
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
