/* Run: node tests/reading-scroll.test.cjs. Exercise the real page scroll updater. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const start = source.indexOf('    function updateScrollVars() {');
const end = source.indexOf("    window.addEventListener('scroll'", start);
assert.ok(start >= 0 && end > start, 'locate the real inline scroll updater');
const updateSource = source.slice(start, end);

function setup(stableReading) {
  const reads = {hero: 0, visibility: 0, bounds: 0, cinema: 0, push: 0};
  const heroWrites = [], sectionWrites = [], progressWrites = [];
  const stableReadingMode = {matches: stableReading};
  const rejectMobileWork = name => {
    assert.equal(stableReadingMode.matches, false, `${name} must not run during touch reading`);
  };
  const sections = [true, false].map((visible, index) => {
    const variables = new Map();
    return {
      dataset: {watch: `chapter-${index}`},
      getClientRects() {
        rejectMobileWork('section visibility measurement'); reads.visibility++;
        return visible ? [{}] : [];
      },
      getBoundingClientRect() {
        rejectMobileWork('section bounds measurement'); reads.bounds++;
        assert.ok(visible, 'collapsed content must not be measured');
        return {top: 100, height: 400};
      },
      style: {
        getPropertyValue: key => variables.get(key),
        setProperty(key, value) {
          rejectMobileWork('section decoration update');
          variables.set(key, value); sectionWrites.push([key, value]);
        },
      },
    };
  });
  const context = {
    window: {scrollY: 2600, innerHeight: 800},
    document: {documentElement: {scrollHeight: 6000}},
    scrollProgress: 0, stableReadingMode, sections,
    progressBar: {style: {set transform(value) { progressWrites.push(value); }}},
    heroStage: {get offsetHeight() {
      rejectMobileWork('hero measurement'); reads.hero++; return 1000;
    }},
    clamp: (value, min = 0, max = 1) => Math.min(max, Math.max(min, value)),
    computeHeroCinematic() {
      rejectMobileWork('cinematic calculation'); reads.cinema++;
      return {glow: .2, flash: .3, mist: .4, letterbox: 1};
    },
    heroForwardBack() { rejectMobileWork('hero animation calculation'); reads.push++; return .5; },
    setHeroVar(key, value) { rejectMobileWork('hero decoration update'); heroWrites.push([key, value]); },
  };
  vm.createContext(context);
  vm.runInContext(updateSource, context, {filename: 'index.html: updateScrollVars'});
  return {context, reads, heroWrites, sectionWrites, progressWrites};
}

const mobile = setup(true);
mobile.context.updateScrollVars();
assert.equal(mobile.context.scrollProgress, .5);
assert.equal(mobile.progressWrites.at(-1), 'scaleX(0.5000)');
assert.deepEqual(mobile.reads, {hero: 0, visibility: 0, bounds: 0, cinema: 0, push: 0});
assert.equal(mobile.heroWrites.length, 0);
assert.equal(mobile.sectionWrites.length, 0);

// Native overscroll and changing browser chrome only affect the bounded progress bar.
for (const [y, expected] of [[-120, 'scaleX(0.0000)'], [6500, 'scaleX(1.0000)'], [0, 'scaleX(0.0000)']]) {
  mobile.context.window.scrollY = y;
  mobile.context.updateScrollVars();
  assert.equal(mobile.progressWrites.at(-1), expected);
}
mobile.context.window.innerHeight = 700;
mobile.context.window.scrollY = 2650;
mobile.context.updateScrollVars();
assert.equal(mobile.progressWrites.at(-1), 'scaleX(0.5000)');
mobile.context.document.documentElement.scrollHeight = 600;
mobile.context.window.scrollY = 0;
mobile.context.updateScrollVars();
assert.equal(mobile.progressWrites.at(-1), 'scaleX(0.0000)', 'short pages do not produce NaN');

const desktop = setup(false);
desktop.context.updateScrollVars();
assert.equal(desktop.progressWrites.at(-1), 'scaleX(0.5000)');
assert.equal(desktop.reads.cinema, 1);
assert.equal(desktop.reads.hero, 2);
assert.equal(desktop.reads.visibility, 2);
assert.equal(desktop.reads.bounds, 1);
assert.equal(desktop.heroWrites.length, 7);
assert.deepEqual(desktop.sectionWrites, [['--chapter-0', '0.6863']]);
desktop.context.updateScrollVars();
assert.equal(desktop.sectionWrites.length, 1, 'unchanged chapter progress is not rewritten');
desktop.context.window.scrollY = 50;
desktop.context.updateScrollVars();
assert.equal(desktop.reads.bounds, 2, 'the hero keeps its early exit before chapter measurements');

// A live media-query change immediately switches subsequent scrolls to the stable path.
desktop.context.stableReadingMode.matches = true;
desktop.context.updateScrollVars();
assert.equal(desktop.reads.bounds, 2);
assert.equal(desktop.progressWrites.at(-1), 'scaleX(0.0096)');
console.log('Reading scroll checks passed: bounded progress, no touch decoration work, desktop behavior retained.');
