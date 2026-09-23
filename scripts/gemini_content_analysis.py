#!/usr/bin/env python3
import json,os,pathlib,random,time,urllib.error,urllib.request
MEDIA=pathlib.Path(os.environ.get('EPISODE1_MEDIA','/tmp/content/EPISODE1_FIRST_WATCH.mp4'))
KEY=os.environ['GEMINI_API_KEY']; EXPECTED=os.environ['EXPECTED_SHA']; OUT=pathlib.Path('state/episode1-content-analysis.json')
def upload():
 meta=json.dumps({'file':{'display_name':MEDIA.name}}).encode()
 req=urllib.request.Request('https://generativelanguage.googleapis.com/upload/v1beta/files?key='+KEY,data=meta,headers={'X-Goog-Upload-Protocol':'resumable','X-Goog-Upload-Command':'start','X-Goog-Upload-Header-Content-Length':str(MEDIA.stat().st_size),'X-Goog-Upload-Header-Content-Type':'video/mp4','Content-Type':'application/json'})
 with urllib.request.urlopen(req,timeout=90) as r: url=r.headers['X-Goog-Upload-URL']
 req=urllib.request.Request(url,data=MEDIA.read_bytes(),headers={'Content-Length':str(MEDIA.stat().st_size),'X-Goog-Upload-Offset':'0','X-Goog-Upload-Command':'upload, finalize'})
 with urllib.request.urlopen(req,timeout=240) as r: return json.loads(r.read())['file']
def wait_active(f):
 for _ in range(90):
  req=urllib.request.Request('https://generativelanguage.googleapis.com/v1beta/files?pageSize=100',headers={'x-goog-api-key':KEY})
  with urllib.request.urlopen(req,timeout=30) as r: listing=json.loads(r.read())
  cur=next((x for x in listing.get('files',[]) if x.get('name')==f.get('name')),{})
  if not cur: time.sleep(4); continue
  if cur.get('state')=='ACTIVE': return cur
  if cur.get('state')=='FAILED': raise RuntimeError(cur)
  time.sleep(4)
 raise RuntimeError('Gemini file processing timeout')
def prompt():
 return f'''Analyze this exact 520.066667-second consumer-finance video end-to-end. Return STRICT JSON only and bind the result to artifact_sha256 {EXPECTED}. Listen to all audio and inspect the entire video. Produce three operational artifacts without inventing words or facts.
1) captions: a time-ordered transcript of all spoken narration/dialogue using accurate start_sec, end_sec, and exact text. Use enough cues to cover all spoken content, at least 40 cues. Do not paraphrase.
2) story_beats: at least 4 time-bounded narrative beats with start_sec, end_sec, summary, purpose, and transition.
3) research_claims: at least 5 concrete financial/factual statements made in the video that merit verification, each with start_sec, claim, verification_target, and risk_level (low|medium|high). This is a verification-target inventory, not a declaration that claims are true.
Schema: {{"artifact_sha256":"{EXPECTED}","complete_end_to_end_analysis":true,"captions":[{{"start_sec":0.0,"end_sec":1.0,"text":""}}],"story_beats":[{{"start_sec":0.0,"end_sec":1.0,"summary":"","purpose":"","transition":""}}],"research_claims":[{{"start_sec":0.0,"claim":"","verification_target":"","risk_level":"low"}}]}}.'''
def infer(f):
 body={'model':'gemini-3.8-flash','input':[{'type':'video','uri':f['uri'],'mime_type':'video/mp4','processing':'agentic'},{'type':'text','text':prompt()}]}; obj=None; errors=[]
 for model in ['gemini-3.8-flash','gemini-3-flash-preview']:
  body['model']=model
  for attempt in range(6):
   req=urllib.request.Request('https://generativelanguage.googleapis.com/v1beta/interactions',data=json.dumps(body).encode(),headers={'Content-Type':'application/json','x-goog-api-key':KEY})
   try:
    with urllib.request.urlopen(req,timeout=900) as r: obj=json.loads(r.read())
    break
   except urllib.error.HTTPError as e:
    errors.append(f'{model}:{e.code}')
    if e.code not in (429,500,502,503,504): raise
    delay=min(60,3*(2**attempt))+random.random()*2; print(f'transient inference HTTP {e.code}; model={model}; retry={attempt+1}; sleep={delay:.1f}s'); time.sleep(delay)
   except (TimeoutError,urllib.error.URLError) as e:
    errors.append(f'{model}:{type(e).__name__}'); delay=min(60,3*(2**attempt))+random.random()*2; time.sleep(delay)
  if obj is not None: break
 if obj is None: raise RuntimeError('Gemini analysis routes exhausted: '+','.join(errors[-8:]))
 texts=[]
 for step in obj.get('steps',[]):
  if step.get('type')=='model_output':
   for item in step.get('content',[]):
    if item.get('type')=='text': texts.append(item.get('text',''))
 raw='\n'.join(texts) or obj.get('output_text','')
 raw=raw.strip()
 if raw.startswith('```'):
  raw=raw.strip('`')
  if raw.startswith('json\n'): raw=raw[5:]
 return json.loads(raw)
def validate(obj):
 assert obj.get('artifact_sha256')==EXPECTED and obj.get('complete_end_to_end_analysis') is True
 caps=obj.get('captions',[]); beats=obj.get('story_beats',[]); claims=obj.get('research_claims',[])
 assert len(caps)>=40 and len(beats)>=4 and len(claims)>=5
 last=-1.0
 for c in caps:
  s=float(c['start_sec']); e=float(c['end_sec']); assert 0<=s<e<=520.3 and s>=last-0.5 and str(c['text']).strip(); last=s
 for b in beats: assert 0<=float(b['start_sec'])<float(b['end_sec'])<=520.3 and str(b['summary']).strip()
 for c in claims: assert 0<=float(c['start_sec'])<=520.3 and str(c['claim']).strip() and str(c['verification_target']).strip()
 return {'captions':len(caps),'story_beats':len(beats),'research_claims':len(claims)}
def main():
 f=wait_active(upload()); obj=infer(f); stats=validate(obj); OUT.parent.mkdir(exist_ok=True); OUT.write_text(json.dumps(obj,indent=2,sort_keys=True)+'\n'); print(json.dumps(stats|{'artifact_sha256':EXPECTED},sort_keys=True))
if __name__=='__main__': main()
