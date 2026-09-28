#!/usr/bin/env python3
import argparse,json,math,re
from pathlib import Path
def direct_text(text,width,height):
    text=str(text or "").strip()
    numeric=bool(re.search(r"[$%\d]",text))
    max_chars=18 if width<=800 else 28
    words=text.split();lines=[];line=""
    for w in words:
        trial=(line+" "+w).strip()
        if len(trial)>max_chars and line:
            lines.append(line);line=w
        else: line=trial
    if line: lines.append(line)
    while len(lines)>3:
        lines[-2]+=" "+lines.pop()
    longest=max([len(x) for x in lines] or [1])
    base=64 if width<=800 else 78
    size=max(28,min(base,int(width/(max(8,longest)*.62))))
    return {
      "content":text,"lines":lines,"line_count":len(lines),"font_size":size,
      "weight":900 if numeric else 800,"numeric_emphasis":numeric,
      "tracking":-.02 if size>48 else 0,"line_height":1.0 if len(lines)>1 else 1.05,
      "max_width":round(width*.78),"zone":"upper_third","collision_padding":24
    }
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--text",required=True);ap.add_argument("--width",type=int,default=720);ap.add_argument("--height",type=int,default=1280);ap.add_argument("--out",required=True);a=ap.parse_args()
    r=direct_text(a.text,a.width,a.height);Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps(r,sort_keys=True))
if __name__=="__main__":main()
