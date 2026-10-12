#!/usr/bin/env python3
"""Bind upstream local probe evidence to the exact CYZOR rendered candidate."""
import argparse
import json
import math
from pathlib import Path
import sys
from adapter import execute,digest


def verify(upstream,video,expected_duration,tolerance=.25):
    expected_duration=float(expected_duration);tolerance=float(tolerance)
    if not math.isfinite(expected_duration) or expected_duration<=0:raise ValueError('Positive finite expected duration required')
    if not math.isfinite(tolerance) or not 0<=tolerance<=1:raise ValueError('Tolerance must be between zero and one second')
    candidate=Path(video).resolve();before=digest(candidate)
    evidence=execute(upstream,{'operation':'probe','input_path':str(candidate),'publication_enabled':False})
    data=evidence['result']['data'];actual=float(data.get('duration_seconds',0));audio=data.get('audio') or {}
    checks={'candidate_unchanged':before==digest(candidate),'probe_bound_to_candidate':evidence['inputs'][0]['sha256']==before,'duration_matches':math.isfinite(actual) and abs(actual-expected_duration)<=tolerance,'audio_stream_present':bool(audio.get('codec')),'audio_sample_rate_valid':int(audio.get('sample_rate',0))>=16000,'audio_channels_valid':int(audio.get('channels',0)) in (1,2),'av_streams_present':int(data.get('stream_count',0))>=2}
    return {'schema_version':1,'status':'PASS' if all(checks.values()) else 'FAIL','candidate_path':str(candidate),'candidate_sha256':before,'expected_duration_seconds':expected_duration,'actual_duration_seconds':actual,'duration_tolerance_seconds':tolerance,'checks':checks,'failed_checks':[k for k,v in checks.items() if not v],'upstream_evidence':evidence,'publication_enabled':False,'scope':'Exact-file duration and audio-stream presence only; stream count does not independently certify video codec, audible samples, sync, identity, or creative quality. Existing production QA remains required.'}


def main():
    p=argparse.ArgumentParser();p.add_argument('--upstream',required=True);p.add_argument('--video',required=True);p.add_argument('--expected-duration',required=True,type=float);p.add_argument('--receipt',required=True);a=p.parse_args()
    try:r=verify(a.upstream,a.video,a.expected_duration)
    except Exception as e:r={'status':'BLOCKED','reason':str(e),'publication_enabled':False}
    dest=Path(a.receipt);dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({'status':r['status'],'receipt':str(dest)}));return 0 if r['status']=='PASS' else 2
if __name__=='__main__':raise SystemExit(main())
