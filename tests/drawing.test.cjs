/* Run: node tests/drawing.test.cjs. Canvas history and local-draft behavior model. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(process.argv[2] || require('node:path').join(__dirname, '../draw-workshop.js'), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
function setup(saved, deferredImages = false, templates = []) {
  const pending = [], seen = [], elements = new Map(), storage = new Map(saved ? [['nuo_drawing_draft_v1', saved]] : []);
  let failStorage = false, counter = 0, confirmation = true;
  const confirmations = [];
  const clone = value => JSON.parse(JSON.stringify(value));
  const canvases = [];
  function makeContext() {
    return {
      marks:[],globalCompositeOperation:'source-over',globalAlpha:1,fillStyle:'',stack:[],
      clearRect(x,y,w,h){if(x===0&&y===0&&w===900&&h===1000)this.marks=[];else this.marks=this.marks.filter(mark=>{const p=mark.position;return !p||p.length!==4||x>p[0]||y>p[1]||x+w<p[0]+p[2]||y+h<p[1]+p[3];});},getImageData(){return {data:new Uint8ClampedArray(this.marks[0]?.kind==='fill'?this.marks[0].color:this.marks.length?[1,1,1,255]:[0,0,0,0]),marks:clone(this.marks)};},
      putImageData(data){this.marks=clone(data.marks);if((!this.marks.length||this.marks[0]?.kind==='fill')&&data.data[3]>0)this.marks=[{kind:'fill',color:Array.from(data.data)}];},
      translate(){},rotate(){},scale(){},
      createRadialGradient(){return {addColorStop(){}};},beginPath(){this.dot=null;},arc(x,y,radius){this.dot={x,y,radius};},moveTo(){},lineTo(){},closePath(){},
      stroke(path){this.marks.push({kind:'template-outline',path:path.path,color:this.strokeStyle});},
      isPointInPath(path,x,y){const rect=path.path.match(/^M (\d+) (\d+) H (\d+) V (\d+) H \d+ Z$/);return !!rect && x>=+rect[1] && y>=+rect[2] && x<=+rect[3] && y<=+rect[4];},
      fill(path){if(path){this.marks.push({kind:'template-fill',path:path.path,color:this.fillStyle});return;}if(this.globalCompositeOperation==='destination-out')this.marks=[];else this.marks.push({kind:'stroke',id:++counter,alpha:this.globalAlpha,...this.dot});},
      fillRect(x,y,width,height){
        if(this.globalCompositeOperation==='source-in')this.marks=this.marks.map(mark=>({...mark,color:this.fillStyle}));
        else this.marks.push({kind:'background',color:this.fillStyle});
      },
      save(){this.stack.push({globalCompositeOperation:this.globalCompositeOperation,globalAlpha:this.globalAlpha,fillStyle:this.fillStyle});},
      restore(){Object.assign(this,this.stack.pop());},
      drawImage(image,...position){
        let marks;
        if(image.ctx)marks=clone(image.ctx.marks);
        else if(image.src.startsWith('data:'))marks=JSON.parse(Buffer.from(image.src.split(',')[1],'base64').toString());
        else marks=[{kind:'outline',src:image.src,position,color:'#eef3f4'}];
        this.marks.push(...marks);
      }
    };
  }
  class Element {
    constructor() { this.events = {}; this.style = {setProperty(){}}; this.dataset = {}; this.classList = {add(){},remove(){},toggle(){}}; this.textContent = ''; this.width=300; this.height=150; this.captured=null; this.encodes=0;this.checked=false;this.disabled=false;this.children=[]; }
    addEventListener(type, fn) { (this.events[type] ||= []).push(fn); }
    dispatchEvent(e) { (this.events[e.type] || []).forEach(fn => fn.call(this,e)); return true; }
    appendChild(e) { e.parentNode=this;this.children.push(e); }
    set innerHTML(value) { this.html=value;this.children=[]; }
    get innerHTML() { return this.html; }
    remove() { this.parentNode=null; }
    querySelectorAll() { return []; }
    getBoundingClientRect() { return this.rect || {left:0,top:0,right:450,bottom:500,width:450,height:500}; }
    setPointerCapture(id) { this.captured=id; }
    hasPointerCapture(id) { return this.captured===id; }
    releasePointerCapture(id) { this.captured=null; }
    closest(selector) { return selector==='#galaxy' && this.inWorkshop ? elements.get('galaxyStage') : null; }
    focus() { document.activeElement=this; }
    blur() { document.activeElement=document.body; }
    setAttribute(name,value) { (this.attributes ||= {})[name]=value; }
    getAttribute(name) { return this.attributes?.[name]; }
    getContext() { return this.ctx ||= makeContext(); }
    toDataURL() { this.encodes++;return 'data:image/png;base64,'+Buffer.from(JSON.stringify(this.getContext().marks)).toString('base64'); }
  }
  const document = new Element();
  document.readyState='complete'; document.body=new Element();
  const removedPreviewIds=new Set(['btnApplyDraw','modelViewerWrap','modelViewerCanvas','modelControls','modelDescription','modelFront','modelSide','modelBack','modelZoomIn','modelZoomOut','btnModeBrowse','btnModeDraw','galaxyCanvas','galaxySearch','workCardBrowse']);
  document.getElementById=id=>{if(removedPreviewIds.has(id))return null;if(!elements.has(id)){const element=new Element();element.inWorkshop=true;elements.set(id,element);}return elements.get(id);};
  document.createElement=type=>{const element=new Element();if(type==='canvas')canvases.push(element);return element;};
  const window = new Element();window.innerWidth=1200;window.innerHeight=800;window.NUO_COLORING_TEMPLATES=templates;
  window.confirm=message=>{confirmations.push(message);return confirmation;};
  const picker = {};
  window.NuoColorPicker={create(root,options){picker.change=options.onChange;picker.color=options.color;return {setColor(hex){picker.color=hex;}};}};
  const originalDispatch=window.dispatchEvent;
  window.dispatchEvent=function(e){seen.push(e.type); return originalDispatch.call(this,e);};
  class MockImage {
    constructor(){this.naturalWidth=1000;this.naturalHeight=1000;}
    set src(value){this._src=value; const load=()=>value.includes('0499.svg')?this.onerror():this.onload(); if(deferredImages)pending.push(load); else queueMicrotask(load);}
    get src(){return this._src;}
  }
  const localStorage={getItem:key=>storage.get(key)||null,setItem(key,value){if(failStorage)throw new Error('QuotaExceeded');storage.set(key,value);}};
  const sandbox={document,window,localStorage,Image:MockImage,Path2D:class {constructor(path){this.path=path;}},Event,performance,console,setTimeout,clearTimeout};
  vm.runInNewContext(source,sandbox,{filename:'draw-workshop.js'});
  const canvas=elements.get('drawCanvas');
  const send=(type,extra={})=>canvas.dispatchEvent({type,pointerId:1,pointerType:'mouse',button:0,clientX:120,clientY:140,preventDefault(){},...extra});
  const click=id=>elements.get(id).dispatchEvent({type:'click'});
  const control=(id,value,event='change')=>{const element=document.getElementById(id);if(typeof value==='boolean')element.checked=value;else element.value=String(value);element.dispatchEvent({type:event});};
  return {window,document,canvas,canvases,elements,seen,storage,pending,click,control,send,picker,confirmations,api:window.NuoDrawing,marks:()=>clone(canvas.ctx.marks),setStorageFailure:(value=true)=>failStorage=value,setConfirmation:value=>confirmation=value};
}
(async()=>{
  const t=setup();await tick();
  assert.equal(t.api.ready,true);assert.ok(t.seen.includes('nuo:drawing-ready'));
  assert.equal(t.document.getElementById('btnApplyDraw'),null,'the planar workshop initializes without any retired 3D DOM');
  assert.equal(t.canvas.width,900);assert.equal(t.canvas.height,1000);assert.equal(t.api.hasContent(),false);
  assert.equal(t.document.getElementById('btnModeBrowse'),null,'the dedicated workshop initializes without demo controls');
  t.send('pointerdown');t.send('pointerup'); const first=t.api.getImage();
  assert.equal(t.api.hasContent(),true,'drawing works immediately without switching away from a demo mode');assert.equal(JSON.parse(t.storage.get('nuo_drawing_draft_v1')).image,first);
  t.click('btnUndo');assert.equal(t.api.hasContent(),false);t.click('btnRedo');assert.equal(t.api.getImage(),first);
  t.send('pointerdown');t.send('pointercancel'); const second=t.api.getImage();assert.notEqual(first,second);
  t.click('btnUndo');assert.equal(t.api.getImage(),first);t.click('btnRedo');assert.equal(t.api.getImage(),second);
  t.api.clear();assert.equal(t.api.hasContent(),false);t.click('btnUndo');assert.equal(t.api.getImage(),second);
  t.window.dispatchEvent(new Event('resize'));assert.equal(t.api.getImage(),second);assert.equal(t.canvas.width,900);
  let prevented=false; t.document.dispatchEvent({type:'keydown',key:'z',ctrlKey:true,target:{closest:()=>({})},preventDefault(){prevented=true;}});
  assert.equal(prevented,false);assert.equal(t.api.getImage(),second);
  t.document.dispatchEvent({type:'keydown',key:'z',metaKey:true,target:t.canvas,preventDefault(){}});assert.equal(t.api.getImage(),first);
  t.document.dispatchEvent({type:'keydown',key:'z',metaKey:true,shiftKey:true,target:t.canvas,preventDefault(){}});assert.equal(t.api.getImage(),second);
  assert.equal(await t.api.addReference('assets/masks/0001.svg'),true);assert.equal(t.marks().filter(mark=>mark.kind==='outline').length,1);assert.equal(t.marks().filter(mark=>mark.kind==='stroke').length,2);
  t.click('btnUndo');assert.equal(t.api.getImage(),second);assert.equal(await t.api.addReference('https://bad.test/mask.svg'),false);
  const saved=t.storage.get('nuo_drawing_draft_v1'); const reloaded=setup(saved);await tick();assert.equal(reloaded.api.getImage(),second);assert.equal(reloaded.api.ready,true);
  const raced=setup(saved,true);assert.equal(raced.api.ready,false);raced.api.enter();raced.send('pointerdown');raced.send('pointerup');const live=raced.api.getImage();raced.pending.shift()();await tick();assert.equal(raced.api.getImage(),live);assert.equal(raced.api.ready,true);
  const atomic=setup();await tick();const metadata={version:1,title:'第一件',referenceIds:[1]};
  assert.equal(atomic.api.saveDraft(metadata),true);metadata.title='外部修改';atomic.api.enter();atomic.send('pointerdown');atomic.send('pointerup');
  assert.equal(JSON.parse(atomic.storage.get('nuo_drawing_draft_v1')).journey.title,'第一件','metadata is copied and carried with automatic drawing saves');
  assert.equal(await atomic.api.restore(first,{version:1,title:'打开旧作'}),true);
  assert.equal(JSON.parse(atomic.storage.get('nuo_drawing_draft_v1')).journey.title,'打开旧作','restore commits image and replacement metadata together');
  atomic.api.resetHistory();atomic.click('btnUndo');assert.equal(atomic.api.getImage(),first,'reset history cannot return to another work');
  assert.equal(atomic.api.clear({version:1,title:'新作品'}),true);atomic.api.resetHistory();atomic.click('btnUndo');assert.equal(atomic.api.hasContent(),false);
  assert.equal(JSON.parse(atomic.storage.get('nuo_drawing_draft_v1')).journey.title,'新作品');
  assert.equal(atomic.api.clear(new Event('click')),false,'DOM events are not accepted as metadata');
  const clearing=setup();await tick();clearing.api.saveDraft({version:1,title:'保留心意'});
  clearing.send('pointerdown');clearing.send('pointerup');const beforeClear=clearing.api.getImage();
  clearing.click('btnEraser');clearing.setConfirmation(false);clearing.click('btnClearDraw');
  assert.equal(clearing.api.getImage(),beforeClear,'cancelling clear preserves the complete drawing');
  clearing.setConfirmation(true);clearing.click('btnClearDraw');
  assert.equal(clearing.api.hasContent(),false);assert.equal(clearing.elements.get('btnEraser').getAttribute('aria-pressed'),'false','clearing exits the eraser so the next stroke can draw');
  assert.equal(JSON.parse(clearing.storage.get('nuo_drawing_draft_v1')).journey.title,'保留心意','clearing the canvas keeps the wish metadata');
  clearing.click('btnUndo');assert.equal(clearing.api.getImage(),beforeClear,'confirmed clear remains reversible');
  clearing.api.clear();clearing.send('pointerdown');clearing.send('pointerup');assert.equal(clearing.api.hasContent(),true,'drawing works directly after a clear');
  clearing.api.clear();const clearPrompts=clearing.confirmations.length;clearing.click('btnClearDraw');assert.equal(clearing.confirmations.length,clearPrompts,'an already empty canvas does not ask for confirmation');
  const originalAtomic=atomic.storage.get('nuo_drawing_draft_v1');const waiting=setup(originalAtomic,true);
  assert.equal(waiting.api.saveDraft({version:1,title:'too early'}),false);assert.equal(waiting.storage.get('nuo_drawing_draft_v1'),originalAtomic);
  while(waiting.pending.length){waiting.pending.shift()();await tick();}waiting.api.enter();waiting.send('pointerdown');waiting.send('pointerup');
  assert.equal(JSON.parse(waiting.storage.get('nuo_drawing_draft_v1')).journey.title,'新作品','initial restored metadata survives later strokes');
  t.setStorageFailure();assert.equal(t.api.saveDraft(),false);assert.match(t.elements.get('drawingStatus').textContent,/保存失败/);assert.equal(t.api.getImage(),second);
  t.click('btnSaveToGalaxy');assert.ok(t.seen.includes('nuo:finish'));assert.ok(t.seen.filter(x=>x==='nuo:drawing-change').length>=8);
  const layers=setup();await tick();layers.api.enter();
  assert.equal(layers.api.hasContent(),false,'a background alone is not a completed drawing');
  const defaultBackground=layers.api.getImage();layers.control('drawBackground','#ffffff');assert.equal(layers.api.exportEditable().background,'#ffffff');
  layers.click('btnUndo');assert.equal(layers.api.getImage(),defaultBackground,'undo restores the background');layers.click('btnRedo');
  layers.send('pointerdown');layers.send('pointerup');const ink=layers.api.exportEditable().strokes;
  await layers.api.addReference('assets/masks/0001.svg');
  assert.equal(layers.api.exportEditable().strokes,ink,'reference is separate from user strokes');
  assert.equal(layers.api.exportEditable().outline.locked,true);assert.equal(layers.elements.get('outlineScale').disabled,true);
  layers.control('outlineScale',140);assert.equal(layers.api.exportEditable().outline.scale,100,'locked outline ignores scale changes');
  layers.control('outlineColor','#bd251f');assert.equal(layers.api.exportEditable().outline.color,'#bd251f','locked outline can still change color');
  assert.equal(layers.api.exportEditable().strokes,ink);assert.equal(layers.marks().find(mark=>mark.kind==='outline').color,'#bd251f');
  layers.control('outlineLocked',false);layers.control('outlineScale',120,'input');layers.control('outlineScale',130,'input');layers.control('outlineScale',130,'change');
  assert.equal(layers.api.exportEditable().outline.scale,130);layers.click('btnUndo');assert.equal(layers.api.exportEditable().outline.scale,100,'one slider gesture takes one undo');layers.click('btnRedo');
  layers.control('outlineX',25);layers.control('outlineY',-20);const positioned=layers.api.exportEditable();
  layers.click('btnResetOutline');assert.equal(layers.api.exportEditable().outline.x,0);layers.click('btnUndo');assert.equal(layers.api.exportEditable().outline.x,25);
  await layers.api.addReference('assets/masks/0002.svg');assert.equal(layers.api.exportEditable().strokes,ink,'replacing reference keeps strokes');
  assert.equal(layers.marks().filter(mark=>mark.kind==='outline').length,1,'there is only one reference layer');layers.click('btnUndo');
  assert.equal(layers.api.exportEditable().outline.src,'assets/masks/0001.svg');assert.equal(layers.api.exportEditable().outline.x,25);
  layers.click('btnEraser');layers.send('pointerdown');layers.send('pointerup');
  assert.equal(layers.marks().filter(mark=>mark.kind==='stroke').length,0);assert.equal(layers.marks().filter(mark=>mark.kind==='outline').length,1,'eraser cannot erase the outline');
  assert.equal(layers.marks().find(mark=>mark.kind==='background').color,'#ffffff','eraser cannot erase the background');layers.click('btnUndo');
  const layeredPNG=layers.api.getImage(), editable=layers.api.exportEditable();assert.equal(JSON.stringify(editable),JSON.stringify(positioned));
  const reopened=setup();await tick();assert.equal(await reopened.api.restore(layeredPNG,{version:1,title:'图层作品'},editable),true);
  assert.equal(reopened.api.getImage(),layeredPNG);assert.equal(JSON.stringify(reopened.api.exportEditable()),JSON.stringify(editable));
  reopened.control('outlineX',-10);assert.equal(reopened.api.exportEditable().outline.x,-10,'reopened outline remains editable');
  const reloadedLayers=setup(layers.storage.get('nuo_drawing_draft_v1'));await tick();await tick();
  assert.equal(reloadedLayers.api.getImage(),layeredPNG,'reload restores layered draft');
  const encodesBefore=[layers.canvas.encodes,layers.canvases[0].encodes];layers.api.saveDraft({version:1,title:'只改标题'});layers.api.saveDraft({version:1,title:'再次改标题'});
  assert.deepEqual([layers.canvas.encodes,layers.canvases[0].encodes],encodesBefore,'metadata changes reuse cached PNGs');
  layers.click('btnRemoveOutline');assert.equal(layers.api.exportEditable().outline,null);assert.equal(layers.api.exportEditable().strokes,ink);layers.click('btnUndo');assert.ok(layers.api.exportEditable().outline);
  assert.equal(layers.api.validateEditable({...editable,outline:{...editable.outline,src:'https://example.org/a.svg'}}),null);
  assert.equal(layers.api.validateEditable({...editable,outline:{...editable.outline,scale:999}}),null);
  assert.equal(layers.api.validateEditable({...editable,strokes:'data:image/svg+xml;base64,YQ=='}),null);
  assert.equal(layers.api.validateEditable({...editable,strokes:'data:image/png;base64,'+'A'.repeat(6000000)}),null);
  assert.equal(layers.api.validateEditable({...editable,version:4}),null);
  const clean=layers.api.validateEditable(editable);clean.outline.x=39;assert.equal(layers.api.exportEditable().outline.x,25,'validated state is an independent copy');
  const legacy=setup();await tick();assert.equal(await legacy.api.restore(layeredPNG),true);assert.equal(legacy.api.getImage(),layeredPNG,'legacy flattened PNG remains intact');
  assert.equal(legacy.api.exportEditable().legacyFlattened,true);assert.equal(legacy.elements.get('drawingLegacyNote').hidden,false);
  const pendingLine=setup(undefined,true);await tick();const loadingReference=pendingLine.api.addReference('assets/masks/0001.svg');
  pendingLine.api.clear({version:1,title:'新作品'});pendingLine.api.resetHistory();pendingLine.pending.shift()();assert.equal(await loadingReference,false);assert.equal(pendingLine.api.exportEditable().outline,null);
  const badDraft=JSON.stringify({version:1,image:layeredPNG,drawing:{...editable,outline:{...editable.outline,src:'assets/masks/0499.svg'}},journey:{version:1,title:'保留的作品'}});
  const failedDraft=setup(badDraft);await tick();await tick();assert.equal(failedDraft.api.ready,true);assert.equal(failedDraft.api.saveDraft({version:1,title:'不能覆盖'}),false);
  assert.equal(failedDraft.storage.get('nuo_drawing_draft_v1'),badDraft,'failed startup restoration cannot overwrite the original draft');
  assert.equal(failedDraft.api.getImage(),layeredPNG,'failed editable restore can still show the saved image');
  assert.equal(layers.elements.get('btnBrushHard').getAttribute('aria-pressed'),'false','eraser is distinct from the inactive brush');layers.click('btnBrushInk');assert.equal(layers.elements.get('btnBrushInk').getAttribute('aria-pressed'),'true');assert.equal(layers.elements.get('btnBrushHard').getAttribute('aria-pressed'),'false');
  assert.equal(t.elements.get('canvasSaveStatus').textContent,t.elements.get('drawingStatus').textContent,'near-canvas status matches the main status');
  const keys=setup();await tick();keys.api.enter();keys.send('pointerdown');keys.send('pointerup');const keyImage=keys.api.getImage();
  assert.equal(keys.document.activeElement,keys.canvas,'pointer drawing focuses the keyboard-operable canvas');assert.equal(keys.canvas.tabIndex,0);
  let intercepted=0;
  const keyboard=(target,key,extra={})=>keys.document.dispatchEvent({type:'keydown',target,key,preventDefault(){intercepted++;},...extra});
  const outside={closest:()=>null};keyboard(outside,'z',{metaKey:true});keyboard(outside,'Escape');assert.equal(intercepted,0);assert.equal(keys.api.getImage(),keyImage);
  keys.send('pointerdown');keys.send('pointerup');assert.notEqual(keys.api.getImage(),keyImage,'game Escape did not leave drawing mode');
  const nativeControl={closest:selector=>selector==='#galaxy'?keys.elements.get('galaxyStage'):{}};
  const beforeNative=keys.api.getImage();keyboard(nativeControl,'z',{metaKey:true});keyboard(nativeControl,'Escape');keyboard(nativeControl,'ArrowRight');assert.equal(intercepted,0);assert.equal(keys.api.getImage(),beforeNative,'native layer inputs retain their own keys');
  keys.elements.get('galaxyStage').rect={left:0,right:450,top:-900,bottom:-400,width:450,height:500};
  keyboard(keys.canvas,'z',{metaKey:true});keyboard(keys.canvas,'Escape');assert.equal(intercepted,0);assert.equal(keys.api.getImage(),beforeNative,'stale workshop focus cannot undo an offscreen result');
  delete keys.elements.get('galaxyStage').rect;keyboard(keys.canvas,'z',{metaKey:true});assert.equal(intercepted,1);assert.equal(keys.api.getImage(),keyImage);
  keyboard(keys.canvas,'z',{metaKey:true,shiftKey:true});assert.equal(keys.api.getImage(),beforeNative);
  keys.elements.get('btnSaveToGalaxy').focus();keys.click('btnSaveToGalaxy');assert.equal(keys.document.activeElement,keys.document.body,'finishing releases workshop focus');
  keyboard(keys.document.activeElement,'z',{metaKey:true});assert.equal(keys.api.getImage(),beforeNative);
  const panelFocus=setup();await tick();
  const desk=panelFocus.elements.get('paintingDesk');
  desk.dispatchEvent({type:'pointerdown',pointerType:'touch'});
  panelFocus.elements.get('btnColorWheel').dispatchEvent({type:'click',detail:1});
  assert.equal(panelFocus.elements.get('colorTray').hidden,false);
  assert.equal(panelFocus.document.activeElement,undefined,'Safari touch clicks without pointerType do not focus the color tray');
  panelFocus.elements.get('closeColorTray').dispatchEvent({type:'click',detail:1});
  assert.equal(panelFocus.document.activeElement,undefined,'closing with touch does not restore offscreen workshop focus');
  panelFocus.elements.get('btnColorWheel').dispatchEvent({type:'click',detail:0});
  assert.equal(panelFocus.document.activeElement,panelFocus.elements.get('showColorWheel'),'keyboard activation after touch still focuses the picker');
  panelFocus.elements.get('closeColorTray').dispatchEvent({type:'click',detail:0});
  assert.equal(panelFocus.document.activeElement,panelFocus.elements.get('btnColorWheel'),'keyboard close returns to the opening control');
  desk.dispatchEvent({type:'pointerdown',pointerType:'mouse'});panelFocus.click('btnMoreColors');
  assert.equal(panelFocus.document.activeElement,panelFocus.elements.get('showColorSwatches'),'mouse activation retains focus');
  panelFocus.picker.change('#4276b9');panelFocus.document.body.focus();panelFocus.api.closePanels();
  assert.equal(panelFocus.document.activeElement,panelFocus.document.body,'leaving the workshop closes panels without pulling focus back');
  assert.equal(panelFocus.elements.get('colorTray').hidden,true);
  assert.equal(JSON.parse(panelFocus.storage.get('nuo_drawing_draft_v1')).brushColor,'#4276b9','closing on departure retains the last selected color');
  const escapeDrawing=setup();await tick();
  escapeDrawing.elements.get('colorTray').hidden=true;escapeDrawing.elements.get('freeBrushSettings').open=false;
  escapeDrawing.send('pointerdown');escapeDrawing.send('pointerup');const beforeEscape=escapeDrawing.api.getImage();
  escapeDrawing.document.dispatchEvent({type:'keydown',target:escapeDrawing.canvas,key:'Escape',preventDefault(){}});
  assert.equal(escapeDrawing.api.getImage(),beforeEscape,'Escape retains all artwork');
  escapeDrawing.send('pointerdown');escapeDrawing.send('pointerup');
  assert.notEqual(escapeDrawing.api.getImage(),beforeEscape,'Escape never switches the drawing canvas to a hidden demo galaxy');
  // Pointer geometry, not just event counts: a fast stroke must visit the sampled curve and reach its tip.
  const curve=setup();await tick();curve.api.enter();
  curve.send('pointerdown',{clientX:10,clientY:10});
  curve.send('pointermove',{clientX:40,clientY:10,getCoalescedEvents:()=>[{clientX:20,clientY:20},{clientX:30,clientY:10}]});
  curve.api.saveDraft(); // A mid-stroke metadata save must not freeze the cached editable pixels.
  curve.send('pointerup',{clientX:50,clientY:10});
  const path=curve.marks().filter(mark=>mark.kind==='stroke');
  assert.equal(path[0].x,20);assert.equal(path.at(-1).x,100);assert.equal(path.at(-1).y,20,'pointerup adds its coordinate and flushes the smoothed tail');
  assert.ok(path.some(mark=>mark.y>25),'coalesced input retains a bend omitted by the dispatched event');
  for(let i=1;i<path.length;i++) {
    assert.ok(path[i].x>=path[i-1].x,'forward input never doubles back to an earlier raw point');
    assert.ok(Math.hypot(path[i].x-path[i-1].x,path[i].y-path[i-1].y)<2.01,'brush stamps stay close enough for a continuous curve');
    assert.ok(Math.abs(path[i].radius-8)<1e-9,'mouse width does not vary with event timing');
  }
  assert.equal(JSON.parse(Buffer.from(curve.api.exportEditable().strokes.split(',')[1],'base64')).at(-1).x,100,'editable export includes the released tip');
  const wholeStroke=curve.api.getImage();curve.click('btnUndo');assert.equal(curve.api.hasContent(),false,'one gesture is exactly one undo');curve.click('btnRedo');assert.equal(curve.api.getImage(),wholeStroke);
  curve.control('brushSizeSlider',12,'input');curve.control('brushSmoothingSlider',0,'input');
  assert.equal(curve.elements.get('brushSizeValue').textContent,12);assert.equal(curve.elements.get('brushSmoothingValue').textContent,'0%');
  const preferences=setup(curve.storage.get('nuo_drawing_draft_v1'));await tick();
  assert.equal(preferences.elements.get('brushSizeSlider').value,12);assert.equal(preferences.elements.get('brushSmoothingSlider').value,0,'new brush settings survive old-version-compatible drafts');
  curve.send('pointerdown',{clientX:10,clientY:30});curve.api.saveDraft();curve.send('pointerup',{clientX:30,clientY:30});
  assert.equal(JSON.parse(Buffer.from(curve.api.exportEditable().strokes.split(',')[1],'base64')).at(-1).x,60,'zero smoothing still invalidates cached pixels on release');

  const suspended=setup();await tick();suspended.api.saveDraft({version:1,title:'手机切走前的心意'});
  suspended.send('pointerdown',{pointerType:'touch',clientX:10,clientY:10});suspended.send('pointermove',{pointerType:'touch',clientX:40,clientY:10});
  suspended.document.hidden=true;suspended.document.dispatchEvent(new Event('visibilitychange'));
  const hiddenStroke=JSON.parse(suspended.storage.get('nuo_drawing_draft_v1'));
  assert.equal(JSON.parse(Buffer.from(hiddenStroke.drawing.strokes.split(',')[1],'base64')).at(-1).x,80,'hiding the phone browser flushes the smoothed stroke tail even without pointerup/pagehide');
  assert.equal(hiddenStroke.journey.title,'手机切走前的心意');
  suspended.send('pointerup',{pointerType:'touch',clientX:300,clientY:10});assert.equal(suspended.api.getImage(),hiddenStroke.image,'a late release after resuming cannot extend the saved stroke');
  suspended.control('drawBackground','#345ea8','input');suspended.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(JSON.parse(suspended.storage.get('nuo_drawing_draft_v1')).drawing.background,'#345ea8','hiding commits a layer preview before its change event');
  suspended.picker.change('#4276b9');suspended.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(JSON.parse(suspended.storage.get('nuo_drawing_draft_v1')).brushColor,'#4276b9','hiding flushes a pending color-wheel save');
  const resumed=setup(suspended.storage.get('nuo_drawing_draft_v1'));await tick();await tick();assert.equal(resumed.api.getImage(),suspended.api.getImage(),'the hidden tab snapshot reopens with the same pixels and layers');

  const pressure=setup();await tick();pressure.api.enter();
  pressure.send('pointerdown',{pointerType:'pen',pressure:0.2,clientX:10});
  pressure.send('pointermove',{pointerType:'pen',pressure:1,clientX:30});
  pressure.send('pointerup',{pointerType:'pen',pressure:0,clientX:40});
  const penPath=pressure.marks().filter(mark=>mark.kind==='stroke');
  assert.ok(penPath[0].radius<penPath.at(-1).radius);assert.equal(penPath.at(-1).radius,8,'release pressure zero does not leave a thin tail or new blob');
  pressure.click('btnUndo');pressure.send('pointerdown',{pointerType:'touch',pressure:0.01,clientX:10});
  pressure.send('pointermove',{pointerType:'touch',pressure:1,clientX:30});pressure.send('pointerup',{pointerType:'touch',pressure:0,clientX:40});
  assert.ok(pressure.marks().filter(mark=>mark.kind==='stroke').every(mark=>Math.abs(mark.radius-8)<1e-9),'synthetic touch pressure is ignored');
  assert.equal(pressure.document.activeElement,undefined,'touch does not leave a focused canvas that Safari could scroll back to');

  const gestures=setup();await tick();gestures.api.enter();const beforeChanges=gestures.seen.filter(x=>x==='nuo:drawing-change').length;
  gestures.send('pointerdown',{pointerType:'touch'});gestures.send('pointermove',{pointerType:'touch',clientX:150});
  gestures.send('pointerdown',{pointerType:'touch',pointerId:2,isPrimary:false,clientX:300});
  const stopped=gestures.api.getImage();
  gestures.send('pointermove',{pointerType:'touch',pointerId:2,clientX:330});gestures.send('pointermove',{pointerType:'touch',clientX:180});
  gestures.send('pointerup',{pointerType:'touch',pointerId:2,clientX:330});gestures.send('pointerup',{pointerType:'touch',clientX:180});
  assert.equal(gestures.api.getImage(),stopped,'a second touch finishes ink and neither finger draws a connecting line');
  assert.equal(gestures.seen.filter(x=>x==='nuo:drawing-change').length-beforeChanges,1,'multi-touch completion records a single history action');
  gestures.click('btnUndo');assert.equal(gestures.api.hasContent(),false);
  gestures.send('pointerdown',{clientX:10});gestures.send('pointermove',{clientX:30});gestures.send('pointercancel',{clientX:9999});
  const cancelled=gestures.api.getImage();assert.equal(gestures.marks().filter(mark=>mark.kind==='stroke').at(-1).x,60,'cancel ignores invalid final coordinates');
  gestures.send('lostpointercapture',{clientX:9999});gestures.send('pointerup',{clientX:9999});assert.equal(gestures.api.getImage(),cancelled,'capture loss and late up do not duplicate the stroke');
  gestures.click('btnUndo');assert.equal(gestures.api.hasContent(),false);
  gestures.send('pointerdown',{clientX:10});gestures.send('pointermove',{clientX:30});gestures.window.dispatchEvent(new Event('resize'));
  const resized=gestures.api.getImage();gestures.send('pointermove',{clientX:40});gestures.send('pointerup',{clientX:50});assert.equal(gestures.api.getImage(),resized,'a viewport resize safely finishes a stroke without rescaling or adding a jump');
  gestures.click('btnUndo');assert.equal(gestures.api.hasContent(),false);

  const spray=setup();await tick();spray.api.enter();spray.click('btnBrushSpray');spray.click('btnSymmetry');
  spray.send('pointerdown',{clientX:100});spray.send('pointerup',{clientX:100});
  const sprayDots=spray.marks().filter(mark=>mark.kind==='stroke');assert.equal(sprayDots.length,2,'soft spray supports symmetry');
  assert.deepEqual(sprayDots.map(mark=>mark.x),[200,700]);assert.ok(sprayDots.every(mark=>mark.alpha<1),'soft spray deposits translucent continuous dots');
  spray.click('btnUndo');assert.equal(spray.api.hasContent(),false);
  // New editable states upgrade only on export, so journey validation can safely run twice.
  const v2={...editable,version:2};delete v2.fills;delete v2.parts;delete v2.outline.cuts;
  const normalizedV2=layers.api.validateEditable(v2);
  assert.equal(normalizedV2.version,2);assert.ok(layers.api.validateEditable(normalizedV2));
  assert.deepEqual(JSON.parse(JSON.stringify(layers.api.validateEditable({...v2,outline:{...v2.outline,cuts:'ignored legacy field'}}).outline.cuts)),[]);
  const oldLayered=setup();await tick();assert.equal(await oldLayered.api.restore(layeredPNG,undefined,normalizedV2),true);
  assert.equal(oldLayered.api.getImage(),layeredPNG);assert.equal(oldLayered.api.exportEditable().version,3);

  const fill=setup();await tick();fill.api.enter();await fill.api.addReference('assets/masks/0001.svg');
  let fillCalls=0,region={indices:new Uint32Array([0]),touchesEdge:false,tooLarge:false};
  fill.window.NuoPaintRegions={findRegion(pixels,w,h,x,y){fillCalls++;assert.equal(w,900);assert.equal(h,1000);return region;}};
  const beforeFill=fill.api.exportEditable();
  fill.click('btnFillRegion');assert.equal(fill.elements.get('btnFillRegion').getAttribute('aria-pressed'),'true');assert.equal(fill.elements.get('btnBrushHard').getAttribute('aria-pressed'),'false');
  fill.send('pointerdown');fill.send('pointerup');
  const filled=fill.api.exportEditable();assert.notEqual(filled.fills,beforeFill.fills);assert.equal(filled.strokes,beforeFill.strokes);assert.equal(JSON.stringify(filled.outline),JSON.stringify(beforeFill.outline));
  assert.match(fill.elements.get('drawingToolHint').textContent,/填色/);
  fill.click('btnUndo');assert.equal(fill.api.exportEditable().fills,beforeFill.fills);fill.click('btnRedo');assert.equal(fill.api.exportEditable().fills,filled.fills);
  const filledImage=fill.api.getImage();
  region={indices:new Uint32Array([0]),touchesEdge:true,tooLarge:false};fill.send('pointerdown');fill.send('pointerup');assert.equal(fill.api.getImage(),filledImage);assert.match(fill.elements.get('drawingStatus').textContent,/边缘/);
  const callCount=fillCalls;
  fill.send('pointerdown');fill.send('pointermove',{clientX:150});fill.send('pointerup',{clientX:150});
  fill.send('pointerdown');fill.send('pointercancel');
  fill.send('pointerdown');fill.send('lostpointercapture');fill.send('pointerup');
  fill.send('pointerdown',{pointerType:'touch'});fill.send('pointerdown',{pointerType:'touch',pointerId:2,isPrimary:false});fill.send('pointerup',{pointerType:'touch',pointerId:2});fill.send('pointerup',{pointerType:'touch'});
  assert.equal(fillCalls,callCount,'drag, cancellation, lost capture and pinch never perform accidental fills');assert.equal(fill.api.getImage(),filledImage);
  fill.click('btnClearFills');assert.equal(fill.api.exportEditable().fills,beforeFill.fills);assert.equal(fill.api.exportEditable().strokes,filled.strokes);assert.ok(fill.api.exportEditable().outline);fill.click('btnUndo');assert.equal(fill.api.getImage(),filledImage);
  const fillReloaded=setup(fill.storage.get('nuo_drawing_draft_v1'));await tick();await tick();assert.equal(fillReloaded.api.getImage(),filledImage,'v3 fills restore with separate lines and strokes');
  fill.click('btnRemoveOutline');assert.equal(fill.api.hasContent(),true,'fill alone counts as meaningful content');fill.api.clear();assert.equal(fill.api.hasContent(),false);fill.click('btnUndo');assert.equal(fill.api.exportEditable().fills,filled.fills);

  const pieces=setup();await tick();pieces.api.enter();await pieces.api.addReference('assets/masks/0001.svg');
  const wholeReference=pieces.api.getImage();
  assert.equal(pieces.api.extractPart({x:200,y:250,w:200,h:180}),true);
  let pieceState=pieces.api.exportEditable();assert.equal(pieceState.parts.length,1);assert.equal(pieceState.outline.cuts.length,1);assert.equal(pieceState.parts[0].src,'assets/masks/0001.svg');
  assert.equal(pieces.elements.get('partPanel').open,true);assert.equal(pieces.document.activeElement,undefined,'part creation does not focus or navigate');
  assert.equal(pieces.api.extractPart({x:240,y:250,w:100,h:100}),false,'overlapping cuts never duplicate removed pixels');assert.equal(pieces.api.exportEditable().parts.length,1);
  pieces.control('partColor','#bd251f');pieces.control('partX',8,'input');pieces.control('partX',12,'input');pieces.control('partX',12,'change');
  assert.equal(pieces.api.exportEditable().parts[0].x,12);pieces.click('btnUndo');assert.equal(pieces.api.exportEditable().parts[0].x,0,'one part slider gesture is one history action');pieces.click('btnRedo');
  pieces.control('partScale',125);pieces.control('partRotation',30);
  pieceState=pieces.api.exportEditable();const composedImage=pieces.api.getImage();assert.equal(pieceState.parts[0].color,'#bd251f');assert.equal(pieceState.outline.color,'#fff0d2');
  const reloadedPieces=setup(pieces.storage.get('nuo_drawing_draft_v1'));await tick();await tick();assert.equal(reloadedPieces.api.getImage(),composedImage);assert.equal(JSON.stringify(reloadedPieces.api.exportEditable()),JSON.stringify(pieceState),'source crop and editable transform survive reload');
  pieces.click('btnDeletePart');assert.equal(pieces.api.exportEditable().parts.length,0);assert.equal(pieces.api.exportEditable().outline.cuts.length,1);pieces.click('btnUndo');assert.equal(pieces.api.getImage(),composedImage,'undo deletion restores the independent part');
  pieces.click('btnResetPart');assert.equal(pieces.api.exportEditable().parts[0].rotation,0);pieces.click('btnUndo');assert.equal(pieces.api.exportEditable().parts[0].rotation,30);
  await pieces.api.addReference('assets/masks/0002.svg');assert.equal(pieces.api.exportEditable().parts[0].src,'assets/masks/0001.svg','replacing the base does not lose earlier fragments or their source');pieces.click('btnRemoveOutline');assert.equal(pieces.api.hasContent(),true);
  assert.equal(pieces.api.validateEditable({...pieceState,parts:[{...pieceState.parts[0],src:'https://example.org/part.svg'}]}),null);
  assert.equal(pieces.api.validateEditable({...pieceState,parts:[{...pieceState.parts[0],crop:{x:0,y:0,w:2,h:1}}]}),null);
  assert.equal(pieces.api.validateEditable({...pieceState,parts:[{...pieceState.parts[0],rotation:999}]}),null);
  assert.equal(pieces.api.validateEditable({...pieceState,fills:null}),null);assert.equal(pieces.api.validateEditable({...pieceState,outline:{...pieceState.outline,cuts:'bad'}}),null);
  const cleanPart=pieces.api.validateEditable(pieceState);cleanPart.parts[0].home.x=1;assert.notEqual(pieces.api.exportEditable().parts[0].home.x,1,'editable export and validation do not expose mutable internal geometry');
  pieces.api.clear();assert.equal(pieces.api.exportEditable().parts.length,0);pieces.click('btnUndo');assert.equal(pieces.api.exportEditable().parts.length,1);

  const emptyParts=setup();await tick();await emptyParts.api.addReference('assets/masks/0001.svg');
  assert.equal(emptyParts.api.extractPart({x:0,y:0,w:900,h:1000}),true);emptyParts.click('btnDeletePart');assert.equal(emptyParts.api.hasContent(),false,'removing a part that contained all lines does not leave a false nonempty work');emptyParts.click('btnUndo');assert.equal(emptyParts.api.hasContent(),true);
  const pieceFailure=setup();await tick();pieceFailure.api.enter();pieceFailure.send('pointerdown');pieceFailure.send('pointerup');const beforePieceFailure=pieceFailure.api.getImage();
  assert.equal(await pieceFailure.api.restore(composedImage,undefined,{...pieceState,parts:[{...pieceState.parts[0],src:'assets/masks/0499.svg'}]}),false);
  assert.equal(pieceFailure.api.getImage(),beforePieceFailure,'one missing source cannot partially replace the current composition');
  const pieceRace=setup(undefined,true);await tick();const pendingRestore=pieceRace.api.restore(composedImage,undefined,pieceState);
  pieceRace.pending.shift()();await tick();pieceRace.pending.shift()();await tick();
  pieceRace.api.enter();pieceRace.send('pointerdown');pieceRace.send('pointerup');const newerPieceImage=pieceRace.api.getImage();
  while(pieceRace.pending.length){pieceRace.pending.shift()();await tick();}
  assert.equal(await pendingRestore,false);assert.equal(pieceRace.api.getImage(),newerPieceImage,'late fragment sources cannot overwrite newer strokes');
  const selection=setup();await tick();selection.api.enter();await selection.api.addReference('assets/masks/0001.svg');selection.click('btnSelectPart');
  selection.send('pointerdown',{pointerType:'touch',clientX:100,clientY:150});selection.send('pointermove',{pointerType:'touch',clientX:200,clientY:200});selection.send('pointercancel');assert.equal(selection.api.exportEditable().parts.length,0);
  selection.send('pointerdown',{pointerType:'touch',clientX:100,clientY:150});selection.send('pointerdown',{pointerType:'touch',pointerId:2,isPrimary:false});selection.send('pointerup',{pointerType:'touch',pointerId:2});selection.send('pointerup',{pointerType:'touch',clientX:200,clientY:200});assert.equal(selection.api.exportEditable().parts.length,0,'pinch cancels a pending crop');
  selection.send('pointerdown',{clientX:150,clientY:150});selection.send('pointerup',{clientX:-50,clientY:-50});
  const clipped=selection.api.exportEditable().parts[0];assert.equal(clipped.home.x,90);assert.equal(clipped.home.y,140);assert.equal(clipped.home.w,210);assert.equal(clipped.home.h,160,'dragging beyond top/left clips to the selected endpoint instead of extending the opposite edge');
  selection.click('btnUndo');assert.equal(selection.api.exportEditable().parts.length,0);assert.equal(selection.api.exportEditable().outline.cuts.length,0,'undo extraction reconnects the original outline');
  selection.window.NUO_MASK_ATLAS={nodes:[{id:1,name:'角色 <甲>'}]};
  selection.control('partCropX',25);selection.control('partCropY',20);selection.control('partCropWidth',50);selection.control('partCropHeight',25);selection.click('btnExtractPart');assert.equal(selection.api.exportEditable().parts.length,1,'numeric crop gives keyboard access to the same operation');assert.match(selection.elements.get('partSelect').innerHTML,/角色 &lt;甲&gt;/);const afterNumeric=selection.api.exportEditable().strokes;selection.send('pointerdown');selection.send('pointerup');assert.notEqual(selection.api.exportEditable().strokes,afterNumeric,'numeric extraction keeps the canvas available');selection.click('btnUndo');
  selection.click('btnUndo');assert.equal(selection.api.exportEditable().parts.length,0);
  for(let index=0;index<8;index++) assert.equal(selection.api.extractPart({x:100+index*70,y:200,w:40,h:40}),true);
  assert.equal(selection.api.extractPart({x:100,y:300,w:40,h:40}),false,'part count is bounded with explicit feedback');assert.match(selection.elements.get('drawingStatus').textContent,/8 个局部/);
  // Closed template regions are editable vector colors, independent of painted pixel boundaries.
  const templates=[
    {id:'test-mask',name:'测试面具',description:'测试分区',preview:'assets/coloring/test.svg',source:'assets/masks/0317.svg',sourceId:317,regions:[
      {id:'face',name:'面部',path:'M 100 100 H 800 V 900 H 100 Z'},
      {id:'brow',name:'额饰',path:'M 200 200 H 400 V 400 H 200 Z'}],details:[]},
    {id:'test-other',name:'另一面具',description:'另一分区',preview:'assets/coloring/other.svg',source:'assets/masks/0319.svg',sourceId:319,regions:[
      {id:'whole',name:'整体',path:'M 100 100 H 800 V 900 H 100 Z'}],details:[]}
  ];
  const coloring=setup(undefined,false,templates);await tick();coloring.api.enter();
  assert.equal(coloring.api.exportEditable().creationMethod,'coloring');assert.equal(coloring.api.exportEditable().template,null);
  coloring.send('pointerdown');coloring.send('pointerup');assert.equal(coloring.api.hasContent(),false,'empty coloring mode never silently draws strokes');
  assert.match(coloring.elements.get('drawingStatus').textContent,/先选择/);
  assert.equal(coloring.api.selectTemplate('unknown'),false);assert.equal(coloring.api.selectTemplate('test-mask'),true);
  assert.equal(coloring.api.hasContent(),true,'uncolored areas are valid intentional white space');
  assert.equal(coloring.elements.get('freeDrawingControls').hidden,true);assert.equal(coloring.elements.get('coloringPanel').hidden,false);
  assert.deepEqual(coloring.marks().filter(mark=>mark.kind.startsWith('template')).map(mark=>mark.kind),['template-fill','template-outline','template-fill','template-outline'],'upper regions cover lower outlines in the same order as preview SVGs');
  coloring.send('pointerdown',{pointerType:'touch',clientX:150,clientY:150});coloring.send('pointerup',{pointerType:'touch',clientX:150,clientY:150});
  assert.equal(coloring.api.exportEditable().template.colors.brow,'#ff6034','topmost closed path wins overlapping hits');assert.equal(coloring.api.exportEditable().template.colors.face,undefined);
  const oneRegionImage=coloring.api.getImage(),oneRegion=JSON.stringify(coloring.api.exportEditable().template);
  assert.match(coloring.elements.get('coloringProgress').textContent,/1 \/ 2/);
  coloring.api.selectTemplate('test-mask');assert.equal(coloring.api.getImage(),oneRegionImage,'same template selection never resets its colors');
  coloring.send('pointerdown',{clientX:10,clientY:10});coloring.send('pointerup',{clientX:10,clientY:10});assert.equal(coloring.api.getImage(),oneRegionImage,'outside template does not fill the entire paper');
  coloring.send('pointerdown');coloring.send('pointermove',{clientX:180});coloring.send('pointerup',{clientX:180});
  coloring.send('pointerdown');coloring.send('pointercancel');
  coloring.send('pointerdown');coloring.send('lostpointercapture');coloring.send('pointerup');
  coloring.send('pointerdown',{pointerType:'touch'});coloring.send('pointerdown',{pointerType:'touch',pointerId:2,isPrimary:false});coloring.send('pointerup',{pointerType:'touch',pointerId:2});coloring.send('pointerup',{pointerType:'touch'});
  assert.equal(coloring.api.getImage(),oneRegionImage,'drag/pinch/cancel/capture loss never accidentally color a template region');
  const browButton=coloring.elements.get('coloringRegionList').children[1];assert.match(browButton.getAttribute('aria-label'),/已上色/);
  coloring.api.setColor('#bd251f');browButton.dispatchEvent({type:'click'});
  assert.equal(coloring.elements.get('coloringRegionList').children[1],browButton,'color updates preserve the focused accessible region button');
  assert.equal(coloring.api.exportEditable().template.colors.brow,'#bd251f');coloring.click('btnUndo');assert.equal(coloring.api.exportEditable().template.colors.brow,'#ff6034');coloring.click('btnRedo');
  const coloredImage=coloring.api.getImage();coloring.click('btnMethodFree');assert.equal(coloring.api.getImage(),coloredImage,'switching methods does not alter pixels');
  assert.equal(coloring.elements.get('coloringPanel').hidden,true);assert.equal(coloring.elements.get('freeBrushSettings').hidden,false);
  coloring.send('pointerdown');coloring.send('pointerup');const overlayInk=coloring.api.exportEditable().strokes;
  coloring.click('btnEraser');coloring.send('pointerdown');coloring.send('pointerup');assert.equal(coloring.api.getImage(),coloredImage,'eraser removes only new strokes, never template colors');coloring.click('btnUndo');
  coloring.click('btnMethodColoring');assert.equal(coloring.api.exportEditable().strokes,overlayInk);assert.equal(coloring.api.exportEditable().template.colors.brow,'#bd251f');
  coloring.api.setColor('#90dfe1');coloring.send('pointerdown',{clientX:150,clientY:150});coloring.send('pointerup',{clientX:150,clientY:150});
  assert.equal(coloring.api.exportEditable().template.colors.brow,'#90dfe1','predefined regions ignore intervening freehand strokes');
  assert.equal(coloring.api.exportEditable().strokes,overlayInk);assert.equal(coloring.api.fillTemplateRegion('bad'),false);
  coloring.click('btnMethodFree');coloring.api.setTool('fill');coloring.api.setColor('#adca7a');
  const rasterBeforeTemplateFill=coloring.api.exportEditable().fills;
  coloring.send('pointerdown',{clientX:150,clientY:150});coloring.send('pointerup',{clientX:150,clientY:150});
  assert.equal(coloring.api.exportEditable().template.colors.brow,'#adca7a','free-mode bucket still edits semantic template regions');assert.equal(coloring.api.exportEditable().fills,rasterBeforeTemplateFill,'template recoloring never creates opaque raster covers');
  coloring.click('btnUndo');assert.equal(coloring.api.exportEditable().template.colors.brow,'#90dfe1');
  coloring.click('btnClearFills');assert.deepEqual(Object.keys(coloring.api.exportEditable().template.colors),[]);assert.equal(coloring.api.exportEditable().strokes,overlayInk);coloring.click('btnUndo');assert.equal(coloring.api.exportEditable().template.colors.brow,'#90dfe1','clear colors preserves the template and can be undone');
  coloring.click('btnMethodColoring');
  const templateArtwork=coloring.api.getImage(),templateEditable=coloring.api.exportEditable();
  const reopenedTemplate=setup(coloring.storage.get('nuo_drawing_draft_v1'),false,templates);await tick();await tick();
  assert.equal(reopenedTemplate.api.getImage(),templateArtwork);assert.equal(JSON.stringify(reopenedTemplate.api.exportEditable()),JSON.stringify(templateEditable),'template/colors/method/strokes all survive local reload');
  const restoredTemplate=setup(undefined,false,templates);await tick();assert.equal(await restoredTemplate.api.restore(templateArtwork,undefined,templateEditable),true);assert.equal(restoredTemplate.api.getImage(),templateArtwork);
  restoredTemplate.api.enter();assert.equal(restoredTemplate.api.exportEditable().creationMethod,'coloring','entering and returning to a work retains its method');
  coloring.api.selectTemplate('test-other');assert.equal(coloring.api.exportEditable().template.id,'test-other');assert.equal(coloring.api.exportEditable().strokes,overlayInk);coloring.click('btnUndo');assert.equal(coloring.api.getImage(),templateArtwork,'undo restores a replaced template and all its colors');
  await coloring.api.addReference('assets/masks/0001.svg');assert.equal(coloring.api.exportEditable().template,null);assert.equal(coloring.api.exportEditable().creationMethod,'free');assert.equal(coloring.api.exportEditable().strokes,overlayInk);coloring.click('btnUndo');assert.equal(coloring.api.getImage(),templateArtwork,'undo replacing a template with an original outline restores colors');
  coloring.api.clear();assert.equal(coloring.api.exportEditable().template,null);assert.equal(coloring.api.hasContent(),false);coloring.click('btnUndo');assert.equal(coloring.api.getImage(),templateArtwork,'clear and undo preserve vector template state');
  assert.equal(coloring.api.validateEditable({...templateEditable,template:{id:'unknown',colors:{}}}),null);
  assert.equal(coloring.api.validateEditable({...templateEditable,template:{id:'test-mask',colors:{bad:'#ffffff'}}}),null);
  assert.equal(coloring.api.validateEditable({...templateEditable,template:{id:'test-mask',colors:{face:'red'}}}),null);
  assert.equal(coloring.api.validateEditable({...templateEditable,template:{id:'test-mask',colors:[]}}),null);
  assert.equal(coloring.api.validateEditable({...templateEditable,creationMethod:'unknown'}),null);
  assert.equal(coloring.api.validateEditable({...templateEditable,outline:editable.outline}),null,'two conflicting base layers are rejected');
  const independentTemplate=coloring.api.validateEditable(templateEditable);independentTemplate.template.colors.brow='#000000';assert.equal(coloring.api.exportEditable().template.colors.brow,'#90dfe1','validation cannot mutate internal colors');
  const oldV3={...editable,outline:{...editable.outline,cuts:[]}};delete oldV3.template;delete oldV3.creationMethod;
  const compatibleTemplate=setup(undefined,false,templates);await tick();assert.equal(await compatibleTemplate.api.restore(layeredPNG,undefined,oldV3),true);assert.equal(compatibleTemplate.api.getImage(),layeredPNG);assert.equal(compatibleTemplate.api.exportEditable().creationMethod,'free','older works retain free drawing even when new empty works default to coloring');
  assert.equal(compatibleTemplate.api.exportEditable().template,null);
  compatibleTemplate.api.extractPart({x:200,y:250,w:100,h:100});compatibleTemplate.window.NuoPaintRegions={findRegion:()=>({indices:new Uint32Array([0]),touchesEdge:false,tooLarge:false})};compatibleTemplate.api.setTool('fill');compatibleTemplate.api.enter();compatibleTemplate.send('pointerdown');compatibleTemplate.send('pointerup');
  const priorLayers=compatibleTemplate.api.exportEditable();compatibleTemplate.api.selectTemplate('test-mask');
  assert.equal(compatibleTemplate.api.exportEditable().fills,priorLayers.fills);assert.equal(compatibleTemplate.api.exportEditable().strokes,priorLayers.strokes);assert.equal(JSON.stringify(compatibleTemplate.api.exportEditable().parts),JSON.stringify(priorLayers.parts),'choosing a template keeps user fills, strokes and cropped source parts');
  const lateTemplate=setup(undefined,true,templates);await tick();const delayedOutline=lateTemplate.api.addReference('assets/masks/0001.svg');lateTemplate.api.selectTemplate('test-mask');lateTemplate.pending.shift()();assert.equal(await delayedOutline,false);assert.equal(lateTemplate.api.exportEditable().template.id,'test-mask','an outdated asynchronous original outline cannot overwrite a newly selected template');
  const originalTemplate={...templates[0],id:'original-test',kind:'original',overlay:'assets/coloring/test-overlay.svg',silhouette:templates[0].regions[0].path,regions:templates[0].regions.map((r,i)=>({...r,family:i?'ornament':'face'}))};
  const originalCatalog=[{...templates[0],hidden:true,legacy:true},originalTemplate];
  const original=setup(undefined,false,originalCatalog);await tick();
  assert.equal(original.elements.get('coloringTemplateList').children.length,1,'legacy templates stay restorable but leave the picker');
  assert.equal(await original.api.selectTemplate('original-test'),true);
  assert.ok(original.marks().some(mark=>mark.src===originalTemplate.overlay),'full original linework overlays the fill regions');
  assert.equal(original.marks().filter(mark=>mark.kind==='template-outline').length,0,'original templates never add crude outlines around every color cell');
  const beforeScheme=original.api.getImage();
  assert.equal(original.api.applyColoringScheme('teal'),true);
  assert.equal(original.api.exportEditable().template.colors.face,'#538180');
  assert.equal(original.api.exportEditable().template.colors.brow,'#c6a367');
  const withScheme=original.api.getImage();original.click('btnUndo');assert.equal(original.api.getImage(),beforeScheme);original.click('btnRedo');assert.equal(original.api.getImage(),withScheme,'suggested palette is one reversible edit');
  original.click('btnMethodFree');original.send('pointerdown');original.send('pointerup');const originalInk=original.api.exportEditable().strokes;
  original.api.applyColoringScheme('ivory');assert.equal(original.api.exportEditable().strokes,originalInk,'suggested palettes preserve freehand strokes');
  const originalSaved=original.storage.get('nuo_drawing_draft_v1');
  const originalReload=setup(originalSaved,false,originalCatalog);await tick();await tick();
  assert.equal(originalReload.api.getImage(),original.api.getImage(),'restore waits for the detailed overlay before saving');
  const delayedOriginal=setup(undefined,true,originalCatalog);await tick();
  const loadingOriginal=delayedOriginal.api.selectTemplate('original-test');
  assert.equal(delayedOriginal.api.selectTemplate('test-mask'),true);delayedOriginal.pending.shift()();
  assert.equal(await loadingOriginal,false);assert.equal(delayedOriginal.api.exportEditable().template.id,'test-mask','a slow overlay cannot overwrite a later template choice');
  const switchedWhileLoading=setup(undefined,true,originalCatalog);await tick();
  const abandonedOverlay=switchedWhileLoading.api.selectTemplate('original-test');
  switchedWhileLoading.api.setCreationMethod('free');switchedWhileLoading.pending.shift()();
  assert.equal(await abandonedOverlay,false);assert.equal(switchedWhileLoading.api.exportEditable().creationMethod,'free');assert.equal(switchedWhileLoading.api.exportEditable().template,null,'changing creation method cancels a late template selection');
  const retiredOriginal={...originalTemplate,id:'original-v1',hidden:true,legacy:true};
  const anatomicalOriginal={...originalTemplate,id:'original-v2',regionEdgeUnderlap:1.4,regions:[
    {...originalTemplate.regions[0],id:'horn-left',name:'左龙角',family:'horn'},
    {...originalTemplate.regions[1],id:'whisker-left',name:'左侧触须',family:'whisker'}
  ]};
  const versionedCatalog=[{...templates[0],hidden:true,legacy:true},retiredOriginal,anatomicalOriginal];
  const versioned=setup(undefined,false,versionedCatalog);await tick();
  await versioned.api.selectTemplate('original-v1');versioned.api.fillTemplateRegion('face');
  const previousRegionWork=versioned.api.exportEditable(),previousRegionImage=versioned.api.getImage();
  const upgradeControl=versioned.elements.get('upgradeColoringTemplate');
  assert.equal(upgradeControl.dataset.templateId,'original-v2','upgrade skips both retired simplified and retired original layouts');
  assert.equal(versioned.elements.get('coloringTemplateList').children.length,1,'only the current anatomical layout appears in the picker');
  const retainedVersion=setup(versioned.storage.get('nuo_drawing_draft_v1'),false,versionedCatalog);await tick();await tick();
  assert.equal(retainedVersion.api.exportEditable().template.id,'original-v1','new layouts never silently remap a stored draft');
  assert.equal(retainedVersion.api.getImage(),previousRegionImage,'a retired original draft keeps its previous pixels and colors');
  versioned.click('upgradeColoringTemplate');await tick();
  assert.equal(versioned.api.exportEditable().template.id,'original-v2');
  assert.deepEqual(Object.keys(versioned.api.exportEditable().template.colors),[],'new region IDs start uncolored rather than inheriting unrelated region colors');
  assert.equal(versioned.api.exportEditable().strokes,previousRegionWork.strokes);
  versioned.click('btnUndo');assert.equal(versioned.api.getImage(),previousRegionImage,'switching to the anatomical layout is reversible');
  versioned.click('btnRedo');versioned.api.fillTemplateRegion('horn-left');
  assert.equal(versioned.api.exportEditable().template.colors['whisker-left'],undefined,'filling a horn does not assign a color to the separate whisker');
  const coloredUnderlap=versioned.marks().filter(mark=>mark.kind==='template-outline');
  assert.deepEqual(coloredUnderlap.map(mark=>mark.color),['#ff6034','#fffaf0'],'new-layout seams use their own fill colors, not dark extra outlines');
  versioned.api.applyColoringScheme('teal');
  assert.notEqual(versioned.api.exportEditable().template.colors['horn-left'],versioned.api.exportEditable().template.colors['whisker-left'],'suggested colors distinguish horns and whiskers');
  const beforeCustom=versioned.api.getImage(),storedBeforeColor=versioned.storage.get('nuo_drawing_draft_v1');
  versioned.click('btnColorWheel');versioned.picker.change('#4276b9');
  assert.equal(versioned.api.getImage(),beforeCustom,'dragging the color wheel does not paint or create history');
  assert.equal(versioned.storage.get('nuo_drawing_draft_v1'),storedBeforeColor,'continuous color selection does not serialize the draft per event');
  assert.equal(versioned.elements.get('currentColorValue').textContent,'#4276B9');
  let closedWithEscape=false;
  versioned.document.dispatchEvent({type:'keydown',key:'Escape',target:versioned.elements.get('showColorWheel'),preventDefault(){closedWithEscape=true;}});
  assert.equal(closedWithEscape,true);assert.equal(versioned.elements.get('colorTray').hidden,true);
  assert.equal(versioned.elements.get('deskPanelBackdrop').hidden,true);
  assert.equal(JSON.parse(versioned.storage.get('nuo_drawing_draft_v1')).brushColor,'#4276b9','closing the picker commits the final chosen color');
  versioned.api.fillTemplateRegion('horn-left');
  assert.equal(versioned.api.exportEditable().template.colors['horn-left'],'#4276b9');
  versioned.click('btnUndo');assert.equal(versioned.api.getImage(),beforeCustom,'color selection adds no spurious undo step');
  const customReload=setup(versioned.storage.get('nuo_drawing_draft_v1'),false,versionedCatalog);await tick();await tick();
  assert.equal(customReload.picker.color,'#4276b9','the wheel restores the saved custom color');
  versioned.click('btnDeskFree');assert.equal(versioned.api.exportEditable().creationMethod,'free');
  versioned.click('btnDeskColoring');assert.equal(versioned.api.exportEditable().creationMethod,'coloring');
  assert.equal(versioned.api.getImage(),beforeCustom,'nearby method controls preserve the artwork');
  const saveFailure=setup(undefined,false,templates);await tick();saveFailure.api.selectTemplate('test-mask');
  const storedBeforeFailure=saveFailure.storage.get('nuo_drawing_draft_v1');saveFailure.setStorageFailure();saveFailure.api.fillTemplateRegion('face');
  assert.equal(saveFailure.storage.get('nuo_drawing_draft_v1'),storedBeforeFailure,'storage failure does not corrupt the previous draft');
  assert.match(saveFailure.elements.get('canvasSaveStatus').textContent,/保存失败/,'the successful fill message cannot hide a failed autosave');
  saveFailure.api.setCreationMethod('free');assert.match(saveFailure.elements.get('drawingStatus').textContent,/保存失败/,'later tool feedback keeps the outstanding save warning visible');
  saveFailure.setStorageFailure(false);assert.equal(saveFailure.api.saveDraft(),true);
  assert.doesNotMatch(saveFailure.elements.get('canvasSaveStatus').textContent,/保存失败/,'only a successful save clears the warning');
  assert.equal(JSON.parse(saveFailure.storage.get('nuo_drawing_draft_v1')).drawing.template.colors.face,'#ff6034','retry saves the latest in-memory color rather than the old stored state');
  console.log('PASS: clear confirmation/cancel/undo and eraser reset, hidden-tab stroke/layer/color flush with metadata and reload, persistent autosave-failure warnings and successful retry.');
  console.log('PASS: custom color preview/persistence, no color-only undo step, Escape closes picker first, reload and nearby method switches preserve art.');
  console.log('PASS: retired original layouts preserve draft pixels, explicit upgrade selects the current layout, upgrade undo restores the prior work, and horn/whisker colors stay independent.');
  console.log('PASS: original overlay and fill separation, hidden legacy template restore, semantic palettes/undo, ink preservation, overlay reload and late-load cancellation.');
  console.log('PASS: predefined template topmost hit/paint order, accessible recoloring, mode and pixel preservation, region/stroke isolation, fill/part preservation, undo/redo/clear/replace, local reload and reopening, old v3 compatibility, validation, late outline cancellation, no fill on scroll/pinch/cancel.');
  console.log('PASS: v3 fill isolation/reload/undo/clear, no accidental fill on drag/pinch/cancel, v2 double validation and restoration, source-preserving rectangular parts/transforms/delete undo/reload, clipped/numeric/multitouch selection and part limit; continuous coalesced curves, final tip, pen pressure, stable touch/mouse width, multi-touch/cancel/capture loss, resize termination, spray symmetry, brush preferences, mobile focus; focused-visible-workshop shortcuts, native inputs/game/result isolation; layered background/reference/strokes, locked transform, single-gesture undo, erase isolation, editable reload/restore, legacy preservation, PNG caching, invalid state, failed/late restore; pointer strokes/cancel, undo/redo, undo clear, draft reload, restore race, fixed resize, form shortcuts, reference insertion, storage failure, finish events, atomic journey metadata, restore/clear metadata, reset history, startup write guard.');
})().catch(error=>{console.error(error);process.exitCode=1;});
