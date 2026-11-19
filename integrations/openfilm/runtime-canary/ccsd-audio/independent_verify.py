"""Host-side second verification using installed FFmpeg; no media leaves MSI."""
from pathlib import Path
import argparse, array, hashlib, json, math, subprocess
base=Path(__file__).resolve().parent
parser=argparse.ArgumentParser()
parser.add_argument('--candidate',type=Path,required=True)
parser.add_argument('--baseline',type=Path,required=True)
options=parser.parse_args()
candidate=options.candidate
baseline=options.baseline
tools=Path(r'C:\Users\19496\.claude-video-vision\bin')
def run(name,args):
    return subprocess.run([str(tools/name),*map(str,args)],capture_output=True,check=True,timeout=30).stdout
info=json.loads(run('ffprobe.exe',['-v','error','-show_streams','-show_format','-of','json',candidate]))
video=next(x for x in info['streams'] if x['codec_type']=='video')
audio=next(x for x in info['streams'] if x['codec_type']=='audio')
assert abs(float(video['duration'])-4)<1e-6
assert abs(float(audio['duration'])-4)<1/48000
assert video['nb_frames']=='96'
def frames(path):
    output=run('ffmpeg.exe',['-v','error','-i',path,'-map','0:v:0','-f','framemd5','-']).decode()
    return [s.strip() for s in output.splitlines() if s and not s.startswith('#')]
before,after=frames(baseline),frames(candidate)
assert len(before)==len(after)==96
assert before==after,'All decoded video frames, including final frame, must remain unchanged'
def pcm(path):
    result=array.array('f')
    result.frombytes(run('ffmpeg.exe',['-v','error','-i',path,'-vn','-ac','1','-ar','48000','-f','f32le','-']))
    return result
old,new=pcm(baseline),pcm(candidate)
assert len(new)>=192000
count=int(3.5*48000)
rmse=math.sqrt(sum((old[i]-new[i])**2 for i in range(count))/count)
assert rmse<.001,'Original audio content changed'
tail=new[int(3.55*48000):192000]
tail_rms=math.sqrt(sum(x*x for x in tail)/len(tail))
assert tail_rms<.0001,'Intended tail must be silent'
report={'passed':True,'verification':'independent host ffprobe/ffmpeg decode',
 'video_duration':float(video['duration']),'audio_duration':float(audio['duration']),
 'all_96_decoded_frames_identical_to_baseline':True,'final_frame_identical':True,
 'first_3_5_seconds_pcm_rmse':rmse,'tail_3_55_to_4_seconds_rms':tail_rms,
 'decoded_audio_samples':len(new),'sha256':hashlib.sha256(candidate.read_bytes()).hexdigest(),
 'publication_enabled':False,'full_motion_review':False,'full_audio_review':False}
(candidate.parent/'independent-verification.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
