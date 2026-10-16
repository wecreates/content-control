"""Bind a rendered interior to a cover package before independent review."""
import argparse
import sys
import hashlib
from pathlib import Path
from pod_common import canonical, digest, read_json, save_json, scoped_file, verified
from pod_book_interior import render_book


def assemble(root, spec, pages, font):
    root = Path(root)
    manifest = read_json(root/'manifest.json')
    previous = manifest.pop('package_sha256')
    if hashlib.sha256(canonical(manifest).encode()).hexdigest() != previous:
        raise ValueError('MANIFEST_HASH_MISMATCH')
    for name, sha in manifest['files'].items():
        if digest(scoped_file(root, name)) != sha:
            raise ValueError('FILE_HASH_MISMATCH')
    cover = manifest['template']
    if manifest['platform'] != 'kdp' or spec['platform'] != 'kdp':
        raise ValueError('PLATFORM_BLOCKED')
    kdp = cover['kdp']
    if (spec['page_count'] != kdp['page_count'] or
        abs(spec['trim_inches'][0]-kdp['trim_width_inches']) > 1e-6 or
        abs(spec['trim_inches'][1]+2*kdp['bleed_inches']-cover['size_inches'][1]) > 1e-6):
        raise ValueError('COVER_INTERIOR_MISMATCH')
    receipt = render_book(spec, pages, font, root/'interior.pdf')
    save_json(root/'interior.receipt.json', receipt)
    manifest['interior'] = {'template': spec, 'receipt': receipt}
    for name in ('interior.pdf', 'interior.receipt.json'):
        manifest['files'][name] = digest(root/name)
    manifest['package_sha256'] = hashlib.sha256(canonical(manifest).encode()).hexdigest()
    save_json(root/'manifest.json', manifest)
    return manifest


def main():
    parser = argparse.ArgumentParser()
    for name in ('package-dir', 'template', 'pages', 'font'):
        parser.add_argument('--'+name, required=True)
    args = parser.parse_args()
    try:
        template_envelope = read_json(args.template)
        spec = verified(template_envelope, 'POD_TEMPLATE_KEY', 'pod:interior-template')['template']
        result = assemble(args.package_dir, spec, read_json(args.pages), args.font)
        verified(template_envelope, 'POD_TEMPLATE_KEY', 'pod:interior-template')
        print(canonical(result))
        return 0
    except Exception as exc:
        print(canonical({'status':'BLOCKED','reason_code':str(exc) if isinstance(exc,ValueError) else type(exc).__name__,'publication_enabled':False}))
        return 2


if __name__ == '__main__':
    sys.exit(main())
