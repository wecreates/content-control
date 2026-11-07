"""Replace Long visuals while retaining the exact verified encoded audio stream."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
from render_long_storyboard_previews import SOURCE_SHA, CAPTION_SHA, sha

def packet_hashes(path):
    data=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','a:0','-show_packets','-show_data_hash','sha256','-show_entries','packet=data_hash','-of','json',str(path)],timeout=60))
    packets=[packet['data_hash'] for packet in data['packets']]
    if not packets:raise RuntimeError('No actual encoded audio packets')
    return packets

def main():
    retained, output=Path('retained'),Path('long-visual-candidate')
    source=retained/'candidate.mp4'
    assert sha(source)==SOURCE_SHA
    assert sha(retained/'captions.json')==CAPTION_SHA
    ccsd_path=Path('projects/long/credit-card-dlc/ccsd.json')
    assert sha(retained/'ccsd.json')==sha(ccsd_path)
    ccsd=json.loads(ccsd_path.read_text())
    assert ccsd.get('publication_enabled') is False
    voice_turns=sum(len(scene.get('audio',{}).get('dialogue',[])) for scene in ccsd['scenes'])
    assert voice_turns==95, 'Original voice turn count changed'
    output.mkdir(exist_ok=False)
    ccsd['caption_track']=json.loads((retained/'captions.json').read_text())
    props=output/'props.json';props.write_text(json.dumps({'ccsd':ccsd}))
    subprocess.run(['node','scripts/verify_caption_frames.mjs','--ccsd',str(ccsd_path),'--captions',str(retained/'captions.json'),'--out',str(output/'caption-frames.json')],check=True,timeout=60)
    silent,candidate=output/'silent.mp4',output/'candidate.mp4'
    subprocess.run(['node_modules/.bin/remotion','render','remotion/studio-animatic-index.jsx','StudioLong',str(silent),'--props='+str(props),'--concurrency=2','--pixel-format=yuv420p','--color-space=bt709'],check=True,timeout=900)
    subprocess.run(['ffmpeg','-v','error','-i',str(silent),'-i',str(source),'-map','0:v:0','-map','1:a:0','-c','copy',str(candidate)],check=True,timeout=90)
    before,after=packet_hashes(source),packet_hashes(candidate)
    assert before==after,'Encoded audio packets changed'
    qa_path=output/'media-qa.json'
    qa_run=subprocess.run(['python','scripts/production_reality_media_qa.py','--video',str(candidate),'--ccsd',str(ccsd_path),'--out',str(qa_path)],timeout=240)
    qa=json.loads(qa_path.read_text())
    assert qa['candidate_sha256']==sha(candidate)
    receipt={'status':'REVIEW_CANDIDATE' if qa_run.returncode==0 and qa['status']=='PASS' else 'BLOCKED_MEDIA_QA','publication_enabled':False,'production_approved':False,'creative_review':'PENDING','listening_review':'PENDING','source_commit':os.environ.get('GITHUB_SHA'),'source_candidate_sha256':SOURCE_SHA,'source_captions_sha256':CAPTION_SHA,'source_ccsd_sha256':sha(ccsd_path),'candidate_sha256':sha(candidate),'voice_turns':voice_turns,'encoded_audio_unchanged':True,'encoded_audio_packet_count':len(before),'encoded_audio_packet_hashes_sha256':hashlib.sha256('\n'.join(before).encode()).hexdigest(),'media_qa':qa}
    (output/'review-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
    print(json.dumps({k:v for k,v in receipt.items() if k!='media_qa'}),flush=True)
    assert receipt['status']=='REVIEW_CANDIDATE','Full candidate did not pass actual media QA'

if __name__=='__main__':main()
