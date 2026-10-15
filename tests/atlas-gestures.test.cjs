/* Run: node tests/atlas-gestures.test.cjs. Real atlas handlers with a minimal DOM/canvas. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../starmap_archive_app.js'), 'utf8');

function setup({observer = false, count = 1, near = true, visible = true} = {}) {
  const elements = new Map(), emitted = [], references = new Set();
  const frames = new Map(), images = [];
  let frameNumber = 0, time = 1, observeScene, observeArchive;
  const frame = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(time)); time += 34; };
  const requestAnimationFrame = fn => { frames.set(++frameNumber, fn); return frameNumber; };
  const cancelAnimationFrame = id => frames.delete(id);
  const context = {
    circles: [], draws: 0, clearRect() { this.circles = []; this.draws++; }, drawImage() {},
    gradients: 0, createRadialGradient() { this.gradients++; return {addColorStop() {}}; },
    arc(...values) { this.circles.push(values); },
    setTransform() {}, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {},
    stroke() {}, fill() {}, save() {}, restore() {}, strokeText() {}, fillText() {},
  };
  class Element {
    constructor() {
      this.events = {}; this.children = []; this.dataset = {}; this.attributes = {};
      this.style = {setProperty() {}}; this.captures = new Set();
      this.classes = new Set(); this.textWrites = 0;
      this.classList = {
        add: value => this.classes.add(value), remove: value => this.classes.delete(value),
        toggle: (value, enabled) => enabled ? this.classes.add(value) : this.classes.delete(value),
      };
    }
    set textContent(value) { this.text = value; this.textWrites++; }
    get textContent() { return this.text; }
    addEventListener(type, fn) { (this.events[type] ||= []).push(fn); }
    emit(type, extra = {}) {
      const event = {type, target: this, pointerId: 1, pointerType: 'touch', button: 0,
        clientX: 180, clientY: 240, prevented: false,
        preventDefault() { this.prevented = true; }, ...extra};
      (this.events[type] || []).forEach(fn => fn(event));
      return event;
    }
    appendChild(child) { this.children.push(child); }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    querySelector() { return this.input ||= new Element(); }
    querySelectorAll() { return []; }
    closest() { return this; }
    setAttribute(key, value) { this.attributes[key] = value; }
    removeAttribute(key) { delete this.attributes[key]; }
    getBoundingClientRect() { return {left: 0, top: 0, right: 375, bottom: 480, width: 375, height: 480}; }
    getContext() { return this.localContext || context; }
    setPointerCapture(id) { this.captures.add(id); }
    hasPointerCapture(id) { return this.captures.has(id); }
    releasePointerCapture(id) { this.captures.delete(id); this.emit('lostpointercapture', {pointerId: id}); }
    focus() { throw new Error('Atlas interaction must not move focus'); }
    scrollIntoView() { throw new Error('Atlas interaction must not scroll the page'); }
  }
  const $ = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
  const document = new Element(); document.getElementById = $; document.createElement = () => { const element = new Element(); element.localContext = {...context, circles: []}; return element; };
  document.body = new Element();
  const window = new Element();
  class IntersectionObserver {
    constructor(callback, options = {}) {
      const update = active => { if (!this.disconnected) callback([{isIntersecting: active}]); };
      if (options.rootMargin) observeArchive = update;
      else observeScene = update;
    }
    observe() {}
    disconnect() { this.disconnected = true; }
  }
  if (observer) window.IntersectionObserver = IntersectionObserver;
  window.dispatchEvent = event => { emitted.push(event); window.emit(event.type, event); };
  window.NuoJourney = {hasReference: id => references.has(Number(id))};
  window.NUO_MASK_ATLAS = {
    nodes: Array.from({length: count}, (_, index) => ({id: index + 1, name: '测试面具', idText: '0001', region: '江西', province: '江西',
      roleType: '神灵信仰类', faceShape: '圆形', semantic: '仪式角色', image: `mask-${index + 1}.svg`,
      xRegion: .1, yRegion: .15, detailUrl: 'https://example.org/mask/1'})),
    meta: {total: count, caseIds: [1]}, colors: {'神灵信仰类': '#ffe4a3'},
    stats: {roleType: [['神灵信仰类', 1]], faceShape: [['圆形', 1]], province: [['江西', 1]]},
  };
  class CustomEvent { constructor(type, options) { this.type = type; this.detail = options.detail; } }
  vm.runInNewContext(source, {window, document, URL, CustomEvent, Image: class { set src(value) { this.url = value; images.push(this); } }, requestAnimationFrame, cancelAnimationFrame, IntersectionObserver}, {filename: 'starmap_archive_app.js'});
  const canvas = $('starChart');
  if (observeArchive) observeArchive(near);
  if (observeScene) observeScene(visible);
  frame();
  const node = () => context.circles[0];
  const tap = () => { const [x, y] = node(); canvas.emit('pointerdown', {clientX: x, clientY: y}); canvas.emit('pointerup', {clientX: x, clientY: y}); frame(); };
  const selected = () => $('detailName').textWrites;
  const reference = $('detailKeywords').children[0]?.children[1];
  return {$, canvas, context, node, tap, selected, reference, references, emitted, frame, frames, images, window, document, observeArchive, observeScene: active => observeScene(active)};
}

const t = setup();
const initialSelection = t.selected();
t.tap(); assert.equal(t.selected(), initialSelection + 1, 'a short tap selects a node');
const afterTap = t.selected(), initialNode = t.node().slice();
t.canvas.emit('pointerdown');
t.canvas.emit('pointermove', {pointerId: 99, clientX: 280});
t.canvas.emit('pointerup', {pointerId: 99, clientX: 280});
assert.deepEqual(t.node(), initialNode, 'untracked pointers cannot rotate or end the current gesture');
assert.ok(t.canvas.hasPointerCapture(1));
t.canvas.emit('pointermove', {clientX: 205}); t.frame();
assert.notDeepEqual(t.node(), initialNode, 'one finger rotates the atlas');
t.canvas.emit('pointerleave');
assert.ok(t.canvas.classes.has('is-dragging'), 'leaving the canvas keeps an explicitly captured drag');
t.canvas.emit('pointerup', {clientX: 205});
assert.equal(t.selected(), afterTap, 'rotation does not select a node');
assert.equal(t.canvas.captures.size, 0);

const pinch = setup(), beforePinch = pinch.node().slice(), beforeSelection = pinch.selected();
pinch.canvas.emit('pointerdown', {pointerId: 1, clientX: 100, clientY: 200});
pinch.canvas.emit('pointerdown', {pointerId: 2, clientX: 200, clientY: 200});
pinch.canvas.emit('pointermove', {pointerId: 2, clientX: 300, clientY: 200}); pinch.frame();
assert.equal(pinch.node()[2], beforePinch[2] * 2, 'spreading two fingers doubles the atlas zoom');
assert.equal(pinch.node()[0] - 187.5, (beforePinch[0] - 187.5) * 2, 'pinch zoom does not also rotate');
pinch.canvas.emit('pointerup', {pointerId: 2, clientX: 300, clientY: 200});
const afterPinch = pinch.node().slice();
pinch.canvas.emit('pointermove', {pointerId: 1, clientX: 100, clientY: 200}); pinch.frame();
assert.deepEqual(pinch.node(), afterPinch, 'lifting a pinch finger rebases without a rotation jump');
pinch.canvas.emit('pointerup', {pointerId: 1, clientX: 100, clientY: 200});
assert.equal(pinch.selected(), beforeSelection, 'neither pinch finger becomes a tap');
assert.equal(pinch.canvas.captures.size, 0);

for (const cancellation of ['pointercancel', 'lostpointercapture']) {
  const cancelled = setup(), original = cancelled.selected(), [x, y] = cancelled.node();
  cancelled.canvas.emit('pointerdown', {clientX: x, clientY: y});
  cancelled.canvas.emit(cancellation, {clientX: x, clientY: y});
  cancelled.canvas.emit('pointerup', {clientX: x, clientY: y});
  assert.equal(cancelled.selected(), original, `${cancellation} is never a selection`);
  assert.equal(cancelled.canvas.captures.size, 0);
  assert.equal(cancelled.canvas.classes.has('is-dragging'), false);
  cancelled.tap(); assert.equal(cancelled.selected(), original + 1, 'next gesture works after cancellation');
}

const wheel = setup(), radius = wheel.node()[2];
assert.equal(wheel.canvas.emit('wheel', {deltaY: -50}).prevented, true); wheel.canvas.emit('pointerdown'); wheel.frame(); wheel.canvas.emit('pointercancel');
assert.equal(wheel.node()[2], radius * 1.08, 'ordinary canvas wheel zooms the atlas');
const zoomed = wheel.node().slice();
assert.equal(wheel.canvas.emit('wheel', {deltaY: -50, ctrlKey: true}).prevented, false);
assert.equal(wheel.canvas.emit('wheel', {deltaY: -50, metaKey: true}).prevented, false);
assert.deepEqual(wheel.node(), zoomed, 'browser zoom shortcuts retain native behavior');

const refs = setup();
assert.equal(refs.reference.textContent, '加入创作参考');
refs.references.add(1); refs.tap();
assert.equal(refs.reference.textContent, '已加入我的参考 ✓', 'selecting again restores the saved reference state');
refs.reference.emit('click');
assert.equal(refs.emitted.length, 1, 'one reference click emits exactly one event');
assert.equal(refs.emitted[0].type, 'nuo:add-reference');
assert.equal(refs.emitted[0].detail.id, 1);
refs.references.clear(); refs.tap();
assert.equal(refs.reference.textContent, '加入创作参考', 'a removed reference is not shown as selected');
console.log('PASS: atlas tap/drag separation, independent pointer IDs, pinch zoom and rebasing, cancel/lost-capture recovery, native browser zoom, saved-reference feedback, no focus/scroll.');

const batched = setup({observer: true, count: 483});
batched.canvas.emit('pointerdown');
const drawCount = batched.context.draws;
for (let i = 0; i < 20; i++) batched.canvas.emit('pointermove', {clientX: 200 + i});
assert.equal(batched.context.draws, drawCount, '20 move events do no synchronous scene painting');
assert.equal(batched.frames.size, 1, '20 move events share one animation frame');
batched.frame();
assert.equal(batched.context.draws, drawCount + 1, 'the whole gesture batch renders once');
for (let i = 0; i < 20; i++) batched.canvas.emit('wheel', {deltaY: -1});
assert.equal(batched.frames.size, 1, 'wheel events also share one animation frame');
batched.frame();
assert.equal(batched.context.draws, drawCount + 2);
assert.equal(batched.images.length, 2, 'only two SVG decodes start concurrently');
batched.images[0].onload();
assert.equal(batched.images.length, 3, 'finishing one decode admits only one more');
batched.observeScene(false);
assert.equal(batched.frames.size, 0, 'leaving the viewport cancels the animation');
batched.images[1].onload();
assert.equal(batched.images.length, 3, 'offscreen image completion does not start more SVG decodes');
assert.equal(batched.frames.size, 0, 'offscreen image completion cannot schedule a render');
batched.observeScene(true); batched.frame();
assert.ok(batched.images.length > 3, 'image loading resumes when the chart returns');
batched.document.hidden = true; batched.document.emit('visibilitychange');
assert.equal(batched.frames.size, 0, 'background tabs stop rendering');
batched.document.hidden = false; batched.document.emit('visibilitychange');
assert.equal(batched.frames.size, 1, 'foreground tabs resume with one render');
batched.frame();
const afterResize = batched.context.draws;
batched.window.emit('resize');
assert.equal(batched.frames.size, 0, 'unchanged viewport size does not schedule redraw or reset the canvas');
assert.equal(batched.context.draws, afterResize);
console.log('PASS: 20 gesture events → 1 render, 2 concurrent SVG loads, offscreen/background stop, unchanged resize skips rendering.');

const reopened = setup({observer: true});
let reopenedRect = {left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0};
reopened.canvas.getBoundingClientRect = () => reopenedRect;
reopened.observeScene(false);
reopened.window.emit('resize');
assert.equal(reopened.canvas.width, 375, 'resizing a collapsed library keeps the last valid canvas width');
assert.equal(reopened.canvas.height, 480, 'resizing a collapsed library keeps the last valid canvas height');
assert.equal(reopened.frames.size, 0, 'hidden resize does not restart rendering');
reopenedRect = {left: 0, top: 0, right: 640, bottom: 420, width: 640, height: 420};
reopened.observeScene(true);
assert.equal(reopened.canvas.width, 640, 'reopening measures the new layout without another window resize');
assert.equal(reopened.canvas.height, 420);
assert.equal(reopened.frames.size, 1, 'reopening after resize schedules only one render loop');
reopened.frame();
const reopenedSelection = reopened.selected();
reopened.tap();
assert.equal(reopened.selected(), reopenedSelection + 1, 'hit testing still selects the rendered node after reopening');
console.log('PASS: collapsed-library resize preserves valid dimensions; reopening remeasures and keeps node selection aligned.');

const lazy = setup({observer: true, near: false, visible: false});
assert.equal(lazy.selected(), 0, 'the permanently expanded library does not initialize a distant chart');
assert.equal(lazy.context.draws, 0); assert.equal(lazy.images.length, 0); assert.equal(lazy.frames.size, 0);
lazy.observeArchive(true);
assert.equal(lazy.selected(), 1, 'a static library initializes its chart near the viewport without an open property');
assert.equal(lazy.frames.size, 0, 'preloading does not start the offscreen animation');
lazy.observeArchive(true);
assert.equal(lazy.selected(), 1, 'the preload observer disconnects after initialization');
lazy.observeScene(true); lazy.frame();
assert.equal(lazy.frames.size, 1, 'entering the chart starts exactly one animation');
lazy.observeScene(false);
lazy.document.hidden = true; lazy.document.emit('visibilitychange');
lazy.document.hidden = false; lazy.document.emit('visibilitychange');
assert.equal(lazy.frames.size, 0, 'returning to a foreground tab does not animate an offscreen chart');

const idle = setup({observer: true});
assert.equal(idle.frames.size, 1, 'visible auto-rotation maintains one frame, never competing loops');
idle.observeScene(false);
assert.equal(idle.frames.size, 0, 'auto-rotation has no remaining RAF while offscreen');
const idleDraws = idle.context.draws;
idle.frame(); assert.equal(idle.context.draws, idleDraws);
idle.observeScene(true); idle.frame();
assert.equal(idle.context.draws, idleDraws + 1);
assert.equal(idle.frames.size, 1, 'returning to the chart restarts one animation loop');
const thumbnails = setup({count: 483});
for (let i = 0; i < thumbnails.images.length; i++) thumbnails.images[i].onload();
assert.ok(thumbnails.images.length <= 37, 'mobile requests at most 36 foreground thumbnails plus the selected case');
assert.equal(thumbnails.$('detailImage').src, 'mask-1.svg', 'detail image retains the original SVG');
thumbnails.canvas.emit('pointerdown');
const beforeGradients = thumbnails.context.gradients;
thumbnails.canvas.emit('pointermove', {clientX: 205}); thumbnails.frame();
assert.equal(thumbnails.context.gradients - beforeGradients, 1, 'a full scene creates only its background gradient; star glows are reused');
console.log('PASS: automatic rotation stops offscreen, mobile thumbnail count bounded, detail keeps original SVG, per-frame star glow gradients removed.');
