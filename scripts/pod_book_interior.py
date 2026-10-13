"""Render supplied manuscript pages using a verified trim/margin specification.
No placeholder pages, debugging boxes, inferred gutters, or fabricated book content.
"""
import argparse
import hashlib
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pod_common import canonical, digest, read_json, save_json, verified

def render_book(spec, pages, font_path, output):
    if spec.get('platform') != 'kdp' or spec.get('interior_type') != 'text_no_bleed':
        raise ValueError('INTERIOR_TEMPLATE_UNSUPPORTED')
    if len(pages) != spec['page_count'] or not 1 <= len(pages) <= 1000:
        raise ValueError('PAGE_COUNT_MISMATCH')
    width, height = [float(v)*72 for v in spec['trim_inches']]
    if min(width,height) < 72 or max(width,height) > 1440:
        raise ValueError('TRIM_INVALID')
    margins = spec['margins_inches']
    inside,outside,top,bottom = [float(margins[k])*72 for k in ('inside','outside','top','bottom')]
    if min(inside,outside,top,bottom) <= 0 or inside+outside >= width or top+bottom >= height:
        raise ValueError('MARGINS_INVALID')
    if digest(font_path) != spec['font_sha256']:
        raise ValueError('FONT_HASH_MISMATCH')
    size,leading=spec['font_size_pt'],spec['leading_pt']
    if not 6 <= size <= 72 or not size*1.2 <= leading <= size*3:
        raise ValueError('TYPE_METRICS_INVALID')
    face='POD-'+spec['font_sha256'][:16]
    pdfmetrics.registerFont(TTFont(face,font_path))
    target=Path(output)
    if target.exists():
        raise ValueError('OUTPUT_EXISTS')
    target.parent.mkdir(parents=True,exist_ok=True)
    pdf=canvas.Canvas(str(target),pagesize=(width,height),invariant=1,pageCompression=1)
    for number,page in enumerate(pages,1):
        lines=page.get('lines')
        if not isinstance(lines,list) or not lines or any(not isinstance(line,str) or '\n' in line for line in lines):
            raise ValueError('PAGE_TEXT_INVALID')
        x=inside if number%2 else outside
        y=height-top-size
        pdf.setFont(face,size)
        for line in lines:
            if y < bottom or pdfmetrics.stringWidth(line,face,size) > width-inside-outside:
                raise ValueError('TEXT_OVERFLOW')
            pdf.drawString(x,y,line);y-=leading
        pdf.showPage()
    pdf.save()
    # Re-open the actual output and verify text and every page size.
    import fitz
    with fitz.open(target) as document:
        if len(document)!=len(pages):
            raise ValueError('PDF_PAGE_COUNT_FAILED')
        for page,expected in zip(document,pages):
            if abs(page.rect.width-width)>.01 or abs(page.rect.height-height)>.01 or page.get_text().splitlines()!=expected['lines']:
                raise ValueError('PDF_TEXT_OR_SIZE_FAILED')
    return {'schema_version':1,'interior_sha256':digest(target),'page_count':len(pages),
            'template_sha256':hashlib.sha256(canonical(spec).encode()).hexdigest(),'technical_checks_passed':True,
            'editorial_review':'UNASSESSED','production_ready':False,'publication_enabled':False}

if __name__=='__main__':
    p=argparse.ArgumentParser()
    for name in ('template','pages','font','output'):
        p.add_argument('--'+name,required=True)
    a=p.parse_args()
    spec=verified(read_json(a.template),'POD_TEMPLATE_KEY','pod:interior-template')['template']
    result=render_book(spec,read_json(a.pages),a.font,a.output)
    save_json(str(a.output)+'.receipt.json',result)
    print(canonical(result))
