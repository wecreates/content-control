"""Print QA. Similarity measurements never masquerade as visual superiority."""
import argparse
import hashlib
import math
import subprocess
import sys
import tempfile
import time
import unicodedata
from pathlib import Path
import cv2
import numpy as np
from PIL import Image
from pod_common import canonical, digest, read_json, save_json, scoped_file, verified, sign, PLATFORMS
from pod_raster import open_raster

def resolution_checks(manifest, image, stored_dpi):
    """Derive physical size and native PPI; manifest claims alone are not proof."""
    try:
        template=manifest['template']
        dpi=template['dpi']
        if type(dpi) is not int or not 300 <= dpi <= 1200 or type(manifest['dpi']) is not int or manifest['dpi'] != dpi:
            return False
        inches=template['size_inches']
        if len(inches)!=2 or any(type(v) not in (int,float) or not math.isfinite(v) or v<=0 for v in inches):
            return False
        expected=[math.ceil(v*dpi) for v in inches]
        if list(image.size)!=expected or manifest['size_px']!=expected:
            return False
        # PNG stores pixels/metre, so allow only its sub-0.02 PPI quantization.
        if len(stored_dpi)!=2 or any(not math.isfinite(v) or abs(v-dpi)>.02 for v in stored_dpi):
            return False
        source=manifest['source_size_px'];placed=manifest['placed_size_px']
        if any(len(pair)!=2 or any(type(v) is not int or v<=0 for v in pair) for pair in (source,placed)):
            return False
        if any(p>s for s,p in zip(source,placed)):
            return False
        native=min(s*dpi/p for s,p in zip(source,placed))
        claimed=manifest['effective_native_ppi']
        return (native>=300 and type(claimed) in (int,float) and math.isfinite(claimed)
                and math.isclose(claimed,native,rel_tol=1e-9,abs_tol=1e-9))
    except (KeyError,TypeError,ValueError,OverflowError,ZeroDivisionError):
        return False

def ocr(image, language='eng'):
    with tempfile.TemporaryDirectory(prefix='pod-ocr-') as tmp:
        path=Path(tmp)/'crop.png'
        image.save(path)
        result=subprocess.run(['tesseract',str(path),'stdout','-l',language,'--psm','6'],
                              capture_output=True,text=True,timeout=45,check=True)
    return unicodedata.normalize('NFC',result.stdout.strip())

def spatial_checks(manifest,image,art_mask,text_mask):
    w,h=image.size
    safe=np.zeros((h,w),dtype=np.uint8)
    sx,sy,sw,sh=manifest['template']['safe_box_px']
    if any(not isinstance(v,int) for v in (sx,sy,sw,sh)) or min(sx,sy)<0 or min(sw,sh)<=0 or sx+sw>w or sy+sh>h:
        return False
    safe[sy:sy+sh,sx:sx+sw]=1
    text=np.asarray(text_mask)>0
    art=np.asarray(art_mask)>0
    if text.shape!=(h,w) or art.shape!=(h,w):
        return False
    if np.any(text & (safe==0)):
        return False
    if manifest['template'].get('art_is_critical',True) and np.any(art & (safe==0)):
        return False
    # Dilation creates a one-pixel clearance; require dedicated text space.
    if np.any(cv2.dilate(text.astype(np.uint8),np.ones((3,3),np.uint8)).astype(bool)&art):
        return False
    ow,oh=manifest['source_size_px']
    nw,nh=manifest['placed_size_px']
    # Integer raster rounding is bounded to one pixel, never unconstrained warping.
    if min(ow,oh,nw,nh)<=0 or abs(nw/ow-nh/oh)>max(1/ow,1/oh):
        return False
    return True

def similarity(candidate,reference):
    with open_raster(candidate) as a, open_raster(reference) as b:
        import torch
        import open_clip
        torch.set_num_threads(2)
        model,_,preprocess=open_clip.create_model_and_transforms('ViT-B-32',pretrained='laion2b_s34b_b79k',device='cpu')
        model.eval()
        batch=torch.stack([preprocess(a.convert('RGB')),preprocess(b.convert('RGB'))])
    with torch.inference_mode():
        z=model.encode_image(batch)
        z=z/z.norm(dim=-1,keepdim=True).clamp_min(1e-12)
        cosine=float((z[0]*z[1]).sum())
    if not np.isfinite(cosine):
        raise ValueError('SIMILARITY_NONFINITE')
    return cosine

EDITORIAL_CHECKS=('editorial','originality','content_completeness','cover_interior_consistency','ai_disclosure')

