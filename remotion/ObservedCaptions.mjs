// Display holds may bridge tiny word gaps; no future word is ever revealed.
export function captionAtTime(track,time) {
 if(track?.status!=='PASS'||track.publication_enabled!==false||!Array.isArray(track.cues)||!Number.isFinite(time))return null;
 for(let i=track.cues.length-1;i>=0;i--){const cue=track.cues[i];if(!Number.isFinite(cue.start)||!Number.isFinite(cue.end)||cue.start>=cue.end)continue;if(cue.start<=time){const until=Math.min(cue.end+.12,track.cues[i+1]?.start??Infinity);return time<until&&typeof cue.text==='string'?cue:null;}}
 return null;
}
