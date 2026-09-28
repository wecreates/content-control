#!/usr/bin/env python3
import argparse,json,cv2,numpy as np
from pathlib import Path

def analyze(video,step_seconds=.25):
    cap=cv2.VideoCapture(str(video));fps=cap.get(cv2.CAP_PROP_FPS) or 24
    duration=(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)/fps
    times=np.arange(0,max(duration,.01),step_seconds)
    prev=None;prev_hist=None;frames=[];tracks=[];next_id=1;active={}
    transitions=[];contacts=[];speeds=[]

    for t in times:
        cap.set(cv2.CAP_PROP_POS_MSEC,float(t)*1000);ok,fr=cap.read()
        if not ok:continue
        small=cv2.resize(fr,(180,320));gray=cv2.cvtColor(small,cv2.COLOR_BGR2GRAY)
        edge=cv2.Canny(gray,70,150)
        thirds=[float(edge[:,i*60:(i+1)*60].mean()/255) for i in range(3)]
        bands=[float(edge[j*80:(j+1)*80,:].mean()/255) for j in range(4)]
        # text-like regions: dense horizontal high-contrast bands
        text_regions=[]
        for j,v in enumerate(bands):
            if v>.055:text_regions.append({"y0":j*.25,"y1":(j+1)*.25,"density":round(v,5)})
        # foreground blobs from dark connected components
        mask=(gray<110).astype(np.uint8)*255
        num,labels,stats,cent=cv2.connectedComponentsWithStats(mask,8)
        blobs=[]
        for k in range(1,num):
            x,y,w,h,area=stats[k]
            if 70<area<9000 and w>5 and h>5:
                blobs.append({"cx":float(cent[k][0]/180),"cy":float(cent[k][1]/320),"w":float(w/180),"h":float(h/320),"area":int(area)})
        # nearest-neighbor track IDs
        assigned=[];new_active={}
        for b in sorted(blobs,key=lambda z:-z["area"])[:8]:
            best=None;bestd=.18
            for tid,p in active.items():
                d=((b["cx"]-p["cx"])**2+(b["cy"]-p["cy"])**2)**.5
                if d<bestd:bestd=d;best=tid
            if best is None:
                best=next_id;next_id+=1
            new_active[best]=b;assigned.append({"track_id":best,**b})
        active=new_active

        hist=cv2.calcHist([gray],[0],None,[32],[0,256]);hist=cv2.normalize(hist,hist).flatten()
        hist_delta=float(cv2.compareHist(prev_hist,hist,cv2.HISTCMP_BHATTACHARYYA)) if prev_hist is not None else 0
        if hist_delta>.42:transitions.append({"time":round(float(t),3),"type":"hard_or_masked_cut","hist_delta":round(hist_delta,5)})
        prev_hist=hist

        motion=0
        if prev is not None:
            flow=cv2.calcOpticalFlowFarneback(prev,gray,None,.5,3,15,3,5,1.2,0)
            mag=np.sqrt(flow[...,0]**2+flow[...,1]**2);motion=float(np.mean(mag));speeds.append(motion)
            if motion>(np.mean(speeds[:-1])+np.std(speeds[:-1])*1.4 if len(speeds)>4 else 2.0):
                contacts.append({"time":round(float(t),3),"motion_peak":round(motion,5),"type":"impact_or_contact_candidate"})
        prev=gray
        frames.append({"time":round(float(t),3),"composition_heatmap":{"thirds":[round(x,5) for x in thirds],"bands":[round(x,5) for x in bands]},"text_regions":text_regions,"object_tracks":assigned,"hist_delta":round(hist_delta,5),"motion_speed":round(motion,5)})
    cap.release()
    # normalized easing from motion speeds
    if speeds:
        m=max(max(speeds),1e-6);easing=[round(x/m,4) for x in speeds]
    else:easing=[]
    return {"schema_version":2,"status":"PASS" if frames else "EMPTY","duration_seconds":round(duration,3),"frames":frames,"transition_candidates":transitions,"contact_candidates":contacts,"easing_curve":easing,"track_count":next_id-1,"publication_enabled":False}

def main():
    ap=argparse.ArgumentParser();ap.add_argument("--video",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();r=analyze(a.video);Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":r["status"],"frames":len(r["frames"]),"tracks":r["track_count"],"transitions":len(r["transition_candidates"])},sort_keys=True))

if __name__=="__main__":main()