def evaluate(root,reference,rights_envelope,competitive_envelope,approved_evaluators,descriptive_similarity=False,
             editorial_envelope=None,approved_editorial_evaluators=None):
    root=Path(root)
    report={'schema_version':1,'engine':'cyzor-pod-qa-v1','verdict':'FAIL','binary_pass':0,
            'production_ready':False,'publication_enabled':False,'checks':{},'errors':[]}
    try:
        m=read_json(root/'manifest.json')
        expected=m.pop('package_sha256')
        actual=hashlib.sha256(canonical(m).encode()).hexdigest()
        m['package_sha256']=expected
        if expected!=actual or m['template_sha256']!=hashlib.sha256(canonical(m['template']).encode()).hexdigest():
            raise ValueError('MANIFEST_HASH_MISMATCH')
        if m.get('platform') not in PLATFORMS or m['template'].get('platform')!=m['platform']:
            raise ValueError('PLATFORM_BLOCKED')
        required_files={'print.png','art-mask.png','text-mask.png'}
        if m['platform']=='kdp':
            required_files.update({'cover.pdf','interior.pdf','interior.receipt.json'})
        if not isinstance(m.get('files'),dict) or not required_files.issubset(m['files']):
            raise ValueError('PACKAGE_FILES_REQUIRED')
        for name,sha in m['files'].items():
            if digest(scoped_file(root,name))!=sha:
                raise ValueError('FILE_HASH_MISMATCH')
        report.update({'platform':m['platform'],'package_sha256':actual,'template_sha256':m['template_sha256'],
                       'candidate_sha256':m['files']['print.png'],'reference_sha256':digest(reference)})
        with open_raster(root/'print.png', m['size_px']) as f:
            image=f.convert('RGB')
            stored_dpi=f.info.get('dpi',(0,0))
        with open_raster(root/'art-mask.png', image.size) as f:
            art=f.convert('L')
        with open_raster(root/'text-mask.png', image.size) as f:
            text=f.convert('L')
        report['checks']['geometry']=spatial_checks(m,image,art,text)
        report['checks']['resolution']=resolution_checks(m,image,stored_dpi)
        text_ok=True
        for layer in m['expected_text']:
            box=layer['box_px']
            crop=image.crop((max(0,box[0]-12),max(0,box[1]-12),min(image.width,box[2]+12),min(image.height,box[3]+12)))
            text_ok &= ocr(crop)==unicodedata.normalize('NFC',layer['text'])
        # Whole-art OCR catches accidental extra lettering; no expected text requires empty OCR.
        observed=ocr(image)
        intended='\n'.join(x['text'] for x in m['expected_text'])
        report['checks']['text']=bool(text_ok and observed==unicodedata.normalize('NFC',intended))
        rights=verified(rights_envelope,'POD_RIGHTS_KEY','pod:package-rights')
        report['checks']['rights']=rights.get('status')=='PASS' and rights.get('package_sha256')==actual and rights.get('permanently_unpublished') is False
        preflight=True
        if m['platform']=='kdp':
            interior=m['interior']
            spec=interior['template']
            receipt=interior['receipt']
            if (read_json(scoped_file(root,'interior.receipt.json'))!=receipt or
                receipt['interior_sha256']!=m['files']['interior.pdf'] or
                receipt['template_sha256']!=hashlib.sha256(canonical(spec).encode()).hexdigest() or
                receipt['technical_checks_passed'] is not True or
                spec['page_count']!=m['template']['kdp']['page_count']):
                raise ValueError('INTERIOR_INVALID')
            from pod_interior_preflight import inspect_interior, inspect_pairing
            inspect_pairing(spec,m['template'])
            inspect_interior(scoped_file(root,'interior.pdf'),spec)
            from pod_cover_preflight import inspect_cover
            preflight=inspect_cover(scoped_file(root,'cover.pdf'),image,m['dpi'])
        report['checks']['print_preflight']=bool(preflight)
        if m['platform']=='kdp':
            report['checks']['editorial']=False
            if editorial_envelope is None:
                raise ValueError('EDITORIAL_REVIEW_REQUIRED')
            editorial=verified(editorial_envelope,'POD_EDITORIAL_KEY','pod:editorial-review')
            report['checks']['editorial']=bool(editorial.get('verdict')=='PASS' and
                editorial.get('package_sha256')==actual and
                editorial.get('interior_sha256')==m['files']['interior.pdf'] and
                editorial.get('evaluator_id') in (approved_editorial_evaluators or []) and
                all(editorial.get('checks',{}).get(k) is True for k in EDITORIAL_CHECKS))
        # Descriptive similarity is optional; the independent signed review remains mandatory.
        report['openclip']={'status':'NOT_REQUESTED','scope':'descriptive_only_not_superiority'}
        if descriptive_similarity:
            report['openclip']={'status':'MEASURED','cosine_similarity':similarity(root/'print.png',reference),'scope':'descriptive_only_not_superiority'}
        comparative=verified(competitive_envelope,'POD_REVIEW_KEY','pod:competitive-review')
        # A reviewer/model service with independently calibrated criteria must attest the strict win.
        # Merely choosing a larger CLIP threshold cannot produce this attestation.
        report['checks']['competitive']=bool(comparative.get('package_sha256')==actual and
            comparative.get('reference_sha256')==report['reference_sha256'] and
            comparative.get('evaluator_id') in approved_evaluators and comparative.get('winner')=='candidate' and
            comparative.get('all_dimensions_noninferior') is True and comparative.get('swapped_order_consistent') is True and
            type(comparative.get('weighted_margin')) in (int,float) and
            math.isfinite(comparative['weighted_margin']) and comparative['weighted_margin']>=.5)
        # Slow PDF/model work must not extend the rights approval checked earlier.
        verified(rights_envelope,'POD_RIGHTS_KEY','pod:package-rights')
        verified(competitive_envelope,'POD_REVIEW_KEY','pod:competitive-review')
        report['evidence_expires_at_ms']=min(rights['expires_at_ms'],comparative['expires_at_ms'])
        if m['platform']=='kdp':
            verified(editorial_envelope,'POD_EDITORIAL_KEY','pod:editorial-review')
            report['evidence_expires_at_ms']=min(report['evidence_expires_at_ms'],editorial['expires_at_ms'])
    except Exception as exc:
        report['errors'].append(str(exc) if isinstance(exc,ValueError) else type(exc).__name__)
    required=('text','geometry','resolution','rights','competitive','print_preflight')
    if report.get('platform')=='kdp':
        required+=('editorial',)
    ok=not report['errors'] and all(report['checks'].get(k) is True for k in required)
    report.update({'verdict':'PASS' if ok else 'FAIL','binary_pass':int(ok),'production_ready':ok})
    return report

