#!/usr/bin/env python3
import datetime,hashlib,json,pathlib,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]; CONTROL=ROOT/'control'/'v5'; RUNTIME=ROOT/'runtime'/'v5'; STATE=ROOT/'state'
DOMAINS=['orchestration','artifact','research','audio','caption','story','render','review','repair','resolver','assembly','quality','security','observability','performance','release','packaging','thumbnail','metadata','reliability']
EXPECTED_IDS=[f'V5-{i:03d}' for i in range(1,401)]
def load(p): return json.loads(p.read_text())
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 controls=[]; ids=[]; domains={}; failures=[]
 for domain in DOMAINS:
  cdir=CONTROL/domain; rdir=RUNTIME/domain
  cs=sorted(cdir.glob('*.json')) if cdir.exists() else []
  if len(cs)!=20: failures.append(f'{domain}: expected 20 controls, found {len(cs)}')
  d={'controls':len(cs),'done':0,'receipts':0,'outputs':0,'verified':0}
  for cp in cs:
   c=load(cp); tid=c.get('task_id'); ids.append(tid); controls.append((cp,c));
   if c.get('status')=='DONE': d['done']+=1
   else: failures.append(f'{tid}: status {c.get("status")}')
   ev=c.get('runtime_evidence') or {}; rp=ROOT/ev.get('receipt',''); op=ROOT/ev.get('output','')
   if not ev: failures.append(f'{tid}: missing runtime_evidence'); continue
   if not rp.is_file(): failures.append(f'{tid}: receipt missing {rp}'); continue
   d['receipts']+=1; r=load(rp)
   if r.get('task_id')!=tid: failures.append(f'{tid}: receipt task mismatch')
   if r.get('status')!='RUNTIME_VERIFIED_DONE': failures.append(f'{tid}: receipt not runtime done')
   if r.get('real_input_exercised') is not True: failures.append(f'{tid}: real input not exercised')
   if r.get('verification')!='PASS': failures.append(f'{tid}: verification not PASS')
   if r.get('downstream_consumer_accepts_output') is not True: failures.append(f'{tid}: downstream not accepted')
   if r.get('publication_enabled') is not False: failures.append(f'{tid}: publication flag unsafe')
   if not op.is_file(): failures.append(f'{tid}: output missing {op}'); continue
   d['outputs']+=1
   actual=sha(op)
   if r.get('output_sha256')!=actual: failures.append(f'{tid}: output hash mismatch')
   else: d['verified']+=1
  domains[domain]=d
 if ids!=EXPECTED_IDS: failures.append('task ID sequence is not exactly V5-001..V5-400')
 if len(controls)!=400: failures.append(f'expected 400 controls, found {len(controls)}')
 watch=load(STATE/'episode1-first-watch.json')
 if watch.get('publication_enabled') is not False: failures.append('Episode 1 publication lock is not false')
 if watch.get('chris_first_watch_complete') is not False: failures.append('unexpected human first-watch completion')
 done=sum(d['done'] for d in domains.values()); verified=sum(d['verified'] for d in domains.values())
 summary={'schema_version':2,'registered':len(controls),'runtime_done':done,'runtime_verified':verified,'remaining':max(0,400-done),'all_400_runtime_verified_done':not failures and done==400 and verified==400,'domains':domains,'first_watch_gate':watch.get('status'),'publication_enabled':False,'verified_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'failure_count':len(failures),'failures':failures}
 out=STATE/'v5-runtime-summary.json'; out.write_text(json.dumps(summary,indent=2,sort_keys=True)+'\n'); print(json.dumps(summary,sort_keys=True))
 if failures or done!=400 or verified!=400: sys.exit(1)
if __name__=='__main__': main()
