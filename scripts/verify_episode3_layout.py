#!/usr/bin/env python3
import re,sys
from pathlib import Path

src=Path(sys.argv[1] if len(sys.argv)>1 else "remotion/CashbackCasinoVisual.jsx").read_text()
issues=[]
pattern=re.compile(r'<Text(?P<attrs>[^>]*)>(?P<text>[^<{]+)</Text>')
def prop(attrs,name,default):
    m=re.search(rf'\b{name}=\{{?(-?\d+(?:\.\d+)?)\}}?',attrs)
    return float(m.group(1)) if m else float(default)

scene_src=src.split("const scenes=",1)[1] if "const scenes=" in src else src
for m in pattern.finditer(scene_src):
    attrs=m.group("attrs"); text=" ".join(m.group("text").split())
    x=prop(attrs,"x",360); y=prop(attrs,"y",100); size=prop(attrs,"size",48)
    # Arial Black uppercase averages roughly 0.56em; add 5% punch-zoom safety.
    estimated_width=len(text)*size*0.56*1.05
    left=x-estimated_width/2; right=x+estimated_width/2
    if left<28 or right>692:
        issues.append({"text":text,"reason":"horizontal_safe_zone","left":round(left,1),"right":round(right,1),"size":size,"x":x})
    if y<45 or y>1215:
        issues.append({"text":text,"reason":"vertical_safe_zone","y":y})

# Catch nested Text components that accidentally retain global x=360 inside transformed props.
for component in ["Price"]:
    block=re.search(rf'const {component}=.*?=>.*?(?=\nconst |\nconst scenes=)',src,re.S)
    if block:
        for m in re.finditer(r'<Text(?![^>]*\bx=)',block.group(0)):
            issues.append({"component":component,"reason":"nested_text_missing_local_x"})

status="PASS" if not issues else "FAIL"
print({"status":status,"issues":issues})
raise SystemExit(0 if status=="PASS" else 2)
