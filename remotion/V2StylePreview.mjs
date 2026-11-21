// Preview only: no default production behavior or copy/timing changes.
// Dark text derivative: 4.807:1 against white; character palette unchanged.
export const PREVIEW_TEXT_TEAL='#087F82';
const emphasis=/\b(wallet|boss|budget|fee|fees|panic|broke|trap|cost|costs|value|snacks|perks|sandwiches)\b/i;
export function previewAccentWord(text) {
 return String(text||'').match(emphasis)?.[0]?.toLowerCase()||null;
}
export function previewWordSelected(word,selected) {
 return String(word).toLowerCase().replace(/[^a-z]/g,'')===selected;
}
