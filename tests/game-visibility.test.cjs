/* Run: node tests/game-visibility.test.cjs. Exercise the real game lifecycle without WebGL. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../nuo-stickman-mask-game/game.js'), 'utf8');
class Events {
  constructor() { this.events = new Map(); }
  addEventListener(type, fn) { if (!this.events.has(type)) this.events.set(type, new Set()); this.events.get(type).add(fn); }
  removeEventListener(type, fn) { this.events.get(type)?.delete(fn); }
  emit(type) { this.events.get(type)?.forEach(fn => fn({type})); }
}
const window = new Events(), document = new Events(), library = new Events();
window.location = {href: 'https://example.org/'};
window.matchMedia = () => ({matches: true});
document.currentScript = {src: 'https://example.org/game.js'};
document.hidden = false;
let now = 100, frameId = 0, observer;
const frames = new Map();
class IntersectionObserver {
  constructor(callback) { this.callback = callback; observer = this; }
  observe(target) { this.target = target; }
  disconnect() { this.disconnected = true; }
  setVisible(isIntersecting) { this.callback([{target: this.target, isIntersecting}]); }
}
window.IntersectionObserver = IntersectionObserver;
vm.runInNewContext(source.replace('window.NuoStickmanGame = { mount };', 'window.GameUnderTest = NuoStickmanMap;'), {
  window, document, URL, navigator: {hardwareConcurrency: 4},
  performance: {now: () => now}, localStorage: {getItem() { return null; }},
  IntersectionObserver,
  requestAnimationFrame(callback) { const id = frameId++; frames.set(id, callback); return id; },
  cancelAnimationFrame(id) { frames.delete(id); },
});
const game = new window.GameUnderTest({}, {});
game.root = new Events();
game.root.closest = () => library;
game.stage = new Events();
game.stage.clientWidth = 375; game.stage.clientHeight = 500;
let renders = 0, resizes = 0, updates = 0, idleUpdates = 0;
game.renderer = {render() { renders++; }, setSize() { resizes++; }};
game.camera = {updateProjectionMatrix() {}};
game.scene = {};
game.update = () => updates++;
game.updateIdle = () => idleUpdates++;
game.setOverlay = game.showOverlay = () => {};
game.pauseButton = {};
game.destroyScene = () => {};
game.bindUi();
game.ready = true;
game.state = 'running';
game.syncVisibility();
assert.equal(frames.size, 0, 'game waits for its own visible viewport after loading');
observer.setVisible(true);
assert.equal(frames.size, 1);
assert.equal(resizes, 1);
game.syncVisibility();
game.handleResize();
assert.equal(frames.size, 1, 'visibility/resize events cannot start extra loops');
assert.equal(resizes, 1, 'unchanged dimensions do not reallocate the drawing buffer');
const step = () => {
  const [id, callback] = frames.entries().next().value;
  frames.delete(id); now += 16; callback(now);
};
step();
assert.equal(renders, 1); assert.equal(updates, 1);
game.keys.up = true; game.dragStart = {x: 1, y: 2};
observer.setVisible(false);
assert.equal(frames.size, 0, 'scrolling away releases WebGL work');
assert.equal(game.keys.up, false); assert.equal(game.dragStart, null);
const elapsed = game.elapsed;
now += 60000;
observer.setVisible(true);
step();
assert.ok(Math.abs(game.elapsed - elapsed - .016) < 1e-8, 'hidden time does not expire mechanisms or advance play');
assert.equal(game.state, 'running');
game.togglePause();
observer.setVisible(false); observer.setVisible(true);
step();
assert.equal(game.state, 'paused', 'returning to the game preserves an explicit pause');
assert.equal(updates, 2); assert.equal(idleUpdates, 1);
document.hidden = true; document.emit('visibilitychange');
assert.equal(frames.size, 0, 'switching browser tabs suspends animation');
document.hidden = false; document.emit('visibilitychange');
assert.equal(frames.size, 1);
observer.setVisible(false);
assert.equal(frames.size, 0, 'the permanently expanded library still stops offscreen games');
document.emit('visibilitychange');
assert.equal(frames.size, 0, 'tab visibility cannot resume an offscreen game');
observer.setVisible(true);
assert.equal(frames.size, 1);
game.stage.clientWidth = 0; game.stage.clientHeight = 0; game.handleResize();
assert.equal(resizes, 1, 'a hidden stage does not resize its WebGL buffer');
game.unmount();
assert.equal(frames.size, 0); assert.equal(observer.disconnected, true);
assert.equal(document.events.get('visibilitychange').size, 0);
assert.equal(library.events.has('toggle'), false, 'the static library needs no collapse listeners or open property');
document.emit('visibilitychange');
assert.equal(frames.size, 0, 'unmount leaves no animation restart listeners');
console.log('Game visibility lifecycle passed.');
