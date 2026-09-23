import fs from 'node:fs';
import assert from 'node:assert/strict';

const src = fs.readFileSync(new URL('../src/episode1.jsx', import.meta.url), 'utf8');

assert.match(src, /useCurrentFrame/);
assert.match(src, /interpolate/);
assert.match(src, /spring/);
assert.match(src, /camera/);
assert.match(src, /StickFigure/);
assert.match(src, /KineticText/);
assert.match(src, /InterestMonster/);
assert.match(src, /TrapDoor/);
assert.match(src, /DecorativeLadder/);
assert.match(src, /publicationEnabled === false/);
assert.doesNotMatch(src, /slide|carousel|presentation/i);
console.log('Episode 1 motion contract: PASS');
