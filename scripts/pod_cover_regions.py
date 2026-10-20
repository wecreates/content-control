"""Necessary region geometry for the supported LTR Amazon-placed barcode."""
import math


def ltr_barcode_box(trim):
    # KDP's retained calculator guide marks 2 by 1.2 inches, .25 inch
    # from the back-cover spine fold and bottom trim, excluding .125 bleed.
    # G5HDYGP4BXLX4RUW and the retained guide checked 2026-10-20.
    if (not isinstance(trim,list) or len(trim)!=2 or
            any(type(v) not in (int,float) for v in trim) or
            not 4<=trim[0]<=8.5 or not 6<=trim[1]<=11.69):
        raise ValueError('COVER_BARCODE_SPEC_INVALID')
    right=trim[0]+.125-.25;bottom=trim[1]+.125-.25
    return [right-2,bottom-1.2,right,bottom]


def barcode_region_px(template):
    try:
        k=template['kdp']
        if k.get('barcode_mode')!='amazon_placed':
            raise ValueError('KDP_BARCODE_MODE_UNSUPPORTED')
        dpi=template['dpi'];size=template['size_inches']
        width=k['trim_width_inches'];spine=k['spine_width_inches'];bleed=k['bleed_inches']
        def number(v):
            return type(v) in (int,float) and 0<v<24 and math.isfinite(v)
        if (template['platform']!='kdp' or k.get('reading_direction')!='left_to_right' or
                type(dpi) is not int or not 300<=dpi<=1200 or
                not isinstance(size,list) or len(size)!=2 or not all(number(v) for v in size) or
                not number(width) or not number(spine) or type(bleed) not in (int,float) or bleed!=.125 or
                abs(size[0]-(2*width+spine+2*bleed))>1e-6):
            raise ValueError('COVER_BARCODE_SPEC_INVALID')
        canvas=tuple(math.ceil(v*dpi) for v in size)
        if canvas[0]*canvas[1]>100_000_000:
            raise ValueError('COVER_BARCODE_SPEC_INVALID')
        box=ltr_barcode_box([width,size[1]-2*bleed])
        # Expand the forbidden rectangle outwards; partial edge pixels cannot
        # be used for critical content. Right/bottom bounds are exclusive.
        pixels=[math.floor(box[0]*dpi),math.floor(box[1]*dpi),
                math.ceil(box[2]*dpi),math.ceil(box[3]*dpi)]
        return canvas,pixels
    except (KeyError,TypeError,AttributeError,OverflowError):
        raise ValueError('COVER_BARCODE_SPEC_INVALID') from None
