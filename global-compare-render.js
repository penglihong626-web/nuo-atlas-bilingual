/* Concrete museum objects are kept separate from the comparisons drawn from them. */
(function () {
  'use strict';
  const content = window.NUO_WORLD_CONTENT;
  if (!content) return;
  const objects = content.objects;
  function escape(value) {
    return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }
  function sourceLink(source, label) {
    return '<a class="comparison-source" href="' + escape(source.url) + (source.url.startsWith('#') ? '">' : '" target="_blank" rel="noopener noreferrer">') + escape(label || source.title) + ' ↗︎</a>';
  }
  function field(label, text) {
    return '<div><dt>' + label + '</dt><dd>' + escape(text) + '</dd></div>';
  }
  function objectImage(item, id, name, width, height, description) {
    return '<img id="' + escape(id) + '" src="' + escape(item.image) + '" alt="' + escape(description || name) + '" width="' + width + '" height="' + height + '" loading="lazy">';
  }
  const picker = document.getElementById('worldObjectPicker');
  const panels = document.getElementById('worldObjectPanels');
  if (picker && panels) {
    picker.innerHTML = objects.map((item, index) => '<button type="button" class="world-object-choice" data-object="' + escape(item.id) + '" aria-controls="world-' + escape(item.id) + '" aria-pressed="' + (index === 0) + '"><img src="' + escape(item.image) + '" alt="" width="160" height="120" loading="lazy"><span>' + escape(item.region) + '</span><strong>' + escape(item.title) + '</strong></button>').join('');
    panels.innerHTML = objects.map((item, index) => {
      const imageId = 'world-image-' + item.id;
      return '<article class="world-object-panel" id="world-' + escape(item.id) + '" aria-labelledby="world-title-' + escape(item.id) + '"' + (index ? ' hidden' : '') + '><figure class="world-object-figure"><div class="world-image-plate">' + objectImage(item, imageId, item.title, 300, 300, item.title + '：' + item.observation) + '</div><figcaption>' + escape(item.imageCredit) + ' ' + sourceLink(item.imageSource, '图像出处') + '</figcaption></figure><div class="world-object-copy"><h3 id="world-title-' + escape(item.id) + '">' + escape(item.title) + '</h3><p class="world-observation">' + escape(item.observation) + '</p><dl class="world-object-facts">' + field('地域', item.region) + field('年代', item.period) + field('作者', item.maker) + field('材料', item.material) + '</dl><div class="world-object-context"><section><h4>它表现谁</h4><p>' + escape(item.role) + '</p></section><section><h4>在什么场合使用</h4><p>' + escape(item.context) + '</p></section></div><div class="world-provenance"><p>' + escape(item.collection + ' · 藏品 ' + item.accession) + '</p>' + sourceLink(item.source, '查看馆藏记录') + '</div></div></article>';
    }).join('');
    const choices = picker.querySelectorAll('button');
    const cards = panels.querySelectorAll('article');
    choices.forEach(button => button.addEventListener('click', () => {
      choices.forEach(choice => choice.setAttribute('aria-pressed', String(choice === button)));
      cards.forEach(card => { card.hidden = card.id !== 'world-' + button.dataset.object; });
    }));
  }
  const track = document.getElementById('deckTrack');
  if (track) {
    track.innerHTML = content.pairs.map((pair, index) => {
      const other = objects.find(item => item.id === pair.foreignId);
      const domestic = pair.domestic;
      const domesticImageId = 'pair-image-' + index + '-china';
      const foreignImageId = 'pair-image-' + index + '-world';
      const portrait = (item, id, name, caption, source) => '<figure><div class="pair-image-plate">' + objectImage(item, id, name, 240, 200) + '</div><figcaption><strong>' + escape(name) + '</strong><span>' + escape(caption) + '</span>' + sourceLink(source, '作品出处') + '</figcaption></figure>';
      return '<article class="deck-card" id="comparison-pair-' + index + '" aria-labelledby="pair-title-' + index + '"' + (index ? ' hidden' : '') + '><header><h3 id="pair-title-' + index + '">' + escape(pair.title) + '</h3><p>' + escape(pair.focus) + '</p></header><div class="pair-portraits">' + portrait(domestic, domesticImageId, domestic.name, domestic.creator, domestic.source) + portrait(other, foreignImageId, other.title, other.region + ' · ' + other.period, other.source) + '</div><p class="pair-photo-note">图片按版面缩放，不代表实物尺寸。形态为据图观察，材料与场合依据作品记录。</p><div class="pair-dimensions">' + pair.dimensions.map(dimension => '<section class="pair-dimension"><h4>' + escape(dimension.label) + '</h4><div class="pair-values"><p><b>' + escape(domestic.name) + '</b><span>' + escape(dimension.china) + '</span></p><p><b>' + escape(other.title) + '</b><span>' + escape(dimension.foreign) + '</span></p></div></section>').join('') + '</div><p class="pair-photo-note">海外图像归属与完整馆藏资料见“世界面具样本”。' + sourceLink({url:'#global-compare',title:'查看世界面具'}) + '</p></article>';
    }).join('');
  }

// A vertical reading gesture must never switch a comparison or move the page.
(function initDeck(){
  var track=document.getElementById('deckTrack');if(!track)return;
  var tabs=document.querySelectorAll('#compare-section .deck-tab'),dots=document.querySelectorAll('#compare-section .deck-dot');
  var pB=document.getElementById('deckPrev'),nB=document.getElementById('deckNext');
  var slides=track.querySelectorAll('.deck-card');
  var cur=0,total=slides.length;
  function go(i){
    cur=Math.max(0,Math.min(total-1,i));
    slides.forEach(function(slide,j){slide.hidden=j!==cur;});
    tabs.forEach(function(t,j){t.classList.toggle('is-active',j===cur);t.setAttribute('aria-pressed',String(j===cur));});
    dots.forEach(function(d,j){d.classList.toggle('is-active',j===cur);});
    if(pB)pB.disabled=cur===0;
    if(nB)nB.disabled=cur===total-1;
  }
  tabs.forEach(function(t){t.addEventListener('click',function(){go(parseInt(t.dataset.slide,10));});});
  dots.forEach(function(d){d.addEventListener('click',function(){go(parseInt(d.dataset.slide,10));});});
  if(pB)pB.addEventListener('click',function(){go(cur-1);});if(nB)nB.addEventListener('click',function(){go(cur+1);});
  track.closest('.deck-shell').addEventListener('keydown',function(e){if(e.target.closest('input,textarea,select,[contenteditable]'))return;if(e.key==='ArrowLeft'){e.preventDefault();go(cur-1);}if(e.key==='ArrowRight'){e.preventDefault();go(cur+1);}});
  go(0);
})();
})();
