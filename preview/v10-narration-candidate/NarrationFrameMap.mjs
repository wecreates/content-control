// Review-only source mapping from observed narration cue starts at 24fps.
// Captions retain exact audio seconds; scene cuts quantize to nearest frame.
export const frameSpans = Object.freeze([
  [0, 43, 0], [43, 89, 60], [89, 194, 120], [194, 308, 360],
  [308, 465, 480], [465, 540, 540], [540, 612, 600], [612, 660, 660],
]);
export function mapNarrationFrame(frame) {
  const f = Math.max(0, Math.floor(frame));
  if (f >= 660) return 719; // Final frame hold through the 720-frame composition.
  const [start, end, source] = frameSpans.find(([a,b]) => f >= a && f < b);
  return source + Math.min(59, Math.floor((f - start) * 60 / (end - start)));
}
