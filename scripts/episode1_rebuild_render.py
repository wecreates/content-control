#!/usr/bin/env python3
import argparse, json, math, pathlib, subprocess, wave, struct, hashlib
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parents[1]
PUBLICATION_ENABLED = False
W, H, FPS = 1280, 720, 15
BG = (12, 16, 24)
WHITE = (245, 247, 250)
GREEN = (57, 255, 20)
RED = (255, 74, 74)
MUTED = (140, 150, 165)
YELLOW = (255, 220, 80)

SCENES = [
    {"id":"cold-open","weight":4,"title":"METAL CARD","subtitle":"Heavy enough to dent a table.","motion":"slam + camera shake","sfx":"metal clang"},
    {"id":"annual-fee","weight":4,"title":"$200 ANNUAL FEE","subtitle":"Bonk.","motion":"invoice falls from ceiling","sfx":"impact bonk"},
    {"id":"dlc","weight":4,"title":"YOUR CREDIT CARD HAS DLC","subtitle":"Four traps. One Alex.","motion":"title snap + orbit icons","sfx":"game unlock"},
    {"id":"planned-spend","weight":7,"title":"BORING. BEAUTIFUL.","subtitle":"$10,000 of spending Alex already planned.","motion":"shopping montage","sfx":"receipt clicks"},
    {"id":"points-balloon","weight":7,"title":"30,000 POINTS","subtitle":"The number looks rich.","motion":"balloon lift + pop","sfx":"inflate + pop"},
    {"id":"redemption","weight":6,"title":"30,000 → $210","subtitle":"The checkout speaks dollars.","motion":"yacht shrinks into grocery cart","sfx":"deflate"},
    {"id":"credit-chase","weight":7,"title":"USE YOUR CREDIT","subtitle":"A coupon tries to become shopping director.","motion":"phone chases Alex","sfx":"robot chant"},
    {"id":"negative-five","weight":6,"title":"SAVED: -$5","subtitle":"$15 thing − $10 credit = $5 spent on nonsense.","motion":"red stamp + recoil","sfx":"error buzzer"},
    {"id":"year-score","weight":7,"title":"PREMIUM: $70   FREE: $200","subtitle":"Same spending. Different result.","motion":"scoreboard + cash slide","sfx":"score bell"},
    {"id":"debt-enter","weight":4,"title":"DEBT","subtitle":"Rewards hate this part.","motion":"lights drop + red eyes","sfx":"low rumble"},
    {"id":"reward-trophy","weight":6,"title":"$20 REWARD","subtitle":"Tiny trophy. Tiny confetti.","motion":"trophy pop","sfx":"tiny fanfare"},
    {"id":"interest-monster","weight":8,"title":"~$19.73 INTEREST","subtitle":"One simplified month at 24% annual rate.","motion":"monster steals trophy","sfx":"snatch + invoice slap"},
    {"id":"autopay","weight":7,"title":"MINIMUM ≠ STATEMENT BALANCE","subtitle":"Automation does exactly what you tell it.","motion":"giant floor buttons + robot stamp","sfx":"stamp"},
    {"id":"bonus-carrot","weight":5,"title":"$300 BONUS","subtitle":"Big green carrot.","motion":"carrot swings in","sfx":"whoosh"},
    {"id":"bonus-gap","weight":6,"title":"$2,500 PLANNED   $500 GAP","subtitle":"The offer just invented shopping.","motion":"meter stops + floor gap","sfx":"record scratch"},
    {"id":"bonus-ladder","weight":8,"title":"WINNING BACKWARDS","subtitle":"Luxury toaster. Second blender. Decorative ladder.","motion":"cart fills + ladder callback","sfx":"rapid item pops"},
    {"id":"delete-cart","weight":5,"title":"DELETE. DELETE. DELETE.","subtitle":"Why did we add a ladder?","motion":"items vanish; ladder returns once","sfx":"delete clicks + boing"},
    {"id":"fine-print","weight":6,"title":"READ THE BORING WORDS","subtitle":"The giant $300 is not the whole offer.","motion":"fine-print villain grows legs","sfx":"tiny footsteps"},
    {"id":"two-doors","weight":5,"title":"0%        0%","subtitle":"Same headline. Different condition.","motion":"two doors slam down","sfx":"double boom"},
    {"id":"zero-trapdoor","weight":9,"title":"INTRO APR ≠ DEFERRED INTEREST","subtitle":"That little “if” deserves a spotlight.","motion":"normal door vs trapdoor","sfx":"trapdoor crack + paper rush"},
    {"id":"payoff-plan","weight":7,"title":"$1,200 ÷ 12 = $100/MO","subtitle":"Planning target, not a minimum-payment formula.","motion":"calendar tiles fill","sfx":"calendar ticks"},
    {"id":"four-rules","weight":8,"title":"ALEX’S FOUR RULES","subtitle":"Use it. Don’t finance the reward. Don’t manufacture spending. Read the condition.","motion":"four callbacks in rapid cuts","sfx":"four impact hits"},
    {"id":"cutting-board","weight":5,"title":"FINANCIAL EDUCATION COMPLETE","subtitle":"The metal card finally finds a practical use.","motion":"tiny cutting-board gag","sfx":"three tiny chops"},
    {"id":"next-episode","weight":5,"title":"NEXT: MINIMUM PAYMENT HORROR MOVIE","subtitle":"That button gets its own episode.","motion":"dark hallway + red eyes","sfx":"horror sting"},
]

