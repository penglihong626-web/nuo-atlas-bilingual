/* Run: node tests/region-browser.test.cjs. Real archive with a minimal DOM/event model. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const data = { window: {} };
for (const name of ['data/masks.js', 'region-content.js']) vm.runInNewContext(read(name), data, { filename: name });
const records = Array.from(data.window.NUO_MASK_ATLAS.nodes);
const content = Array.from(data.window.NUO_REGION_CONTENT);
const source = read('region-browser.js');
const ids = ['regionBrowser', 'regionOverview', 'regionChoices', 'regionContext', 'regionLocality', 'regionSearch', 'regionSamplesTitle', 'regionResultCount', 'regionSampleList', 'regionPagination', 'regionPageLabel', 'regionPrevious', 'regionNext'];
const decode = value => value.replace(/&(?:amp|lt|gt|quot|#39);/g, entity => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }[entity]));

function setup(options = {}) {
  class Element {
    constructor() { this.events = {}; this.dataset = {}; this.attributes = {}; this.value = ''; this.textContent = ''; this.innerHTML = ''; this.hidden = false; this.disabled = false; }
    addEventListener(type, listener) { (this.events[type] ||= []).push(listener); }
    emit(type, event = {}) { for (const listener of this.events[type] || []) listener({ target: this, ...event }); }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    querySelectorAll(selector) {
      assert.equal(selector, 'button');
      return this.buttons ||= Array.from(this.innerHTML.matchAll(/data-region-choice="([^"]+)"/g), match => {
        const button = new Element(); button.dataset.regionChoice = decode(match[1]); return button;
      });
    }
    closest(selector) {
      return selector === '[data-region-choice]' && 'regionChoice' in this.dataset || selector === '[data-region-reference]' && 'regionReference' in this.dataset ? this : null;
    }
  }
  const elements = new Map(ids.map(id => [id, new Element()]));
  if (options.missingRoot) elements.delete('regionBrowser');
  const $ = id => elements.get(id);
  const events = [], references = new Set(options.references || []);
  const window = {
    NUO_MASK_ATLAS: { nodes: options.records || records },
    NUO_REGION_CONTENT: options.content || content,
    dispatchEvent(event) { events.push(event); if (options.acceptReferences !== false) references.add(event.detail.id); }
  };
  if (!options.withoutJourney) window.NuoJourney = { hasReference: id => references.has(id) };
  class CustomEvent { constructor(type, options) { this.type = type; this.detail = options.detail; } }
  vm.runInNewContext(source, { window, document: { getElementById: $ }, URL, CustomEvent }, { filename: 'region-browser.js' });
  const delegated = (host, dataset) => {
    const button = new Element(); button.dataset = dataset;
    $(host).emit('click', { target: { closest: selector => button.closest(selector) } });
    return button;
  };
  const choose = province => delegated('regionChoices', { regionChoice: province });
  const input = (id, value, type = 'input') => { $(id).value = value; $(id).emit(type); };
  const visible = () => Array.from($('regionSampleList').innerHTML.matchAll(/data-region-reference="(\d+)"/g), match => Number(match[1]));
  const allPages = () => {
    const found = []; let pageCount = 0;
    do {
      assert.ok(++pageCount < 100, 'pagination reaches its last page');
      found.push(...visible());
      if ($('regionNext').disabled) break;
      $('regionNext').emit('click');
    } while (true);
    return found;
  };
  return { $, choose, input, visible, allPages, delegated, events, references };
}

const expected = { 江西: 159, 贵州: 91, 湖南: 29, 广西: 28, 重庆: 28, 湖北: 25, 四川: 24, 云南: 13, 安徽: 8, 福建: 6, 未明确地区: 72 };
assert.equal(records.length, 483);
assert.equal(new Set(records.map(record => record.id)).size, 483);
assert.ok(records.every(record => Number.isSafeInteger(record.id) && record.id > 0), 'archive reference IDs are trusted numeric values');
assert.equal(content.length, 11);
assert.deepEqual(content.map(region => region.province).sort(), Object.keys(expected).sort(), 'every archive group has context, including unknown provenance');
for (const [province, count] of Object.entries(expected)) assert.equal(records.filter(record => record.province === province).length, count);

const browser = setup();
assert.match(browser.$('regionOverview').textContent, /483 条记录.*10 个具名省级地区.*72 条地区未明确/);
assert.equal(browser.$('regionChoices').querySelectorAll('button').length, 11);
assert.equal(browser.$('regionPageLabel').textContent, '1 / 27');
assert.equal(browser.$('regionPrevious').disabled, true);
const visited = [];
for (const [province, count] of Object.entries(expected)) {
  browser.choose(province);
  assert.equal(browser.$('regionSearch').value, '');
  assert.equal(browser.$('regionLocality').value, '');
  assert.equal(browser.$('regionPrevious').disabled, true);
  const selected = browser.$('regionChoices').querySelectorAll('button').filter(button => button.attributes['aria-pressed'] === 'true');
  assert.deepEqual(selected.map(button => button.dataset.regionChoice), [province]);
  assert.match(browser.$('regionResultCount').textContent, new RegExp(`共 ${count} 件`));
  assert.equal(browser.$('regionPagination').hidden, count <= 6);
  const found = browser.allPages();
  assert.deepEqual(found, records.filter(record => record.province === province).map(record => record.id), `${province}: all records remain reachable, ordered and without duplicates`);
  visited.push(...found);
  assert.equal(browser.$('regionPageLabel').textContent, `${Math.ceil(count / 6)} / ${Math.ceil(count / 6)}`);
  const lastPage = browser.visible();
  browser.$('regionNext').emit('click');
  assert.deepEqual(browser.visible(), lastPage, 'even a repeated next event cannot overflow the last page');
  if (count > 6) {
    browser.$('regionPrevious').emit('click');
    assert.equal(browser.$('regionNext').disabled, false, 'the final page remains reversible');
  }
}
assert.equal(visited.length, 483);
assert.equal(new Set(visited).size, 483);
assert.equal(browser.$('regionSamplesTitle').textContent, '尚待确认来处的样本');
assert.doesNotMatch(browser.$('regionContext').innerHTML, /class="region-tradition"/, 'unknown provenance does not invent a local tradition');
assert.match(browser.$('regionContext').innerHTML, /资料状态/);

browser.choose('江西');
const locality = '江西·南丰（推定）';
const localRecords = records.filter(record => record.region === locality);
assert.ok(localRecords.length);
assert.match(browser.$('regionLocality').innerHTML, /南丰（推定）/, 'uncertainty labels remain visible');
browser.input('regionLocality', locality, 'change');
assert.deepEqual(browser.allPages(), localRecords.map(record => record.id), 'locality filter retains every matching page');
browser.input('regionSearch', `  ${localRecords[0].idText}  `);
assert.deepEqual(browser.visible(), [localRecords[0].id]);
assert.equal(browser.$('regionPageLabel').textContent, '1 / 1', 'a new search resets an old page');
assert.equal(browser.$('regionPagination').hidden, true);
browser.input('regionSearch', '没有这种面具_000000');
assert.deepEqual(browser.visible(), []);
assert.equal(browser.$('regionResultCount').textContent, '没有匹配样本');
assert.equal(browser.$('regionPrevious').disabled, true);
assert.equal(browser.$('regionNext').disabled, true);
assert.match(browser.$('regionSampleList').innerHTML, /试试其他名称或编号/);
browser.input('regionSearch', '');
browser.input('regionLocality', '', 'change');
assert.deepEqual(browser.visible(), records.filter(record => record.province === '江西').slice(0, 6).map(record => record.id));
browser.input('regionSearch', '开山');
assert.deepEqual(browser.allPages(), records.filter(record => record.province === '江西' && record.name.includes('开山')).map(record => record.id));
browser.choose('贵州');
assert.equal(browser.$('regionSearch').value, '', 'switching province clears an earlier search');
assert.equal(browser.$('regionPageLabel').textContent, '1 / 16');
const beforeUnknownChoice = browser.$('regionContext').innerHTML;
browser.choose('并不存在的地区');
assert.equal(browser.$('regionContext').innerHTML, beforeUnknownChoice, 'invalid delegated choices are ignored');

const reference = browser.visible()[0];
const button = browser.delegated('regionSampleList', { regionReference: String(reference) });
assert.equal(browser.events.length, 1);
assert.equal(browser.events[0].type, 'nuo:add-reference');
assert.equal(browser.events[0].detail.id, reference, 'reference events carry the numeric archive ID');
assert.equal(button.textContent, '已留下参考 ✓');
const pageBeforeReference = browser.$('regionPageLabel').textContent;
browser.delegated('regionSampleList', { regionReference: String(reference) });
assert.equal(browser.$('regionPageLabel').textContent, pageBeforeReference, 'leaving a reference stays on the current page');
browser.$('regionNext').emit('click'); browser.$('regionPrevious').emit('click');
assert.match(browser.$('regionSampleList').innerHTML, new RegExp(`data-region-reference="${reference}">已留下参考 ✓`), 'saved reference status survives a rerender');
for (const value of ['999999', 'not-a-number', '']) browser.delegated('regionSampleList', { regionReference: value });
browser.delegated('regionSampleList', {});
assert.equal(browser.events.length, 2, 'missing and unknown reference IDs never dispatch');
const refused = setup({ acceptReferences: false });
assert.notEqual(refused.delegated('regionSampleList', { regionReference: String(refused.visible()[0]) }).textContent, '已留下参考 ✓', 'confirmation requires the journey to accept the reference');
const independent = setup({ withoutJourney: true });
assert.doesNotThrow(() => independent.delegated('regionSampleList', { regionReference: String(independent.visible()[0]) }));
assert.equal(independent.events.length, 1, 'the browser can dispatch without a loaded journey API');

const unsafe = '<script>alert(1)</script><b title="x">&\'';
const unsafeURLs = ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'file:///tmp/mask', '/relative', 'not a URL'];
const securityRecords = [...unsafeURLs, 'https://example.org/mask?q=1&view=2'].map((detailUrl, index) => ({ id: index + 1, idText: unsafe, province: unsafe, region: unsafe, name: `ABC${unsafe}`, intro: unsafe, detailUrl, image: index === 5 ? 'assets/masks/0006.svg' : ['https://example.org/mask.svg', 'assets/masks/../0001.svg', 'assets/masks/0001.svg" onerror="alert(1)', 'data:image/svg+xml,<svg/>', 'assets/masks/00001.svg'][index] }));
const secure = setup({ records: securityRecords, content: [{ province: unsafe, intro: unsafe, note: unsafe, traditions: [...unsafeURLs, 'http://example.org/tradition?q=1&view=2'].map(sourceUrl => ({ name: unsafe, place: unsafe, context: unsafe, sourceTitle: unsafe, sourceUrl })) }] });
for (const id of ['regionChoices', 'regionContext', 'regionLocality', 'regionSampleList']) {
  assert.doesNotMatch(secure.$(id).innerHTML, /<script>|<b title="x">/, `${id}: text cannot introduce HTML`);
  assert.match(secure.$(id).innerHTML, /&lt;script&gt;/);
  assert.match(secure.$(id).innerHTML, /&quot;x&quot;/);
  assert.match(secure.$(id).innerHTML, /&amp;&#39;/);
}
assert.equal((secure.$('regionSampleList').innerHTML.match(/<img /g) || []).length, 1, 'only canonical local mask SVG paths produce images');
assert.equal((secure.$('regionSampleList').innerHTML.match(/<a /g) || []).length, 1);
assert.equal((secure.$('regionContext').innerHTML.match(/<a /g) || []).length, 1, 'both source link types reject unsupported URL protocols');
for (const id of ['regionSampleList', 'regionContext']) {
  assert.match(secure.$(id).innerHTML, /q=1&amp;view=2/);
  assert.match(secure.$(id).innerHTML, /target="_blank" rel="noopener noreferrer"/);
}
secure.input('regionSearch', '  aBc  ');
assert.equal(secure.visible().length, 6, 'name search is trimmed and case insensitive');
assert.doesNotThrow(() => setup({ missingRoot: true }));
assert.doesNotThrow(() => setup({ records: [] }));
assert.doesNotThrow(() => setup({ content: [] }));
console.log('Region browser: 483 records across 11 groups, complete pagination, filters, empty search, reference events and safe output passed.');
