// Explicit visual events are independent of speech/caption tracks. Times are absolute seconds.
export function nonverbalTextAtTime(scene, time, beat) {
  const events = scene?.visual?.text_events ?? [];
  if (!Array.isArray(events)) throw new Error('visual.text_events must be an array');
  let active = null;
  for (const event of events) {
    if (event.type !== 'nonverbal_text' || event.character_id !== 'cashback_goblin' ||
        typeof event.text !== 'string' || !event.text.trim() ||
        !Number.isFinite(event.start) || !Number.isFinite(event.end) || event.start >= event.end ||
        !Number.isFinite(scene.start) || !Number.isFinite(scene.end) ||
        event.start < scene.start || event.end > scene.end ||
        !beat || scene.id !== beat.id || event.start < beat.start || event.end > beat.end) {
      throw new Error('Invalid or out-of-scene nonverbal text event');
    }
    if (time >= event.start && time < event.end) {
      if (active) throw new Error('Overlapping nonverbal text events');
      active = event;
    }
  }
  return active;
}

// Keep every source character, including spaces and punctuation, across SVG tspans.
export function nonverbalTextLines(text, maxCharacters = 26) {
  if (!Number.isInteger(maxCharacters) || maxCharacters < 1) throw new Error('Invalid line width');
  const lines = [];
  let remaining = text;
  while (remaining.length > maxCharacters) {
    const space = remaining.lastIndexOf(' ', maxCharacters - 1);
    const end = space >= 0 ? space + 1 : maxCharacters;
    lines.push(remaining.slice(0, end));
    remaining = remaining.slice(end);
  }
  if (remaining) lines.push(remaining);
  return lines;
}