def ffprobe_duration(path):
    out = subprocess.check_output([
        "ffprobe","-v","error","-show_entries","format=duration",
        "-of","default=nw=1:nk=1",str(path)
    ], text=True).strip()
    return float(out)

def font(size, bold=False):
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
    ]
    for p in candidates:
        if pathlib.Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

def centered(draw, text, y, fnt, fill=WHITE):
    box = draw.textbbox((0,0), text, font=fnt)
    x = (W - (box[2]-box[0]))/2
    draw.text((x,y), text, font=fnt, fill=fill)

def draw_stick(draw, x, y, scale=1.0, pose=0.0, face="neutral", accent=WHITE):
    r = int(22*scale)
    draw.ellipse((x-r,y-r,x+r,y+r), outline=accent, width=max(2,int(4*scale)))
    body_top = y+r
    body_bottom = y+int(115*scale)
    draw.line((x,body_top,x,body_bottom), fill=accent, width=max(2,int(5*scale)))
    sway = math.sin(pose)*int(42*scale)
    arm_y = y+int(58*scale)
    draw.line((x,arm_y,x-int(55*scale),arm_y+int(35*scale)+sway),fill=accent,width=max(2,int(5*scale)))
    draw.line((x,arm_y,x+int(55*scale),arm_y-int(10*scale)-sway),fill=accent,width=max(2,int(5*scale)))
    draw.line((x,body_bottom,x-int(42*scale),body_bottom+int(70*scale)),fill=accent,width=max(2,int(5*scale)))
    draw.line((x,body_bottom,x+int(42*scale),body_bottom+int(70*scale)),fill=accent,width=max(2,int(5*scale)))
    eye_y=y-int(4*scale)
    draw.ellipse((x-int(10*scale),eye_y,x-int(6*scale),eye_y+int(4*scale)), fill=accent)
    draw.ellipse((x+int(6*scale),eye_y,x+int(10*scale),eye_y+int(4*scale)), fill=accent)
    if face=="panic":
        draw.arc((x-int(10*scale),y+int(7*scale),x+int(10*scale),y+int(27*scale)),180,360,fill=accent,width=max(1,int(2*scale)))
    elif face=="smile":
        draw.arc((x-int(10*scale),y+int(1*scale),x+int(10*scale),y+int(18*scale)),0,180,fill=accent,width=max(1,int(2*scale)))
    else:
        draw.line((x-int(8*scale),y+int(14*scale),x+int(8*scale),y+int(14*scale)),fill=accent,width=max(1,int(2*scale)))

