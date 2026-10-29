/* Culture first. Drafts and saved works stay in this browser. */
(function () {
  'use strict';
  const content = window.NUO_JOURNEY_CONTENT;
  const archive = new Map(window.NUO_MASK_ATLAS.nodes.map(n => [n.id, n]));
  const pilot = new Map(content.samples.map(n => [n.id, n]));
  const DRAFT_KEY = 'nuo_journey_draft_v1';
  const WORKS_KEY = 'nuo_journey_works_v1';
  const steps = ['journey-intro','journey-explore','journey-intention','galaxy','journey-result'];
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const tx = (text, values = {}) => (window.NuoI18n?.t(text) || text).replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '{' + key + '}');
  const customLanguage = window.NuoI18n?.lang === 'en' || document.documentElement?.lang === 'en' ? 'en' : 'zh';
  $('customOrdersLink').href = 'customize.html?view=orders&lang=' + customLanguage;
  const userText = value => `<span data-i18n-skip>${esc(value)}</span>`;
  const short = (s, max) => typeof s === 'string' ? s.slice(0, max) : '';
  const validPNG = value => typeof value === 'string' && value.length < 6000000 && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value);
  const safeURL = value => {
    try { const url = new URL(value); return /^https?:$/.test(url.protocol) ? url.href : ''; } catch (_) { return ''; }
  };
  const link = (url, title) => safeURL(url) ? `<a href="${esc(safeURL(url))}" target="_blank" rel="noopener noreferrer">${esc(title)} ↗︎</a>` : '';
  function drawingTemplate(drawing) {
    const catalog = window.NUO_COLORING_TEMPLATES;
    if (typeof drawing?.template?.id !== 'string' || !Array.isArray(catalog)) return null;
    return catalog.find(template=>template.id === drawing.template.id && Number.isInteger(template.sourceId) && archive.has(template.sourceId) && template.source === archive.get(template.sourceId).image && /^assets\/masks\/\d{4}\.svg$/.test(template.source)) || null;
  }
  function templateNote(drawing) {
    const template = drawingTemplate(drawing);
    return template ? (template.kind === 'original' ? tx('基于《{name}》原线稿分区填色，配色为个人创作。', {name: tx(template.name)}) : tx('使用《{name}》当代简化分区底稿，非原作复原。', {name: tx(template.name)})) : '';
  }
  function cleanDraft(raw) {
    const value = raw && typeof raw === 'object' ? raw : {};
    // The picker limits voluntary collections to 12; actual canvas sources must never be truncated.
    const referenceIds = [...new Set(Array.isArray(value.referenceIds) ? value.referenceIds.filter(id => Number.isInteger(id) && archive.has(id)) : [])];
    return {
      version: 1,
      referenceIds,
      // Keep a removed reference's reason in the draft in case its artwork is still used or it is selected again.
      referenceNotes: Object.fromEntries(Object.entries(value.referenceNotes && typeof value.referenceNotes === 'object' ? value.referenceNotes : {}).filter(([id])=>/^\d+$/.test(id) && archive.has(Number(id))).map(([id,note])=>[Number(id),short(note,140)])),
      sampleId: pilot.has(value.sampleId) ? value.sampleId : content.samples[0].id,
      step: steps.includes(value.step) ? value.step : 'journey-intro',
      target: value.target === 'gift' ? 'gift' : 'self',
      interest: short(value.interest,160), wish: short(value.wish,100), recipient: short(value.recipient,24), signature: short(value.signature,24),
      title: short(value.title,30), explanation: short(value.explanation,240), workId: short(value.workId,80)
    };
  }
  function includeDrawingReferences(value, drawing) {
    const metadata = cleanDraft(value);
    const sources = [drawing?.outline, ...(Array.isArray(drawing?.parts) ? drawing.parts : [])];
    for (const item of sources) {
      const match = typeof item?.src === 'string' && /^assets\/masks\/(\d{4})\.svg$/.exec(item.src);
      const id = match ? Number(match[1]) : 0;
      if (archive.has(id) && !metadata.referenceIds.includes(id)) metadata.referenceIds.push(id);
    }
    const template = drawingTemplate(drawing);
    if (template && !metadata.referenceIds.includes(template.sourceId)) metadata.referenceIds.push(template.sourceId);
    return metadata;
  }
  let readError = false;
  function readLocal(key, fallback) {
    try { const data = localStorage.getItem(key); return data ? JSON.parse(data) : fallback; }
    catch (_) { readError = true; return fallback; }
  }
  const drawingDraft = readLocal('nuo_drawing_draft_v1', null);
  let draft = cleanDraft(drawingDraft?.journey || readLocal(DRAFT_KEY, {}));
  const storedWorks = readLocal(WORKS_KEY, []);
  let works = (Array.isArray(storedWorks) ? storedWorks : []).filter(w => w && typeof w === 'object' && validPNG(w.image) && typeof w.id === 'string' && w.id.trim()).slice(0,10).map(w => {
    const drawing = window.NuoDrawing?.validateEditable?.(w.drawing) || undefined;
    return {...includeDrawingReferences(w,drawing), id:short(w.id,80), date:short(w.date,30), image:w.image, drawing};
  });
  let currentCard = null;
  let selectedId = draft.sampleId;
  let photoMode = true;
  let exporting = false;
  const downloadURLs = new Map();
  let dirty = Boolean(draft.referenceIds.length || draft.wish || draft.title);
  let switchingWork = false;
  let navigationRevision = 0;
  let touchNavigation = null;
  function notice(id, message, error = false, verbatim = false) { if (verbatim) $(id).dataset.i18nSkip = ''; else delete $(id).dataset.i18nSkip; $(id).textContent = message; $(id).dataset.error = String(error); }
  function ref(id) {
    const n = archive.get(id);
    if (!n) return null;
    return pilot.get(id) || {id:n.id,name:n.name,region:n.region,image:n.image,sourceUrl:n.detailUrl,sourceTitle:n.name+' · 原始资料',sourceNote:'完整星图档案；视觉标签为项目整理，请结合原始资料理解。',sources:[{title:n.name+' · 原始资料',url:n.detailUrl}]};
  }
  function persistDraft() {
    if (!window.NuoDrawing?.ready || switchingWork) return false;
    const saved = window.NuoDrawing.saveDraft(cleanDraft(draft));
    $('resumeDraft').textContent = hasDraft() ? '继续上次创作' : '开始认识';
    if (saved) { notice('draftStatus','草稿已保存'); notice('intentionDraftStatus','心意与参考已保存到此浏览器'); return true; }
    notice('draftStatus','暂无法保存草稿',true);
    notice('intentionDraftStatus','本次修改尚未保存，请保留当前页面',true);
    notice('intentionStatus','浏览器存储空间不足或不可用。当前内容仍可继续创作，请完成后下载作品卡。',true);
    return false;
  }
  function hasDraft() { return draft.referenceIds.length > 0 || Boolean(draft.wish || draft.title) || window.NuoDrawing?.ready && window.NuoDrawing.hasContent(); }
  function scrollToSection(target, behavior) {
    const revision = ++navigationRevision;
    requestAnimationFrame(() => {
      // A finger starting to browse takes precedence over a queued section jump.
      if (revision === navigationRevision) target.scrollIntoView({behavior,block:'start'});
    });
  }
  function releaseWorkshopAnchor() {
    const target = $(location.hash.slice(1));
    if (target?.closest('#galaxy')) {
      // Keep the saved draft step, but stop Safari retaining an offscreen fragment target.
      history.replaceState(null,'',location.pathname + location.search);
    }
  }
  function setLibraryExpanded(expanded) {
    $('research-library').hidden = !expanded;
    $('browseCultureAtlas').setAttribute('aria-expanded', String(expanded));
    $('browseCultureAtlas').textContent = expanded ? '收起文化图谱' : '展开文化图谱';
  }
  function revealLibrary(target) {
    const library = target?.closest('.research-library');
    if (!library) return false;
    setLibraryExpanded(true);
    return true;
  }
  function go(id, remember = true) {
    const target = id === 'galaxyStage' ? ($('paintingDesk') || $(id)) : $(id);
    if (!target) return;
    $('siteMenu').open = false;
    document.body.dataset.journeyStep = id==='galaxyStage' ? 'galaxy' : id;
    if (revealLibrary(target)) {
      if(document.activeElement?.closest('#galaxy')) document.activeElement.blur();
      window.NuoDrawing?.closePanels?.();
    }
    if (remember && steps.includes(id)) { draft.step = id; persistDraft(); }
    history.replaceState(null,'','#'+id);
    scrollToSection(target,window.matchMedia('(max-width: 900px), (pointer: coarse), (prefers-reduced-motion: reduce)').matches?'auto':'smooth');
  }
  const intro = content.intro;
  $('introCopy').innerHTML = [ ['傩面具是什么', intro.context], ['当地的人们怎样使用它',intro.performance], ['这次从哪些作品开始',intro.craft] ].map(([title,text])=>`<h3>${title}</h3><p>${esc(text)}</p>`).join('') + `<p class="research-note">${esc(intro.boundary)}</p><div class="source-links">${intro.sources.map(s=>link(s.url,s.title)).join('')}</div>`;
  function renderSample() {
    $('sampleGallery').innerHTML = content.samples.map(s=>`<button type="button" class="sample-tile" data-sample="${s.id}" aria-pressed="${selectedId===s.id}"><img src="${esc(s.image)}" alt="${esc(s.imageAlt)}" loading="lazy"><span>${esc(s.name)}</span><small>${esc(s.roleTags?.join(' · ') || s.workTitle || '彭国龙作品')}</small></button>`).join('');
    const s = pilot.get(selectedId);
    const imagePath = photoMode && s.photo ? s.photo : s.image;
    const tags = values => (values || []).map(text=>`<span>${esc(text)}</span>`).join('');
    $('sampleDetail').innerHTML = `
      <div class="sample-image">
        <img src="${esc(imagePath)}" alt="${esc(photoMode && s.photo ? s.photoAlt : s.imageAlt)}">
        <div class="image-switch" role="group" aria-label="切换样本图像"><button type="button" data-photo="true" aria-pressed="${photoMode}" class="journey-button">作品图像</button><button type="button" data-photo="false" aria-pressed="${!photoMode}" class="journey-button">观察线稿</button></div>
        <details class="sample-comparison"><summary>把作品图像与线稿放在一起看</summary><div><figure><img src="${esc(s.photo || s.image)}" alt="${esc(s.photoAlt || s.imageAlt)}" loading="lazy"><figcaption>作品图像</figcaption></figure><figure><img src="${esc(s.image)}" alt="${esc(s.imageAlt)}" loading="lazy"><figcaption>轮廓线稿</figcaption></figure></div><p>先比较眉眼、冠饰和轮廓，再决定自己想保留的细节。</p></details>
        <p class="sample-image-note">${esc(photoMode && s.photo ? '整理后的作品图像 · 查看来源了解作品' : content.labels.imageNote)}</p>
      </div>
      <div class="sample-copy">
        <h3>${esc(s.name)}${s.workTitle ? ' · '+esc(s.workTitle):''}</h3>
        <p class="sample-meta">${esc(s.region)} ／ ${esc(s.creator)}作品</p>
        <div class="sample-tags" aria-label="角色关键词">${tags(s.roleTags)}</div>
        <h4>它是谁？</h4><p>${esc(s.story)}</p>
        ${s.tradition ? `<div class="sample-tradition"><h4>传统中的用途与场景 <small>${esc(s.tradition.scope)}</small></h4><p>${esc(s.tradition.text)}</p><div class="source-links">${link(s.tradition.sourceUrl,s.tradition.sourceTitle)}</div></div>` : ''}
        ${s.wishBridge ? `<div class="sample-wish"><h4>可以联想到怎样的心意？</h4><div class="sample-tags" aria-label="当代心意启发">${tags(s.wishTags)}</div><p>${esc(s.wishBridge)}</p><p class="field-note">这些是当代创作的联想方向，你也可以写出自己的理解。</p></div>` : ''}
        <p class="sample-prompt">${esc(s.prompt)}</p>
        <button class="journey-button primary" data-add-ref="${s.id}" type="button">${draft.referenceIds.includes(s.id)?'已加入我的参考 ✓':'留下这张参考 ＋'}</button>
        <details class="sample-sources"><summary>作品资料与来源</summary><div class="source-links">${s.sources.map(x=>link(x.url,x.title)).join('')}</div><p class="field-note">${esc(s.sourceNote)}</p></details>
      </div>`;
  }
  function renderReferences() {
    const refs = draft.referenceIds.map(ref).filter(Boolean);
    $('referenceCount').textContent = refs.length;
    $('referenceList').innerHTML = refs.length ? refs.map(s=>`<article class="reference-entry"><div class="reference-row"><img src="${esc(s.image)}" alt="${esc(s.name)}线稿"><div class="reference-copy"><strong>${esc(s.name)}</strong><p>${esc(s.region)}</p></div><button type="button" data-remove-ref="${s.id}" aria-label="${esc(tx('移除{name}参考', {name: tx(s.name)}))}">移除</button>${link(s.sourceUrl,'查看出处')}</div><label for="ref-note-${s.id}">${esc(tx('我想从{name}留下什么？', {name: tx(s.name)}))}<small>选填，随作品一起保留</small></label><textarea id="ref-note-${s.id}" data-reference-note="${s.id}" maxlength="140" rows="2" placeholder="一段故事、一种职责、一个造型细节……它为什么与你有关？">${esc(draft.referenceNotes[s.id])}</textarea></article>`).join('') : '<p class="empty-state">还没有留下参考。先点开上面的面具，看看哪个故事或细节吸引了你。</p>';
    $('intentionReferences').innerHTML = `<p class="eyebrow">你留下的文化参考</p>${refs.length?refs.map(s=>`<div class="intention-reference"><strong>${esc(s.name)}</strong><p id="intention-note-${s.id}">${draft.referenceNotes[s.id] ? userText(draft.referenceNotes[s.id]) : '还没有写下选择理由，可以回到“我的参考”补充。'}</p></div>`).join(''):'<p>先留下至少一张你感兴趣的面具。</p>'}<a class="journey-text-link" href="#journey-references">补充或修改参考理由</a>`;
    renderWish();
    $('workshopReferences').innerHTML = '<p class="field-note">这些是你留下的文化参考。想轻松开始，可以从工坊选择原线稿分区底稿，保留细节、点选区域上色；想自己画，可以使用下面的原线稿，或在空白画布自由创作。</p>'+refs.map(s=>`<article class="workshop-reference"><img src="${esc(s.image)}" alt="${esc(s.name)}参考线稿"><div><strong>${esc(s.name)}</strong>${s.roleTags?`<p>角色线索：${esc(s.roleTags.join('、'))}</p>`:''}<p class="workshop-note" id="workshop-note-${s.id}">${draft.referenceNotes[s.id] ? '我想留下：'+userText(draft.referenceNotes[s.id]) : '回想这张文化参考与你的心意有什么联系，再选择分区上色或自由绘画。'}</p><div class="source-links">${link(s.sourceUrl,'文化出处')}${pilot.has(s.id)?`<button type="button" class="journey-text-link" data-review-sample="${s.id}">重看角色与场景</button>`:''}</div><button class="journey-text-link" type="button" data-use-outline="${s.id}">使用原线稿自由画</button>${s.palette?`<div class="reference-colors" aria-label="项目设计配色">${s.palette.map(hex=>`<button type="button" style="background:${hex}" data-ref-color="${hex}" aria-label="使用创作配色 ${hex}" title="创作配色 ${hex}"></button>`).join('')}</div><p>${esc(s.paletteNote)}</p>`:'<p>可参考它的形态，为自己的作品选择颜色或添加笔触。</p>'}</div></article>`).join('');
  }
  function renderWish() {
    $('workshopWish').innerHTML = draft.wish ? (draft.target === 'gift' ? '送给' + userText(draft.recipient || tx('重要的人')) + ': ' : '留给自己：') + userText(draft.wish) : '先留下感兴趣的参考，再写下你想表达的心意。';
  }
  $('referenceList').addEventListener('input',event=>{
    const id=Number(event.target.dataset.referenceNote);
    if(!draft.referenceIds.includes(id))return;
    const note=short(event.target.value,140);
    draft.referenceNotes[id]=note; dirty=true; persistDraft();
    $('intention-note-'+id).textContent=note || tx('还没有写下选择理由，可以回到“我的参考”补充。');
    $('intention-note-'+id).dataset.i18nSkip = '';

    $('workshop-note-'+id).textContent=note ? tx('我想留下：')+note : tx('回想这张文化参考与你的心意有什么联系，再选择分区上色或自由绘画。');
    $('workshop-note-'+id).dataset.i18nSkip = '';
  });
  function syncForm() {
    for (const [id,key] of Object.entries(fields)) $(id).value = draft[key];
    document.querySelector(`input[name="journeyTarget"][value="${draft.target}"]`).checked = true;
    updateTarget();
  }
  function updateTarget() {
    $('giftFields').hidden = draft.target !== 'gift';
    $('wishLabel').textContent = draft.target==='gift' ? '你有什么话，想通过作品留给对方？' : '你希望接下来的自己，保持什么？';
    $('journeyWish').placeholder = draft.target==='gift' ? '例如：愿你去往新地方，也记得有人一直支持你。' : '例如：换了环境以后，仍然愿意尝试。';
  }
  function addReference(id) {
    if (!archive.has(id)) return;
    if (draft.referenceIds.includes(id)) { notice('draftStatus','这张参考已经留下'); return; }
    if (draft.referenceIds.length >=12) { notice('draftStatus','最多留下12张，请先移除一张',true); return; }
    draft.referenceIds.push(id); dirty = true;
    if (draft.step==='journey-intro') draft.step='journey-explore';
    renderReferences(); const saved=persistDraft();
    document.querySelectorAll(`[data-add-ref="${id}"], [data-reference-id="${id}"]`).forEach(button=>{button.textContent='已加入我的参考 ✓';});
    if(saved)notice('draftStatus','已留下 '+ref(id).name);
  }
  window.NuoJourney = { hasReference: id => draft.referenceIds.includes(Number(id)) };
  const fields = {journeyInterest:'interest',journeyWish:'wish',journeyRecipient:'recipient',journeySignature:'signature',drawWorkName:'title',drawWorkDesc:'explanation'};
  for (const [id,key] of Object.entries(fields)) $(id).addEventListener('input',()=>{
    draft[key] = $(id).value; dirty = true; persistDraft();
    if (key==='wish' || key==='recipient') renderWish();
  });
  document.querySelectorAll('input[name="journeyTarget"]').forEach(input=>input.addEventListener('change',()=>{
    draft.target=input.value; dirty=true; updateTarget(); renderReferences(); persistDraft();
  }));
  function ready() {
    if (switchingWork) { notice('worksStatus','作品正在打开，请稍等。'); return false; }
    if (window.NuoDrawing?.ready) return true;
    notice('drawingStatus','画布正在恢复，请稍等片刻。'); return false;
  }
  $('intentionForm').addEventListener('submit',event=>{
    event.preventDefault();
    if (!draft.referenceIds.length) { notice('intentionStatus','先留下至少一张文化参考，再把观察带入创作。',true); go('journey-explore'); return; }
    if (!draft.wish.trim()) { notice('intentionStatus','写一句你想留下的心意。',true); $('journeyWish').focus(); return; }
    if (!ready()) { notice('intentionStatus','画布正在准备，请稍后再试。'); return; }
    notice('intentionStatus',''); renderReferences(); window.NuoDrawing.enter(); go('galaxy');
  });
  window.addEventListener('nuo:add-reference',event=>addReference(Number(event.detail?.id)));
  window.addEventListener('nuo:drawing-change',()=>{if(!switchingWork){dirty=true;persistDraft();}});
  window.addEventListener('nuo:drawing-ready',()=>{ $('resumeDraft').textContent=hasDraft()?'继续上次创作':'开始认识'; if(hasDraft())persistDraft(); });
  document.addEventListener('pointerdown',event=>{
    navigationRevision++;
    touchNavigation = event.pointerType === 'touch' ? {id:event.pointerId,x:event.clientX,y:event.clientY,moved:false} : null;
    const active=document.activeElement;
    if (!$('siteMenu').contains(event.target)) $('siteMenu').open = false;
    const library=$('research-library');
    if(event.pointerType==='touch' && library.contains(event.target)) {
      // Release stale controls when touch browsing resumes in the library.
      const editing = active?.matches('input, textarea, select, [contenteditable]:not([contenteditable="false"])');
      if(active && active!==document.body && !active.contains(event.target) && (!library.contains(active) || !editing)) active.blur();
      window.NuoDrawing?.closePanels?.();
      releaseWorkshopAnchor();
    }
    // Mobile viewport changes must not pull a reader back to a previously focused canvas/detail.
    if(event.pointerType==='touch' && active?.matches('#drawCanvas, #sampleDetail') && !active.contains(event.target)) active.blur();
  },{passive:true});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape' && $('siteMenu').open) {
      $('siteMenu').open=false;
      $('siteMenu').querySelector('summary').focus({preventScroll:true});
    }
  });
  document.addEventListener('pointermove',event=>{
    if(touchNavigation && touchNavigation.id === event.pointerId && Math.hypot(event.clientX-touchNavigation.x,event.clientY-touchNavigation.y)>10) {
      touchNavigation.moved=true; navigationRevision++;
    }
  },{passive:true});
  document.addEventListener('pointercancel',event=>{
    if(touchNavigation && touchNavigation.id === event.pointerId) { touchNavigation.moved=true; navigationRevision++; }
  },{passive:true});
  document.addEventListener('click',event=>{
    // Some Safari touch releases emit a click after native scrolling. Never turn that into navigation or collapse the library.
    if(event.detail !== 0 && touchNavigation?.moved && event.target.closest('a[href^="#"], #browseCultureAtlas, #siteMenu > summary')) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  },true);
  document.addEventListener('click',async event=>{
    const button = event.target.closest('button');
    if (button?.id === 'browseCultureAtlas') {
      navigationRevision++;
      const expanded = $('research-library').hidden;
      setLibraryExpanded(expanded);
      if (expanded) releaseWorkshopAnchor();
      else if ($(location.hash.slice(1))?.closest('.research-library')) history.replaceState(null, '', '#culture-guide');
      return;
    }
    if (button?.dataset.sample || button?.dataset.reviewSample) {
      selectedId=Number(button.dataset.sample || button.dataset.reviewSample);
      if(!pilot.has(selectedId))return;
      draft.sampleId=selectedId; renderSample(); draft.step='journey-explore'; persistDraft();
      go('sampleDetail',false); $('sampleDetail').focus({preventScroll:true});
    }
    if (button?.dataset.photo) {
      photoMode=button.dataset.photo==='true';
      const s=pilot.get(selectedId);
      const panel=$('sampleDetail').querySelector('.sample-image');
      const img=panel.querySelector('img');
      img.src=photoMode && s.photo ? s.photo : s.image;
      img.alt=photoMode && s.photo ? s.photoAlt : s.imageAlt;
      panel.querySelector('.sample-image-note').textContent=photoMode && s.photo ? '整理后的作品图像 · 查看来源了解作品' : content.labels.imageNote;
      panel.querySelectorAll('[data-photo]').forEach(toggle=>toggle.setAttribute('aria-pressed',String((toggle.dataset.photo==='true')===photoMode)));
    }
    if (button?.dataset.addRef) addReference(Number(button.dataset.addRef));
    if (button?.dataset.removeRef) {
      const id=Number(button.dataset.removeRef);
      draft.referenceIds=draft.referenceIds.filter(refId=>refId!==id); dirty=true;
      renderReferences(); renderSample(); persistDraft();
    }
    if (button?.dataset.useOutline && ready()) {
      button.disabled=true;
      const replacesTemplate = Boolean(drawingTemplate(window.NuoDrawing.exportEditable?.()));
      const ok = await window.NuoDrawing.addReference(ref(Number(button.dataset.useOutline)).image);
      button.disabled=false;
      if (ok) { button.textContent='已使用这张线稿 ✓'; notice('drawingStatus',(replacesTemplate?'已换用原线稿自由画，分区底稿已替换。':'已使用这张线稿自由画。')+'原有自由笔触、自由填色和截取局部保留。点击“到画布”查看；建议先调整构图，再上色。'); }
    }
    if (button?.dataset.refColor && ready()) { window.NuoDrawing.setColor(button.dataset.refColor); window.NuoDrawing.enter(); }
    const anchor=event.target.closest('a[href^="#"]');
    if (anchor && anchor.id!=='resumeDraft') {
      const id=anchor.getAttribute('href').slice(1);
      if ($(id)) {
        event.preventDefault();
        if (id === 'galaxy' && window.NuoDrawing?.ready) window.NuoDrawing.enter();
        go(id);
      }
    }
  });
  $('resumeDraft').addEventListener('click',event=>{
    event.preventDefault();
    if(!window.NuoDrawing?.ready && ['galaxy','journey-result'].includes(draft.step)){
      $('resumeDraft').textContent='草稿恢复中，请稍后再试';return;
    }
    if (draft.step==='journey-result' && ready() && window.NuoDrawing.hasContent()) { finish(); return; }
    if (draft.step==='galaxy' && ready()) window.NuoDrawing.enter();
    go(hasDraft()?draft.step:'journey-intro');
  });
  const dateText = date => new Intl.DateTimeFormat(document.documentElement?.lang === 'en' ? 'en-US' : 'zh-CN',{year:'numeric',month:'long',day:'numeric',timeZone:'Asia/Shanghai'}).format(Number.isNaN(Date.parse(date))?new Date():new Date(date));
  function sourceHTML(work) {
    return work.referenceIds.map(ref).filter(Boolean).map(s=>`<div class="card-reference"><p><strong>${esc(s.name)}</strong> · ${esc(s.region)}</p>${s.roleTags?`<p>资料中的角色线索：${esc(s.roleTags.join('、'))}</p>`:''}${work.referenceNotes[s.id]?`<p class="card-explanation">我想留下：${userText(work.referenceNotes[s.id])}</p>`:''}<p>${s.sources.map(x=>link(x.url,x.title)).join('<br>')}</p></div>`).join('');
  }
  function renderCard(work) {
    const adaptation = templateNote(work.drawing);
    $('journey-result').hidden=false;
    $('resultGuidance').textContent = work.target==='gift' ? '先读一遍你想对对方说的话，再看看画面和解释能否传达这份心意。下载后即可自行分享，对方无需注册或回复。' : '这份作品记录了此刻的期待。保存后，日后还能回看自己的选择和心意。';
    $('resultDelivery').textContent = work.target==='gift' ? '送出前，核对称呼、署名和留言。将作品卡图片分享给对方即可，对方不用打开这个网站，也不必回复。' : '把图片保存到相册或文件中，日后可以回看这份期待。需要继续改颜色或笔触，请同时保存到“我的作品”。';
    $('saveWork').textContent = works.some(w=>w.id===work.id) ? '更新已保存的作品' : '保存到我的作品';
    clearDownload('resultStatus');
    $('finishedCard').innerHTML = `<p class="card-meta">傩面万象 · 当代创作 ／ ${esc(dateText(work.date))}</p><h3 data-i18n-skip>${esc(work.title)}</h3><p class="card-meta">${work.target==='gift'?'送给 '+userText(work.recipient||tx('重要的人')):'留给自己'}</p><p class="card-wish" data-i18n-skip>${esc(work.wish)}</p>${work.target==='gift'&&work.signature?`<p class="card-meta card-signature">来自 ${userText(work.signature)}</p>`:''}<img data-i18n-skip src="${work.image}" alt="${esc(tx('{title}的创作图像', {title: work.title}))}">${adaptation?`<p class="field-note">${esc(adaptation)}</p>`:''}<div class="card-sources"><h4>我为什么这样创作</h4><p class="card-explanation" data-i18n-skip>${esc(work.explanation)}</p>${work.interest?`<p class="card-explanation">最初吸引我的：${userText(work.interest)}</p>`:''}<p class="field-note">这一部分记录创作者的个人理解。</p></div><div class="card-sources"><h4>这份作品的文化来处</h4>${sourceHTML(work)}<p>此为借鉴文化参考的当代创作，个人解释不代表传统角色的固定寓意。</p></div>`;
  }
  function finish(navigate = true) {
    if (!ready()) return false;
    const drawing = window.NuoDrawing.exportEditable?.();
    const completeDraft = includeDrawingReferences(draft,drawing);
    if (completeDraft.referenceIds.length !== draft.referenceIds.length) {
      draft = completeDraft; dirty = true;
      renderReferences(); renderSample(); persistDraft();
    }
    if (!draft.referenceIds.length || !draft.wish.trim()) { notice('intentionStatus','完成前，请留下文化参考并写一句自己的心意。',true); go('journey-intention'); return false; }
    window.NuoDrawing.enter();
    if (!window.NuoDrawing.hasContent()) { notice('drawingStatus','画布还是空的。可以选择一张分区练习稿上色，也可以使用原线稿或空白画布自由画。',true); go('galaxy'); return false; }
    if (!draft.title.trim() || !draft.explanation.trim()) {
      notice('drawingStatus','请为作品起个名字，并用一句话解释自己的创作选择。',true);
      go('galaxy'); (!draft.title.trim()?$('drawWorkName'):$('drawWorkDesc')).focus(); return false;
    }
    const previous=works.find(w=>w.id===draft.workId);
    currentCard={...cleanDraft(draft),id:draft.workId || (window.crypto?.randomUUID?crypto.randomUUID():Date.now().toString(36)),date:previous?.date || new Date().toISOString(),image:window.NuoDrawing.getImage(),drawing};
    renderCard(currentCard); notice('resultStatus','作品卡已生成，尚未保存本次修改。');
    if(navigate !== false) go('journey-result');
    return true;
  }
  window.addEventListener('nuo:finish',finish);
  $('finishFromExplanation').addEventListener('click',finish);
  function openCustomization(work, origin, statusId) {
    try {
      const outline = /^assets\/masks\/(\d{4})\.svg$/.exec(work.drawing?.outline?.src || '');
      const productionSourceId = drawingTemplate(work.drawing)?.sourceId || (outline && archive.has(Number(outline[1])) ? Number(outline[1]) : null);
      const references = work.referenceIds.map(ref).filter(Boolean).map(source => ({
        id: source.id, name: source.name, region: source.region,
        note: work.referenceNotes[source.id] || '',
        sources: source.sources.map(({title, url}) => ({title, url}))
      }));
      sessionStorage.setItem('nuo_custom_work_v1', JSON.stringify({work, origin, productionSourceId, references}));
      location.assign('customize.html?lang=' + customLanguage);
    } catch (_) {
      notice(statusId,'暂时无法打开定制演示，当前作品仍保留。请先下载作品卡，再重试。',true);
    }
  }
  $('customizeWork').addEventListener('click',()=>{
    if (finish(false)) openCustomization(currentCard, 'result', 'resultStatus');
  });
  $('editWork').addEventListener('click',()=>{if(ready()){window.NuoDrawing.enter();go('galaxy');}});
  function persistWorks(next, statusId) {
    try { localStorage.setItem(WORKS_KEY,JSON.stringify(next)); works=next; return true; }
    catch (_) {notice(statusId,'没有保存成功：浏览器存储空间不足或不可用。请先下载作品卡，或删除不再需要的本机作品后重试。',true);return false;}
  }
  $('saveWork').addEventListener('click',()=>{
    if (!currentCard) return;
    // Rebuild the preview without moving the page so the latest edits are saved.
    if (!finish(false)) return;
    const previous = works.find(w=>w.id===currentCard.id);
    if(previous && dirty && !window.confirm(tx('更新“{title}”的已保存版本？原版本将被本次修改替换，下载过的图片不会改变。', {title:previous.title}))) {
      notice('resultStatus','尚未更新已保存版本，当前修改仍留在草稿中。'); return;
    }
    const next=works.filter(w=>w.id!==currentCard.id);
    if(next.length>=10){notice('resultStatus','本机最多保留10件作品。请先下载备份，并在“我的作品”中删除一件后重试。',true);return;}
    if(persistWorks([{...currentCard,workId:currentCard.id},...next],'resultStatus')){
      draft.workId=currentCard.id; dirty=false; const draftSaved=persistDraft(); renderWorks();
      $('saveWork').textContent='更新已保存的作品';
      notice('resultStatus',draftSaved ? '已保存到“我的作品”，可以再次打开继续编辑。也建议下载一份图片留存。' : '作品已保存到“我的作品”，但自动草稿未能更新。下次请从“我的作品”重新打开。',!draftSaved);
    }
  });
  function renderWorks() {
    $('savedWorks').innerHTML = works.length?works.map(w=>`<article class="saved-work"><img data-i18n-skip src="${w.image}" alt="${esc(tx('{title}的创作图像', {title:w.title}))}" loading="lazy"><h3 data-i18n-skip>${esc(w.title)}</h3><p>${esc(dateText(w.date))} · ${w.target==='gift'?'赠予作品':'自我留存'}</p><p data-i18n-skip>${esc(w.wish)}</p><div class="journey-actions"><button class="journey-text-link" type="button" data-open-work="${esc(w.id)}">重新打开</button><button class="journey-text-link" type="button" data-export-work="${esc(w.id)}">下载</button><button class="journey-text-link" type="button" data-delete-work="${esc(w.id)}">删除</button></div><button class="journey-button saved-work-customize" type="button" data-customize-work="${esc(w.id)}">定制这件作品</button><p class="field-note">定制流程演示，不会产生真实订单。</p></article>`).join(''):'<p class="empty-state">还没有保存的作品。完成创作后，它会带着心意与文化参考一起留在这里。</p>';
  }
  function mayReplace() { return !hasDraft() || !dirty && works.some(w=>w.id===draft.workId) || window.confirm(tx('当前草稿将被替换。已保存到“我的作品”的内容会保留。要继续吗？')); }
  $('savedWorks').addEventListener('click',async event=>{
    const button=event.target.closest('button');if(!button)return;
    const id=button.dataset.openWork||button.dataset.exportWork||button.dataset.deleteWork||button.dataset.customizeWork;
    const work=works.find(w=>w.id===id);if(!work)return;
    if(button.dataset.customizeWork){openCustomization(work, 'saved', 'worksStatus');return;}
    if(button.dataset.exportWork){await download(work,'worksStatus');return;}
    if(button.dataset.deleteWork){
      if(window.confirm(tx('从此浏览器删除“{title}”？下载过的文件不会受影响。', {title:work.title}))&&persistWorks(works.filter(w=>w.id!==id),'worksStatus')){renderWorks();notice('worksStatus','已删除本机作品。');}return;
    }
    if(!ready()||!mayReplace())return;
    button.disabled=true;
    switchingWork=true;
    notice('worksStatus','正在打开作品，请稍等。');
    $('journeyContent').inert=true;
    let restored=false;
    try { restored=await window.NuoDrawing.restore(work.image,cleanDraft({...work,workId:work.id,step:'galaxy'}),work.drawing); }
    catch (_) { /* Preserve the current journey metadata if restoration fails. */ }
    finally { switchingWork=false;button.disabled=false;$('journeyContent').inert=false; }
    if(!restored){notice('worksStatus','图像未能恢复，当前内容已保留。',true);return;}
    draft=cleanDraft({...work,workId:work.id,step:'galaxy'});selectedId=draft.sampleId;currentCard=null;dirty=false;
    window.NuoDrawing.resetHistory(); $('journey-result').hidden=true;
    syncForm();renderReferences();renderSample();persistDraft();window.NuoDrawing.enter();go('galaxy');
    notice('worksStatus',tx('已打开“{title}”，可以继续编辑。', {title:work.title}),false,true);
  });
  $('newWork').addEventListener('click',()=>{
    if(!ready()||!mayReplace())return;
    switchingWork=true;window.NuoDrawing.clear(cleanDraft({}));switchingWork=false;
    window.NuoDrawing.resetHistory();draft=cleanDraft({});selectedId=draft.sampleId;currentCard=null;dirty=false;
    $('journey-result').hidden=true;syncForm();renderReferences();renderSample();persistDraft();go('journey-explore');
  });
  function clearDownload(statusId) {
    const id=statusId==='worksStatus'?'worksDownloadPreview':'resultDownloadPreview';
    if(downloadURLs.has(id)){URL.revokeObjectURL(downloadURLs.get(id));downloadURLs.delete(id);}
    $(id).hidden=true;$(id).innerHTML='';
  }
  function imageFrom(src) { return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('image'));img.src=src;}); }
  async function download(work,statusId) {
    if(exporting){notice(statusId,'作品卡正在生成，请稍等。');return;}
    exporting=true;notice(statusId,'正在生成包含文化出处的作品卡……');
    try {
      const references=work.referenceIds.map(ref).filter(Boolean);
      if(document.fonts?.load){
        const text=[work.title,work.wish,work.recipient,work.signature,work.explanation,work.interest,templateNote(work.drawing),...Object.values(work.referenceNotes),'我为什么这样创作 · 个人理解最初吸引我的：文化参考 · 可追溯的来处资料中的角色线索：、我想留下：此为借鉴文化参考的当代创作；个人解释不代表传统角色的固定寓意。送给重要的人留给自己来自',...references.flatMap(s=>[s.name,s.region,...(s.roleTags||[]),...s.sources.map(source=>source.title)])].filter(Boolean).join('');
        // Canvas measurement and drawing must use the same loaded faces.
        await Promise.allSettled([
          document.fonts.load('400 27px "Nuo Sans"',text),
          document.fonts.load('600 24px "Nuo Sans"','傩面万象 · 当代创作 '+dateText(work.date)),
          document.fonts.load('600 50px "Nuo Serif"',[work.title,...references.map(s=>s.name+' ／ '+s.region)].join(''))
        ]);
      }
      const img=await imageFrom(work.image);
      const canvas=document.createElement('canvas');canvas.width=1200;
      const measure=canvas.getContext('2d');
      if(!measure)throw new Error('canvas');
      const blocks=[];
      function add(text,size=27,color='#d2c1a2',gap=22,heading=false){
        const font=heading?`600 ${size}px "Nuo Serif","Songti SC",serif`:`400 ${size}px "Nuo Sans","PingFang SC",sans-serif`;
        measure.font=font;
        for(const paragraph of String(text).split('\n')) {
          let line='';
          // Keep English words intact while allowing Chinese text to wrap character by character.
          const tokens = paragraph.match(/[^\s\u3400-\u9fff]+|\s+|[\u3400-\u9fff]/gu) || [];
          for (const token of tokens) {
            const pieces = measure.measureText(token).width > 1032 ? Array.from(token) : [token];
            for (const piece of pieces) {
              if (measure.measureText(line + piece).width > 1032 && line) {
                blocks.push({text:line.trimEnd(),size,color,font}); line = piece.trimStart();
              } else line += piece;
            }
          }
          blocks.push({text:line,size,color,font});
        }
        blocks.push({gap});
      }
      add(work.title,50,'#fff0d2',26,true);
      add(work.target==='gift'?tx('送给 {name}', {name:work.recipient||tx('重要的人')}):tx('留给自己'),24,'#d6a159',20);
      add(work.wish,36,'#fff0d2',28);
      if(work.target==='gift'&&work.signature)add(tx('来自 {name}', {name:work.signature}),25,'#d6a159');
      blocks.push({image:true});
      const adaptation = templateNote(work.drawing);
      if(adaptation)add(adaptation,22,'#bda989',20);
      add(tx('我为什么这样创作 · 个人理解'),23,'#d6a159',14);add(work.explanation);
      if(work.interest)add(tx('最初吸引我的：')+work.interest,25);
      add(tx('文化参考 · 可追溯的来处'),25,'#d6a159',15);
      references.forEach(s=>{
        add(tx(s.name)+' / '+tx(s.region),26,'#fff0d2',8,true);
        if(s.roleTags)add(tx('资料中的角色线索：')+s.roleTags.map(tag=>tx(tag)).join(', '),24,'#d2c1a2',12);
        if(work.referenceNotes[s.id])add(tx('我想留下：')+work.referenceNotes[s.id],25,'#fff0d2',16);
        for(const source of s.sources){add(tx(source.title),21,'#cbbb9f',2);if(safeURL(source.url))add(safeURL(source.url),20,'#bda989',12);}
      });
      add(tx('此为借鉴文化参考的当代创作；个人解释不代表传统角色的固定寓意。'),22,'#bda989',0);
      const height=Math.ceil(210+blocks.reduce((sum,b)=>sum+(b.image?990:b.gap!==undefined?b.gap:b.size*1.65),0));
      // Bound large multi-reference cards without clipping their cultural sources.
      const scale=Math.min(1,8192/height,Math.sqrt(12000000/(1200*height)));
      canvas.width=Math.floor(1200*scale);canvas.height=Math.floor(height*scale);
      const ctx=canvas.getContext('2d');ctx.scale(scale,scale);ctx.fillStyle='#1b130d';ctx.fillRect(0,0,1200,height);ctx.strokeStyle='#a07c48';ctx.lineWidth=2;ctx.strokeRect(30,30,1140,height-60);
      ctx.fillStyle='#d6a159';ctx.font='600 24px "Nuo Sans","PingFang SC",sans-serif';ctx.fillText(tx('傩面万象 · 当代创作'),84,98);ctx.textAlign='right';ctx.fillText(dateText(work.date),1116,98);ctx.textAlign='left';
      let y=185;
      for(const b of blocks){
        if(b.image){ctx.fillStyle='#0d0906';ctx.fillRect(84,y,1032,920);const scale=Math.min(960/img.width,880/img.height);ctx.drawImage(img,600-img.width*scale/2,y+460-img.height*scale/2,img.width*scale,img.height*scale);y+=990;continue;}
        if(b.gap!==undefined){y+=b.gap;continue;}
        ctx.fillStyle=b.color;ctx.font=b.font;ctx.fillText(b.text,84,y);y+=b.size*1.65;
      }
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('export');
      clearDownload(statusId);
      const url=URL.createObjectURL(blob);
      const filename=(work.title.replace(/[\\/:*?"<>|]/g,'_')||tx('傩面作品'))+(document.documentElement?.lang === 'en' ? '-artwork-card.png' : '-作品卡.png');
      const id=statusId==='worksStatus'?'worksDownloadPreview':'resultDownloadPreview';
      downloadURLs.set(id,url);
      $(id).innerHTML=`<details><summary data-i18n-skip>${esc(tx('查看《{title}》图片／长按保存', {title:work.title}))}</summary><p>在手机上展开图片后，可以长按图片保存。赠予时请分享这张图片；称呼、留言与文化出处都包含在内。</p><a class="journey-text-link" href="${url}" download="${esc(filename)}">再次下载作品卡</a><img data-i18n-skip src="${url}" alt="${esc(tx('{title}的完整作品卡，可长按保存', {title:work.title}))}"></details>`;
      $(id).hidden=false;
      const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();
      notice(statusId,'已生成作品卡并发起下载。若没有找到图片，可展开下方预览，长按图片保存。');
    } catch (_) {notice(statusId,'作品卡生成失败。当前作品仍保留，请重试或先保存到“我的作品”。',true);} finally {exporting=false;}
  }
  $('downloadWork').addEventListener('click',()=>{if(finish(false))download(currentCard,'resultStatus');});
  window.addEventListener('nuo:before-language-change', event => {
    if (switchingWork || (!window.NuoDrawing?.ready && (hasDraft() || drawingDraft))) {
      event.preventDefault();
      if (event.detail) event.detail.message = '草稿正在恢复，请稍后再切换语言。';
      return;
    }
    if (hasDraft() && !persistDraft()) {
      event.preventDefault();
      if (event.detail) event.detail.message = '切换语言前，请先保存或下载当前作品。当前页面已保留。';
    }
  });
  window.addEventListener('pagehide',()=>{if(hasDraft())persistDraft();});
  function followCultureHash() {
    const target = $(location.hash.slice(1));
    if (revealLibrary(target)) scrollToSection(target, 'auto');
  }
  window.addEventListener('hashchange', followCultureHash);
  syncForm();renderSample();renderReferences();renderWorks();
  $('resumeDraft').textContent=hasDraft()?'继续上次创作':'开始认识';
  if(readError)notice('worksStatus','部分本机记录无法读取。当前可重新开始创作，原存储内容未自动删除。',true);
  if(location.hash) followCultureHash();
})();
