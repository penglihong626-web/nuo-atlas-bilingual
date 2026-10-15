/* A portable, progressively loaded atlas: overview → works → regions → saved palette. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const t = (text, vars) => window.NuoI18n?.t(text, vars) ?? String(text).replace(/\{(\w+)\}/g, (_, key) => vars?.[key] ?? '');
  if (!$('color-atlas')) return;
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pct = n => (n * 100).toFixed(1) + '%';
  const validHex = value => /^#[0-9a-f]{6}$/i.test(value);
  const safeURL = value => typeof value === 'string' && (/^https:\/\//.test(value) || value === '#color-atlas' || value === '#caBrowse');
  const displaySource = title => {
    const count = /^色彩图谱 · (\d+) 张样本中出现$/.exec(title);
    return count ? t('色彩图谱 · {count} 张样本中出现',{count:count[1]}) : t(title);
  };
  const sourceLink = (url, title) => safeURL(url) ? '<a class="ca-source" href="' + esc(url) + '"' + (url[0] === '#' ? '' : ' target="_blank" rel="noopener noreferrer"') + '>' + esc(displaySource(title)) + ' ↗︎</a>' : esc(displaySource(title));
  const button = (action, label, extra = '') => '<button type="button" class="ca-button" data-ca-action="' + action + '" ' + extra + '>' + label + '</button>';
  const storageKey = 'nuo_color_palette_v1';
  const state = {model:null, colorId:'', maskId:'', colorPage:0, maskPage:0, loading:false, paletteEmpty:false};
  const colorPageSize = 12, maskPageSize = 8;
  let saved = [];
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (Array.isArray(raw)) saved = raw.filter(c => c && validHex(c.hex) && typeof c.color_id === 'string').slice(0,8).map(c => ({color_id:c.color_id.slice(0,80), hex:c.hex, name:String(c.name || c.hex).slice(0,80), sources:(Array.isArray(c.sources) ? c.sources : []).filter(s => s && safeURL(s.url)).slice(0,20).map(s => ({url:s.url, title:String(s.title || '配色出处').slice(0,160)}))}));
  } catch (_) { /* The palette remains usable without browser storage. */ }

  function pages(total, size, page, kind) {
    if (total <= size) return '';
    const count = Math.ceil(total / size);
    return '<span>' + t('第 {page} / {pages} 页 · 共 {total} 项', {page:page+1,pages:count,total}) + '</span>' + button(kind+'-prev','上一页',page===0?'disabled':'') + button(kind+'-next','下一页',page===count-1?'disabled':'');
  }
  function familyHex(family) {
    return state.model.palette.find(c => c.family === family)?.hex || '#82745f';
  }
  function bar(share, hex) {
    return '<div class="ca-bar" style="--share:' + Math.min(100,share*100) + '%;--swatch:' + esc(hex) + '"><i></i></div>';
  }
  function strip(colors, residual) {
    return '<div class="ca-strip" role="img" aria-label="整张样本的聚类色占比；斜线为未记录比例">' + colors.map(c => '<span title="' + esc(c.name + ' ' + pct(c.share)) + '" style="--share:' + c.share*100 + '%;--swatch:' + esc(c.hex) + '"></span>').join('') + '<span class="ca-residual" title="' + esc(t('未纳入记录 {share}',{share:pct(residual)})) + '" style="--share:' + residual*100 + '%"></span></div>';
  }
  function overview() {
    const m = state.model;
    $('caMetrics').innerHTML = [[m.total,'样本图片'],[m.palette.length,'项目聚类色'],[m.families.length,'色系'],[m.regions.length,'地域标签']].map(([v,l])=>'<div class="ca-metric"><strong>'+v+'</strong><span>'+l+'</span></div>').join('');
    $('caFamilies').innerHTML = m.families.map(f=>'<button type="button" class="ca-family" data-ca-family="'+esc(f.family)+'" title="'+esc(t('查看{family}对应面具',{family:t(f.family_label)}))+'"><small>'+esc(f.family_label)+'</small><strong>'+pct(f.share)+'</strong>'+bar(f.share,familyHex(f.family))+'</button>').join('');
    $('caMethod').innerHTML = [
      t('先从照片中提取前景，再将相近颜色归并为 {count} 种项目聚类色。归并阈值 ΔE00 ≤ {threshold}。这些色名是本项目的索引，不是传统颜料名称。',{count:m.palette.length,threshold:m.method.merge_threshold_delta_e_2000}),
      t('单图占比取自该图已有的前景像素映射记录；同一图片中重复出现的聚类色先合并。全局占比是 {total} 张图片的等权平均，地域占比是在对应地域内等权平均。出现样本数按不同图片去重。',{total:m.total}),
      t('平均有 {share} 的比例未纳入现有记录，原因待核。色条用斜线保留余量，不将已知颜色重新放大到 100%。微小占比显示为 0.0% 时仅是四舍五入。',{share:pct(m.residual)}),
      t('图片可用于配色观察，但背景去除、拍摄光照与后期处理都会改变取色。地域不明或推定的图片保留原标签。')
    ].map(text=>'<p>'+esc(text)+'</p>').join('');
    $('caFamily').innerHTML = '<option value="all">全部色系</option>' + m.families.map(f=>'<option value="'+esc(f.family)+'">'+esc(f.family_label)+'</option>').join('');
    const options = m.regions.map(r=>'<option value="'+esc(r.region)+'">'+esc(t('{region} · {count} 张',{region:t(r.region),count:r.count}))+'</option>').join('');
    $('caMaskRegion').innerHTML = '<option value="all">全部地域标签</option>' + options;
    $('caRegionA').innerHTML = options; $('caRegionB').innerHTML = options;
    const confirmed = m.regions.filter(r=>!r.region.includes('推定') && !r.region.includes('未明确'));
    $('caRegionA').value = (confirmed[0] || m.regions[0]).region;
    $('caRegionB').value = (confirmed[1] || m.regions[1] || m.regions[0]).region;
  }
  function filteredColors() {
    return window.NUO_COLOR_MODEL.filterPalette(state.model.palette,{family:$('caFamily').value,query:$('caColorQuery').value,sort:$('caSort').value});
  }
  function renderColors(resetSelection) {
    $('caActionStatus').textContent='';
    const list = filteredColors();
    state.paletteEmpty = !list.length;
    if (resetSelection || state.colorId && !list.some(c=>c.color_id===state.colorId)) state.colorId = list[0]?.color_id || '';
    state.colorPage = Math.min(state.colorPage,Math.max(0,Math.ceil(list.length/colorPageSize)-1));
    $('caColors').innerHTML = list.length ? list.slice(state.colorPage*colorPageSize,(state.colorPage+1)*colorPageSize).map(c=>'<button type="button" class="ca-color" data-ca-color="'+esc(c.color_id)+'" aria-pressed="'+(state.colorId===c.color_id)+'"><i class="ca-color-chip" style="--swatch:'+esc(c.hex)+'"></i><span class="ca-color-info"><span>'+esc(c.name)+'</span><span class="ca-color-hex">'+esc(c.hex)+'</span><span>'+pct(c.global_share)+'</span></span></button>').join('') : '<p class="ca-note">没有符合条件的颜色，请修改或清空筛选。</p>';
    $('caColorPages').innerHTML = pages(list.length,colorPageSize,state.colorPage,'colors');
    const c = state.model.palette.find(c=>c.color_id===state.colorId);
    $('caSelectedColor').innerHTML = c ? '<i style="--swatch:'+esc(c.hex)+'"></i><div><strong>'+esc(c.name)+' · '+esc(c.hex)+'</strong><p class="ca-note">'+t('平均占比 {share} · 出现在 {count} 张样本中',{share:pct(c.global_share),count:c.image_count})+'</p></div>'+button('save-color','收藏颜色') : '<p class="ca-note">'+(list.length?'当前查看全部颜色的面具。选择上方色卡，可以缩小范围。':'当前没有可选颜色。')+'</p>';
    renderMasks();
  }
  function filteredMasks() {
    if (state.paletteEmpty) return [];
    return window.NUO_COLOR_MODEL.filterMasks(state.model.masks,{region:$('caMaskRegion').value,query:$('caMaskQuery').value,colorId:state.colorId});
  }
  function renderMasks() {
    const list = filteredMasks();
    state.maskPage = Math.min(state.maskPage,Math.max(0,Math.ceil(list.length/maskPageSize)-1));
    const page = list.slice(state.maskPage*maskPageSize,(state.maskPage+1)*maskPageSize);
    if (!page.some(m=>m.image_id===state.maskId)) state.maskId = page[0]?.image_id || '';
    $('caMaskCount').textContent = list.length ? t('找到 {total} 张样本 · 当前显示 {first}–{last} 张',{total:list.length,first:state.maskPage*maskPageSize+1,last:Math.min(list.length,(state.maskPage+1)*maskPageSize)}) : '没有符合条件的面具。可清空名称、切换地域或查看全部面具。';
    $('caMasks').innerHTML = page.map(m=>'<button type="button" class="ca-mask" data-ca-mask="'+esc(m.image_id)+'" aria-pressed="'+(state.maskId===m.image_id)+'"><img src="'+esc(m.outline || m.photo)+'" alt="" width="56" height="72" loading="lazy"><span><strong>'+esc(m.name)+'</strong><small>'+esc(String(m.numericId).padStart(4,'0'))+' · '+esc(m.region)+'</small></span></button>').join('');
    $('caMaskPages').innerHTML = pages(list.length,maskPageSize,state.maskPage,'masks');
    renderMaskDetail();
  }
  function colorRow(c) {
    return '<div class="ca-color-row"><i class="ca-mini-chip" style="--swatch:'+esc(c.hex)+'"></i><span>'+esc(c.name)+'<br>'+esc(c.hex)+'</span><span>'+pct(c.share)+'</span>'+button('save-mask-color','收藏','data-color-id="'+esc(c.color_id)+'" aria-label="'+esc(t('收藏 {name}',{name:t(c.name)}))+'"')+'</div>';
  }
  function renderMaskDetail() {
    const m = state.model.masks.find(m=>m.image_id===state.maskId);
    if (!m) { $('caMaskDetail').innerHTML=''; return; }
    $('caMaskDetail').innerHTML = '<article class="ca-mask-detail"><figure class="ca-mask-photo"><img src="'+esc(m.photo)+'" alt="'+esc(t('{name}作品照片',{name:t(m.name)}))+'" width="320" height="320" loading="lazy"><figcaption class="ca-note">原图片资料 · '+esc(m.filename)+'<br>'+sourceLink(m.source_url,'查看作品档案与出处')+'</figcaption></figure><div class="ca-mask-copy"><div><h4>'+esc(m.name)+'</h4><p class="ca-note">'+esc(t('{region} · 样本 {id}',{region:t(m.region),id:String(m.numericId).padStart(4,'0')}))+'</p></div>'+strip(m.colors,m.residual)+'<p class="ca-note">'+t('{count} 种聚类色 · 未纳入记录 {share}（斜线部分）',{count:m.colors.length,share:pct(m.residual)})+'</p><div class="ca-color-rows">'+m.colors.slice(0,6).map(colorRow).join('')+'</div>'+(m.colors.length>6?'<details class="ca-method"><summary>'+t('查看其余 {count} 种颜色',{count:m.colors.length-6})+'</summary><div class="ca-color-rows">'+m.colors.slice(6).map(colorRow).join('')+'</div></details>':'')+button('save-mask-palette',t('收藏前 {count} 种颜色',{count:Math.min(5,m.colors.length)}))+'<p id="caMaskSaveStatus" class="ca-status" role="status"></p><p class="ca-note">这是照片的配色记录。借用颜色时，请把自己的表达与传统角色的含义分开说明。</p></div></article>';
  }
  function renderRegions() {
    const a = state.model.regions.find(r=>r.region===$('caRegionA').value), b = state.model.regions.find(r=>r.region===$('caRegionB').value);
    if (!a || !b) return;
    $('caRegionFacts').innerHTML = [a,b].map(r=>'<div><strong>'+esc(r.region)+'</strong><p class="ca-note">'+t('{count} 张样本',{count:r.count})+(r.count<10?' · 样本较少':'')+'<br>'+t('未纳入记录 {share}',{share:pct(r.residual)})+'</p></div>').join('');
    $('caRegionComparison').innerHTML = state.model.families.map(f=>'<div class="ca-compare-row"><span>'+esc(f.family_label)+'</span>'+[a,b].map(r=>{const share=r.families.find(x=>x.family===f.family)?.share || 0;return '<div><span>'+pct(share)+'</span>'+bar(share,familyHex(f.family))+'</div>';}).join('')+'</div>').join('');
  }
  function saveColors(colors, source) {
    let added = 0, missed = 0;
    colors.forEach(c=>{
      let found = saved.find(s=>s.color_id===c.color_id);
      if (!found) {
        if (saved.length>=8) { missed++; return; }
        found={color_id:c.color_id,hex:c.hex,name:c.name,sources:[]}; saved.push(found); added++;
      }
      if (source && !found.sources.some(s=>s.url===source.url && s.title===source.title) && found.sources.length<20) found.sources.push(source);
    });
    let stored = true;
    try { localStorage.setItem(storageKey,JSON.stringify(saved)); } catch (_) { stored=false; }
    renderSaved();
    const text = (missed ? t('已保留 {count} 种颜色，最多 8 种；移除一些后可继续添加。',{count:saved.length}) : added ? t('已收藏 {count} 种颜色，创作画布下方也可以选用。',{count:added}) : '这份颜色与出处已在收藏中。') + ' ' + t(stored?'已保存在此浏览器。':'暂时无法保存到浏览器，关闭页面后本次修改可能丢失。');
    $('caSaveStatus').textContent = text;
    // Keep feedback beside the action, without moving the reading position.
    $('caActionStatus').textContent = text;
    if ($('caMaskSaveStatus')) $('caMaskSaveStatus').textContent = text;
  }
  function renderSaved() {
    $('caSaved').innerHTML = saved.length ? '<div class="ca-saved-grid">'+saved.map(c=>'<div class="ca-saved-item"><i style="--swatch:'+esc(c.hex)+'"></i><strong>'+esc(c.name)+' · '+esc(c.hex)+'</strong><details><summary>'+t('配色出处（{count}）',{count:c.sources.length})+'</summary><ul>'+c.sources.map(s=>'<li>'+sourceLink(s.url,s.title)+'</li>').join('')+'</ul></details>'+button('remove-color','移除','data-color-id="'+esc(c.color_id)+'" aria-label="'+esc(t('移除 {name}',{name:t(c.name)}))+'"')+'</div>').join('')+'</div><div class="ca-saved-actions"><a class="ca-button" href="#galaxy">带着配色进入创作工坊 →</a></div>' : '<p class="ca-note">还没有收藏颜色。在上方选一抹颜色，或收藏一张面具的主要配色。</p>';
    const dock = $('colorWorkshopPalette');
    if (!dock) return;
    dock.hidden = !saved.length;
    dock.innerHTML = '<div class="ca-workshop-header"><span>图谱收藏配色</span><a href="#color-atlas">查看出处 / 管理</a></div><div class="ca-workshop-colors" role="group" aria-label="图谱收藏配色">'+saved.map(c=>'<button type="button" data-saved-color="'+esc(c.hex)+'" aria-label="'+esc(t('使用 {name} {hex}',{name:t(c.name),hex:c.hex}))+'" aria-pressed="false"'+(window.NuoDrawing?.ready?'':' disabled')+'><i style="--swatch:'+esc(c.hex)+'"></i></button>').join('')+'</div><p id="caDockStatus" role="status">'+(window.NuoDrawing?.ready?'选择颜色后可在画布上使用。':'画布准备好后即可选用。')+'</p>';
  }
  $('colorWorkshopPalette')?.addEventListener('click',event=>{
    const b=event.target.closest('[data-saved-color]');
    if (!b || !window.NuoDrawing?.ready) return;
    window.NuoDrawing.setColor(b.dataset.savedColor);
    $('colorWorkshopPalette').querySelectorAll('[data-saved-color]').forEach(c=>c.setAttribute('aria-pressed',String(c===b)));
    $('caDockStatus').textContent=t('当前颜色 {hex}；可以继续填色或绘画。',{hex:b.dataset.savedColor});
  });
  function syncWorkshopColor() {
    const hex=$('currentColorValue')?.textContent.trim().toUpperCase();
    $('colorWorkshopPalette')?.querySelectorAll('[data-saved-color]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.savedColor.toUpperCase()===hex)));
  }
  if ($('currentColorValue')) new MutationObserver(syncWorkshopColor).observe($('currentColorValue'),{childList:true,characterData:true,subtree:true});
  window.addEventListener('nuo:drawing-ready',()=>{renderSaved();syncWorkshopColor();});
  renderSaved();

  $('color-atlas').addEventListener('click',event=>{
    if (!state.model) return;
    const b=event.target.closest('button'); if (!b) return;
    if (b.dataset.caFamily) {
      $('caFamily').value=b.dataset.caFamily; $('caColorQuery').value=''; state.colorPage=0; state.maskPage=0;
      renderColors(true);
      // A deliberate family choice is navigation; ordinary filtering never scrolls.
      $('caBrowse').scrollIntoView({block:'start',behavior:'auto'}); return;
    }
    if (b.dataset.caColor) { state.colorId=b.dataset.caColor; state.maskPage=0; renderColors(false); return; }
    if (b.dataset.caMask) { state.maskId=b.dataset.caMask; renderMasks(); return; }
    const action=b.dataset.caAction;
    if (action?.startsWith('colors-')) { state.colorPage+=action.endsWith('next')?1:-1; renderColors(false); }
    if (action?.startsWith('masks-')) { state.maskPage+=action.endsWith('next')?1:-1; renderMasks(); }
    if (action==='save-color') {
      const c=state.model.palette.find(c=>c.color_id===state.colorId);
      if(c)saveColors([c],{url:'#color-atlas',title:'色彩图谱 · '+c.image_count+' 张样本中出现'});
    }
    if (action==='save-mask-color' || action==='save-mask-palette') {
      const m=state.model.masks.find(m=>m.image_id===state.maskId);
      if(m)saveColors(action==='save-mask-palette'?m.colors.slice(0,5):m.colors.filter(c=>c.color_id===b.dataset.colorId),{url:m.source_url || '#color-atlas',title:m.name+' · '+m.region+' · '+m.filename});
    }
    if (action==='remove-color') {
      saved=saved.filter(c=>c.color_id!==b.dataset.colorId);
      let stored=true;try{localStorage.setItem(storageKey,JSON.stringify(saved));}catch(_){stored=false;}
      renderSaved(); $('caSaveStatus').textContent=stored?'已移除该颜色。':'本页已移除，但浏览器存储暂不可用。';
    }
  });
  ['caFamily','caSort','caColorQuery'].forEach(id=>$(id).addEventListener(id==='caColorQuery'?'input':'change',()=>{if(!state.model)return;state.colorPage=0;state.maskPage=0;renderColors(id!=='caSort');}));
  ['caMaskRegion','caMaskQuery'].forEach(id=>$(id).addEventListener(id==='caMaskQuery'?'input':'change',()=>{if(!state.model)return;state.maskPage=0;renderMasks();}));
  ['caRegionA','caRegionB'].forEach(id=>$(id).addEventListener('change',()=>{if(state.model)renderRegions();}));
  $('caAllMasks').addEventListener('click',()=>{
    if(!state.model)return;
    state.colorId='';state.maskPage=0;state.colorPage=0;
    $('caFamily').value='all';$('caColorQuery').value='';$('caMaskRegion').value='all';$('caMaskQuery').value='';
    renderColors(false);
  });
  function initialize() {
    if(state.model)return;
    state.model=window.NUO_COLOR_MODEL.build(window.NUO_COLOR_DATA,window.NUO_MASK_ATLAS?.nodes || []);
    overview();renderColors(true);renderRegions();
    $('caContent').hidden=false;$('caLoadStatus').hidden=true;$('caRetry').hidden=true;
  }
  function load() {
    if(state.loading || state.model)return;
    state.loading=true;$('caLoadStatus').textContent='正在整理颜色与面具资料…';$('caRetry').hidden=true;
    if(window.NUO_COLOR_DATA){try{initialize();}catch(_){failed();}return;}
    const script=document.createElement('script');script.src='color-atlas/data/browser-data.js?v=four-layers-20261008';
    script.onload=()=>{try{initialize();}catch(_){failed();}};
    script.onerror=()=>{script.remove();failed();};document.head.appendChild(script);
  }
  function failed() { state.loading=false;state.model=null;$('caLoadStatus').hidden=false;$('caLoadStatus').textContent='色彩资料暂未加载，请重试。';$('caRetry').hidden=false; }
  $('caRetry').addEventListener('click',load);
  if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();load();}},{rootMargin:'400px'});observer.observe($('color-atlas'));}else load();
})();
