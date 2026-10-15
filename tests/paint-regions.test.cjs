/* Run: node tests/paint-regions.test.cjs. Real RGBA connectivity, not Canvas mocks. */
const assert = require('node:assert/strict');
const { findRegion } = require('../paint-regions.js');
function image(rows, colors = { '.': [240, 240, 240, 255], '#': [10, 10, 10, 255] }) {
  const width = rows[0].length, height = rows.length;
  const pixels = new Uint8ClampedArray(width * height * 4);
  rows.forEach((row, y) => [...row].forEach((key, x) => pixels.set(colors[key], (y * width + x) * 4)));
  return { pixels, width, height, at: (x, y, options) => findRegion(pixels, width, height, x, y, options) };
}

const closed = image(['.......', '.#####.', '.#...#.', '.#...#.', '.#####.', '.......']);
const before = closed.pixels.slice();
const inside = closed.at(2, 2);
assert.deepEqual([...inside.indices].sort((a, b) => a - b), [16, 17, 18, 23, 24, 25]);
assert.equal(inside.touchesEdge, false);
assert.equal(inside.tooLarge, false);
assert.equal(inside.invalid, false);
assert.deepEqual(closed.pixels, before, 'selection must not recolor its input');
assert.deepEqual([...closed.at(2.8, 2.4).indices], [...inside.indices], 'fractional pointer coordinates map to the containing pixel');

assert.equal(closed.at(0, 0).touchesEdge, true, 'outside paper is flagged for the UI to reject');
const open = image(['.......', '.#####.', '.#...#.', '.#.....', '.#####.', '.......']);
assert.equal(open.at(2, 2).touchesEdge, true, 'even a one-pixel route to the edge is open');
const diagonal = image(['#####', '#.###', '##.##', '#####']);
assert.deepEqual([...diagonal.at(1, 1).indices], [6], 'corners do not connect diagonally');
const separate = image(['#########', '#..#....#', '#########']);
assert.equal(separate.at(1, 1).indices.length, 2, 'same-color islands separated by a line stay separate');

const shades = image(['#####', '#abc#', '#####'], {
  '#': [0, 0, 0, 255], a: [240, 240, 240, 255], b: [218, 218, 218, 255], c: [195, 195, 195, 255]
});
assert.deepEqual([...shades.at(1, 1).indices], [6, 7], 'seed-based tolerance stops a gradual ramp');
assert.deepEqual([...shades.at(1, 1, { tolerance: 0 }).indices], [6], 'zero tolerance only matches exact visible colors');
assert.deepEqual([...shades.at(1, 1, { tolerance: 45 }).indices], [6, 7, 8], 'the tolerance boundary is inclusive');
const alpha = image(['#####', '#abc#', '#####'], {
  '#': [0, 0, 0, 255], a: [240, 50, 80, 0], b: [20, 200, 40, 0], c: [0, 0, 0, 50]
});
assert.deepEqual([...alpha.at(1, 1).indices], [6, 7], 'transparent hidden RGB is ignored, visible alpha is not');

const capped = closed.at(2, 2, { maxPixels: 3 });
assert.equal(capped.indices.length, 3);
assert.equal(capped.tooLarge, true, 'a partial capped result must never be painted');
assert.equal(closed.at(2, 2, { maxPixels: 6 }).tooLarge, false, 'a region exactly at the cap remains complete');
const plain = image(['...', '...', '...']);
assert.equal(plain.at(1, 1).indices.length, 9);
assert.equal(plain.at(1, 1).touchesEdge, true);
assert.equal(image(['.']).at(0, 0).touchesEdge, true);

for (const args of [
  [null, 1, 1, 0, 0], [new Uint8ClampedArray(0), 1, 1, 0, 0],
  [plain.pixels, 3.5, 3, 0, 0], [plain.pixels, 0, 3, 0, 0],
  [plain.pixels, 3, 3, -1, 1], [plain.pixels, 3, 3, 3, 1],
  [plain.pixels, 3, 3, 1, 3], [plain.pixels, 3, 3, NaN, 1],
  [plain.pixels, 3, 3, 1, 1, { tolerance: -1 }],
  [plain.pixels, 3, 3, 1, 1, { maxPixels: 0 }]
]) {
  const result = findRegion(...args);
  assert.equal(result.invalid, true);
  assert.equal(result.indices.length, 0);
}
const excessive = findRegion(new Uint8ClampedArray(4000001 * 4), 4000001, 1, 0, 0);
assert.equal(excessive.tooLarge, true);
assert.equal(excessive.indices.length, 0, 'oversized images are rejected before working-array allocation');

const full = new Uint8ClampedArray(900 * 1000 * 4);
const whole = findRegion(full, 900, 1000, 450, 500);
assert.equal(whole.indices.length, 900000, 'full artboard traversal is iterative and has no duplicate pixels');
assert.equal(whole.touchesEdge, true);
assert.equal(whole.tooLarge, false);
console.log('Paint region checks passed: closed/open contours, RGBA tolerance, 4-way connectivity, bounds and full-artboard traversal.');