def scene_card(scene, progress, t_global):
    img=Image.new("RGB",(W,H),BG)
    d=ImageDraw.Draw(img)
    pulse = 1.0 + 0.03*math.sin(progress*math.tau*2)
    shake = 0
    if scene["id"] in {"cold-open","annual-fee","dlc","two-doors"}:
        shake=int(8*math.sin(progress*math.tau*6)*(1-progress))
    title_color = GREEN if any(k in scene["id"] for k in ["points","reward","bonus","planned","payoff"]) else RED if any(k in scene["id"] for k in ["fee","debt","interest","negative","trapdoor","horror"]) else WHITE
    centered(d, scene["title"], 56+shake, font(int(54*pulse), True), title_color)
    centered(d, scene["subtitle"], 126, font(25), MUTED)

    cx=420+int(40*math.sin(progress*math.tau))
    cy=285+int(8*math.sin(progress*math.tau*2))
    face="smile"
    if scene["id"] in {"annual-fee","negative-five","interest-monster","bonus-gap","zero-trapdoor"}: face="panic"
    draw_stick(d,cx,cy,1.35,progress*math.tau,face)

    sid=scene["id"]
    if sid=="cold-open":
        card=(680,360,980,520)
        d.rounded_rectangle(card,30,outline=WHITE,width=8)
        d.line((700,440,960,440),fill=MUTED,width=4)
        d.text((725,390),"PREMIUM",font=font(38,True),fill=WHITE)
        if progress>0.55:
            d.line((740,520,940,540),fill=RED,width=8)
    elif sid=="annual-fee":
        y=int(-120 + progress*500)
        d.rectangle((700,y,1060,y+180),fill=(245,245,235),outline=RED,width=6)
        d.text((755,y+45),"$200 FEE",font=font(48,True),fill=(20,20,20))
    elif sid=="dlc":
        for i,(label,color) in enumerate([("REWARDS",GREEN),("INTEREST",RED),("BONUS",GREEN),("0%*",YELLOW)]):
            a=progress*math.tau+i*math.pi/2
            x=850+int(math.cos(a)*160); y=390+int(math.sin(a)*120)
            d.ellipse((x-55,y-55,x+55,y+55),outline=color,width=5)
            box=d.textbbox((0,0),label,font=font(20,True)); d.text((x-(box[2]-box[0])/2,y-10),label,font=font(20,True),fill=color)
    elif sid=="planned-spend":
        items=["GROCERIES","GAS","BILLS","RENT"]
        for i,item in enumerate(items):
            x=675+(i%2)*210; y=330+(i//2)*140
            d.rounded_rectangle((x,y,x+170,y+95),20,outline=GREEN,width=5)
            d.text((x+18,y+31),item,font=font(23,True),fill=WHITE)
    elif sid=="points-balloon":
        r=int(75+90*progress)
        d.ellipse((790-r,390-r,790+r,390+r),outline=GREEN,width=7)
        d.text((720,365),"30K",font=font(52,True),fill=GREEN)
        d.line((790,390+r,790,590),fill=WHITE,width=3)
    elif sid=="redemption":
        d.text((690,300),"30,000",font=font(60,True),fill=GREEN)
        d.text((860,305),"→",font=font(54,True),fill=WHITE)
        d.text((940,300),"$210",font=font(60,True),fill=YELLOW)
        d.rectangle((815,445,1020,540),outline=WHITE,width=5)
        d.ellipse((845,530,885,570),outline=WHITE,width=5); d.ellipse((950,530,990,570),outline=WHITE,width=5)
    elif sid=="credit-chase":
        px=760+int(120*math.sin(progress*math.tau))
        d.rounded_rectangle((px,300,px+185,560),25,outline=GREEN,width=7)
        d.text((px+20,355),"USE YOUR",font=font(28,True),fill=GREEN)
        d.text((px+35,400),"CREDIT",font=font(34,True),fill=GREEN)
        d.ellipse((px+45,465,px+65,485),fill=WHITE); d.ellipse((px+120,465,px+140,485),fill=WHITE)
    elif sid=="negative-five":
        d.text((720,335),"$15 - $10 = $5",font=font(48,True),fill=WHITE)
        if progress>0.45:
            d.rounded_rectangle((735,440,1035,540),12,outline=RED,width=8)
            d.text((775,465),"SAVED -$5",font=font(46,True),fill=RED)
    elif sid=="year-score":
        d.rounded_rectangle((680,300,1040,410),18,outline=RED,width=5)
        d.text((730,335),"PREMIUM  $70",font=font(38,True),fill=WHITE)
        d.rounded_rectangle((680,455,1040,565),18,outline=GREEN,width=5)
        d.text((735,490),"FREE  $200",font=font(38,True),fill=WHITE)
    elif sid=="debt-enter":
        d.text((720,310),"D E B T",font=font(90,True),fill=RED)
        d.ellipse((790,500,815,525),fill=RED); d.ellipse((930,500,955,525),fill=RED)
    elif sid=="reward-trophy":
        d.polygon([(820,320),(940,320),(915,430),(845,430)],outline=GREEN)
        d.rectangle((858,430,902,510),outline=GREEN,width=5); d.rectangle((820,510,940,545),outline=GREEN,width=5)
        d.text((825,350),"$20",font=font(44,True),fill=GREEN)
    elif sid=="interest-monster":
        mx=820+int(80*progress)
        d.ellipse((mx,300,mx+210,555),outline=RED,width=8)
        d.ellipse((mx+45,365,mx+70,390),fill=RED); d.ellipse((mx+135,365,mx+160,390),fill=RED)
        d.arc((mx+60,410,mx+150,500),180,360,fill=RED,width=6)
        d.text((mx+20,250),"$19.73",font=font(44,True),fill=RED)
    elif sid=="autopay":
        for i,(lab,color) in enumerate([("MINIMUM",RED),("STATEMENT",GREEN)]):
            x=690+i*215
            d.rounded_rectangle((x,345,x+190,465),25,outline=color,width=6)
            d.text((x+20,390),lab,font=font(27,True),fill=color)
    elif sid=="bonus-carrot":
        d.polygon([(800,310),(1010,350),(850,545)],fill=GREEN)
        d.line((1000,340,1080,280),fill=GREEN,width=10)
        d.text((835,370),"$300",font=font(48,True),fill=(10,20,10))
    elif sid=="bonus-gap":
        d.rectangle((700,330,1050,390),outline=WHITE,width=5)
        fillw=int(350*0.833)
        d.rectangle((700,330,700+fillw,390),fill=GREEN)
        d.rectangle((700+fillw,330,1050,390),fill=RED)
        d.text((730,430),"$2,500 planned",font=font(32,True),fill=GREEN)
        d.text((790,485),"$500 GAP",font=font(42,True),fill=RED)
    elif sid=="bonus-ladder":
        d.rectangle((690,470,1060,555),outline=WHITE,width=6)
        d.ellipse((740,545,790,595),outline=WHITE,width=5); d.ellipse((960,545,1010,595),outline=WHITE,width=5)
        for y in range(280,480,45):
            d.line((930,y,1030,y),fill=YELLOW,width=6)
        d.line((925,270,925,500),fill=YELLOW,width=6); d.line((1035,270,1035,500),fill=YELLOW,width=6)
        d.text((700,300),"TOASTER  BLENDER",font=font(28,True),fill=WHITE)
    elif sid=="delete-cart":
        d.text((700,330),"DELETE",font=font(56,True),fill=RED)
        d.text((820,410),"DELETE",font=font(56,True),fill=RED)
        if progress>0.55:
            d.text((760,500),"LADDER?",font=font(44,True),fill=YELLOW)
    elif sid=="fine-print":
        d.rectangle((690,290,1060,555),outline=MUTED,width=5)
        for y in range(320,530,24):
            d.line((720,y,1025,y),fill=MUTED,width=3)
        d.ellipse((720,540,750,570),fill=WHITE); d.ellipse((990,540,1020,570),fill=WHITE)
    elif sid=="two-doors":
        for x in (690,900):
            d.rectangle((x,290,x+170,570),outline=WHITE,width=7)
            d.text((x+35,350),"0%",font=font(58,True),fill=YELLOW)
    elif sid=="zero-trapdoor":
        d.rectangle((680,300,845,570),outline=GREEN,width=7)
        d.text((715,355),"0%",font=font(50,True),fill=GREEN)
        d.rectangle((905,300,1070,570),outline=RED,width=7)
        d.text((940,355),"0%*",font=font(50,True),fill=RED)
        if progress>0.5:
            d.polygon([(900,570),(1080,570),(1010,700),(920,700)],fill=(40,5,5),outline=RED)
            for i in range(5):
                d.text((930+i*20,590+i*18),"$",font=font(28,True),fill=RED)
    elif sid=="payoff-plan":
        for i in range(12):
            x=690+(i%6)*65; y=320+(i//6)*120
            d.rounded_rectangle((x,y,x+55,y+80),8,outline=GREEN if progress>(i+1)/12 else MUTED,width=4)
            d.text((x+6,y+28),"$100",font=font(15,True),fill=WHITE)
    elif sid=="four-rules":
        rules=["USE IT","DEBT KILLS REWARDS","DON'T INVENT SPENDING","READ THE CONDITION"]
        for i,r in enumerate(rules):
            y=285+i*78
            d.ellipse((690,y,735,y+45),outline=GREEN,width=4)
            d.text((704,y+8),str(i+1),font=font(23,True),fill=GREEN)
            d.text((755,y+4),r,font=font(27,True),fill=WHITE)
    elif sid=="cutting-board":
        d.rounded_rectangle((710,420,1030,530),18,outline=WHITE,width=7)
        for i in range(3):
            x=765+i*80
            d.ellipse((x,380,x+55,430),outline=GREEN,width=5)
        knife_x=720+int(progress*260)
        d.line((knife_x,330,knife_x+100,430),fill=WHITE,width=8)
    elif sid=="next-episode":
        d.rectangle((760,320,990,520),fill=(5,5,8),outline=RED,width=4)
        d.ellipse((815,390,838,413),fill=RED); d.ellipse((910,390,933,413),fill=RED)
        d.rounded_rectangle((815,470,940,535),18,outline=WHITE,width=5)
        d.text((837,490),"MIN",font=font(24,True),fill=WHITE)

    # footer / chapter pulse
    d.line((0,H-48,W,H-48),fill=(30,38,52),width=2)
    d.text((35,H-38),"EPISODE 1 REBUILD • REVIEW ONLY • PUBLICATION DISABLED",font=font(18,True),fill=MUTED)
    return img

def make_sfx(path, duration, scene_starts):
    sr=48000
    n=int(duration*sr)
    with wave.open(str(path),"wb") as wf:
        wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(sr)
        starts=[int(s*sr) for s in scene_starts]
        idx=0
        for i in range(n):
            sample=0.0
            while idx+1<len(starts) and i>=starts[idx+1]:
                idx+=1
            dt=(i-starts[idx])/sr if starts else 999
            if 0<=dt<0.10:
                # short scene punctuation click/impact
                freq=90 if idx%5==0 else 620
                amp=0.22*(1-dt/0.10)
                sample += amp*math.sin(2*math.pi*freq*dt)
            if 0<=dt<0.025:
                sample += 0.08*(1-dt/0.025)
            sample=max(-0.95,min(0.95,sample))
            wf.writeframesraw(struct.pack("<h",int(sample*32767)))

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--audio",required=True)
    ap.add_argument("--out",required=True)
    ap.add_argument("--workdir",default="/tmp/episode1-rebuild")
    args=ap.parse_args()
    audio=pathlib.Path(args.audio)
    out=pathlib.Path(args.out)
    work=pathlib.Path(args.workdir); work.mkdir(parents=True,exist_ok=True)
    frames=work/"frames"; frames.mkdir(exist_ok=True)

    duration=ffprobe_duration(audio)
    total_weight=sum(s["weight"] for s in SCENES)
    scene_durations=[duration*s["weight"]/total_weight for s in SCENES]
    scene_starts=[]; t=0.0
    for d in scene_durations:
        scene_starts.append(t); t+=d

    frame_count=max(1,int(duration*FPS))
    for fi in range(frame_count):
        t=fi/FPS
        si=len(SCENES)-1
        for j,start in enumerate(scene_starts):
            if j+1==len(scene_starts) or t<scene_starts[j+1]:
                si=j; break
        start=scene_starts[si]; dur=scene_durations[si]
        progress=max(0.0,min(1.0,(t-start)/max(dur,0.001)))
        img=scene_card(SCENES[si],progress,t)
        img.save(frames/f"frame_{fi:06d}.jpg",quality=88)

    sfx=work/"sfx.wav"
    make_sfx(sfx,duration,scene_starts)
    silent=work/"silent.mp4"
    subprocess.check_call([
        "ffmpeg","-y","-framerate",str(FPS),"-i",str(frames/"frame_%06d.jpg"),
        "-c:v","libx264","-preset","veryfast","-crf","20","-pix_fmt","yuv420p",
        "-r","30",str(silent)
    ])
    subprocess.check_call([
        "ffmpeg","-y","-i",str(silent),"-i",str(audio),"-i",str(sfx),
        "-filter_complex","[1:a]volume=1.0[n];[2:a]volume=0.38[s];[n][s]amix=inputs=2:duration=first:dropout_transition=0[a]",
        "-map","0:v","-map","[a]","-c:v","copy","-c:a","aac","-b:a","192k","-shortest",str(out)
    ])
    sha=hashlib.sha256(out.read_bytes()).hexdigest()
    meta={
        "schema_version":1,
        "status":"REVIEW_CANDIDATE_RENDERED",
        "rebuild":"V2-entertainment-first",
        "duration_seconds":ffprobe_duration(out),
        "frame_rate":30,
        "width":W,"height":H,
        "scene_count":len(SCENES),
        "source_audio":str(audio),
        "sha256":sha,
        "publication_enabled":False
    }
    meta_path=out.with_suffix(".json")
    meta_path.write_text(json.dumps(meta,indent=2,sort_keys=True)+"\n")
    print(json.dumps(meta,sort_keys=True))

if __name__=="__main__":
    main()
