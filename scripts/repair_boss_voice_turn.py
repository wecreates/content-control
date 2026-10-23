"""One bounded punctuation-only Dave take; preserve the original artifact."""
import copy, hashlib, json, shutil
from pathlib import Path
from timed_free_voice import prepare_timeline
from v2_free_voice import generate, local_synthesizer
from v2_audio_assemble import assemble
from free_transcription_qa import norm


def repair(source, retained, output, synth=None):
    retained, output = Path(retained), Path(output)
    if output.exists(): raise ValueError('Use a fresh repair directory')
    old=json.loads((retained/'timed-voice.json').read_text())
    timeline=prepare_timeline(source)
    oldturns=old['timeline']['scenes']; newturns=timeline['scenes']
    if len(oldturns)!=18 or len(newturns)!=18: raise ValueError('Expected eighteen original turns')
    for index,(before,after) in enumerate(zip(oldturns,newturns)):
        expected=copy.deepcopy(before)
        if index==7:
            line=expected['audio']['dialogue'][0]; revised=after['audio']['dialogue'][0]
            if line['speaker']!='dave' or line['text']!='So I just stop getting punched?' or revised['text']!='So, I just stop getting punched?':
                raise ValueError('Only approved punctuation-only Dave take is permitted')
            if norm(line['text'])!=norm(revised['text']): raise ValueError('Spoken words changed')
            line['text']=revised['text']
        if expected!=after: raise ValueError('Unrelated source or timing changed')
    if hashlib.sha256((retained/'voice.wav').read_bytes()).hexdigest()!=old['audio']['audio_sha256']:
        raise ValueError('Original audio hash mismatch')
    for clip in old['manifest']['clips']:
        relative=Path(clip['file'])
        if relative.is_absolute() or '..' in relative.parts or (retained/relative).is_symlink():
            raise ValueError('Unsafe original clip path')
        if hashlib.sha256((retained/clip['file']).read_bytes()).hexdigest()!=clip['audio_sha256']:
            raise ValueError('Original clip hash mismatch')
    shutil.copytree(retained,output)
    backend=synth or local_synthesizer()
    def one_natural_take(text, voice, speed):
        if speed!=1.0: raise ValueError('One natural-speed take only; no accelerated retry')
        return backend(text, voice, speed)
    new=generate({'publication_enabled':False,'scenes':[newturns[7]]},output/'clearer-dave-take',one_natural_take)
    clip=copy.deepcopy(new['clips'][0])
    if clip['speed']!=1.0: raise ValueError('Natural speed required; do not distort timing')
    clip['file']='clearer-dave-take/'+clip['file']
    result=copy.deepcopy(old);result['timeline']=timeline;result['manifest']['clips'][7]=clip
    assembly=copy.deepcopy(timeline)
    if assembly['scenes'][-1]['end']<timeline['source_duration_seconds']:
        assembly['scenes'].append({'id':'silent-tail','start':assembly['scenes'][-1]['end'],'end':timeline['source_duration_seconds'],'audio':{'dialogue':[]}})
    result['audio']=assemble(assembly,result['manifest'],output,output/'repaired-voice.wav')
    (output/'voice.wav').write_bytes((output/'repaired-voice.wav').read_bytes())
    result['repair_provenance']={'scope':'One punctuation-only natural-speed Dave take; requires independent ASR and listening',
        'original_audio_sha256':old['audio']['audio_sha256'],'original_clip':old['manifest']['clips'][7],
        'original_text':oldturns[7]['audio']['dialogue'][0]['text'],'new_text':newturns[7]['audio']['dialogue'][0]['text']}
    (output/'timed-voice.json').write_text(json.dumps(result,indent=2)+'\n')
    return result

if __name__=='__main__':
    import argparse
    p=argparse.ArgumentParser();p.add_argument('--ccsd',required=True);p.add_argument('--retained',required=True);p.add_argument('--out',required=True);a=p.parse_args()
    r=repair(json.loads(Path(a.ccsd).read_text()),a.retained,a.out)
    print(json.dumps({'status':r['status'],'publication_enabled':False,'production_approved':False,'replacement_speed':r['manifest']['clips'][7]['speed']}))
