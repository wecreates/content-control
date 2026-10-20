"""Bind independent print QA to the original signed artwork bytes and layout."""
import hashlib
import io
import math
from PIL import Image,ImageChops
from pod_common import open_regular_binary,verified,MAX_JSON_BYTES
from pod_raster import open_raster
from pod_template_evidence import strict_json
from pod_text_preflight import capture_text_layers,render_text_strip

MAX_SOURCE_BYTES=16*1024*1024
STRIP_ROWS=128


def source_evidence_deadline(evidence):
    try:
        return verified(evidence['rights'],'POD_RIGHTS_KEY','pod:asset-rights')['expires_at_ms']
    except Exception:
        raise ValueError('SOURCE_RIGHTS_INVALID') from None


def inspect_original_source(manifest,image,art_mask,text_mask,paths):
    required={'source','rights','text_layers'}
    if (not isinstance(paths,dict) or not required.issubset(paths) or set(paths)-required-{'asset_root'} or
            any(paths[k] is None for k in required)):
        raise ValueError('SOURCE_EVIDENCE_REQUIRED')
    try:
        with open_regular_binary(paths['rights']) as f:data=f.read(MAX_JSON_BYTES+1)
        if len(data)>MAX_JSON_BYTES:raise ValueError()
        envelope=strict_json(data.decode('utf-8',errors='strict'))
        strict_json(envelope['payload'])
        rights=verified(envelope,'POD_RIGHTS_KEY','pod:asset-rights')
        if rights.get('status')!='PASS':raise ValueError()
    except Exception:
        raise ValueError('SOURCE_RIGHTS_INVALID') from None
    try:
        with open_regular_binary(paths['source']) as f:source_bytes=f.read(MAX_SOURCE_BYTES+1)
        if not 0<len(source_bytes)<=MAX_SOURCE_BYTES:raise ValueError()
    except Exception:
        raise ValueError('SOURCE_BYTES_INVALID') from None
    sha=hashlib.sha256(source_bytes).hexdigest()
    if rights.get('source_sha256')!=sha or manifest.get('source_sha256')!=sha:
        raise ValueError('SOURCE_HASH_MISMATCH')
    layers,text_sha=capture_text_layers(paths,rights,manifest,image.size)
    # Identity, header inspection and decoding use one bounded byte capture.
    with open_raster(io.BytesIO(source_bytes)) as source:
        sw,sh=source.size
        try:
            w,h=image.size;t=manifest['template'];box=t['art_box_px'];dpi=t['dpi']
            if (type(dpi) is not int or not 300<=dpi<=1200 or
                    not isinstance(box,(list,tuple)) or len(box)!=4 or
                    any(type(v) is not int for v in box)):
                raise ValueError()
            x,y,bw,bh=box
            if min(x,y)<0 or min(bw,bh)<=0 or x+bw>w or y+bh>h:raise ValueError()
            scale=min(bw/sw,bh/sh)
            if scale>1:raise ValueError()
            nw,nh=max(1,round(sw*scale)),max(1,round(sh*scale))
            ox,oy=x+(bw-nw)//2,y+(bh-nh)//2
            native=min(sw*dpi/nw,sh*dpi/nh)
            pairs=(('source_size_px',[sw,sh]),('placed_size_px',[nw,nh]),('placed_origin_px',[ox,oy]))
            if any(not isinstance(manifest.get(k),list) or len(manifest[k])!=2 or
                   any(type(v) is not int for v in manifest[k]) or manifest[k]!=expected for k,expected in pairs):
                raise ValueError()
            claimed=manifest['effective_native_ppi']
            if type(claimed) not in (int,float) or not math.isfinite(claimed) or not math.isclose(claimed,native,rel_tol=1e-9,abs_tol=1e-9):
                raise ValueError()
            background=t.get('background_rgba',[255,255,255,255])
            if not isinstance(background,(list,tuple)) or len(background)!=4 or any(type(v) is not int or not 0<=v<=255 for v in background):
                raise ValueError()
            if image.mode!='RGB' or art_mask.mode!='L' or text_mask.mode!='L' or art_mask.size!=(w,h) or text_mask.size!=(w,h):
                raise ValueError()
        except (KeyError,TypeError,ValueError,OverflowError,ZeroDivisionError):
            raise ValueError('SOURCE_LAYOUT_INVALID') from None
        source.load()
        resized=source.convert('RGBA').resize((nw,nh),Image.Resampling.LANCZOS)
    # Compare fixed-height strips to avoid allocating another complete canvas.
    # Original glyphs and masks are reconstructed too; producer text masks
    # cannot exclude arbitrary pixels from the comparison.
    try:
        for top in range(0,h,STRIP_ROWS):
            bottom=min(h,top+STRIP_ROWS);region=(0,top,w,bottom)
            tile=Image.new('RGBA',(w,bottom-top),tuple(background))
            mask=Image.new('L',tile.size,0)
            start,stop=max(top,oy),min(bottom,oy+nh)
            if start<stop:
                part=resized.crop((0,start-oy,nw,stop-oy))
                tile.alpha_composite(part,(ox,start-top));mask.paste(part.getchannel('A'),(ox,start-top))
            if ImageChops.difference(mask,art_mask.crop(region)).getbbox() is not None:
                raise ValueError('SOURCE_MASK_MISMATCH')
            text=render_text_strip(tile,layers,top)
            if ImageChops.difference(text,text_mask.crop(region)).getbbox() is not None:
                raise ValueError('TEXT_MASK_MISMATCH')
            if ImageChops.multiply(mask,text.point(lambda value:255 if value else 0)).getbbox() is not None:
                raise ValueError('SOURCE_PIXELS_MISMATCH')
            difference=ImageChops.difference(tile.convert('RGB'),image.crop(region))
            if difference.getbbox() is not None:raise ValueError('SOURCE_PIXELS_MISMATCH')
    finally:
        resized.close()
    evidence={'rights':envelope,'source_sha256':sha,'text_layers_sha256':text_sha,
              'source_size_px':[sw,sh],'effective_native_ppi':native}
    source_evidence_deadline(evidence)
    return evidence
