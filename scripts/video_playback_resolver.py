#!/usr/bin/env python3
import argparse, json, re
from urllib.parse import urlparse

DIRECT_EXTS=(".mp4",".m4v",".mov",".webm",".m3u8")

def classify_url(url):
    p=urlparse(url)
    host=(p.hostname or "").lower()
    path=p.path or ""
    if not p.scheme.startswith("http"):
        raise ValueError("Only http(s) video URLs are supported")
    if host in ("youtube.com","www.youtube.com","youtu.be","m.youtube.com"):
        platform="youtube"
    elif host.endswith("instagram.com"):
        platform="instagram"
    elif host.endswith("tiktok.com"):
        platform="tiktok"
    elif host in ("x.com","www.x.com","twitter.com","www.twitter.com"):
        platform="x"
    elif host.endswith("vimeo.com"):
        platform="vimeo"
    elif host.endswith("dropbox.com"):
        platform="dropbox"
    elif any(path.lower().endswith(ext) for ext in DIRECT_EXTS):
        platform="direct_media"
    else:
        platform="web_video_page"
    return {"url":url,"platform":platform,"host":host,"path":path}

ROUTES={
    "youtube":{
        "primary":"gemini_public_video_url",
        "fallbacks":["authenticated_browser","direct_media_av"],
        "requires_login":False,
    },
    "instagram":{
        "primary":"authenticated_browser",
        "fallbacks":["social_media_resolver","public_mirror_av"],
        "requires_login":True,
    },
    "tiktok":{
        "primary":"authenticated_browser",
        "fallbacks":["social_media_resolver","public_mirror_av"],
        "requires_login":False,
    },
    "x":{
        "primary":"authenticated_browser",
        "fallbacks":["social_media_resolver","public_mirror_av"],
        "requires_login":False,
    },
    "vimeo":{
        "primary":"gemini_public_video_url",
        "fallbacks":["direct_media_av","authenticated_browser"],
        "requires_login":False,
    },
    "dropbox":{
        "primary":"direct_media_av",
        "fallbacks":["authenticated_browser"],
        "requires_login":False,
    },
    "direct_media":{
        "primary":"direct_media_av",
        "fallbacks":["gemini_uploaded_media"],
        "requires_login":False,
    },
    "web_video_page":{
        "primary":"authenticated_browser",
        "fallbacks":["direct_media_av","public_mirror_av"],
        "requires_login":False,
    },
}

def route_for(classification):
    base=dict(ROUTES[classification["platform"]])
    base.update({
        "platform":classification["platform"],
        "fail_closed":True,
        "metadata_only_counts_as_watched":False,
        "watch_success_contract":{
            "visual_access_required":True,
            "audio_access_required":True,
            "end_to_end_coverage_required":True,
            "timestamped_evidence_required":True,
        }
    })
    return base

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("url",nargs="+")
    args=ap.parse_args()
    rows=[]
    for url in args.url:
        c=classify_url(url)
        rows.append({"classification":c,"route":route_for(c)})
    print(json.dumps(rows,indent=2,sort_keys=True))

if __name__=="__main__":
    main()
