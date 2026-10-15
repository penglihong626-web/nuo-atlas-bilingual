/* Regional context and archive labels remain separate; counts come from real records. */
(function () {
  const records = window.NUO_MASK_ATLAS?.nodes || [];
  const content = window.NUO_REGION_CONTENT || [];
  const root = document.getElementById('regionBrowser');
  if (!root || !records.length || !content.length) return;
  const $ = id => document.getElementById(id);
  const tx = (text, variables) => window.NuoI18n ? window.NuoI18n.t(text, variables) : String(text).replace(/\{(\w+)\}/g, (_, key) => variables?.[key] ?? '');
  const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeURL = value => { try { const url = new URL(value); return /^https?:$/.test(url.protocol) ? url.href : ''; } catch (_) { return ''; } };
  const source = (url, title) => safeURL(url) ? `<a href="${esc(safeURL(url))}" target="_blank" rel="noopener noreferrer">${esc(title)} ↗︎</a>` : '';
  const groups = new Map(content.map(item => [item.province, records.filter(node => node.province === item.province)]));
  const pageSize = 6;
  let province = content[0].province, locality = '', query = '', page = 0;

  const unknownCount = groups.get('未明确地区')?.length || 0;
  $('regionOverview').textContent = tx('本站收录 {count} 条记录，涉及 {regions} 个具名省级地区；另有 {unknown} 条地区未明确。以下按档案标签浏览，部分归属仍待核实。', {count: records.length, regions: [...groups.keys()].filter(name => name !== '未明确地区').length, unknown: unknownCount});
  $('regionChoices').innerHTML = content.map(item => `<button class="region-choice" type="button" data-region-choice="${esc(item.province)}" aria-pressed="${item.province === province}"><span>${esc(item.province)}</span><small>${groups.get(item.province).length} 件</small></button>`).join('');

  function renderRegion() {
    const item = content.find(item => item.province === province);
    const nodes = groups.get(province);
    $('regionChoices').querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.regionChoice === province)));
    $('regionContext').innerHTML = `<h3>${esc(province)}</h3><p>${esc(item.intro)}</p>` + item.traditions.map(tradition => `<section class="region-tradition"><h4>${esc(tradition.name)}</h4><p class="region-place">${esc(tradition.place)}</p><p>${esc(tradition.context)}</p>${source(tradition.sourceUrl, tradition.sourceTitle)}</section>`).join('') + `<p class="region-boundary">${esc(item.note)}</p>`;
    const labels = [...new Set(nodes.map(node => node.region))];
    $('regionLocality').innerHTML = '<option value="">全部档案地区</option>' + labels.map(label => `<option value="${esc(label)}">${esc(label)}（${nodes.filter(node => node.region === label).length}）</option>`).join('');
    $('regionLocality').value = locality = '';
    $('regionSearch').value = query = '';
    $('regionSamplesTitle').textContent = province === '未明确地区' ? '尚待确认来处的样本' : `${province} · 本站收录样本`;
    page = 0;
    renderSamples();
  }

  function renderSamples() {
    const nodes = groups.get(province).filter(node => (!locality || node.region === locality) && (!query || `${node.name} ${tx(node.name)} ${node.idText}`.toLowerCase().includes(query)));
    const pages = Math.max(1, Math.ceil(nodes.length / pageSize));
    page = Math.min(page, pages - 1);
    const start = page * pageSize;
    $('regionResultCount').textContent = nodes.length ? tx('共 {count} 件，当前 {start}–{end} 件', {count: nodes.length, start: start + 1, end: Math.min(start + pageSize, nodes.length)}) : '没有匹配样本';
    $('regionSampleList').innerHTML = nodes.slice(start, start + pageSize).map(node => {
      const added = Boolean(window.NuoJourney?.hasReference(node.id));
      const image = /^assets\/masks\/\d{4}\.svg$/.test(node.image) ? `<img src="${esc(node.image)}" width="54" height="66" alt="${esc(node.name)}线稿" loading="lazy">` : '';
      return `<details class="region-sample"><summary>${image}<span><strong>${esc(node.name)}</strong><small>${esc(node.region)} · ${esc(node.idText)}</small></span></summary><div class="region-sample-body"><p>${esc(node.intro || '档案简介尚待补充，请查阅原始资料。')}</p><p class="region-archive-note">以上为档案整理简介。具体作品的角色、地域及使用情况，请结合原始资料阅读。</p><div class="region-sample-actions">${source(node.detailUrl, '查看作品原始资料')}<button type="button" class="region-add" data-region-reference="${node.id}">${added ? '已留下参考 ✓' : '留下这张参考 ＋'}</button></div></div></details>`;
    }).join('') || '<p class="region-no-results">试试其他名称或编号，也可以切回全部档案地区。</p>';
    $('regionPagination').hidden = pages <= 1;
    $('regionPageLabel').textContent = `${page + 1} / ${pages}`;
    $('regionPrevious').disabled = page === 0;
    $('regionNext').disabled = page === pages - 1;
  }

  $('regionChoices').addEventListener('click', event => {
    const button = event.target.closest('[data-region-choice]');
    if (!button || !groups.has(button.dataset.regionChoice) || province === button.dataset.regionChoice) return;
    province = button.dataset.regionChoice;
    renderRegion();
  });
  $('regionLocality').addEventListener('change', event => { locality = event.target.value; page = 0; renderSamples(); });
  $('regionSearch').addEventListener('input', event => { query = event.target.value.trim().toLowerCase(); page = 0; renderSamples(); });
  $('regionPrevious').addEventListener('click', () => { if (page > 0) { page--; renderSamples(); } });
  $('regionNext').addEventListener('click', () => { page++; renderSamples(); });
  $('regionSampleList').addEventListener('click', event => {
    const button = event.target.closest('[data-region-reference]');
    if (!button) return;
    const id = Number(button.dataset.regionReference);
    if (!records.some(node => node.id === id)) return;
    window.dispatchEvent(new CustomEvent('nuo:add-reference', {detail:{id}}));
    if (window.NuoJourney?.hasReference(id)) button.textContent = '已留下参考 ✓';
  });
  renderRegion();
})();
