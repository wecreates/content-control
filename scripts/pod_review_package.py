"""Produce a local review package; never authorize a marketplace release."""
import argparse
import hashlib
from pathlib import Path
from pod_common import canonical, digest, read_json, save_json, PLATFORMS
from pod_output_attempt import output_attempt
from pod_original_art import create_art
from pod_asset_generator import generate
from pod_book_package import assemble



def prepare(spec, font, output):
    if spec.get('publication_enabled') is not False or spec.get('paid_generation_enabled') is not False:
        raise ValueError('REVIEW_ONLY_REQUIRED')
    platform=spec.get('platform')
    if platform not in PLATFORMS or spec['cover_template'].get('platform')!=platform:
        raise ValueError('PLATFORM_BLOCKED')
    metadata=spec.get('metadata',{})
    allowed={'title','description','author','language','keywords','ai_generated'}
    if set(metadata)-allowed or any(not isinstance(metadata.get(k),str) or not metadata[k].strip()
                                    for k in ('title','description','language')):
        raise ValueError('METADATA_REQUIRED')
    if (not isinstance(metadata.get('keywords'),list) or len(metadata['keywords'])>7 or
        any(not isinstance(k,str) or not k.strip() for k in metadata['keywords'])):
        raise ValueError('KEYWORDS_INVALID')
    if (not isinstance(metadata.get('ai_generated'),dict) or
        set(metadata['ai_generated'])!={'text','images','translations'} or
        any(type(v) is not bool for v in metadata['ai_generated'].values())):
        raise ValueError('AI_PROVENANCE_REQUIRED')
    if platform=='kdp' and (not metadata.get('author') or 'interior' not in spec):
        raise ValueError('BOOK_CONTENT_REQUIRED')
    research=spec.get('market_research',[])
    if not isinstance(research,list) or any(not isinstance(r,dict) or
        not isinstance(r.get('source_url'),str) or not r['source_url'].startswith('https://') or
        not isinstance(r.get('observation'),str) or not r['observation'].strip() for r in research):
        raise ValueError('RESEARCH_INVALID')
    output=Path(output)
    with output_attempt(output):
        provenance=create_art(spec['original_art'],output/'source.png')
        layers=[]
        for layer in spec.get('text_layers',[]):
            if 'font_path' in layer or 'font_sha256' in layer:
                raise ValueError('FONT_IS_WORKER_OWNED')
            layers.append({**layer,'font_path':str(font),'font_sha256':digest(font)})
        manifest=generate(output/'source.png',spec['cover_template'],layers,output/'package')
        if platform=='kdp':
            interior=spec['interior']
            template={**interior['template'],'font_sha256':digest(font)}
            manifest=assemble(output/'package',template,interior['pages'],font)
        # Supplied metadata is preserved exactly, never expanded into invented claims.
        save_json(output/'package/metadata.json',metadata)
        save_json(output/'package/research.json',{'observations':research,'verification_status':'UNASSESSED'})
        save_json(output/'package/provenance.json',provenance)
        manifest.pop('package_sha256')
        for name in ('metadata.json','research.json','provenance.json'):
            manifest['files'][name]=digest(output/'package'/name)
        manifest['package_sha256']=hashlib.sha256(canonical(manifest).encode()).hexdigest()
        save_json(output/'package/manifest.json',manifest)
        result={'schema_version':1,'status':'REVIEW_REQUIRED','package_sha256':manifest['package_sha256'],
            'platform':platform,'publication_enabled':False,'production_ready':False,
            'paid_generation_enabled':False,'marketplace_ready':False,
            'remaining_checks':['official_template','rights','editorial','independent_visual_review',
                                'marketplace_account','platform_preview','release_approval']}
        save_json(output/'result.json',result)
        return result


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    for name in ('input','font','output'):
        parser.add_argument('--'+name,required=True)
    args=parser.parse_args()
    print(canonical(prepare(read_json(args.input),args.font,args.output)))
