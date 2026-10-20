"""Capture signed original text/font inputs for independent strip rendering."""
import hashlib
import io
from pathlib import Path
import re
from PIL import Image,ImageDraw,ImageFont
from pod_common import canonical,open_regular_binary,MAX_JSON_BYTES
from pod_template_evidence import strict_json

MAX_TEXT_LAYERS=32
MAX_TEXT_CHARS=16384
MAX_FONT_BYTES=16*1024*1024
MAX_FONT_BATCH_BYTES=32*1024*1024


def capture_text_layers(paths,rights,manifest,size):
    try:
        with open_regular_binary(paths['text_layers']) as f:data=f.read(MAX_JSON_BYTES+1)
        if len(data)>MAX_JSON_BYTES:raise ValueError()
        layers=strict_json(data.decode('utf-8',errors='strict'))
        if not isinstance(layers,list) or len(layers)>MAX_TEXT_LAYERS:raise ValueError()
        sha=hashlib.sha256(canonical(layers).encode()).hexdigest()
    except Exception:
        raise ValueError('TEXT_LAYERS_INVALID') from None
    if rights.get('text_layers_sha256')!=sha:raise ValueError('TEXT_LAYERS_HASH_MISMATCH')
    prepared=[];expected=[];fonts={};instances={};total=0;decoded=0;chars=0;w,h=size
    metric=ImageDraw.Draw(Image.new('L',(1,1)))
    for layer in layers:
        try:
            name=layer['font_path'];identity=layer['font_sha256'];font_size=layer['font_size_px']
            position=layer['position_px'];text=layer['text'];rgba=layer['rgba']
            if (type(name) is not str or not 0<len(name)<=4096 or type(identity) is not str or
                    re.fullmatch('[a-f0-9]{64}',identity) is None or
                    type(font_size) is not int or not 1<=font_size<=4096 or
                    not isinstance(position,list) or len(position)!=2 or any(type(v) is not int for v in position) or
                    type(text) is not str or len(text)>4096 or
                    not isinstance(rgba,list) or len(rgba)!=4 or any(type(v) is not int or not 0<=v<=255 for v in rgba)):
                raise ValueError()
            chars+=len(text)
            if chars>MAX_TEXT_CHARS:raise ValueError()
            file=Path(name)
            if paths.get('asset_root') is not None:
                root=Path(paths['asset_root']).resolve(strict=True)
                file=root/file
                parent=file.parent.resolve(strict=True)
                if not parent.is_relative_to(root):raise ValueError()
                # Resolve/validate parents, then open the final component with
                # NOFOLLOW rather than turning a symlink into an accepted font.
                file=parent/file.name
        except Exception:
            raise ValueError('TEXT_LAYOUT_INVALID') from None
        cache=(str(file),identity)
        if cache not in fonts:
            try:
                with open_regular_binary(file) as f:font_bytes=f.read(MAX_FONT_BYTES+1)
                total+=len(font_bytes)
                if not 0<len(font_bytes)<=MAX_FONT_BYTES or total>MAX_FONT_BATCH_BYTES or hashlib.sha256(font_bytes).hexdigest()!=identity:
                    raise ValueError()
                fonts[cache]=font_bytes
            except Exception:
                raise ValueError('TEXT_FONT_INVALID') from None
        instance=(cache,font_size)
        if instance not in instances:
            try:
                decoded+=len(fonts[cache])
                if decoded>MAX_FONT_BATCH_BYTES:raise ValueError()
                instances[instance]=ImageFont.truetype(io.BytesIO(fonts[cache]),font_size)
            except Exception:
                raise ValueError('TEXT_FONT_INVALID') from None
        try:
            font=instances[instance]
            box=metric.textbbox(tuple(position),text,font=font)
            if box[0]<0 or box[1]<0 or box[2]>w or box[3]>h:raise ValueError()
        except Exception:
            raise ValueError('TEXT_LAYOUT_INVALID') from None
        expected.append({'text':text,'box_px':list(box),'font_sha256':identity})
        prepared.append({'text':text,'position':position,'rgba':tuple(rgba),'font':font,'box':box})
    if canonical(manifest.get('expected_text'))!=canonical(expected):raise ValueError('TEXT_LAYOUT_INVALID')
    return prepared,sha


def render_text_strip(tile,prepared,top):
    mask=Image.new('L',tile.size,0)
    draw=ImageDraw.Draw(tile);mask_draw=ImageDraw.Draw(mask)
    for layer in prepared:
        if layer['box'][3]<=top or layer['box'][1]>=top+tile.height:continue
        x,y=layer['position'];position=(x,y-top)
        draw.text(position,layer['text'],font=layer['font'],fill=layer['rgba'])
        mask_draw.text(position,layer['text'],font=layer['font'],fill=255)
    return mask
