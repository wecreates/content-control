import math
from PIL import Image,ImageDraw
clamp=lambda x:max(0,min(1,x));ease=lambda p:p*p*(3-2*p)
rects=[(142,415,250,447),(501,415,610,447)]
for offset in [0,45]:
 hits=[]
 for f in range(1001):
  p=f/1000;s=clamp((p-.12)/.55);c=max(0,math.sin(s*math.pi));r=ease(clamp((p-.67)/.33));x=250+185*s-r*145;y=480+offset-c*22-r*36;a=math.radians(-24+36*s-r*42)
  tr=lambda v:(round((x+1.15*(v[0]*math.cos(a)-v[1]*math.sin(a)))*3),round((y+1.15*(v[0]*math.sin(a)+v[1]*math.cos(a)))*3))
  im=Image.new('L',(2160,1800));d=ImageDraw.Draw(im)
  pts=[tr(v) for v in [(-94,-15),(72,-15),(112,0),(72,15),(-94,15)]]
  d.polygon(pts,fill=255);d.line(pts+[pts[0]],fill=255,width=18)
  for line in [[(-72,0),(83,0)],[(-96,-31),(-96,31)],[(-124,0),(-98,0)]]:d.line([tr(v) for v in line],fill=255,width=25)
  for i,rect in enumerate(rects):
   if im.crop(tuple(int(z*3) for z in rect)).getbbox():hits.append((p,i))
 print(offset,len(hits),hits[:3],hits[-3:])
