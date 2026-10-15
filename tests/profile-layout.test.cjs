/* Run: node tests/profile-layout.test.cjs. Hidden analysis slides must not size the visible card. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const start = source.indexOf('  function setSlide(index)');
const end = source.indexOf('  function fetchText(url)', start);
assert.ok(start >= 0 && end > start, 'the real profile slide handler is present');

const slides = Array.from({length: 6}, () => ({hidden: false}));
function makeButtons() {
  return slides.map(() => {
    const classes = new Set();
    return {classes, classList: {toggle: (name, on) => on ? classes.add(name) : classes.delete(name)}};
  });
}
const tabs = makeButtons(), dots = makeButtons();
const state = {activeSlide: 0};
const context = {
  state,
  document: {querySelectorAll(selector) {
    assert.equal(selector, '#vizTrack .insight-slide');
    return slides;
  }},
  els: {
    tabs: {querySelectorAll: () => tabs},
    dots: {querySelectorAll: () => dots},
  },
};
vm.runInNewContext(source.slice(start, end), context, {filename: 'profile-setSlide.js'});

function select(index, expected) {
  context.setSlide(index);
  assert.equal(state.activeSlide, expected);
  assert.equal(slides.filter(slide => !slide.hidden).length, 1, 'only the selected analysis contributes layout height');
  slides.forEach((slide, i) => assert.equal(slide.hidden, i !== expected));
  [tabs, dots].forEach(buttons => {
    assert.equal(buttons.filter(button => button.classes.has('is-active')).length, 1);
    buttons.forEach((button, i) => assert.equal(button.classes.has('is-active'), i === expected));
  });
}

select(0, 0); // The initial render hides all five offscreen analyses.
for (let index = 0; index < slides.length; index++) select(index, index);
select(state.activeSlide + 1, 0); // Last -> first.
select(state.activeSlide - 1, 5); // First -> last.
select(state.activeSlide - 1, 4);
select(1, 1); // Direct tab navigation after circular navigation.

// Exercise the shipped event bindings, not a second implementation of swipe detection.
class Surface {
  constructor() { this.events={};this.style={};this.children=[];this.dataset={};this.classes=new Set();this.classList={toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name)}; }
  setAttribute(name,value) { this[name]=value; }
  addEventListener(type,fn) { (this.events[type] ||= []).push(fn); }
  querySelectorAll() { return this.children; }
  closest() { return this.parent || null; }
  emit(type,values={}) {
    const event={type,target:this,pointerId:1,pointerType:'touch',clientX:100,clientY:100,preventDefault(){this.prevented=true;},...values};
    (this.events[type] || []).forEach(fn=>fn(event));return event;
  }
}
function checkReadingGestures(deck,window,read) {
  const before=read();
  deck.emit('pointerdown');
  deck.emit('pointermove',{clientX:170,clientY:600});
  deck.emit('pointerup',{clientX:170,clientY:600});
  assert.equal(read(),before,'a primarily vertical gesture cannot change the active reading panel');
  deck.emit('pointerdown');deck.emit('pointercancel');
  window.emit('pointermove',{pointerId:2,clientX:300,clientY:500});
  window.emit('pointerup',{pointerId:2,clientX:300,clientY:500});
  assert.equal(read(),before,'a cancelled scroll leaves no drag for a later pointer to move or switch');
  assert.equal(deck.emit('pointermove',{clientX:300}).prevented,undefined,'nested matrix scrolling retains native pointer behavior');
}
for (const id of ['prev','next','deck','featureMatrix','regionMatrix','quadrantFilters','scatter']) context.els[id]=new Surface();
context.els.tabs=Object.assign(new Surface(),{children:tabs});
context.els.dots=Object.assign(new Surface(),{children:dots});
const bindStart=source.indexOf('  function bindEvents()',source.indexOf('  const URLS ='));
const bindEnd=source.indexOf('  function renderAll()',bindStart);
assert.ok(bindStart>=0 && bindEnd>bindStart);
vm.runInNewContext(source.slice(bindStart,bindEnd),context,{filename:'profile-bindEvents.js'});
context.bindEvents();
checkReadingGestures(context.els.deck,new Surface(),()=>JSON.stringify([state.activeSlide,slides.map(slide=>slide.hidden)]));
context.els.next.emit('click');assert.equal(state.activeSlide,2);
context.els.prev.emit('click');assert.equal(state.activeSlide,1);
context.els.tabs.emit('click',{target:{closest:()=>({dataset:{slide:'4'}})}});assert.equal(state.activeSlide,4);
context.els.dots.emit('click',{target:{closest:()=>({dataset:{slide:'0'}})}});assert.equal(state.activeSlide,0);

const comparisonSource=fs.readFileSync(path.join(__dirname,'../global-compare-render.js'),'utf8');
const elements=new Map();
const get=id=>{if(!elements.has(id))elements.set(id,new Surface());return elements.get(id);};
const compareTabs=Array.from({length:3},(_,index)=>Object.assign(new Surface(),{dataset:{slide:String(index)}}));
const compareDots=Array.from({length:3},(_,index)=>Object.assign(new Surface(),{dataset:{slide:String(index)}}));
const track=get('deckTrack');track.children=Array.from({length:3},()=>new Surface());track.parent=new Surface();track.offsetWidth=320;
const compareWindow=new Surface();
const compareContext={window:compareWindow,document:{getElementById:get,querySelectorAll:selector=>selector.endsWith('.deck-tab')?compareTabs:compareDots}};
const deckStart=comparisonSource.indexOf('(function initDeck()');
vm.runInNewContext(comparisonSource.slice(deckStart,comparisonSource.lastIndexOf('})();')),compareContext,{filename:'comparison-deck.js'});
const active=()=>track.children.flatMap((slide,i)=>slide.hidden?[]:[i]);
assert.deepEqual(active(),[0],'the comparison renders only its initial reading panel');
checkReadingGestures(track,compareWindow,()=>JSON.stringify([active(),track.style.transform]));
get('deckNext').emit('click');assert.deepEqual(active(),[1]);
get('deckPrev').emit('click');assert.deepEqual(active(),[0]);
get('deckPrev').emit('click');assert.deepEqual(active(),[0],'comparison previous stops at the first panel');
compareTabs[2].emit('click');assert.deepEqual(active(),[2]);
get('deckNext').emit('click');assert.deepEqual(active(),[2],'comparison next stops at the last panel');
compareDots[1].emit('click');assert.deepEqual(active(),[1]);
assert.equal(compareTabs[1].classes.has('is-active'),true);
assert.equal(compareDots[1].classes.has('is-active'),true);
track.parent.emit('keydown',{key:'ArrowRight',target:{closest:()=>null}});assert.deepEqual(active(),[2],'keyboard navigation remains available');
assert.equal(track.style.transform,undefined,'comparison panels never translate outside the reading viewport');
console.log('PASS: profile/comparison single-panel layout, tabs/arrows/dots/keyboard, vertical scroll and cancelled-pointer isolation.');
