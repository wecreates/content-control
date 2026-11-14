"""Preview-only profiling observer. Does not replace model methods or decoder options."""
import argparse
import hashlib
import importlib.metadata
import json
import math
import os
from pathlib import Path
import platform
import re
import runpy
import stat
import sys

MODEL_FILES = {'model.bin', 'config.json', 'tokenizer.json', 'vocabulary.json', 'preprocessor_config.json'}
DEPENDENCIES = ['faster-whisper', 'ctranslate2', 'numpy', 'av', 'tokenizers', 'onnxruntime', 'huggingface-hub']
THREAD_ENV = ['OMP_NUM_THREADS', 'OPENBLAS_NUM_THREADS', 'MKL_NUM_THREADS']
SEGMENT_FIELDS = {'temperature': (0, 2),
                  'avg_logprob': (-100, 0), 'no_speech_prob': (0, 1), 'compression_ratio': (0, 100)}


def digest(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def number(value, low, high):
    return type(value) in {int, float} and low <= value <= high and math.isfinite(value)


def hex_hash(value, length=64):
    return isinstance(value, str) and re.fullmatch('[0-9a-f]{'+str(length)+'}', value) is not None


def choice(value, values):
    return isinstance(value, str) and value in values

def public_summary(raw):
    """Complete output allowlist; never serialize arbitrary values, paths or exceptions."""
    if not isinstance(raw, dict):
        return {'status': 'INVALID_OBSERVER_RECEIPT'}
    out = {'status': raw.get('status') if choice(raw.get('status'), {'OBSERVED', 'PARTIAL', 'NO_MODEL_OBSERVATIONS'}) else 'INVALID_STATUS',
           'decoder_options_changed': False, 'instrumentation': 'python_profile_events'}
    for key in ['observer_sha256', 'producer_sha256']:
        if hex_hash(raw.get(key)): out[key] = raw[key]
    if hex_hash(raw.get('model_revision'), 40): out['model_revision'] = raw['model_revision']
    versions = raw.get('versions', {})
    if isinstance(versions, dict):
        out['versions'] = {k: v for k, v in versions.items() if k in DEPENDENCIES+['python'] and isinstance(v, str)
                           and re.fullmatch(r'[0-9][0-9A-Za-z.+_-]{0,63}', v)}
    model = raw.get('model_files', {})
    if isinstance(model, dict):
        out['model_files'] = {k: v for k, v in model.items() if k in MODEL_FILES and hex_hash(v)}
    cpu = raw.get('cpu', {})
    if isinstance(cpu, dict):
        out['cpu'] = {k: v for k, v in cpu.items() if k in {'family', 'model', 'stepping', 'logical_cpu_count', 'process_threads_at_model_init'} and type(v) is int and 0 <= v <= 65536}
        if choice(cpu.get('architecture'), {'x86_64', 'aarch64'}): out['cpu']['architecture'] = cpu['architecture']
        if choice(cpu.get('vendor'), {'GenuineIntel', 'AuthenticAMD', 'ARM'}): out['cpu']['vendor'] = cpu['vendor']
        flags = cpu.get('features', {})
        if isinstance(flags, dict):out['cpu']['features'] = {k:v for k,v in flags.items() if k in {'avx', 'avx2', 'avx512f', 'fma', 'sse4_2'} and type(v) is bool}
    threads = raw.get('thread_environment', {})
    if isinstance(threads, dict):out['thread_environment'] = {k:v for k,v in threads.items() if k in THREAD_ENV and type(v) is int and 1 <= v <= 65536}
    backend = raw.get('backend', {})
    if isinstance(backend, dict):
        out['backend'] = {}
        for key in ['device', 'effective_device']:
            if choice(backend.get(key), {'cpu', 'cuda', 'auto'}):out['backend'][key] = backend[key]
        for key in ['compute_type', 'effective_compute_type']:
            if choice(backend.get(key), {'int8', 'int8_float32', 'int8_float16', 'float32', 'float16', 'default', 'auto'}):out['backend'][key] = backend[key]
        for key in ['cpu_threads_argument', 'num_workers_argument']:
            if type(backend.get(key)) is int and 0 <= backend[key] <= 65536:out['backend'][key] = backend[key]
    samples = raw.get('decoded_samples', {})
    if isinstance(samples, dict):
        out['decoded_samples'] = {}
        if hex_hash(samples.get('sha256')):out['decoded_samples']['sha256'] = samples['sha256']
        if choice(samples.get('dtype'), {'float32', '<f4', '>f4'}):out['decoded_samples']['dtype'] = samples['dtype']
        if type(samples.get('sample_count')) is int and 0 < samples['sample_count'] <= 20_000_000:out['decoded_samples']['sample_count'] = samples['sample_count']
    options = raw.get('resolved_options', {})
    if isinstance(options, dict):
        out['resolved_options'] = {}
        for key in ['beam_size', 'best_of']:
            if type(options.get(key)) is int and 1 <= options[key] <= 100:out['resolved_options'][key] = options[key]
        for key in ['word_timestamps', 'vad_filter', 'condition_on_previous_text', 'full_audio_clip']:
            if type(options.get(key)) is bool:out['resolved_options'][key] = options[key]
        values = options.get('temperature')
        if isinstance(values, (tuple,list)) and len(values) <= 16 and all(number(x,0,2) for x in values):out['resolved_options']['temperature'] = list(values)
        if hex_hash(options.get('suppress_tokens_sha256')):out['resolved_options']['suppress_tokens_sha256'] = options['suppress_tokens_sha256']
    segments = raw.get('segment_scalars', [])
    if isinstance(segments, list):out['segment_scalars'] = [{k:round(v,6) for k,v in item.items() if k in SEGMENT_FIELDS and number(v,*SEGMENT_FIELDS[k])} for item in segments[:64] if isinstance(item,dict)]
    for key in ['observed_segment_count', 'observer_errors']:
        if type(raw.get(key)) is int and 0 <= raw[key] <= 10000:out[key] = raw[key]
    if type(raw.get('segment_list_truncated')) is bool:out['segment_list_truncated'] = raw['segment_list_truncated']
    out['segment_scalar_basis'] = 'generator_yields_before_VAD_timestamp_restoration_no_alignment_claim'
    out['model_hash_scope'] = 'observed_files_after_initialization_not_loaded_weights_attestation'
    out['available'] = {'model_revision': 'model_revision' in out, 'model_file_hashes': bool(out.get('model_files')),
                        'decoded_sample_hash': bool(out.get('decoded_samples', {}).get('sha256')),
                        'segment_scalars': bool(out.get('segment_scalars')),
                        'effective_backend': bool(out.get('backend', {}).get('effective_compute_type'))}
    return out


def host_metadata():
    result = {'versions': {'python': platform.python_version()}, 'cpu': {'architecture': platform.machine()}, 'thread_environment': {}}
    count = os.cpu_count()
    if type(count) is int and count > 0:result['cpu']['logical_cpu_count'] = count
    for package in DEPENDENCIES:
        try:result['versions'][package] = importlib.metadata.version(package)
        except importlib.metadata.PackageNotFoundError:pass
    for key in THREAD_ENV:
        value = os.environ.get(key, '')
        if re.fullmatch('[0-9]{1,5}', value):result['thread_environment'][key] = int(value)
    try:
        with Path('/proc/cpuinfo').open() as stream:
            lines = stream.read(32768).split('\n\n')[0].splitlines()
        cpu = dict(line.split(':',1) for line in lines if ':' in line)
        cpu = {k.strip():v.strip() for k,v in cpu.items()}
        result['cpu']['vendor'] = cpu.get('vendor_id')
        for source,key in [('cpu family','family'),('model','model'),('stepping','stepping')]:
            if cpu.get(source,'').isdigit():result['cpu'][key] = int(cpu[source])
        if 'flags' in cpu:
            flags = set(cpu['flags'].split())
            result['cpu']['features'] = {flag:flag in flags for flag in ['avx','avx2','avx512f','fma','sse4_2']}
    except OSError:pass
    return result


class Observer:
    def __init__(self):
        self.report = dict(host_metadata(), status='NO_MODEL_OBSERVATIONS', model_files={}, segment_scalars=[], observed_segment_count=0, observer_errors=0)

    def profile(self, frame, event, arg):
        # Match exact supported Python code names; never mutate frame locals/arguments/results.
        if frame.f_globals.get('__name__') != 'faster_whisper.transcribe': return
        name = frame.f_code.co_qualname
        try:
            local = frame.f_locals
            if name == 'WhisperModel.__init__' and event == 'return':
                self.observe_model(local)
            elif name == 'WhisperModel.transcribe' and event == 'call':
                self.observe_input(local)
            elif name == 'WhisperModel.generate_segments' and event == 'return' and arg is not None:
                self.observe_segment(arg)
        except Exception:
            self.report['observer_errors'] = min(10000, self.report['observer_errors']+1)
            # No exception text is captured. Observation failure does not change producer control flow.

    def observe_model(self, local):
        model_path = Path(local['model_path'])
        if model_path.parent.name == 'snapshots' and hex_hash(model_path.name,40):self.report['model_revision'] = model_path.name
        for name in sorted(MODEL_FILES):
            path = model_path/name
            if path.is_file() and 0 < path.stat().st_size <= 512*1024*1024:
                self.report['model_files'][name] = digest(path)
        self.report['backend'] = {key:local.get(key) for key in ['device','compute_type']}
        self.report['backend'].update(cpu_threads_argument=local.get('cpu_threads'), num_workers_argument=local.get('num_workers'))
        model = getattr(local.get('self'), 'model', None)
        self.report['backend'].update(effective_device=getattr(model,'device',None), effective_compute_type=getattr(model,'compute_type',None))
        try:self.report['cpu']['process_threads_at_model_init'] = len(list(Path('/proc/self/task').iterdir()))
        except OSError:pass
        self.report['status'] = 'OBSERVED'

    def observe_input(self, local):
        samples = local['audio']
        # Actual array passed into unchanged transcribe, after producer decode. No decode is rerun.
        if getattr(samples,'ndim',None) == 1 and 0 < samples.size <= 20_000_000 and str(samples.dtype) in {'float32','<f4','>f4'}:
            self.report['decoded_samples'] = {'sha256':hashlib.sha256(samples.tobytes(order='C')).hexdigest(), 'dtype':str(samples.dtype), 'sample_count':int(samples.size)}
        options = {key:local.get(key) for key in ['beam_size','best_of','word_timestamps','vad_filter','condition_on_previous_text','temperature']}
        options['full_audio_clip'] = local.get('clip_timestamps') == '0'
        suppress = local.get('suppress_tokens')
        if isinstance(suppress,list) and len(suppress) <= 100000 and all(type(x) is int for x in suppress):
            options['suppress_tokens_sha256'] = hashlib.sha256(json.dumps(suppress,separators=(',',':')).encode()).hexdigest()
        self.report['resolved_options'] = options

    def observe_segment(self, segment):
        self.report['observed_segment_count'] = min(10000,self.report['observed_segment_count']+1)
        if len(self.report['segment_scalars']) < 64:
            self.report['segment_scalars'].append({key:value for key in SEGMENT_FIELDS if number(value:=getattr(segment,key,None),*SEGMENT_FIELDS[key])})
        else:self.report['segment_list_truncated'] = True


def observe_producer(producer, arguments, output):
    observer = Observer()
    observer.report.update(observer_sha256=digest(__file__), producer_sha256=digest(producer))
    previous_argv = sys.argv
    previous_profile = sys.getprofile()
    if previous_profile is not None:raise RuntimeError('Existing profiler prevents isolated observation')
    try:
        sys.argv = [str(producer), *arguments]
        sys.setprofile(observer.profile)
        runpy.run_path(str(producer), run_name='__main__')
    finally:
        sys.setprofile(previous_profile)
        sys.argv = previous_argv
        if observer.report['observer_errors']:observer.report['status'] = 'PARTIAL'
        try:
            Path(output).write_text(json.dumps(public_summary(observer.report),sort_keys=True)+'\n')
        except Exception:
            # Optional observation failure must never replace producer success/exception/SystemExit.
            # The parent reports a missing/invalid diagnostic, without inventing observations.
            pass


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--observer-output',required=True)
    parser.add_argument('producer_arguments',nargs=argparse.REMAINDER)
    args = parser.parse_args()
    arguments = args.producer_arguments
    if arguments[:1] == ['--']:arguments = arguments[1:]
    producer = Path('scripts/free_transcription_qa.py')
    if producer.resolve() != Path(__file__).with_name('free_transcription_qa.py').resolve():
        raise RuntimeError('Preview observer requires the repository working root')
    observe_producer(producer, arguments, args.observer_output)

if __name__ == '__main__':main()
