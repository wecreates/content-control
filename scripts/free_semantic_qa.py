#!/usr/bin/env python3
"""Free CPU visual analysis. Execution success is never artistic approval."""
import argparse
import gc
import hashlib
import importlib.metadata
import json
import os
import subprocess
from pathlib import Path


def sha256(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def sample(paths, limit):
    if len(paths) <= limit:
        return paths
    return [paths[round(i * (len(paths) - 1) / (limit - 1))] for i in range(limit)]


def extract_candidate(video, directory):
    directory = Path(directory)
    if directory.exists() and any(directory.iterdir()):
        raise ValueError('candidate extraction directory must be empty')
    directory.mkdir(parents=True, exist_ok=True)
    subprocess.run(['ffmpeg', '-nostdin', '-hide_banner', '-loglevel', 'error',
                    '-i', str(Path(video).resolve()), '-vf', 'fps=1/3', '-q:v', '2',
                    str(directory / 'cand-%06d.jpg')], check=True, timeout=300)
    return {'engine': 'ffmpeg', 'filter': 'fps=1/3', 'sequence_start': 1,
            'sample_interval_seconds': 3, 'derived_from_candidate_video': True}


def manifest(paths):
    return [{'file': p.name, 'sha256': sha256(p)} for p in paths]


def analyze(reference_dir, candidate_dir, candidate_video=None, batch_size=2, max_frames=32, analysis_only=False):
    refs = sorted(Path(reference_dir).glob('ref-*.jpg'))
    cands = sorted(Path(candidate_dir).glob('cand-*.jpg'))
    report = {
        'schema_version': 2, 'engine': 'openclip-florence-free-qa-v2',
        'analysis_status': 'INCOMPLETE', 'verdict': 'ANALYSIS_INCOMPLETE',
        'artistic_acceptance': 'UNASSESSED', 'production_ready': False,
        'publication_enabled': False,
        'limitations': ['Embedding similarity is descriptive, not calibrated artistic parity.',
                       'Sampled frames do not establish timing, animation quality, or full-video parity.',
                       'Captions may omit details or hallucinate; they are not visual approval.'],
        'provenance': {'source_revision': os.environ.get('GITHUB_SHA'),
                       'run_id': os.environ.get('GITHUB_RUN_ID'),
                       'reference_frames': manifest(refs), 'candidate_frames': manifest(cands)},
        'openclip_model': 'ViT-B-32/laion2b_s34b_b79k',
        'florence_model': 'florence-community/Florence-2-base',
        'errors': [],
    }
    try:
        if candidate_video:
            report['provenance']['candidate_video'] = {'file': str(candidate_video), 'sha256': sha256(candidate_video)}
        if not 1 <= batch_size <= 8 or not 8 <= max_frames <= 64:
            raise ValueError('batch size must be 1..8 and max frames 8..64')
        if len(refs) < 10 or len(cands) < 8:
            raise ValueError('insufficient semantic QA frames: require 10 reference and 8 candidate')
        refs, cands = sample(refs, max_frames), sample(cands, max_frames)
        report['sampled_frames'] = {'reference': [p.name for p in refs], 'candidate': [p.name for p in cands]}
        report['runtime_versions'] = {name: importlib.metadata.version(name) for name in ('torch', 'torchvision', 'open_clip_torch', 'transformers', 'Pillow')}
        import torch
        import open_clip
        from PIL import Image
        torch.set_num_threads(min(4, os.cpu_count() or 1))
        model, _, preprocess = open_clip.create_model_and_transforms(
            'ViT-B-32', pretrained='laion2b_s34b_b79k', device='cpu')
        model.eval()

        def encode(paths):
            encoded = []
            for start in range(0, len(paths), batch_size):
                tensors = []
                for path in paths[start:start + batch_size]:
                    with Image.open(path) as image:
                        tensors.append(preprocess(image.convert('RGB')))
                with torch.inference_mode():
                    z = model.encode_image(torch.stack(tensors))
                    z = z / z.norm(dim=-1, keepdim=True).clamp_min(1e-12)
                encoded.append(z.cpu())
            return torch.cat(encoded)

        re, ce = encode(refs), encode(cands)
        sims = ce @ re.T
        best, indices = sims.max(dim=1)
        ref_centroid, cand_centroid = re.mean(0), ce.mean(0)
        global_similarity = float(torch.nn.functional.cosine_similarity(
            ref_centroid[None], cand_centroid[None]).item())
        if not torch.isfinite(sims).all() or not torch.isfinite(best).all():
            raise ValueError('non-finite model output')
        report.update({
            'mean_best_frame_similarity': float(best.mean()),
            'global_similarity': global_similarity,
            'best_reference_similarity_by_candidate': best.tolist(),
            'frame_matches': [{'candidate': p.name, 'reference': refs[int(indices[i])].name,
                               'cosine_similarity': float(best[i])} for i, p in enumerate(cands)],
            'openclip_status': 'COMPLETE',
        })
        # Release the first model before loading the captioner on small CPU runners.
        del model, re, ce, sims, best, indices
        gc.collect()
        from transformers import AutoProcessor, Florence2ForConditionalGeneration
        mid = report['florence_model']
        processor = AutoProcessor.from_pretrained(mid)
        fm = Florence2ForConditionalGeneration.from_pretrained(mid).to('cpu')
        fm.eval()
        captions = {'reference': [], 'candidate': []}
        for group, paths in [('reference', refs), ('candidate', cands)]:
            for path in sample(paths, 3):
                with Image.open(path) as source:
                    image = source.convert('RGB')
                prompt = '<MORE_DETAILED_CAPTION>'
                inp = processor(text=prompt, images=image, return_tensors='pt')
                with torch.inference_mode():
                    out = fm.generate(**inp, max_new_tokens=96, num_beams=1, do_sample=False)
                raw = processor.batch_decode(out, skip_special_tokens=False)[0]
                parsed = processor.post_process_generation(raw, task=prompt, image_size=image.size)
                caption = str(parsed.get(prompt, '')).strip()
                if not caption:
                    raise ValueError('caption model returned an empty caption')
                captions[group].append({'file': path.name, 'caption': caption})
        report['florence'] = {'status': 'COMPLETE', 'captions': captions}
        report['analysis_status'] = 'COMPLETE'
        report['checks'] = {'openclip_mean_best_similarity': report['mean_best_frame_similarity'] >= 0.20,
                            'openclip_global_similarity': global_similarity >= 0.18, 'florence_completed': True}
        report['checks_scope'] = 'Legacy heuristic screening only; not artistic parity or production approval'
        report['verdict'] = 'ANALYSIS_COMPLETE' if analysis_only else ('PASS' if all(report['checks'].values()) else 'FAIL')
    except Exception as exc:
        report['errors'].append(f'{type(exc).__name__}: {exc}')
    return report


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--reference-dir', required=True)
    ap.add_argument('--candidate-dir', required=True)
    ap.add_argument('--candidate-video')
    ap.add_argument('--extract-candidate', action='store_true', help='Derive candidate frames from the supplied video into a fresh empty directory')
    ap.add_argument('--output', required=True)
    ap.add_argument('--analysis-only', action='store_true', help='Exit successfully when measurement completes, regardless of similarity')
    ap.add_argument('--batch-size', type=int, default=2)
    ap.add_argument('--max-frames', type=int, default=32)
    a = ap.parse_args()
    extraction = None
    if a.extract_candidate:
        if not a.candidate_video:
            ap.error('--extract-candidate requires --candidate-video')
        extraction = extract_candidate(a.candidate_video, a.candidate_dir)
    report = analyze(a.reference_dir, a.candidate_dir, a.candidate_video, a.batch_size, a.max_frames, a.analysis_only)
    report['provenance']['candidate_extraction'] = extraction
    report['provenance']['candidate_frames_video_binding_verified'] = extraction is not None
    path = Path(a.output)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, indent=2, sort_keys=True, allow_nan=False) + '\n')
    print(json.dumps({'analysis_status': report['analysis_status'], 'artistic_acceptance': report['artistic_acceptance'], 'output': str(path), 'errors': report['errors']}))
    return 0 if report['analysis_status'] == 'COMPLETE' and (a.analysis_only or report['verdict'] == 'PASS') else 3


if __name__ == '__main__':
    raise SystemExit(main())
