#!/usr/bin/env python3
"""Bind public V2 build data to existing Money Factory adapters; never publish."""
import argparse,hashlib,html,json,math,re,subprocess,sys
from pathlib import Path
MF_REVISION='d8a7038a3fd6c7ac5e51dd66400c9e0f081de3c3'
def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def git(root,*args):return subprocess.check_output(['git','-C',str(root),*args],text=True)
def observed_inputs(transcription,captions,duration,voice_hash):
 if transcription.get('status')!='PASS' or transcription.get('publication_enabled') is not False or transcription.get('audio_sha256')!=voice_hash or transcription.get('word_timestamps') is not True:raise ValueError('Exact observed transcription required')
 if captions.get('status')!='PASS' or captions.get('publication_enabled') is not False or captions.get('source_audio_sha256')!=voice_hash:raise ValueError('Exact observed caption track required')
 segments=transcription.get('segments',[]);cues=captions.get('cues',[])
 if not segments or not cues or not math.isfinite(duration) or duration<=0:raise ValueError('Observed transcript segments/captions missing')
 for entry in segments+cues:
  a,b=entry.get('start'),entry.get('end')
  if any(type(x) not in (int,float) or not math.isfinite(x) for x in (a,b)) or not 0<=a<=b<=duration or not isinstance(entry.get('text'),str) or not entry['text'].strip():raise ValueError('Invalid observed transcript interval')
 ends=[float(x['end']) for x in segments if 0<x['end']<=min(12,duration)]
 if not ends:raise ValueError('No complete observed teaser segment within twelve seconds')
 end=max(ends)
 def stamp(seconds):
  ms=round(seconds*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'
 lines=[]
 for cue in cues:
  if 0<=cue['start']<cue['end']<=end and round(cue['end']*1000)>round(cue['start']*1000):
   lines.append(f"{len(lines)+1}\n{stamp(cue['start'])} --> {stamp(cue['end'])}\n{cue['text'].replace(chr(10),' ')}\n")
 if not lines:raise ValueError('Teaser has no positive-duration observed captions')
 return {'duration':duration,'transcript':{'segments':segments,'text':transcription.get('actual_transcript','')}},'\n'.join(lines),end

def prepare(root,artifact,out):
 root=Path(root).resolve();artifact=Path(artifact).resolve();out=Path(out).resolve()
 report=json.loads((root/'state/v2-production-status.json').read_text());draft=json.loads((root/'state/v2-draft.json').read_text())
 video=root/'public-review/v2-draft.mp4';candidate=sha(video)
 if report.get('candidate_sha256')!=candidate or draft.get('candidate_sha256')!=candidate or report.get('run_id')!=draft.get('run_id'):raise ValueError('Current draft/build identity mismatch')
 if any(x.get('publication_enabled') is not False or x.get('production_approved') is not False for x in (report,draft)):raise ValueError('Only unapproved public drafts accepted')
 source=report.get('source_commit','')
 if not re.fullmatch('[a-f0-9]{40}',source):raise ValueError('Exact source commit required')
 if sha(artifact/'render/v2-boss-fight.mp4')!=candidate:raise ValueError('Downloaded build is not current video')
 technical=artifact/'receipts/render.json';receipt=json.loads(technical.read_text())
 if sha(technical)!=report.get('checks',{}).get('technical_video',{}).get('receipt_sha256') or receipt.get('candidate_sha256')!=candidate:raise ValueError('Original technical receipt mismatch')
 raw=git(root,'show',source+':projects/v2/amex-vs-chase-boss-fight/metadata.json');metadata=json.loads(raw)
 ccsdpath=artifact/'ccsd.json';ccsd=json.loads(ccsdpath.read_text())
 if metadata.get('publication_enabled') is not False or ccsd.get('publication_enabled') is not False:raise ValueError('Source publication flags must be false')
 dialogue=' '.join(str(d['text']) for scene in ccsd.get('scenes',[]) for d in scene.get('audio',{}).get('dialogue',[]) if isinstance(d,dict) and isinstance(d.get('text'),str))
 if not dialogue or not metadata.get('title'):raise ValueError('Actual dialogue and metadata required')
 transcription_path=artifact/'receipts/transcription.json';captions_path=artifact/'captions.json'
 for name,path in [('transcription',transcription_path),('captions',captions_path)]:
  if sha(path)!=report.get('checks',{}).get(name,{}).get('receipt_sha256'):raise ValueError('Original '+name+' receipt mismatch')
 duration=float(receipt.get('metrics',{}).get('duration',0))
 windows,srt,teaser_end=observed_inputs(json.loads(transcription_path.read_text()),json.loads(captions_path.read_text()),duration,sha(artifact/'voice.wav'))
 out.mkdir(parents=True,exist_ok=False)
 audit={'id':ccsd['project_id'],'platform':'youtube','title':metadata['title'],'description':metadata['description'],'tags':metadata['tags'],'brand':'CYZOR','transcript':dialogue,'publication_enabled':False}
 brief={'project_id':ccsd['project_id'],'candidate_sha256':candidate,'source_commit':source,'metadata':metadata,'ccsd':ccsd,'publication_enabled':False}
 for name,data in [('audit-input.json',audit),('brief-input.json',brief),('transcript-input.json',windows)]: (out/name).write_text(json.dumps(data,indent=2)+'\n')
 (out/'teaser.srt').write_text(srt)
 (out/'metadata-input.html').write_text('<!doctype html><html lang="en"><head><title>'+html.escape(metadata['title'])+'</title><meta name="description" content="'+html.escape(metadata['description'],quote=True)+'"></head><body><h1>'+html.escape(metadata['title'])+'</h1><p>'+html.escape(metadata['description'])+'</p></body></html>')
 manifest={'schema_version':1,'candidate_sha256':candidate,'build_run_id':report['run_id'],'build_source_commit':source,'money_factory_revision':MF_REVISION,'source_ccsd_sha256':sha(ccsdpath),'source_metadata_sha256':hashlib.sha256(raw.encode()).hexdigest(),'technical_receipt_sha256':sha(technical),'source_transcription_sha256':sha(transcription_path),'source_captions_sha256':sha(captions_path),'teaser_end_seconds':teaser_end,'inputs':{n:sha(out/n) for n in ('audit-input.json','brief-input.json','transcript-input.json','teaser.srt','metadata-input.html')},'production_approved':False,'publication_enabled':False}
 (out/'handoff.json').write_text(json.dumps(manifest,indent=2)+'\n');return manifest

def execute(root,money,runtime,out):
 root=Path(root).resolve();money=Path(money).resolve();runtime=Path(runtime).resolve();out=Path(out).resolve()
 if git(money,'rev-parse','HEAD').strip()!=MF_REVISION:raise ValueError('Money Factory adapter revision mismatch')
 manifest=json.loads((out/'handoff.json').read_text())
 if manifest['candidate_sha256']!=sha(root/'public-review/v2-draft.mp4'):raise ValueError('Candidate changed since handoff preparation')
 for name,digest in manifest['inputs'].items():
  if sha(out/name)!=digest:raise ValueError('Prepared input changed')
 sys.path.insert(0,str(money/'integrations'))
 from hosted_job import execute as run_existing
 operations=[('youtube-clipper-skill','clip','@candidate','.mp4'),('youtube-clipper-skill','captions','@teaser','.mp4'),('openshorts','vertical','@teaser','.mp4'),('openshorts','transcript-windows','transcript-input.json','.json'),('claude-seo','parse-html','metadata-input.html','.json'),('youtube-automation-agent','audit','audit-input.json','.json'),('toonflow-app','import-brief','brief-input.json','.json'),('ruflo','remember-project',None,'.txt')]
 results=[]
 for tool,operation,source,suffix in operations:
  folder=out/(tool+'-'+operation);job={'tool':tool,'operation':operation,'output':str(folder/('result'+suffix)),'publication_enabled':False,'paid_generation_enabled':False}
  if source:job['input']=str(root/'public-review/v2-draft.mp4' if source=='@candidate' else out/'youtube-clipper-skill-clip/result.mp4' if source=='@teaser' else out/source)
  if operation=='clip':job.update(start=0,end=manifest['teaser_end_seconds'])
  if operation=='captions':job['subtitles']=str(out/'teaser.srt')
  run_existing(job,runtime,root,folder)
  result=Path(job['output']);receipt=json.loads(Path(str(result)+'.receipt.json').read_text())
  if receipt.get('status')!='PASS' or receipt.get('output_sha256')!=sha(result):raise ValueError('Adapter output failed verification')
  record={'tool':tool,'operation':operation,'input_sha256':sha(job['input']) if source else None,'output_sha256':sha(result),'receipt':receipt}
  if operation=='captions':record['subtitle_sha256']=sha(out/'teaser.srt')
  if tool=='toonflow-app':
   imported=list((folder/'toonflow-data').rglob('cyzor-content-brief.json'))
   if len(imported)!=1 or json.loads(imported[0].read_text())!=json.loads((out/source).read_text()):raise ValueError('Toonflow imported brief read-back mismatch')
   record['brief_readback_sha256']=sha(imported[0])
  if tool=='ruflo':record['memory_scope']='Rehydrated canonical Money Factory PROJECT_MEMORY.md; no claim of persistent SQLite or current-video memory'
  results.append(record)
 manifest.update(status='OPERATIONS_VERIFIED',operations=results,scope='Exact public candidate CPU repurposing derivatives, observed transcript windows, metadata HTML parsing, audit and brief rehydration; derivatives are not final approved edits, stream-copy teaser bounds may vary by keyframe, and audiovisual quality/publishing approval remain separate')
 (out/'handoff.json').write_text(json.dumps(manifest,indent=2)+'\n')
 return manifest

def main():
 p=argparse.ArgumentParser();p.add_argument('mode',choices=['prepare','execute']);p.add_argument('--root',default='.');p.add_argument('--artifact');p.add_argument('--money-factory');p.add_argument('--runtime');p.add_argument('--out',required=True);a=p.parse_args()
 result=prepare(a.root,a.artifact,a.out) if a.mode=='prepare' else execute(a.root,a.money_factory,a.runtime,a.out)
 print(json.dumps({'candidate_sha256':result['candidate_sha256'],'status':result.get('status','PREPARED')}))
if __name__=='__main__':main()
