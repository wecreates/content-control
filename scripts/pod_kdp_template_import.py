"""Offline inspection of a retained KDP calculator guide; never an approval."""
import argparse
import hashlib
import io
import json
import math
import re
import stat
import sys
import zipfile
import fitz
from pod_common import canonical, open_regular_binary, read_json
from pod_raster import open_raster
from pod_pdf_policy import inspect_static_document, inspect_static_page

MAX_ARCHIVE_BYTES=16*1024*1024
MAX_MEMBER_BYTES=16*1024*1024
MAX_TOTAL_BYTES=32*1024*1024
PROFILE_KEYS={'binding','ink_type','paper_type','reading_direction','trim_inches','page_count','locale'}


def inspect_template_archive(path, profile, expected_sha256):
    if (not isinstance(profile,dict) or set(profile)!=PROFILE_KEYS or
            profile.get('binding')!='paperback' or profile.get('ink_type')!='black' or
            type(profile.get('paper_type')) is not str or
            profile['paper_type'] not in ('white','cream','groundwood') or
            profile.get('reading_direction')!='left_to_right' or profile.get('locale')!='en_US'):
        raise ValueError('KDP_TEMPLATE_PROFILE_INVALID')
    trim=profile.get('trim_inches');count=profile.get('page_count')
    if (type(count) is not int or not 24<=count<=828 or count%2 or
            not isinstance(trim,list) or len(trim)!=2 or
            any(type(v) not in (int,float) for v in trim) or
            not 4<=trim[0]<=8.5 or not 6<=trim[1]<=11.69):
        raise ValueError('KDP_TEMPLATE_PROFILE_INVALID')
    if not isinstance(expected_sha256,str) or not re.fullmatch('[a-f0-9]{64}',expected_sha256):
        raise ValueError('KDP_TEMPLATE_HASH_REQUIRED')
    with open_regular_binary(path) as f:
        captured=f.read(MAX_ARCHIVE_BYTES+1)
    if not 0<len(captured)<=MAX_ARCHIVE_BYTES:
        raise ValueError('KDP_TEMPLATE_ARCHIVE_SIZE_INVALID')
    sha=hashlib.sha256(captured).hexdigest()
    if sha!=expected_sha256:
        raise ValueError('KDP_TEMPLATE_HASH_MISMATCH')
    base=f"PAPERBACK_{trim[0]:.3f}x{trim[1]:.3f}_{count}_BW_{profile['paper_type'].upper()}_en_US"
    names={base+'.pdf',base+'.png','readme.txt'}
    members={}
    try:
        with zipfile.ZipFile(io.BytesIO(captured)) as z:
            entries=z.infolist()
            if len(entries)!=3 or {e.filename for e in entries}!=names:
                raise ValueError('KDP_TEMPLATE_ARCHIVE_INVALID')
            total=0
            for entry in entries:
                kind=stat.S_IFMT(entry.external_attr>>16)
                if (entry.is_dir() or kind not in (0,stat.S_IFREG) or entry.flag_bits&1 or
                        entry.compress_type not in (zipfile.ZIP_STORED,zipfile.ZIP_DEFLATED) or
                        not 0<entry.file_size<=MAX_MEMBER_BYTES):
                    raise ValueError('KDP_TEMPLATE_ARCHIVE_INVALID')
                total+=entry.file_size
                if total>MAX_TOTAL_BYTES:
                    raise ValueError('KDP_TEMPLATE_ARCHIVE_INVALID')
                with z.open(entry) as f:
                    data=f.read(MAX_MEMBER_BYTES+1)
                if not 0<len(data)<=MAX_MEMBER_BYTES or len(data)!=entry.file_size:
                    raise ValueError('KDP_TEMPLATE_ARCHIVE_INVALID')
                members[entry.filename]=data
    except ValueError:
        raise
    except Exception:
        raise ValueError('KDP_TEMPLATE_ARCHIVE_INVALID') from None
    # Never extract paths, execute contents, download URLs or mint approvals.
    spine=count*{'white':.002252,'cream':.0025,'groundwood':.00235}[profile['paper_type']]
    full=[2*trim[0]+spine+.25,trim[1]+.25]
    try:
        with fitz.open(stream=members[base+'.pdf'],filetype='pdf') as doc:
            inspect_static_document(doc,'KDP_TEMPLATE_GUIDE')
            if len(doc)!=1:
                raise ValueError()
            page=doc[0];inspect_static_page(doc,page,'KDP_TEMPLATE_GUIDE')
            expected=(0,0,round(full[0]*72),round(full[1]*72))
            if page.rotation or any(abs(a-b)>.01 for a,b in zip(page.rect,expected)):
                raise ValueError()
            text=page.get_text()
            required=('Paperback Book','Cover Template - Left to Right',
                      f'{trim[0]:g}" x {trim[1]:g}" Book',f'{count} Pages',
                      profile['paper_type'].title()+' Paper','Black & White',
                      f'{full[0]:.3f}" x {full[1]:.3f}" Overall Dimensions',
                      f'{spine:.3f}" Spine Width',
                      'REMOVE THIS TEMPLATE LAYER FROM FINAL ARTWORK.')
            if len(text)>65536 or any(value not in text for value in required):
                raise ValueError()
            points=list(page.rect)
    except Exception:
        raise ValueError('KDP_TEMPLATE_GUIDE_INVALID') from None
    try:
        with open_raster(io.BytesIO(members[base+'.png'])) as image:
            pixels=[math.ceil(v*600) for v in full]
            dpi=image.info.get('dpi',())
            if (image.format!='PNG' or image.mode not in ('RGB','RGBA') or
                    list(image.size)!=pixels or len(dpi)!=2 or
                    any(not math.isfinite(v) or abs(v-600)>.02 for v in dpi)):
                raise ValueError()
            # CRC/structure verification, not a visual/print-quality verdict.
            image.verify()
    except Exception:
        raise ValueError('KDP_TEMPLATE_RASTER_INVALID') from None
    try:
        readme=members['readme.txt'].decode('utf-8',errors='strict')
        if not readme.strip() or len(readme)>65536:
            raise ValueError()
    except Exception:
        raise ValueError('KDP_TEMPLATE_README_INVALID') from None
    return {'schema_version':1,'kind':'kdp-calculator-source-inspection',
            'archive_sha256':sha,'archive_bytes':len(captured),'profile':profile,
            'members':{name:{'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data)}
                       for name,data in sorted(members.items())},
            'guide':{'pdf_page_box_pt':points,'png_size_px':pixels,
                     'png_header_dpi':list(dpi),'declared_cover_inches':full,
                     'declared_spine_inches':spine,'png_header_crc_validated':True},
            'source_authority_verified':False,'production_template_approved':False,
            'publication_enabled':False}


def profile_json(text):
    # Node supplies a small profile derived from authenticated templates. Keep
    # the standalone CLI unambiguous and bounded as well; never read a URL.
    def pairs(values):
        result={}
        for key,value in values:
            if key in result:
                raise ValueError()
            result[key]=value
        return result
    def reject_constant(value):
        raise ValueError()
    try:
        if not isinstance(text,str) or len(text.encode('utf-8'))>4096:
            raise ValueError()
        return json.loads(text,object_pairs_hook=pairs,parse_constant=reject_constant)
    except Exception:
        raise ValueError('KDP_TEMPLATE_PROFILE_INVALID') from None


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--archive',required=True)
    profiles=p.add_mutually_exclusive_group(required=True)
    profiles.add_argument('--profile')
    profiles.add_argument('--profile-json')
    p.add_argument('--expected-sha256',required=True)
    a=p.parse_args()
    try:
        profile=read_json(a.profile) if a.profile else profile_json(a.profile_json)
        result=inspect_template_archive(a.archive,profile,a.expected_sha256)
        print(canonical(result))
        return 0
    except Exception as exc:
        reason=str(exc) if isinstance(exc,ValueError) and str(exc).startswith('KDP_TEMPLATE_') else 'KDP_TEMPLATE_IMPORT_BLOCKED'
        print(canonical({'status':'BLOCKED','reason_code':reason,'publication_enabled':False}))
        return 2

if __name__=='__main__':
    sys.exit(main())
