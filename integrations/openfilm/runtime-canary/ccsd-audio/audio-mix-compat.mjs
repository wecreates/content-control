// Owned compatibility transform for the pinned OpenFilm full-timeline mixer.
// Pure: does not run upstream, access files, or enable an integration.
import assert from 'node:assert/strict';

export function normalizeAudioPadding(graph,duration){
 assert.ok(Number.isFinite(duration)&&duration>0&&duration<=30,'Bounded timeline required');
 assert.ok(graph&&Array.isArray(graph.inputs)&&graph.inputs.every(v=>typeof v==='string'),
  'Invalid mixer inputs');
 assert.equal(typeof graph.filter,'string','Invalid mixer filter');
 const suffix=`apad=whole_dur=${duration},atrim=0:${duration}[out]`;
 assert.ok(graph.filter.endsWith(suffix)&&graph.filter.split(suffix).length===2,
  'Pinned mixer graph changed');
 assert.ok(!graph.filter.includes('asetpts=N/SR/TB'),'Mixer already normalized');
 return {inputs:[...graph.inputs],filter:graph.filter.slice(0,-suffix.length)+
  `asetpts=N/SR/TB,${suffix}`};
}
