"""Review saved OpenShorts windows through the existing clipper job contract; never execute."""
import json,hashlib,math,re,os,stat
from pathlib import Path
from datetime import datetime,timezone,timedelta
PIN='0240abeccc0e18463f6fd3f881767c4bc33ae3a6'
def digest(b):return hashlib.sha256(b).hexdigest()
EVIDENCE_LIMIT=4*1024*1024
def read_snapshot(path):
 p=Path(path)
 if p.is_symlink():raise ValueError('BOUNDED_REGULAR_EVIDENCE_REQUIRED')
 with p.open('rb') as stream:
  info=os.fstat(stream.fileno())
  if not stat.S_ISREG(info.st_mode) or info.st_size>EVIDENCE_LIMIT:raise ValueError('BOUNDED_REGULAR_EVIDENCE_REQUIRED')
  raw=stream.read(EVIDENCE_LIMIT+1)
 if len(raw)>EVIDENCE_LIMIT:raise ValueError('BOUNDED_REGULAR_EVIDENCE_REQUIRED')
 def reject(x):raise ValueError('NONFINITE_JSON')
 return json.loads(raw,parse_constant=reject),digest(raw)
def num(n):return type(n) in (int,float) and math.isfinite(n)
def review_windows(root,handoff,out,expected_hash,evidence_kind):
 root=Path(root).resolve();handoff=Path(handoff).resolve();out=Path(out)
 if evidence_kind not in ('SYNTHETIC_FIXTURE','OWNER_SAVED_RECEIPTS'):raise ValueError('EVIDENCE_KIND_REQUIRED')
 m,mh=read_snapshot(handoff/'handoff.json')
 if not re.fullmatch('[a-f0-9]{64}',expected_hash or '') or mh!=expected_hash:raise ValueError('HANDOFF_IDENTITY_MISMATCH')
 if m.get('publication_enabled') is not False or m.get('production_approved') is not False:raise ValueError('DRAFT_ONLY')
 media=root/'public-review/v2-draft.mp4'
 if media.is_symlink() or digest(media.read_bytes())!=m.get('candidate_sha256'):raise ValueError('CANDIDATE_CHANGED')
 ip=handoff/'transcript-input.json';source,ih=read_snapshot(ip)
 if m.get('inputs',{}).get('transcript-input.json')!=ih:raise ValueError('TRANSCRIPT_CHANGED')
 records=[x for x in m.get('operations',[]) if x.get('tool')=='openshorts' and x.get('operation')=='transcript-windows']
 if len(records)!=1:raise ValueError('UNAMBIGUOUS_OPERATION_REQUIRED')
 record=records[0];result=handoff/'openshorts-transcript-windows/result.json';windows,rh=read_snapshot(result);rp=Path(str(result)+'.receipt.json');receipt,receipt_hash=read_snapshot(rp)
 if record.get('input_sha256')!=ih or record.get('output_sha256')!=rh or json.dumps(record.get('receipt'),sort_keys=True)!=json.dumps(receipt,sort_keys=True):raise ValueError('OPERATION_PROVENANCE_MISMATCH')
 if type(receipt.get('schema_version')) is not int or receipt['schema_version']!=1 or receipt.get('tool')!='openshorts' or receipt.get('operation')!='transcript-windows' or receipt.get('revision')!=PIN or receipt.get('status')!='PASS' or receipt.get('output_sha256')!=rh or receipt.get('publication_enabled') is not False:raise ValueError('UNVERIFIED_WINDOW_RECEIPT')
 stamp=datetime.fromisoformat(receipt['verified_at'].replace('Z','+00:00'));now=datetime.now(timezone.utc)
 if stamp.tzinfo is None or stamp>now or now-stamp>=timedelta(days=7):raise ValueError('STALE_OR_FUTURE_WINDOWS')
 duration=source.get('duration');segments=source.get('transcript',{}).get('segments')
 if not num(duration) or duration<=0 or not isinstance(segments,list) or not segments:raise ValueError('TIMED_TRANSCRIPT_REQUIRED')
 for s in segments:
  if not num(s.get('start')) or not num(s.get('end')) or not 0<=s['start']<s['end']<=duration or not isinstance(s.get('text'),str) or not s['text'].strip():raise ValueError('INVALID_TRANSCRIPT')
 if not isinstance(windows,list) or not 1<=len(windows)<=100:raise ValueError('BOUNDED_WINDOWS_REQUIRED')
 proposals=[];seen=set()
 for w in windows:
  if set(w)!={'id','start','end','text'} or not isinstance(w['id'],str) or not re.fullmatch('window_[0-9]{3,}',w['id']) or w['id'] in seen:raise ValueError('INVALID_OR_DUPLICATE_WINDOW')
  seen.add(w['id']);a,b=w['start'],w['end']
  if not num(a) or not num(b) or not 0<=a<b<=duration or any((p['proposed_job']['start'],p['proposed_job']['end'])==(a,b) for p in proposals):raise ValueError('INVALID_WINDOW_BOUNDS')
  matching=[s for s in segments if round(s['start'],3)>=a and round(s['end'],3)<=b]
  if not matching or round(matching[0]['start'],3)!=a or round(matching[-1]['end'],3)!=b or ' '.join(s['text'].strip() for s in matching)!=w['text']:raise ValueError('WINDOW_TRANSCRIPT_MISMATCH')
  proposals.append({'id':w['id'],'text':w['text'],'proposed_job':{'tool':'youtube-clipper-skill','operation':'clip','input':str(media),'start':a,'end':b,'publication_enabled':False,'paid_generation_enabled':False},'dispatch_enabled':False,'status':'EDITORIAL_REVIEW_REQUIRED','review':{'standalone_opening':None,'claim_and_support':None,'complete_ending':None,'replacement_hook':None,'on_screen_text':None,'loop_point':None,'vertical_crop':None},'limitation':'Window is a search interval, not a selected Short or verified quality/ranking. Output path intentionally absent; job cannot dispatch as-is.'})
 document={'schema_version':1,'evidence_kind':evidence_kind,'handoff_sha256':expected_hash,'candidate_sha256':m['candidate_sha256'],'transcript_sha256':ih,'result_sha256':rh,'receipt_sha256':receipt_hash,'receipt_verified_at':receipt['verified_at'],'source_revision':PIN,'raw_windows':windows,'proposals':proposals,'semantic_review_verified':False,'source_authenticity_verified':False,'production_approved':False,'publication_enabled':False}
 out.mkdir(parents=True,exist_ok=False);(out/'window-review.json').write_text(json.dumps(document,indent=2)+'\n',encoding='utf-8');return document
