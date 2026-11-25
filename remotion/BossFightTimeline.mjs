// Source scene times drive every visual beat; the table retains visual identities only.
export function bossFightBeats(ccsd, defaults) {
  if (!ccsd?.scenes) return defaults;
  if (!Array.isArray(ccsd.scenes) || ccsd.scenes.length !== defaults.length) throw new Error('Boss Fight requires every story beat');
  let previous = 0;
  return defaults.map((beat, index) => {
    const scene = ccsd.scenes[index];
    if (scene?.id !== beat.id || !Number.isFinite(scene.start) || !Number.isFinite(scene.end) ||
        Math.abs(scene.start - previous) > 1e-6 || scene.end <= scene.start || scene.end > 90) {
      throw new Error('Invalid Boss Fight source timeline');
    }
    previous = scene.end;
    return {...beat, start: scene.start, end: scene.end};
  });
}
