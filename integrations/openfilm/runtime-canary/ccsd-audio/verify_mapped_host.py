from pathlib import Path
import array,json,subprocess,sys,math,hashlib
media=Path(sys.argv[1]); output=Path(sys.argv[2])
def run(tool,args):return subprocess.run([tool,*args],capture_output=True,check=True,timeout=30).stdout
probe=json.loads(run('ffprobe',['-v','error','-count_frames','-show_streams','-of','json',str(media)]))
v=next(s for s in probe['streams'] if s['codec_type']=='video');a=next(s for s in probe['streams'] if s['codec_type']=='audio')
assert v['nb_read_frames']=='96' and float(v['duration'])==4 and float(a['duration'])==4
frames=json.loads(run('ffprobe',['-v','error','-select_streams','v:0','-show_frames','-show_entries','frame=best_effort_timestamp_time','-of','json',str(media)]))['frames']
assert len(frames)==96 and abs(float(frames[-1]['best_effort_timestamp_time'])-95/24)<1e-6
pcm=array.array('f');pcm.frombytes(run('ffmpeg',['-v','error','-i',str(media),'-vn','-ac','1','-ar','48000','-f','f32le','-']))
assert len(pcm)>=192000
def rms(lo,hi):
    chunk=pcm[round(lo*48000):round(hi*48000)]
    return math.sqrt(sum(x*x for x in chunk)/len(chunk))
levels=[rms(t+.05,t+.2) for t in [.25,1.25,2.25,3.25]]
assert min(levels)>.02 and abs(levels[1]/levels[0]-.5)<.01
assert rms(3.55,4)<.0001
report={'passed':True,'host_verified':True,'video_duration':4,'audio_duration':4,'decoded_frames':96,
 'final_frame_timestamp':float(frames[-1]['best_effort_timestamp_time']),'cue_rms':levels,
 'half_gain_ratio':levels[1]/levels[0],'tail_rms':rms(3.55,4),
 'sha256':hashlib.sha256(media.read_bytes()).hexdigest(),'creative_acceptance':False}
output.write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
