// Observed source: independent base.en narration decode, 2026-11-20.
// Changes to the narration require a new alignment, not a silent timeline reuse.
export const narrationSha256 = '77ae2168527509c49a02ab08d9e54f8c04fd5774309bba82e8eefa88974074fb';
export const pictureTimeline = Object.freeze([
  {start: 0, scene: 0, beat: 'fee'},
  {start: 1.8, scene: 1, beat: 'again'},
  {start: 3.76, scene: 2, beat: 'credit-purchase'},
  {start: 7.12, scene: 3, beat: 'catch'},
  {start: 8.12, scene: 4, beat: 'math-intro'},
  {start: 9.6, scene: 6, beat: 'arithmetic'},
  {start: 12.02, scene: 5, beat: 'monk'},
  {start: 14.38, scene: 7, beat: 'wallet'},
  {start: 15.3, scene: 8, beat: 'compare-value'},
  {start: 18.2, scene: 9, beat: 'value-wins'},
  {start: 21.24, scene: 10, beat: 'fee-wins'},
  {start: 24.2, scene: 11, beat: 'closing-rule'},
].map(Object.freeze));

export function pictureSceneAtFrame(frame, fps = 24) {
  if (!Number.isFinite(frame) || frame < 0 || !Number.isFinite(fps) || fps <= 0) {
    throw new Error('Nonnegative frame and positive FPS required');
  }
  let index = 0;
  for (let i = 1; i < pictureTimeline.length; i++) {
    if (frame >= Math.ceil(pictureTimeline[i].start * fps)) index = i;
  }
  const current = pictureTimeline[index];
  const startFrame = Math.ceil(current.start * fps);
  const endFrame = Math.ceil((pictureTimeline[index + 1]?.start ?? 30) * fps);
  return {scene: current.scene, beat: current.beat,
    progress: Math.max(0, Math.min(1, (frame - startFrame) / (endFrame - startFrame)))};
}
