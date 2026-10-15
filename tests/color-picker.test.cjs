/* Run: node tests/color-picker.test.cjs — color conversion, input and pointer ownership. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
class Element {
  constructor() {
    this.events = new Map(); this.attributes = {}; this.style = {}; this.children = new Map();
    this.classList = {add() {}}; this.captured = new Set(); this.value = ''; this.textContent = '';
    this.rect = {left: 0,top: 0,width: 200,height: 200};
  }
  addEventListener(type, callback) { if (!this.events.has(type)) this.events.set(type,new Set()); this.events.get(type).add(callback); }
  removeEventListener(type, callback) { this.events.get(type)?.delete(callback); }
  querySelector(name) { if (!this.children.has(name)) this.children.set(name,new Element()); return this.children.get(name); }
  setAttribute(name,value) { this.attributes[name] = String(value); }
  removeAttribute(name) { delete this.attributes[name]; }
  getBoundingClientRect() { return this.rect; }
  setPointerCapture(id) { this.captured.add(id); }
  hasPointerCapture(id) { return this.captured.has(id); }
  releasePointerCapture(id) { this.captured.delete(id); }
  blur() {}
  focus(options) { this.focusOptions = options; }
  send(type, values = {}) {
    const event = {type,button:0,pointerId:1,clientX:100,clientY:0,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...values};
    for (const callback of Array.from(this.events.get(type) || [])) callback(event);
    return event;
  }
}
function setup(initial = '#ff0000') {
  const document = new Element(), root = new Element(), window = {}, changes = [];
  root.ownerDocument = document;
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../color-picker.js'),'utf8'),{document,window});
  const picker = window.NuoColorPicker.create(root,{color:initial,onChange:hex=>changes.push(hex)});
  return {root,document,changes,picker,hue:root.querySelector('.ncp-hue'),sv:root.querySelector('.ncp-sv'),input:root.querySelector('.ncp-hex'),error:root.querySelector('.ncp-error')};
}
const t = setup();
assert.equal(t.changes.length,0);
for (const color of ['#ff0000','#00ff00','#0000ff','#ff00ff','#00ffff','#ffff00','#000000','#ffffff','#808080','#d6a159','#203857','#9e5720']) {
  t.picker.setColor(color);
  t.hue.send('keydown',{key:'ArrowRight'});
  t.hue.send('keydown',{key:'ArrowLeft'});
  assert.equal(t.input.value,color,'RGB → HSV → RGB preserves '+color);
}
let count = t.changes.length;
assert.equal(t.picker.setColor('  #A3F  '),true);
assert.equal(t.input.value,'#aa33ff');
assert.equal(t.changes.length,count,'external sync emits no callback');
for (const bad of ['', '#12','#gggggg','rgb(0,0,0)', '#1234567','<script>']) {
  assert.equal(t.picker.setColor(bad),false);
  assert.equal(t.input.value,'#aa33ff');
}
t.input.value = '#0c8'; t.input.send('change');
assert.equal(t.input.value,'#00cc88');assert.equal(t.changes.at(-1),'#00cc88');
count = t.changes.length;
t.input.value = '#oops'; t.input.send('change');
assert.equal(t.input.attributes['aria-invalid'],'true');assert.ok(t.error.textContent);assert.equal(t.changes.length,count);
t.input.send('keydown',{key:'Escape'});assert.equal(t.input.value,'#00cc88');assert.equal(t.error.textContent,'');
assert.equal(t.hue.focusOptions.preventScroll,true,'leaving text editing keeps keyboard focus in the picker without scrolling');
t.picker.setColor('#0000ff');
const hue = t.hue.attributes['aria-valuenow'];
for (const gray of ['#ffffff','#888888','#000000']) {
  t.picker.setColor(gray);assert.equal(t.hue.attributes['aria-valuenow'],hue,'achromatic colors keep the previous hue');
}
t.sv.send('keydown',{key:'End'});t.sv.send('keydown',{key:'PageUp'});assert.equal(t.input.value,'#0000ff','a black color can return to the retained hue');
// A capture keeps selection working beyond the square, clamped to its edges.
t.sv.rect = {left:50,top:50,width:100,height:100};
const down = t.sv.send('pointerdown',{clientX:100,clientY:100});
assert.ok(down.prevented && down.stopped && t.root.hasPointerCapture(1));
t.document.send('pointermove',{clientX:400,clientY:-100});assert.equal(t.input.value,'#0000ff');
t.document.send('pointermove',{clientX:-400,clientY:-100});assert.equal(t.input.value,'#ffffff');
t.document.send('pointermove',{clientX:400,clientY:400});assert.equal(t.input.value,'#000000');
t.document.send('pointercancel');assert.equal(t.root.captured.size,0);
count = t.changes.length;t.document.send('pointermove',{clientX:100,clientY:100});assert.equal(t.changes.length,count,'cancel releases the gesture');
// Ring orientation matches CSS: top red, right chartreuse, bottom cyan, left violet.
t.picker.setColor('#ff0000');t.hue.send('pointerdown');
t.document.send('pointermove',{clientX:200,clientY:100});assert.equal(t.input.value,'#80ff00');
t.document.send('pointermove',{clientX:100,clientY:200});assert.equal(t.input.value,'#00ffff');
t.document.send('pointermove',{clientX:0,clientY:100});assert.equal(t.input.value,'#8000ff');
t.document.send('pointerup',{clientX:100,clientY:0});assert.equal(t.input.value,'#ff0000');
// A second finger cancels selection and is stopped before it reaches a canvas.
t.hue.send('pointerdown');
const extra = t.document.send('pointerdown',{pointerId:2,clientX:200,clientY:100});
assert.ok(extra.prevented && extra.stopped);count=t.changes.length;
t.document.send('pointermove',{clientX:200,clientY:100});
t.document.send('pointermove',{pointerId:2,clientX:0,clientY:100});
assert.equal(t.changes.length,count);
t.document.send('pointerup',{pointerId:1});
t.document.send('pointerup',{pointerId:2});assert.equal(t.root.captured.size,0);
t.hue.send('pointerdown',{clientX:100,clientY:200});assert.equal(t.input.value,'#00ffff','a fresh single-finger gesture works after cancellation');
t.root.send('lostpointercapture');count=t.changes.length;
t.document.send('pointermove',{clientX:200,clientY:100});assert.equal(t.changes.length,count);
assert.ok([...t.document.events.values()].every(listeners=>!listeners.size),'document gesture listeners are removed after release');
const focus = setup();
focus.hue.send('pointerdown',{pointerType:'touch',clientX:200,clientY:100});
assert.equal(focus.hue.focusOptions,undefined,'touch color selection does not leave a focus target for Safari to scroll back to');
assert.equal(focus.input.value,'#80ff00','touch selection still changes the color');
focus.document.send('pointerup',{pointerType:'touch',clientX:200,clientY:100});
focus.sv.send('pointerdown',{pointerType:'mouse'});
assert.equal(focus.sv.focusOptions.preventScroll,true,'mouse selection retains keyboard-operable focus without scrolling');
focus.document.send('pointerup',{pointerType:'mouse'});
console.log('Color picker: color conversion, validation, keyboard, pointer bounds and cancellation passed.');
