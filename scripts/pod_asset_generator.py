"""Deterministic layout of original input art; does not pretend to be an AI image API."""
import argparse
import hashlib
import math
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from pod_common import canonical, digest, read_json, save_json, verified, PLATFORMS

Image.MAX_IMAGE_PIXELS = 100_000_000

def generate(source_path, template, text_layers, output_dir):
    if template.get('platform') not in PLATFORMS:
        raise ValueError('PLATFORM_BLOCKED')
    dpi = template.get('dpi', 300)
    if not isinstance(dpi, int) or not 300 <= dpi <= 1200:
        raise ValueError('DPI_INVALID')
    w, h = [math.ceil(float(v) * dpi) for v in template['size_inches']]
    if min(w, h) <= 0 or w*h > Image.MAX_IMAGE_PIXELS:
        raise ValueError('CANVAS_INVALID')
    # KDP spine size must come from a verified official template for exact paper/page count.
    if template['platform'] == 'kdp':
        k = template['kdp']
        expected = 2*k['trim_width_inches'] + k['spine_width_inches'] + 2*k['bleed_inches']
        if k.get('page_count', 0) <= 0 or abs(template['size_inches'][0]-expected) > 1e-6:
            raise ValueError('KDP_TEMPLATE_INVALID')
    x, y, bw, bh = template['art_box_px']
    if any(not isinstance(v, int) for v in (x,y,bw,bh)) or min(x,y)<0 or min(bw,bh)<=0 or x+bw>w or y+bh>h:
        raise ValueError('ART_BOX_INVALID')
    root = Path(output_dir)
    root.mkdir(parents=True, exist_ok=False)
    with Image.open(source_path) as source:
        source.load()
        source = source.convert('RGBA')
        sw, sh = source.size
        scale = min(bw/sw, bh/sh)
        if scale > 1:
            raise ValueError('NATIVE_RESOLUTION_INSUFFICIENT')
        nw, nh = max(1, round(sw*scale)), max(1, round(sh*scale))
        source = source.resize((nw,nh), Image.Resampling.LANCZOS)
        ox, oy = x+(bw-nw)//2, y+(bh-nh)//2
        canvas = Image.new('RGBA',(w,h),tuple(template.get('background_rgba',[255,255,255,255])))
        canvas.alpha_composite(source,(ox,oy))
        art_mask = Image.new('L',(w,h),0)
        art_mask.paste(source.getchannel('A'),(ox,oy))
    text_mask = Image.new('L',(w,h),0)
    expected = []
    for layer in text_layers:
        if digest(layer['font_path']) != layer['font_sha256']:
            raise ValueError('FONT_HASH_MISMATCH')
        font = ImageFont.truetype(layer['font_path'], layer['font_size_px'])
        px, py = layer['position_px']
        draw = ImageDraw.Draw(canvas)
        box = draw.textbbox((px,py),layer['text'],font=font)
        if box[0]<0 or box[1]<0 or box[2]>w or box[3]>h:
            raise ValueError('TEXT_CLIPPED')
        draw.text((px,py),layer['text'],font=font,fill=tuple(layer['rgba']))
        ImageDraw.Draw(text_mask).text((px,py),layer['text'],font=font,fill=255)
        expected.append({'text':layer['text'],'box_px':list(box),'font_sha256':layer['font_sha256']})
    canvas.save(root/'print.png',dpi=(dpi,dpi))
    art_mask.save(root/'art-mask.png')
    text_mask.save(root/'text-mask.png')
    files = ['print.png','art-mask.png','text-mask.png']
    if template['platform']=='kdp':
        # Optional explicit dependency; failure blocks KDP rather than producing a fake PDF.
        from reportlab.pdfgen import canvas as pdfcanvas
        from reportlab.lib.utils import ImageReader
        pdf = pdfcanvas.Canvas(str(root/'cover.pdf'),pagesize=(w*72/dpi,h*72/dpi))
        pdf.drawImage(ImageReader(canvas.convert('RGB')),0,0,width=w*72/dpi,height=h*72/dpi)
        pdf.showPage()
        pdf.save()
        files.append('cover.pdf')
    manifest={'schema_version':1,'platform':template['platform'],'dpi':dpi,'size_px':[w,h],
              'source_size_px':[sw,sh],'placed_size_px':[nw,nh], 'placed_origin_px':[ox,oy],
              'effective_native_ppi':min(sw/(nw/dpi),sh/(nh/dpi)),
              'expected_text':expected,'template_sha256':hashlib.sha256(canonical(template).encode()).hexdigest(),
              'template':template,'files':{name:digest(root/name) for name in files},'publication_enabled':False}
    manifest['package_sha256']=hashlib.sha256(canonical(manifest).encode()).hexdigest()
    save_json(root/'manifest.json',manifest)
    return manifest

def main():
    p=argparse.ArgumentParser()
    for name in ('source','template','text-layers','rights','output-dir'):
        p.add_argument('--'+name,required=True)
    a=p.parse_args()
    try:
        rights=verified(read_json(a.rights),'POD_RIGHTS_KEY','pod:asset-rights')
        template=verified(read_json(a.template),'POD_TEMPLATE_KEY','pod:template')['template']
        layers=read_json(a.text_layers)
        if rights.get('status')!='PASS' or rights.get('source_sha256')!=digest(a.source) or rights.get('text_layers_sha256')!=hashlib.sha256(canonical(layers).encode()).hexdigest():
            raise ValueError('RIGHTS_BLOCKED')
        result=generate(a.source,template,layers,a.output_dir)
        print(canonical({'status':'GENERATED','package_sha256':result['package_sha256'],'publication_enabled':False}))
        return 0
    except Exception as exc:
        print(canonical({'status':'BLOCKED','reason_code':str(exc) if isinstance(exc,ValueError) else type(exc).__name__,'publication_enabled':False}))
        return 2

if __name__=='__main__':
    sys.exit(main())
