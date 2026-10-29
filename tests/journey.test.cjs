/* Run: node tests/journey.test.cjs. Minimal DOM/storage model for the user-facing save flows. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../journey.js'), 'utf8');
const PNG = 'data:image/png;base64,aGVsbG8=';
const DRAFT = 'nuo_journey_draft_v1', WORKS = 'nuo_journey_works_v1', DRAWING = 'nuo_drawing_draft_v1';
const validDraft = {version:1,referenceIds:[1],step:'journey-result',target:'self',wish:'愿我敢于表达',title:'我的作品',explanation:'我选择了对称的布局'};
function setup(seed = {}, options = {}) {
  let image = seed[DRAWING]?.image || PNG, confirms = 0, failKey = '', sequence = 0, resetCount = 0, failRestore = false, enterCount = 0;
  let metadata = seed[DRAWING]?.journey || null;
  let editable = seed[DRAWING]?.drawing;
  const writes = [], exportedText = [], scrolls = [], focused = [], hashChanges = [];
  const exportOrder=[], exportCanvases=[], revokedURLs=[], measuredFonts=[], paintedFonts=[];
  const frames=[];
  const location={hash:options.hash || '',pathname:'/nuo-atlas/',search:'?round=2',assign(url){this.assigned=url;}};
  const exportContext={measureText(text){measuredFonts.push(this.font);return {width:text.length*24};},scale(){},fillRect(){},strokeRect(){},drawImage(){exportOrder.push('image');},fillText(text){exportedText.push(text);exportOrder.push(text);paintedFonts.push({text,font:this.font});}};
  const storage = new Map(Object.entries(seed).map(([key,value])=>[key,JSON.stringify(value)]));
  const session = new Map();
  const sessionStorage = {setItem(key,value){if(options.sessionFailure)throw new Error('QuotaExceeded');session.set(key,value);}};
  const elements = new Map();
  class Element {
    constructor(){this.events={};this.dataset={};this.value='';this.textContent='';this.innerHTML='';this.hidden=false;this.id='';this.disabled=false;this.open=false;}
    setAttribute(name,value){this[name]=String(value);}
    addEventListener(type,fn,capture){(this.events[type] ||= [])[capture===true?'unshift':'push'](fn);}
    async emit(type,event={}){let stopped=false;const pending=[];const value={target:this,preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){stopped=true;},...event};for(const fn of this.events[type]||[]){pending.push(fn(value));if(stopped)break;}await Promise.all(pending);return value;}
    closest(selector){if(selector==='.research-library' && ['research-library','timeline','atlas'].includes(this.id))return $('research-library');return selector==='button'&&this.dataset?this:selector==='#galaxy'&&['galaxy','galaxyStage'].includes(this.id)?this:null;}
    scrollIntoView(options){scrolls.push({id:this.id,options});} focus(options){focused.push({id:this.id,options});document.activeElement=this;} blur(){document.activeElement=document.body;}
    matches(selector){return selector.split(',').some(id=>id.trim()==='#'+this.id);} contains(target){return target===this || this.child===target;} append(){} remove(){} click(){}
    getContext(){return exportContext;}toBlob(done){done({});}
  }
  const $ = id=>{if(!elements.has(id)){const e=new Element();e.id=id;elements.set(id,e);}return elements.get(id);};
  $('research-library').hidden=true;
  const document = new Element();document.documentElement={lang:options.language || 'zh-CN'};document.getElementById=$;document.body=new Element();document.fonts=options.fonts;
  const radios=['self','gift'].map(value=>{const e=new Element();e.value=value;return e;});
  document.querySelector=selector=>radios.find(e=>selector.includes('"'+e.value+'"'))||new Element();
  const referenceButtons = [new Element(), new Element()];
  document.querySelectorAll=selector=>selector==='input[name="journeyTarget"]'?radios:selector.includes('data-add-ref="1"')?referenceButtons:[];document.createElement=tag=>{const e=new Element();if(tag==='canvas')exportCanvases.push(e);return e;};
  const window=new Element();window.dispatchEvent=e=>window.emit(e.type,e);
  window.confirm=()=>{confirms++;return false;};window.matchMedia=()=>({matches:true});window.crypto={randomUUID:()=>`work-${++sequence}`};
  function saveDrawing(nextMetadata){
    if(nextMetadata!==undefined)metadata=JSON.parse(JSON.stringify(nextMetadata));
    try{localStorage.setItem(DRAWING,JSON.stringify({version:1,image,journey:metadata,drawing:editable}));return true;}catch(_){return false;}
  }
  window.NuoDrawing={ready:true,hasContent:()=>Boolean(image),getImage:()=>image,enter(){enterCount++;},addReference:async()=>true,
    clear(next){image='';saveDrawing(next);window.dispatchEvent({type:'nuo:drawing-change'});return true;},
    restore:async(value,next,layers)=>{if(failRestore)return false;image=value;editable=layers;saveDrawing(next);window.dispatchEvent({type:'nuo:drawing-change'});return true;},
    exportEditable:()=>editable,validateEditable:value=>[2,3].includes(value?.version)?value:null,
    saveDraft:saveDrawing,resetHistory(){resetCount++;}
  };
  const sources=[{title:'原始资料',url:'https://example.org/mask/1'}];
  const sample={id:1,name:'样本',region:'江西',image:'assets/masks/0001.svg',imageAlt:'线稿',sources,sourceUrl:sources[0].url,creator:'作者'};
  window.NUO_MASK_ATLAS={nodes:[...Array.from({length:15},(_,index)=>index+1),317,319,325].map(id=>({
    ...sample,id,name:id===1?sample.name:'样本'+id,
    image:'assets/masks/'+String(id).padStart(4,'0')+'.svg',detailUrl:'https://example.org/mask/'+id
  }))};
  window.NUO_COLORING_TEMPLATES=[
    {id:'panguan',name:'判官练习稿',sourceId:317,source:'assets/masks/0317.svg'},
    {id:'caishen',name:'财神练习稿',sourceId:319,source:'assets/masks/0319.svg'},
    {id:'longwang',name:'龙王练习稿',sourceId:325,source:'assets/masks/0325.svg'},
    {id:'bad-path',name:'无效路径',sourceId:4,source:'https://example.org/assets/masks/0004.svg'}
  ];
  window.NUO_JOURNEY_CONTENT={samples:[sample],intro:{context:'地方',craft:'木雕',performance:'表演',boundary:'项目说明',sources},labels:{imageNote:'线稿'}};
  const localStorage={getItem:key=>storage.get(key)||null,setItem(key,value){if(failKey===key)throw new Error('QuotaExceeded');storage.set(key,value);writes.push({key,value:JSON.parse(value)});}};
  class ExportURL extends URL{};ExportURL.createObjectURL=()=> 'blob:test';ExportURL.revokeObjectURL=url=>revokedURLs.push(url);
  class ExportImage{constructor(){this.width=900;this.height=1000;}set src(value){queueMicrotask(()=>this.onload());}}
  if (options.language === 'en') {
    for (const name of ['site', 'content', 'archive', 'interactive', 'intro-1', 'intro-2', 'intro-3']) vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname, '../locales/' + name + '-en.js'), 'utf8'), {window});
    window.NuoI18n = {t: text => window.NUO_EN[text] || text};
  }
  vm.runInNewContext(source,{window,document,localStorage,sessionStorage,history:{replaceState(_state,_title,hash){hashChanges.push(hash);location.hash=new URL(hash,'https://example.org/nuo-atlas/').hash;}},location,requestAnimationFrame:fn=>options.deferFrames?frames.push(fn):fn(),URL:ExportURL,Event,Intl,Date,crypto:window.crypto,console,setTimeout:()=>0,Image:ExportImage},{filename:'journey.js'});
  const delegated = async (host,dataset)=>{const button=new Element();button.dataset=dataset;await (host===null?document:$(host)).emit('click',{target:button});return button;};
  return {$,window,document,storage,session,delegated,scrolls,focused,hashChanges,location,flushFrames(){while(frames.length)frames.shift()();},referenceButtons,enterCount:()=>enterCount,editable:()=>editable,confirms:()=>confirms,setFail:key=>failKey=key,image:()=>image,writes,exportedText,exportOrder,exportCanvases,revokedURLs,measuredFonts,paintedFonts,resetCount:()=>resetCount,setRestoreFailure:()=>failRestore=true};
}
(async()=>{
  const saved={...validDraft,id:'saved-1',workId:'saved-1',date:'2026-10-03T00:00:00Z',image:PNG};
  const customResult=setup({[DRAFT]:validDraft});
  customResult.$('drawWorkName').value='最新定制稿';await customResult.$('drawWorkName').emit('input');
  await customResult.$('customizeWork').emit('click');
  const handoff=JSON.parse(customResult.session.get('nuo_custom_work_v1'));
  assert.equal(handoff.origin,'result');assert.equal(handoff.work.title,'最新定制稿','customization uses the latest valid work');
  assert.equal(handoff.work.image,PNG);assert.equal(customResult.location.assigned,'customize.html?lang=zh');
  assert.equal(handoff.productionSourceId,null,'collected references do not identify the production base');
  assert.deepEqual(handoff.references,[{id:1,name:'样本',region:'江西',note:'',sources:[{title:'原始资料',url:'https://example.org/mask/1'}]}]);
  const customSaved=setup({[DRAFT]:{...validDraft,title:'保留的当前草稿'},[WORKS]:[saved]},{language:'en'});
  const beforeCustomDraft=customSaved.storage.get(DRAWING);
  await customSaved.delegated('savedWorks',{customizeWork:'saved-1'});
  assert.equal(JSON.parse(customSaved.session.get('nuo_custom_work_v1')).origin,'saved');
  assert.equal(JSON.parse(customSaved.session.get('nuo_custom_work_v1')).work.id,'saved-1');
  assert.equal(customSaved.storage.get(DRAWING),beforeCustomDraft,'ordering a saved work does not replace the active drawing');
  assert.equal(customSaved.location.assigned,'customize.html?lang=en');
  assert.equal(customSaved.$('customOrdersLink').href,'customize.html?view=orders&lang=en');
  for (const [drawing,expected] of [
    [{version:3,template:{id:'panguan',sourceId:319},outline:{src:'assets/masks/0325.svg'}},317],
    [{version:3,outline:{src:'assets/masks/0319.svg'}},319],
    [{version:3,outline:{src:'https://example.org/assets/masks/0319.svg'}},null],
    [{version:3,outline:{src:'assets/masks/9999.svg'}},null]
  ]) {
    const customBase=setup({[WORKS]:[{...saved,referenceNotes:{1:'保留冠饰的细节'},drawing}]});
    await customBase.delegated('savedWorks',{customizeWork:'saved-1'});
    const metadata=JSON.parse(customBase.session.get('nuo_custom_work_v1'));
    assert.equal(metadata.productionSourceId,expected,'identify the actual trusted template or exact outline');
    assert.equal(metadata.references.find(reference=>reference.id===1).note,'保留冠饰的细节');
    assert.deepEqual(metadata.work.drawing,drawing,'production metadata does not rewrite the user drawing');
  }
  const customFailure=setup({[DRAFT]:validDraft},{sessionFailure:true});
  await customFailure.$('customizeWork').emit('click');
  assert.equal(customFailure.location.assigned,undefined,'a failed handoff does not navigate away');
  assert.match(customFailure.$('resultStatus').textContent,/当前作品仍保留/);
  const shortcut=setup();
  delete shortcut.$('research-library').open; // The library is an ordinary container, revealed by navigation.
  shortcut.$('siteMenu').open=true;
  const directLink=shortcut.$('directCreate');
  directLink.getAttribute=()=> '#galaxy';
  directLink.closest=selector=>selector.includes('a[href')?directLink:null;
  await shortcut.document.emit('click',{target:directLink});
  assert.equal(shortcut.scrolls.at(-1).id,'galaxy','direct creation bypasses the reading route');
  assert.equal(shortcut.enterCount(),1,'direct creation enables drawing');
  assert.equal(shortcut.$('siteMenu').open,false,'navigation dismisses the mobile menu');
  assert.equal(shortcut.$('research-library').hidden,true,'direct creation must not open the cultural library');
  assert.deepEqual(JSON.parse(shortcut.storage.get(DRAWING)).journey.referenceIds,[],'a shortcut does not invent a cultural reference');
  const browseLink=shortcut.$('browseCultureAtlas');
  browseLink.closest=selector=>selector==='button'||selector.includes('#browseCultureAtlas')?browseLink:null;
  const beforeBrowse=shortcut.scrolls.length;
  await shortcut.document.emit('click',{target:browseLink});
  assert.equal(shortcut.$('research-library').hidden,false,'the browse button reveals the directory and all cultural chapters');
  assert.equal(browseLink['aria-expanded'],'true');
  assert.equal(browseLink.textContent,'收起文化图谱');
  assert.equal(shortcut.scrolls.length,beforeBrowse,'expanding preserves the current reading position');
  shortcut.location.hash='#timeline';
  await shortcut.document.emit('click',{target:browseLink});
  assert.equal(shortcut.$('research-library').hidden,true,'the same button collapses the library');
  assert.equal(browseLink['aria-expanded'],'false');
  assert.equal(browseLink.textContent,'展开文化图谱');
  assert.equal(shortcut.location.hash,'#culture-guide','collapse clears a hidden chapter fragment without jumping');
  assert.equal(shortcut.scrolls.length,beforeBrowse,'collapsing also preserves the current reading position');
  await shortcut.document.emit('pointerdown',{pointerType:'touch',pointerId:8,clientX:100,clientY:200,target:browseLink});
  await shortcut.document.emit('pointermove',{pointerType:'touch',pointerId:8,clientX:100,clientY:250,target:browseLink});
  const staleBrowse=await shortcut.document.emit('click',{target:browseLink,detail:1});
  assert.equal(staleBrowse.defaultPrevented,true,'a swipe ending on the disclosure cannot toggle the library');
  assert.equal(shortcut.$('research-library').hidden,true);
  await shortcut.document.emit('click',{target:browseLink,detail:0});
  assert.equal(shortcut.$('research-library').hidden,false,'keyboard activation and repeated opening work');
  await shortcut.document.emit('click',{target:directLink});
  assert.equal(shortcut.$('research-library').hidden,false,'later creation navigation does not collapse the opened content');
  const deepLink=setup({}, {hash:'#timeline'});
  assert.equal(deepLink.$('research-library').hidden,false,'a direct cultural chapter link is also readable');
  assert.equal(deepLink.scrolls.at(-1).id,'timeline');
  for (const fromArchive of [false, true]) {
    const navigation=setup({[DRAFT]:{...validDraft,referenceIds:[],step:fromArchive?'galaxy':'journey-explore'}});
    assert.equal(navigation.window.NuoJourney.hasReference(1),false);
    if(fromArchive)await navigation.window.emit('nuo:add-reference',{detail:{id:1}});
    else await navigation.delegated(null,{addRef:'1'});
    assert.equal(navigation.window.NuoJourney.hasReference('1'),true,'archive buttons can query current reference state');
    assert.deepEqual(JSON.parse(navigation.storage.get(DRAWING)).journey.referenceIds,[1],'reference is saved from either entry point');
    assert.deepEqual(navigation.scrolls,[],'adding a reference must not scroll away from the current view');
    assert.deepEqual(navigation.focused,[],'adding a reference must not move focus or open the mobile keyboard');
    assert.deepEqual(navigation.hashChanges,[],'adding a reference must not rewrite the current section URL');
    assert.equal(navigation.document.body.dataset.journeyStep,undefined,'adding a reference must not change the active route');
    assert.ok(navigation.referenceButtons.every(button=>button.textContent==='已加入我的参考 ✓'),'both entry points show a local confirmation');
    await navigation.window.emit('nuo:add-reference',{detail:{id:1}});
    assert.deepEqual(JSON.parse(navigation.storage.get(DRAWING)).journey.referenceIds,[1],'repeated selection is idempotent');
    await navigation.$('intentionForm').emit('submit');
    assert.equal(navigation.hashChanges.at(-1),'#galaxy','explicit continue still navigates to the workshop');
    assert.equal(navigation.scrolls.at(-1).id,'galaxy');
  }
  const outlineNavigation=setup({[DRAFT]:validDraft});
  let finishOutline;
  outlineNavigation.window.NuoDrawing.addReference=()=>new Promise(resolve=>{finishOutline=resolve;});
  const applyingOutline=outlineNavigation.delegated(null,{useOutline:'1'});
  outlineNavigation.document.body.dataset.journeyStep='starmap-section';
  finishOutline(true);const outlineButton=await applyingOutline;
  assert.deepEqual(outlineNavigation.scrolls,[],'finishing an asynchronous outline load must not scroll');
  assert.deepEqual(outlineNavigation.hashChanges,[],'outline load must not overwrite a subsequent navigation');
  assert.equal(outlineNavigation.document.body.dataset.journeyStep,'starmap-section');
  assert.equal(outlineNavigation.enterCount(),0,'outline completion must not re-enter the workshop');
  assert.equal(outlineButton.textContent,'已使用这张线稿 ✓','outline confirmation stays at the clicked control');
  const focusNavigation=setup();
  for(const id of ['drawCanvas','sampleDetail']){
    focusNavigation.$(id).focus({preventScroll:true});
    await focusNavigation.document.emit('pointerdown',{pointerType:'touch',target:focusNavigation.$('starmapCanvas')});
    assert.equal(focusNavigation.document.activeElement,focusNavigation.document.body,'touching another section releases old programmatic focus');
  }
  const detail=focusNavigation.$('sampleDetail');detail.child=focusNavigation.$('sampleDetailsLink');detail.focus();
  await focusNavigation.document.emit('pointerdown',{pointerType:'touch',target:detail.child});
  assert.equal(focusNavigation.document.activeElement,detail,'interacting inside the focused detail preserves focus');
  await focusNavigation.document.emit('pointerdown',{pointerType:'mouse',target:focusNavigation.$('starmapCanvas')});
  assert.equal(focusNavigation.document.activeElement,detail,'mouse/keyboard navigation focus is preserved');
  const input=focusNavigation.$('journeyWish');input.focus();
  await focusNavigation.document.emit('pointerdown',{pointerType:'touch',target:focusNavigation.$('starmapCanvas')});
  assert.equal(focusNavigation.document.activeElement,input,'text input focus is not forcibly blurred');
  const libraryFocus=setup();let panelCloses=0;
  const library=libraryFocus.$('research-library'), chart=libraryFocus.$('starChart'), search=libraryFocus.$('searchInput');
  library.contains=target=>[library,chart,search].includes(target);
  libraryFocus.window.NuoDrawing.closePanels=()=>{panelCloses++;};
  for(const id of ['showColorWheel','btnMoreColors','drawWorkName','drawWorkDesc']) {
    libraryFocus.$(id).focus({preventScroll:true});
    await libraryFocus.document.emit('pointerdown',{pointerType:'touch',target:chart});
    assert.equal(libraryFocus.document.activeElement,libraryFocus.document.body,'entering the cultural library releases old workshop focus: '+id);
  }
  assert.equal(panelCloses,4);assert.deepEqual(libraryFocus.scrolls,[]);assert.deepEqual(libraryFocus.hashChanges,[]);
  search.focus();await libraryFocus.document.emit('pointerdown',{pointerType:'touch',target:search});
  assert.equal(libraryFocus.document.activeElement,search,'the research search field keeps its own focus');
  let syntheticResizes=0;libraryFocus.window.addEventListener('resize',()=>syntheticResizes++);
  await libraryFocus.document.emit('pointerdown',{pointerType:'touch',target:chart});
  assert.equal(syntheticResizes,0,'reading research does not resize every unrelated renderer');
  const reading=setup({[DRAFT]:{...validDraft,step:'galaxy'}},{hash:'#galaxy'});
  const readingLibrary=reading.$('research-library'), readingDirectoryLink=reading.$('libraryDirectoryLink'), readingChart=reading.$('researchChart');
  readingLibrary.contains=target=>[readingLibrary,readingDirectoryLink,readingChart].includes(target);
  readingDirectoryLink.closest=selector=>selector.includes('a[href')?readingDirectoryLink:null;
  readingDirectoryLink.getAttribute=()=> '#timeline';
  reading.$('timeline').closest=selector=>selector==='.research-library'?readingLibrary:null;
  await reading.document.emit('pointerdown',{pointerType:'touch',pointerId:3,clientX:100,clientY:200,target:readingChart});
  assert.equal(reading.location.hash,'','touching the static library releases an old workshop fragment without scrolling');
  assert.equal(reading.hashChanges.at(-1),'/nuo-atlas/?round=2','clearing the stale fragment preserves the preview path/query');
  assert.equal(JSON.parse(reading.storage.get(DRAFT)).step,'galaxy','entering cultural reading does not erase the draft resume step');
  reading.location.hash='#galaxyStage';
  readingDirectoryLink.focus();
  await reading.document.emit('pointerdown',{pointerType:'touch',pointerId:4,clientX:100,clientY:200,target:readingChart});
  assert.equal(reading.document.activeElement,reading.document.body,'a directory link loses stale focus while reading other content');
  assert.equal(reading.location.hash,'','returning to the library also clears a stale canvas fragment');
  assert.deepEqual(reading.scrolls,[],'touch browsing never forces scrolling');
  const readingSearch=reading.$('researchSearch');readingSearch.matches=selector=>selector.startsWith('input');
  readingLibrary.contains=target=>[readingLibrary,readingDirectoryLink,readingChart,readingSearch].includes(target);
  readingSearch.focus();await reading.document.emit('pointerdown',{pointerType:'touch',pointerId:4,clientX:100,clientY:200,target:readingChart});
  assert.equal(reading.document.activeElement,readingSearch,'touch scrolling does not interrupt an active research query');
  reading.location.hash='#starmap-section';await reading.document.emit('pointerdown',{pointerType:'touch',pointerId:4,clientX:100,clientY:200,target:readingChart});
  assert.equal(reading.location.hash,'#starmap-section','a cultural deep link is preserved');
  const navLink=reading.$('testWorkshopLink');navLink.getAttribute=()=> '#galaxy';
  navLink.closest=selector=>selector.includes('a[href')?navLink:null;
  await reading.document.emit('pointerdown',{pointerType:'touch',pointerId:5,clientX:100,clientY:200,target:navLink});
  await reading.document.emit('pointermove',{pointerType:'touch',pointerId:5,clientX:100,clientY:250,target:navLink});
  const accidental=await reading.document.emit('click',{target:navLink,detail:1});
  assert.equal(accidental.defaultPrevented,true,'a swipe ending on a workshop link cannot become a navigation click');
  assert.deepEqual(reading.scrolls,[]);
  const accidentalDirectoryJump=await reading.document.emit('click',{target:readingDirectoryLink,detail:1});
  assert.equal(accidentalDirectoryJump.defaultPrevented,true,'a synthetic click after scrolling cannot jump to a directory chapter');
  await reading.document.emit('pointerdown',{pointerType:'touch',pointerId:6,clientX:100,clientY:200,target:navLink});
  await reading.document.emit('pointercancel',{pointerType:'touch',pointerId:6,target:navLink});
  assert.equal((await reading.document.emit('click',{target:navLink,detail:1})).defaultPrevented,true,'native Safari pan cancellation also blocks its stale synthetic click');
  await reading.document.emit('click',{target:navLink,detail:0});
  assert.equal(reading.scrolls.at(-1).id,'galaxy','keyboard navigation remains available after a touch scroll');
  await reading.document.emit('pointerdown',{pointerType:'touch',pointerId:7,clientX:100,clientY:200,target:navLink});
  await reading.document.emit('click',{target:navLink,detail:1});
  assert.equal(reading.scrolls.length,2,'a fresh deliberate tap still navigates');
  await reading.document.emit('click',{target:readingDirectoryLink,detail:1});
  assert.equal(reading.scrolls.at(-1).id,'timeline','a deliberate directory selection still reaches its chapter');
  assert.equal(readingLibrary.hidden,false,'chapter navigation preserves the always-visible library');
  const queued=setup({[DRAFT]:validDraft},{deferFrames:true});
  await queued.$('intentionForm').emit('submit');
  await queued.document.emit('pointerdown',{pointerType:'touch',pointerId:1,clientX:20,clientY:300,target:queued.$('researchChart')});
  queued.flushFrames();
  assert.deepEqual(queued.scrolls,[],'a user beginning to read cancels an older navigation still waiting for its animation frame');
  await queued.$('intentionForm').emit('submit');queued.flushFrames();
  assert.equal(queued.scrolls.at(-1).id,'galaxy','a subsequent explicit navigation still works');
  const t=setup({[DRAFT]:validDraft});
  await t.window.emit('nuo:finish');
  const previewScrollCount=t.scrolls.length,previewHashCount=t.hashChanges.length;
  assert.equal(t.scrolls.at(-1).id,'journey-result','finishing explicitly takes the user to their preview');
  await t.$('saveWork').emit('click');
  assert.equal(t.scrolls.length,previewScrollCount,'saving an existing valid preview does not scroll again');
  assert.equal(t.hashChanges.length,previewHashCount,'saving does not rewrite the current route');
  assert.equal(JSON.parse(t.storage.get(WORKS)).length,1,'first save persists one work');
  await t.$('saveWork').emit('click');assert.equal(JSON.parse(t.storage.get(WORKS)).length,1,'repeated save updates the existing work');
  t.$('drawWorkName').value='修改后的作品';await t.$('drawWorkName').emit('input');await t.$('saveWork').emit('click');
  assert.equal(JSON.parse(t.storage.get(WORKS))[0].title,validDraft.title,'declining an update preserves the saved version');
  t.window.confirm=()=>true;await t.$('saveWork').emit('click');
  assert.equal(JSON.parse(t.storage.get(WORKS))[0].title,'修改后的作品','save rebuilds the latest text');
  await t.$('downloadWork').emit('click');await new Promise(setImmediate);
  assert.equal(t.scrolls.length,previewScrollCount,'repeat saves and download keep the valid preview in place');
  assert.equal(t.hashChanges.length,previewHashCount,'repeat saves and download preserve the route');
  const olderDrawing={version:3,ink:PNG,outline:null,parts:[],creationMethod:'coloring',template:{id:'longwang',colors:{'left-horn':'#ff6034','right-horn':'#435bb8'}}};
  const olderSaved={...saved,target:'gift',recipient:'重要的人',signature:'朋友',referenceIds:[1,325],referenceNotes:{325:'保留龙角的力量感'},drawing:olderDrawing,
    publication:{title:'曾经发布的旧标题',image:'data:image/png;base64,b2xk',date:saved.date,referenceIds:[1]}};
  const oldWorks=setup({[WORKS]:[olderSaved]});
  assert.equal(oldWorks.storage.get(WORKS),JSON.stringify([olderSaved]),'loading older works never deletes or rewrites their stored data');
  assert.equal(oldWorks.writes.filter(write=>write.key===WORKS).length,0,'gallery removal does not run a destructive startup migration');
  assert.ok(oldWorks.$('savedWorks').innerHTML.includes(olderSaved.title)&&oldWorks.$('savedWorks').innerHTML.includes(olderSaved.wish),'older saved artwork and story still appear');
  assert.ok(oldWorks.$('savedWorks').innerHTML.includes(PNG)&&!oldWorks.$('savedWorks').innerHTML.includes('曾经发布的旧标题'),'my works uses the saved image/title instead of an obsolete publication snapshot');
  assert.ok(!oldWorks.$('savedWorks').innerHTML.includes('星河')&&!oldWorks.$('savedWorks').innerHTML.includes('data-unpublish-work'),'obsolete publication controls and badges are absent');
  oldWorks.window.confirm=()=>true;await oldWorks.delegated('savedWorks',{openWork:olderSaved.id});
  assert.equal(oldWorks.image(),PNG);assert.equal(oldWorks.$('drawWorkName').value,olderSaved.title);assert.equal(oldWorks.$('journeyWish').value,olderSaved.wish);
  assert.equal(oldWorks.$('journeyRecipient').value,olderSaved.recipient);assert.equal(oldWorks.$('journeySignature').value,olderSaved.signature);
  assert.equal(JSON.stringify(oldWorks.editable()),JSON.stringify(olderDrawing),'older editable drawing colors and mode reopen unchanged');
  await oldWorks.window.emit('nuo:finish');await oldWorks.$('saveWork').emit('click');
  const resavedOlder=JSON.parse(oldWorks.storage.get(WORKS));
  assert.equal(resavedOlder.length,1);assert.equal(resavedOlder[0].id,olderSaved.id,'saving an older work updates it without a duplicate');
  for(const field of ['image','title','wish','recipient','signature','target','explanation'])assert.equal(resavedOlder[0][field],olderSaved[field],'older work retains '+field);
  assert.deepEqual(resavedOlder[0].drawing,olderDrawing);assert.deepEqual(resavedOlder[0].referenceIds,olderSaved.referenceIds);assert.deepEqual(resavedOlder[0].referenceNotes,olderSaved.referenceNotes);
  const q=setup({[DRAFT]:validDraft,[WORKS]:[saved]});q.setFail(WORKS);await q.window.emit('nuo:finish');await q.$('saveWork').emit('click');
  assert.equal(JSON.parse(q.storage.get(WORKS)).length,1);assert.match(q.$('resultStatus').textContent,/没有保存成功/,'quota failure is shown');
  const malicious={...saved,title:'<img src=x onerror=alert(1)>',wish:'<script>bad()</script>'};
  const safe=setup({[WORKS]:[malicious,{...saved,id:'bad',image:'javascript:alert(1)'}]});
  assert.ok(!safe.$('savedWorks').innerHTML.includes('<script>'),'stored text is escaped');assert.ok(safe.$('savedWorks').innerHTML.includes('&lt;script&gt;'));
  assert.ok(!safe.$('savedWorks').innerHTML.includes('data-open-work="bad"'),'non-PNG records are rejected');
  const loaded=setup({[WORKS]:[saved]});loaded.window.confirm=()=>true;await loaded.delegated('savedWorks',{openWork:'saved-1'});
  assert.equal(loaded.$('drawWorkName').value,saved.title);assert.equal(loaded.image(),PNG);
  const recovered=setup({[DRAFT]:{...validDraft,workId:'saved-1',title:'尚未保存的修改'},[WORKS]:[saved]});
  await recovered.$('newWork').emit('click');
  assert.equal(recovered.confirms(),1,'reloaded unsaved edits must ask before replacement');
  assert.equal(recovered.$('drawWorkName').value,'尚未保存的修改','declining replacement preserves the edited draft');
  assert.equal(loaded.resetCount(),1,'opening another work clears canvas history');assert.equal(loaded.$('journey-result').hidden,true);
  const failedOpen=setup({[DRAFT]:validDraft,[WORKS]:[saved]});failedOpen.window.confirm=()=>true;failedOpen.setRestoreFailure();
  await failedOpen.delegated('savedWorks',{openWork:'saved-1'});assert.equal(failedOpen.$('drawWorkName').value,validDraft.title,'failed restore keeps current text');
  const atomic=setup({[DRAFT]:validDraft,[DRAWING]:{version:1,image:PNG,journey:{...validDraft,title:'统一草稿'}}});
  assert.equal(atomic.$('drawWorkName').value,'统一草稿','unified metadata takes priority over legacy key');
  atomic.setFail(DRAWING);atomic.$('drawWorkName').value='内存里的修改';await atomic.$('drawWorkName').emit('input');
  assert.equal(JSON.parse(atomic.storage.get(DRAWING)).journey.title,'统一草稿');assert.match(atomic.$('intentionStatus').textContent,/存储空间不足|不可用/);
  atomic.setFail('');atomic.window.confirm=()=>true;const beforeNew=atomic.writes.length;await atomic.$('newWork').emit('click');
  assert.equal(atomic.image(),'');assert.equal(atomic.resetCount(),1);assert.equal(atomic.$('drawWorkName').value,'');
  for(const write of atomic.writes.slice(beforeNew).filter(w=>w.key===DRAWING)){assert.equal(write.value.journey.title,'');assert.equal(write.value.image,'');}
  const exported=setup({[WORKS]:[saved]});await exported.delegated('savedWorks',{exportWork:'saved-1'});
  assert.ok(exported.exportedText.some(text=>text.includes('文化参考')));assert.ok(exported.exportedText.some(text=>text.includes('https://example.org/mask/1')));
  assert.ok(exported.exportedText.includes(saved.wish));assert.match(exported.$('worksStatus').textContent,/发起下载/);
  assert.equal(exported.$('worksDownloadPreview').hidden,false,'a generated card has a visible saving fallback');
  assert.match(exported.$('worksDownloadPreview').innerHTML,/长按保存/);
  assert.match(exported.$('worksDownloadPreview').innerHTML,/blob:test/);
  await exported.delegated('savedWorks',{exportWork:'saved-1'});
  assert.deepEqual(exported.revokedURLs,['blob:test'],'only replacing a preview releases its previous image URL');
  const pendingFonts=[];
  const fontExport=setup({[WORKS]:[saved]},{fonts:{load(font,text){return new Promise(resolve=>pendingFonts.push({font,text,resolve}));}}});
  const pendingDownload=fontExport.delegated('savedWorks',{exportWork:'saved-1'});
  assert.equal(pendingFonts.length,3,'export requests both body weights and the display face');
  assert.equal(fontExport.measuredFonts.length,0,'text is not measured with temporary fallback fonts while faces load');
  pendingFonts.forEach(font=>font.resolve([]));await pendingDownload;
  assert.match(fontExport.paintedFonts.find(item=>item.text===saved.title).font,/600 50px "Nuo Serif"/);
  assert.match(fontExport.paintedFonts.find(item=>item.text===saved.wish).font,/400 36px "Nuo Sans"/);
  for(const item of fontExport.paintedFonts.slice(2)){
    assert.ok(fontExport.measuredFonts.includes(item.font),'every wrapped line paints using its measured face and weight');
  }
  const fontFailure=setup({[WORKS]:[saved]},{fonts:{load(){return Promise.reject(new Error('unavailable font'));}}});
  await fontFailure.delegated('savedWorks',{exportWork:'saved-1'});
  assert.match(fontFailure.$('worksStatus').textContent,/发起下载/,'an unavailable font uses the same measured system fallback instead of losing the export');
  const longCard={...saved,referenceIds:Array.from({length:15},(_,i)=>i+1),referenceNotes:Object.fromEntries(Array.from({length:15},(_,i)=>[i+1,'测试长文'.repeat(35)])),explanation:'作品解释'.repeat(60)};
  const longExport=setup({[WORKS]:[longCard]});await longExport.delegated('savedWorks',{exportWork:'saved-1'});
  assert.ok(longExport.exportCanvases[0].height<=8192 && longExport.exportCanvases[0].width*longExport.exportCanvases[0].height<=12000000,'large cards stay within the chosen canvas memory budget');
  assert.ok(longExport.exportedText.includes('https://example.org/mask/15'),'resizing keeps the final source instead of truncating');
  const partialSave=setup({[DRAFT]:validDraft});await partialSave.window.emit('nuo:finish');partialSave.setFail(DRAWING);await partialSave.$('saveWork').emit('click');
  assert.equal(JSON.parse(partialSave.storage.get(WORKS)).length,1);
  assert.match(partialSave.$('resultStatus').textContent,/作品已保存.*自动草稿未能更新/,'a saved work and a failed draft report their separate outcomes');
  const throwingRestore=setup({[DRAFT]:validDraft,[WORKS]:[saved]});throwingRestore.window.confirm=()=>true;
  throwingRestore.window.NuoDrawing.restore=async()=>{throw new Error('decode');};
  const failedButton=await throwingRestore.delegated('savedWorks',{openWork:'saved-1'});
  assert.equal(failedButton.disabled,false);assert.equal(throwingRestore.$('drawWorkName').value,validDraft.title);
  throwingRestore.$('journeyWish').value='恢复失败后仍可修改';await throwingRestore.$('journeyWish').emit('input');
  assert.equal(JSON.parse(throwingRestore.storage.get(DRAWING)).journey.wish,'恢复失败后仍可修改','a thrown restore cannot leave all later draft saves locked');
  assert.equal(throwingRestore.$('journeyContent').inert,false,'failed restoration unlocks editing');
  const pendingRestore=setup({[WORKS]:[saved]});pendingRestore.window.confirm=()=>true;
  let resolveRestore;pendingRestore.window.NuoDrawing.restore=()=>new Promise(resolve=>{resolveRestore=resolve;});
  const opening=pendingRestore.delegated('savedWorks',{openWork:'saved-1'});
  assert.equal(pendingRestore.$('journeyContent').inert,true,'waiting for old images suspends all content editing');
  resolveRestore(true);await opening;assert.equal(pendingRestore.$('journeyContent').inert,false);
  const deletedCurrent=setup({[WORKS]:[saved]});deletedCurrent.window.confirm=()=>true;
  await deletedCurrent.delegated('savedWorks',{openWork:'saved-1'});await deletedCurrent.delegated('savedWorks',{deleteWork:'saved-1'});
  let promptedAfterDelete=false;deletedCurrent.window.confirm=()=>{promptedAfterDelete=true;return false;};
  await deletedCurrent.$('newWork').emit('click');
  assert.ok(promptedAfterDelete,'a deleted saved version is no longer a safe backup of the current draft');
  assert.equal(deletedCurrent.$('drawWorkName').value,saved.title,'cancel keeps the remaining draft of the deleted work');
  const invalidFinish=setup({[DRAFT]:validDraft});await invalidFinish.window.emit('nuo:finish');
  invalidFinish.$('drawWorkDesc').value='';await invalidFinish.$('drawWorkDesc').emit('input');await invalidFinish.$('saveWork').emit('click');
  assert.equal(invalidFinish.storage.has(WORKS),false,'invalid current input cannot save stale result preview');
  const notes=setup({[DRAFT]:{...validDraft,referenceNotes:{1:'一段故事',99:'无关参考'}}});
  const note='<线条>让我想到彼此照应。';
  await notes.$('referenceList').emit('input',{target:{dataset:{referenceNote:'1'},value:note}});
  assert.equal(JSON.parse(notes.storage.get(DRAWING)).journey.referenceNotes[1],note);
  assert.equal(JSON.parse(notes.storage.get(DRAWING)).journey.referenceNotes[99],undefined,'unselected reference notes are ignored');
  assert.equal(notes.$('workshop-note-1').textContent,'我想留下：'+note);
  await notes.$('finishFromExplanation').emit('click');
  assert.match(notes.$('finishedCard').innerHTML,/&lt;线条&gt;/,'reference notes are escaped in the final card');
  await notes.$('saveWork').emit('click');await notes.$('downloadWork').emit('click');
  assert.equal(JSON.parse(notes.storage.get(WORKS))[0].referenceNotes[1],note);
  assert.ok(notes.exportedText.some(text=>text.includes(note)),'reference reason is included in the exported card');
  assert.ok(notes.exportOrder.indexOf(validDraft.wish)<notes.exportOrder.indexOf('image'),'the intention precedes the image');
  const layers={version:2,width:900,height:1000,background:'#fff0d2',strokes:PNG,outline:{src:'assets/masks/0001.svg',color:'#bd251f',scale:88,x:12,y:-8,locked:false}};
  const layered=setup({[DRAWING]:{version:1,image:PNG,journey:validDraft,drawing:layers}});
  await layered.window.emit('nuo:finish');await layered.$('saveWork').emit('click');
  assert.deepEqual(JSON.parse(layered.storage.get(WORKS))[0].drawing,layers,'saved work retains editable drawing data');
  const reopened=setup({[WORKS]:JSON.parse(layered.storage.get(WORKS))});reopened.window.confirm=()=>true;
  await reopened.delegated('savedWorks',{openWork:JSON.parse(layered.storage.get(WORKS))[0].id});
  assert.equal(JSON.stringify(reopened.editable()),JSON.stringify(layers),'reopen forwards the editable drawing to the engine');
  const partLayers={...layers,version:3,outline:{...layers.outline,src:'assets/masks/0002.svg'},parts:[{src:'assets/masks/0003.svg'},{src:'assets/masks/0003.svg'},null,{src:'https://example.org/assets/masks/0004.svg'},{src:'assets/masks/../0004.svg'},{src:'assets/masks/9999.svg'}]};
  const sourceDraft={...validDraft,referenceIds:[1,2,4],referenceNotes:{2:'保留这段眉线的理由',4:'未使用的参考理由'}};
  const sourceRemoval=setup({[DRAWING]:{version:1,image:PNG,journey:sourceDraft,drawing:partLayers}});
  await sourceRemoval.delegated(null,{removeRef:'2'});await sourceRemoval.delegated(null,{removeRef:'4'});
  assert.equal(sourceRemoval.window.NuoJourney.hasReference(2),false,'removing a collection remains possible while its outline is used');
  const sourceRecord=JSON.parse(sourceRemoval.storage.get(DRAWING));
  assert.equal(sourceRecord.journey.referenceNotes[2],sourceDraft.referenceNotes[2],'removing a reference does not erase its reason');
  const recoveredSources=setup({[DRAWING]:sourceRecord});
  await recoveredSources.window.emit('nuo:finish');
  const completedSources=JSON.parse(recoveredSources.storage.get(DRAWING)).journey;
  assert.deepEqual(completedSources.referenceIds,[1,2,3],'finish retains chosen references and adds only actual, valid outline and part sources');
  assert.equal(completedSources.referenceNotes[2],sourceDraft.referenceNotes[2],'removed source reason survives a reload and returns with the used source');
  assert.equal(recoveredSources.window.NuoJourney.hasReference(2),true,'restored sources are reflected in the current draft');
  assert.match(recoveredSources.$('referenceList').innerHTML,/样本2/,'restored sources appear in the reference UI');
  assert.match(recoveredSources.$('finishedCard').innerHTML,/保留这段眉线的理由/,'the final card retains the creator’s explanation');
  assert.ok(!recoveredSources.$('finishedCard').innerHTML.includes('未使用的参考理由'),'removed unused references do not return to the card');
  await recoveredSources.$('saveWork').emit('click');await recoveredSources.$('downloadWork').emit('click');
  const sourceWork=JSON.parse(recoveredSources.storage.get(WORKS))[0];
  assert.deepEqual(sourceWork.referenceIds,[1,2,3],'saving does not truncate drawing provenance');
  for(const id of [2,3])assert.ok(recoveredSources.exportedText.includes('https://example.org/mask/'+id),'download contains every used source');
  const repairedSaved=setup({[WORKS]:[{...sourceWork,referenceIds:[1]}]});
  await repairedSaved.delegated('savedWorks',{exportWork:sourceWork.id});
  for(const id of [2,3])assert.ok(repairedSaved.exportedText.includes('https://example.org/mask/'+id),'direct download repairs an older saved work with missing drawing sources');
  const fullCollection=setup({[DRAWING]:{version:1,image:PNG,journey:{...validDraft,referenceIds:Array.from({length:12},(_,i)=>i+1)},drawing:{...layers,version:3,outline:{...layers.outline,src:'assets/masks/0013.svg'},parts:[{src:'assets/masks/0014.svg'}]}}});
  await fullCollection.window.emit('nuo:finish');await fullCollection.$('saveWork').emit('click');
  assert.deepEqual(JSON.parse(fullCollection.storage.get(WORKS))[0].referenceIds,Array.from({length:14},(_,i)=>i+1),'12 collected references must not crowd actual drawing sources out of saved metadata');
  await fullCollection.delegated(null,{addRef:'15'});
  assert.equal(fullCollection.window.NuoJourney.hasReference(15),false,'the manual collection limit still applies');
  assert.ok(!t.$('finishedCard').innerHTML.includes('当代简化分区底稿'),'free drawing without a template is not labeled as a simplified template');
  for(const creationMethod of ['coloring','free']) {
    const templateDrawing={...layers,version:3,outline:null,parts:[],creationMethod,template:{id:'panguan',colors:{forehead:'#bd251f'},sourceId:319,source:'assets/masks/0319.svg'}};
    const templateDraft={...validDraft,referenceNotes:{317:'想保留认真面对变化的神情'}};
    const coloring=setup({[DRAWING]:{version:1,image:PNG,journey:templateDraft,drawing:templateDrawing}});
    await coloring.window.emit('nuo:finish');await coloring.$('saveWork').emit('click');await coloring.$('downloadWork').emit('click');
    const savedColoring=JSON.parse(coloring.storage.get(WORKS))[0];
    assert.deepEqual(savedColoring.referenceIds,[1,317],'template source is resolved from the trusted catalog, not state-supplied source fields');
    assert.equal(savedColoring.referenceNotes[317],templateDraft.referenceNotes[317]);
    assert.deepEqual(savedColoring.drawing,templateDrawing,'journey does not change creation mode or the template while completing/saving');
    assert.match(coloring.$('finishedCard').innerHTML,/判官练习稿.*当代简化分区底稿，非原作复原/,'template adaptation is labeled even after switching to free drawing');
    assert.ok(coloring.exportedText.join('').includes('当代简化分区底稿，非原作复原'),'PNG export identifies the contemporary adaptation');
    assert.ok(coloring.exportedText.includes('https://example.org/mask/317'),'PNG includes the real template source');
    assert.ok(!coloring.exportedText.includes('https://example.org/mask/319'),'state cannot redirect template provenance');
    const reopenColoring=setup({[WORKS]:[{...savedColoring,referenceIds:[1]}]});reopenColoring.window.confirm=()=>true;
    await reopenColoring.delegated('savedWorks',{exportWork:savedColoring.id});
    assert.ok(reopenColoring.exportedText.includes('https://example.org/mask/317'),'direct download repairs missing template provenance');
    assert.ok(reopenColoring.exportedText.join('').includes('当代简化分区底稿，非原作复原'));
    await reopenColoring.delegated('savedWorks',{openWork:savedColoring.id});
    assert.equal(JSON.stringify(reopenColoring.editable()),JSON.stringify(templateDrawing),'reopening forwards template colors and creation mode unchanged');
    assert.equal(reopenColoring.window.NuoJourney.hasReference(317),true,'reopened template work restores its culture source to the UI');
  }
  for(const id of ['unknown-template','bad-path']) {
    const untrusted=setup({[DRAWING]:{version:1,image:PNG,journey:validDraft,drawing:{...layers,version:3,outline:null,parts:[],template:{id,sourceId:325,source:'assets/masks/0325.svg'}}}});
    await untrusted.window.emit('nuo:finish');await untrusted.$('saveWork').emit('click');
    assert.deepEqual(JSON.parse(untrusted.storage.get(WORKS))[0].referenceIds,[1],'unknown templates and invalid catalog paths cannot introduce sources');
    assert.ok(!untrusted.$('finishedCard').innerHTML.includes('当代简化分区底稿'),'unrecognized metadata cannot claim a trusted template');
  }
  const waiting=setup({[DRAFT]:validDraft});waiting.window.NuoDrawing.ready=false;
  await waiting.$('resumeDraft').emit('click');
  assert.match(waiting.$('resumeDraft').textContent,/恢复中/);
  assert.equal(waiting.document.body.dataset.journeyStep,undefined,'resume cannot navigate to a hidden result before drawing is ready');
  const languageSave = setup({[DRAFT]:validDraft});
  const languageSuccess = await languageSave.window.emit('nuo:before-language-change', {detail:{}});
  assert.ok(!languageSuccess.defaultPrevented);
  assert.equal(JSON.parse(languageSave.storage.get(DRAWING)).journey.title, validDraft.title, 'language switch flushes the current draft');
  languageSave.setFail(DRAWING);
  const languageFailure = await languageSave.window.emit('nuo:before-language-change', {detail:{}});
  assert.ok(languageFailure.defaultPrevented, 'failed storage cannot discard current work by changing language');
  assert.match(languageFailure.detail.message, /先保存或下载/);
  languageSave.window.NuoDrawing.ready = false;
  const languageLoading = await languageSave.window.emit('nuo:before-language-change', {detail:{}});
  assert.ok(languageLoading.defaultPrevented, 'language switch waits for draft restoration');
  const englishWork = {...saved,title:'趣味小游戏',wish:'使用道具',explanation:'判官',referenceNotes:{1:'行囊'}};
  const english = setup({[WORKS]:[englishWork]}, {language:'en'});
  await english.delegated('savedWorks', {exportWork:'saved-1'});
  assert.ok(english.exportedText.includes('NUO ATLAS · Contemporary creation'), 'canvas header uses the active language');
  for (const ownWords of ['趣味小游戏','使用道具','判官']) assert.ok(english.exportedText.includes(ownWords), 'export preserves user text even when it matches a translation key');
  assert.match(english.$('savedWorks').innerHTML, /data-i18n-skip>趣味小游戏/, 'saved user titles are excluded from DOM translation');
  let englishPrompt = ''; english.window.confirm = message => {englishPrompt = message;return false;};
  await english.delegated('savedWorks', {deleteWork:'saved-1'});
  assert.equal(englishPrompt, 'Delete “趣味小游戏” from this browser? Downloaded files will not be affected.');
  console.log('PASS: language switch saves before reload, blocks on failed saves/restoration, and English exports/dialogs preserve user-written text.');
  console.log('PASS: older works with publication metadata remain intact on load, reopen and save; valid preview save/download stays in place.');
  console.log('PASS: repeated save, current edits, quotas, escaping, image validation, reopen/failure, reload protection, atomic drafts, new work, source-bearing export, stale-preview validation.');
  console.log('PASS: reference selection/async outline stay in place, stale touch focus released, text/keyboard focus and explicit continue preserved.');
  console.log('PASS: per-reference reasons, escaping/export order, editable works retained/reopened, resume loading guard.');
  console.log('PASS: removed-source reasons survive reload, actual outline/part sources reach cards and downloads, invalid paths ignored, full collections retain drawing provenance.');
  console.log('PASS: trusted template provenance, adaptation labels in cards/PNG, free-mode overlays retain labels, unknown sources rejected, template colors/method retained across save/reopen.');
})().catch(error=>{console.error(error);process.exitCode=1;});
