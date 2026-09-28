#!/usr/bin/env python3
import argparse,hashlib,json,os,subprocess,tempfile,urllib.request,urllib.error
from pathlib import Path
from scripts.voice_provider import add_v3_tags, ELEVEN_ENV

API="https://api.elevenlabs.io/v1/text-to-dialogue"
MAX_CHARS=1900

def chunk_turns(turns,max_chars=MAX_CHARS):
    chunks=[];cur=[];n=0
    for t in turns:
        text=t["text"]
        if len(text)>max_chars:
            if cur: chunks.append(cur);cur=[];n=0
            start=0
            while start<len(text):
                part=dict(t);part["text"]=text[start:start+max_chars]
                chunks.append([part]);start+=max_chars
            continue
        if cur and n+len(text)>max_chars:
            chunks.append(cur);cur=[];n=0
        cur.append(t);n+=len(text)
    if cur: chunks.append(cur)
    return chunks

def build_dialogue_payload(turns,seed):
    return {
      "model_id":"eleven_v3",
      "seed":int(seed)%2147483647,
      "inputs":[{"text":t["text"],"voice_id":t["voice_id"]} for t in turns]
    }

def stable_seed(reference,speaker,index):
    h=hashlib.sha256(f"{reference}|{speaker}|{index}".encode()).hexdigest()
    return int(h[:8],16)%2147483647

def request_audio(api_key,payload,output):
    data=json.dumps(payload).encode()
    req=urllib.request.Request(
      API+"?output_format=mp3_44100_128",
      data=data,
      headers={"xi-api-key":api_key,"Content-Type":"application/json","Accept":"audio/mpeg"},
      method="POST",
    )
    with urllib.request.urlopen(req,timeout=180) as r:
        output.write_bytes(r.read())

def concat_mp3(parts,out):
    if len(parts)==1:
        out.write_bytes(parts[0].read_bytes());return
    with tempfile.TemporaryDirectory() as td:
        listing=Path(td)/"list.txt"
        listing.write_text("\n".join(f"file '{p.resolve()}'" for p in parts)+"\n")
        subprocess.run(["ffmpeg","-y","-f","concat","-safe","0","-i",str(listing),"-c:a","libmp3lame","-b:a","192k",str(out)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)

def build_turns(dialogue,lock,env):
    turns=[]
    perf=dialogue.get("performance_profiles",{})
    for i,item in enumerate(dialogue.get("segments",[])):
        speaker=item.get("speaker","narrator")
        env_name=ELEVEN_ENV[speaker]
        voice_id=env.get(env_name)
        if not voice_id:
            raise RuntimeError(f"missing {env_name}")
        turns.append({
          "speaker":speaker,
          "voice_id":voice_id,
          "text":add_v3_tags(speaker,item.get("text",""),item.get("performance") or perf.get(speaker) or {}),
        })
    return turns

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--dialogue",required=True)
    ap.add_argument("--lock",default="control/voice-lock-v1.json")
    ap.add_argument("--out",required=True)
    ap.add_argument("--receipt",required=True)
    ap.add_argument("--reference-id",default="content-control")
    a=ap.parse_args()
    dialogue=json.loads(Path(a.dialogue).read_text())
    lock=json.loads(Path(a.lock).read_text())
    api_key=os.environ.get("ELEVENLABS_API_KEY","")
    receipt={"schema_version":1,"provider":"elevenlabs","model_id":"eleven_v3","publication_enabled":False}
    try:
        if not api_key: raise RuntimeError("missing ELEVENLABS_API_KEY")
        turns=build_turns(dialogue,lock,os.environ)
        chunks=chunk_turns(turns)
        out=Path(a.out);out.parent.mkdir(parents=True,exist_ok=True)
        parts=[]
        with tempfile.TemporaryDirectory() as td:
            for i,chunk in enumerate(chunks):
                seed=stable_seed(a.reference_id,chunk[0]["speaker"],i)
                p=Path(td)/f"part-{i:03d}.mp3"
                request_audio(api_key,build_dialogue_payload(chunk,seed),p)
                parts.append(p)
            concat_mp3(parts,out)
        subprocess.run(["ffprobe","-v","error","-select_streams","a:0","-show_entries","stream=codec_name,sample_rate,channels","-show_entries","format=duration","-of","json",str(out)],check=True,capture_output=True,text=True)
        receipt.update({"status":"PASS","output":str(out),"chunks":len(chunks),"selected_provider":"elevenlabs","fallback_required":False})
    except Exception as e:
        receipt.update({"status":"FALLBACK_REQUIRED","error":str(e),"selected_provider":"fallback","fallback_required":True})
    Path(a.receipt).parent.mkdir(parents=True,exist_ok=True)
    Path(a.receipt).write_text(json.dumps(receipt,indent=2,sort_keys=True)+"\n")
    print(json.dumps(receipt,sort_keys=True))
    raise SystemExit(0)

if __name__=="__main__":
    main()
