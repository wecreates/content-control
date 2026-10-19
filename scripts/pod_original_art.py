"""Original deterministic geometric artwork. No competitor pixels or external APIs."""
import argparse
import hashlib
import math
import os
from pathlib import Path
import random
import tempfile
from PIL import Image, ImageDraw
from pod_common import canonical, digest, read_json, save_json

def create_art(spec, output):
    width, height = spec['size_px']
    if any(type(v) is not int or not 300 <= v <= 10000 for v in (width, height)) or width*height > 40_000_000:
        raise ValueError('ART_DIMENSIONS_INVALID')
    seed = spec['concept_id']
    if not isinstance(seed, str) or not 1 <= len(seed) <= 200:
        raise ValueError('CONCEPT_REQUIRED')
    palette = spec['palette']
    if not 2 <= len(palette) <= 8 or any(len(c) != 4 or any(type(v) is not int or not 0 <= v <= 255 for v in c) for c in palette):
        raise ValueError('PALETTE_INVALID')
    rng = random.Random(hashlib.sha256(seed.encode()).digest())
    img = Image.new('RGBA', (width, height), (0,0,0,0))
    draw = ImageDraw.Draw(img)
    count = spec.get('motifs', 7)
    if type(count) is not int or not 1 <= count <= 30:
        raise ValueError('MOTIF_COUNT_INVALID')
    for i in range(count):
        angle = 2*math.pi*i/count
        radius = min(width,height)*rng.uniform(.06,.12)
        cx = width/2 + math.cos(angle)*width*.25
        cy = height/2 + math.sin(angle)*height*.25
        points = [(cx+math.cos(angle+j*math.pi/3)*radius, cy+math.sin(angle+j*math.pi/3)*radius) for j in range(6)]
        draw.polygon(points, fill=tuple(palette[i % len(palette)]))
    target = Path(output)
    if target.exists():
        raise ValueError('OUTPUT_EXISTS')
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        # Encode privately before exposing a complete output. Linking is an
        # atomic no-replace operation, including against dangling symlinks and
        # files created after the optional early existence check.
        with tempfile.NamedTemporaryFile(dir=target.parent, prefix='.pod-art-',
                                         suffix=target.suffix, delete=False) as stream:
            temporary = Path(stream.name)
            img.save(stream, dpi=(300,300))
            stream.flush()
            os.fsync(stream.fileno())
        source_sha256 = digest(temporary)
        try:
            os.link(temporary, target)
        except FileExistsError:
            raise ValueError('OUTPUT_EXISTS') from None
        directory = os.open(target.parent, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        img.close()
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    return {'source_sha256':source_sha256,'generator':'procedural-geometric-v1','concept_id':seed,
            'spec_sha256':hashlib.sha256(canonical(spec).encode()).hexdigest(),'rights_status':'UNASSESSED','publication_enabled':False}

if __name__ == '__main__':
    p=argparse.ArgumentParser();p.add_argument('--spec',required=True);p.add_argument('--output',required=True);a=p.parse_args()
    receipt=create_art(read_json(a.spec),a.output)
    save_json(str(a.output)+'.provenance.json',receipt)
    print(canonical(receipt))
