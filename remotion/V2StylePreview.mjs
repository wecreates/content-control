// Preview only: no default production behavior or copy/timing changes.
// Use the approved Dave teal sparingly, with the existing dark type outline.
const emphasis=/\b(wallet|boss|budget|fee|fees|panic|broke|trap|cost|costs|value|snacks|perks|sandwiches)\b/i;
export function previewAccentWord(text) {
 return String(text||'').match(emphasis)?.[0]?.toLowerCase()||null;
}
export function previewWordSelected(word,selected) {
 return String(word).toLowerCase().replace(/[^a-z]/g,'')===selected;
}
