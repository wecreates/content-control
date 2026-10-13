"""Decode every video frame and report temporal observations, never creative approval."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import cv2
import numpy as np


def analyze(video):
    path=Path(video)
    digest=hashlib.sha256(path.read_bytes()).hexdigest()
    cap=cv2.VideoCapture(str(path))
    fps=float(cap.get(cv2.CAP_PROP_FPS)); expected=float(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if not math.isfinite(fps) or fps<=0 or not math.isfinite(expected) or expected<2 or not expected.is_integer():
        cap.release();raise ValueError('Valid video metadata required')
    previous=None;deltas=[];count=0;static_start=None;static=[];cuts=[]
    try:
        while True:
            ok,frame=cap.read()
            if not ok:break
            if frame is None:raise ValueError('Undecodable frame')
            gray=cv2.cvtColor(cv2.resize(frame,(180,320)),cv2.COLOR_BGR2GRAY)
            if previous is not None:
                delta=float(np.abs(gray.astype(float)-previous.astype(float)).mean()/255)
                deltas.append(delta)
                if delta<=.001:
                    if static_start is None:static_start=count-1
                elif static_start is not None:
                    if (count-static_start)/fps>=1:static.append([round(static_start/fps,3),round(count/fps,3)])
                    static_start=None
                if delta>=.15:cuts.append(round(count/fps,3))
            previous=gray;count+=1
        if count!=int(expected):raise ValueError(f'Incomplete decode: {count}/{int(expected)} frames')
        if static_start is not None and (count-static_start)/fps>=1:static.append([round(static_start/fps,3),round(count/fps,3)])
    finally:cap.release()
    return {'schema_version':1,'analysis_status':'COMPLETE','candidate_sha256':digest,'decoded_frames':count,
        'fps':fps,'duration_seconds':count/fps,'coverage':'every decoded frame',
        'observations':{'mean_frame_change':float(np.mean(deltas)),'p95_frame_change':float(np.percentile(deltas,95)),
        'low_change_intervals_seconds':static,'large_change_timestamps_seconds':cuts},
        'parameters':{'analysis_resolution':[180,320],'low_change_threshold':.001,'large_change_threshold':.15,'minimum_low_change_seconds':1},
        'scope':'Pixel motion diagnostics only. Camera motion, meaning, pacing quality and competitor motion parity are not inferred.',
        'production_approved':False,'publication_enabled':False}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--video',required=True);p.add_argument('--out',required=True);a=p.parse_args()
    result=analyze(a.video);out=Path(a.out);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({'analysis_status':result['analysis_status'],'decoded_frames':result['decoded_frames']}))