def qa_receipt(report, now):
    """A PASS receipt cannot outlive either approval from which it was derived."""
    expires=now+900000
    if report.get('binary_pass')==1:
        deadline=report.get('evidence_expires_at_ms')
        if type(deadline) is not int or deadline<=now:
            report.update({'verdict':'FAIL','binary_pass':0,'production_ready':False})
            report.setdefault('errors',[]).append('EVIDENCE_EXPIRED')
        else:
            expires=min(expires,deadline)
    return {**report,'audience':'content-control:pod:qa','issued_at_ms':now,'expires_at_ms':expires}

def main():
    p=argparse.ArgumentParser()
    for name in ('package-dir','reference','rights','competitive-review','output'):
        p.add_argument('--'+name,required=True)
    p.add_argument('--approved-evaluator',action='append',default=[])
    p.add_argument('--signed-output')
    p.add_argument('--descriptive-similarity',action='store_true')
    p.add_argument('--editorial-review')
    p.add_argument('--approved-editorial-evaluator',action='append',default=[])
    a=p.parse_args()
    try:
        report=evaluate(a.package_dir,a.reference,read_json(a.rights),read_json(a.competitive_review),a.approved_evaluator,a.descriptive_similarity,
                        read_json(a.editorial_review) if a.editorial_review else None,a.approved_editorial_evaluator)
    except Exception as exc:
        report={'schema_version':1,'verdict':'FAIL','binary_pass':0,'production_ready':False,'publication_enabled':False,'errors':[type(exc).__name__]}
    save_json(a.output,report)
    if a.signed_output:
        now=int(time.time()*1000)
        receipt=qa_receipt(report,now)
        # Receipt construction can downgrade a result that expired after evaluation.
        save_json(a.output,report)
        try:
            save_json(a.signed_output,sign(receipt,'POD_QA_KEY'))
        except Exception:
            report.update({'verdict':'FAIL','binary_pass':0,'production_ready':False})
            report.setdefault('errors',[]).append('QA_SIGNING_FAILED')
            save_json(a.output,report)
    print(canonical(report))
    return 0 if report['binary_pass']==1 else 2

if __name__=='__main__':
    sys.exit(main())
