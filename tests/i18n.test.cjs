/* Run: node tests/i18n.test.cjs. Display translation must never change application or user data. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const base = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(base, file), 'utf8');
const dictionaryFiles = ['site', 'content', 'archive', 'interactive', 'intro-1', 'intro-2', 'intro-3', 'semantic'];
const han = /[\u3400-\u9fff]/;
function harness(search = '', storedLanguage = null) {
  class Element {
    constructor(tag, attrs = {}, children = []) { this.nodeType = 1; this.tagName = tag.toUpperCase(); this.attrs = {...attrs}; this.children = []; this.events = {}; children.forEach(child => this.append(child)); }
    append(child) { child.parentElement = this; this.children.push(child); return child; }
    get textContent() { return this.children.map(child => child.nodeType === 3 ? child.nodeValue : child.textContent).join(''); }
    set textContent(value) { this.children = []; this.append(new Text(String(value))); }
    getAttribute(name) { return this.attrs[name] ?? null; }
    setAttribute(name, value) { this.attrs[name] = String(value); }
    hasAttribute(name) { return Object.hasOwn(this.attrs, name); }
    matches(selector) { return selector.split(',').some(part => { part = part.trim(); return part === this.tagName.toLowerCase() || part === '[contenteditable]:not([contenteditable="false"])' && this.hasAttribute('contenteditable') && this.attrs.contenteditable !== 'false' || part === '[data-i18n-skip]' && this.hasAttribute('data-i18n-skip'); }); }
    closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
    addEventListener(type, callback) { this.events[type] = callback; }
  }
  class Text { constructor(value) { this.nodeType = 3; this.nodeValue = value; } }
  const text = value => new Text(value);
  const html = new Element('html'); const body = html.append(new Element('body'));
  const label = body.append(new Element('span', {'data-region': '江西', title: '趣味小游戏', 'aria-valuetext': '使用道具'}, [text('趣味小游戏')]));
  const option = body.append(new Element('option', {}, [text('江西')]));
  const keyedOption = body.append(new Element('option', {value: '贵州'}, [text('贵州')]));
  const input = body.append(new Element('input', {value: '趣味小游戏', placeholder: '趣味小游戏'}));
  const textarea = body.append(new Element('textarea', {placeholder: '趣味小游戏'}, [text('趣味小游戏')]));
  const user = body.append(new Element('div', {'data-i18n-skip': ''}, [text('趣味小游戏')]));
  const editable = body.append(new Element('div', {contenteditable: ''}, [text('趣味小游戏')]));
  const script = body.append(new Element('script', {}, [text('趣味小游戏')]));
  const language = body.append(new Element('button', {'data-language-switch': '', 'data-i18n-skip': ''}));
  let callback, reload, stored;
  const document = {documentElement: html, readyState: 'complete', querySelectorAll: () => [language], createTreeWalker(root, _mask, filter) {
    const nodes = []; const walk = node => { for (const child of node.children || []) { if (filter.acceptNode(child) === 2) continue; nodes.push(child); walk(child); } }; walk(root); let index = -1;
    return {nextNode() { this.currentNode = nodes[++index]; return !!this.currentNode; }};
  }};
  const context = {window: {dispatchEvent() { return true; }}, document, NodeFilter: {SHOW_ELEMENT: 1, SHOW_TEXT: 4, FILTER_REJECT: 2, FILTER_ACCEPT: 1},
    MutationObserver: class { constructor(fn) { callback = fn; } observe() {} }, URL, URLSearchParams, CustomEvent: class {constructor(type, options) {this.type = type;Object.assign(this, options);} preventDefault() {this.defaultPrevented = true;}},
    location: {search, href: 'https://example.org/index.html' + search + '#stickman-game', assign(url) {reload = url;}},
    localStorage: {getItem() {return storedLanguage;}, setItem(key, value) {stored = [key, value];}}
  };
  vm.createContext(context);
  for (const file of dictionaryFiles) vm.runInContext(read('locales/' + file + '-en.js'), context);
  vm.runInContext(read('locales/i18n.js'), context);
  return {context, body, text, Element, label, option, keyedOption, input, textarea, user, editable, script, language, observe: records => callback(records), reload: () => reload, stored: () => stored};
}
const en = harness();
assert.equal(en.context.window.NuoI18n.lang, 'en', 'new visits default to English');
assert.equal(en.context.document.documentElement.lang, 'en');
assert.equal(en.label.textContent, en.context.window.NUO_EN['趣味小游戏']);
assert.equal(en.label.getAttribute('aria-valuetext'), 'Use object', 'screen reader slider descriptions are translated');
assert.equal(en.label.getAttribute('data-region'), '江西', 'translation cannot change geography keys');
assert.equal(en.option.getAttribute('value'), '江西', 'implicit select values retain their source keys');
assert.equal(en.keyedOption.getAttribute('value'), '贵州', 'explicit select values stay intact');
assert.equal(en.textarea.getAttribute('placeholder'), 'Mini-game', 'textarea prompts translate without changing user input');
assert.equal(en.input.getAttribute('value'), '趣味小游戏', 'input data stays exactly as entered');
for (const node of [en.textarea, en.user, en.editable, en.script]) assert.equal(node.textContent, '趣味小游戏', 'user content and code are never translated');
const added = en.body.append(new en.Element('span', {}, [en.text('使用道具')]));
en.observe([{type: 'childList', addedNodes: [added]}]);
assert.equal(added.textContent, 'Use object', 'newly rendered game content is translated');
const before = added.textContent;
en.observe([{type: 'characterData', target: added.children[0]}]);
assert.equal(added.textContent, before, 'observer translations converge without feedback loops');
en.language.events.click();
assert.deepEqual(en.stored(), ['nuo-language', 'zh']);
assert.match(en.reload(), /\?lang=zh#stickman-game$/, 'switching language preserves the active section');
const blocked = harness(); let alertMessage = '';
blocked.context.window.dispatchEvent = event => { assert.ok(event.cancelable); event.preventDefault(); event.detail.message = '切换语言前，请先保存或下载当前作品。当前页面已保留。'; return false; };
blocked.context.window.alert = message => { alertMessage = message; };
blocked.language.events.click();
assert.equal(blocked.reload(), undefined, 'a failed draft save prevents navigation');
assert.equal(blocked.stored(), undefined, 'a canceled switch does not change the language preference');
assert.match(alertMessage, /could not be saved/);
const zh = harness('?lang=zh', 'en');
assert.equal(zh.context.window.NuoI18n.lang, 'zh', 'explicit language URL takes priority');
assert.equal(zh.label.textContent, '趣味小游戏');
assert.equal(zh.context.document.documentElement.lang, 'zh-CN');
assert.equal(harness('', 'zh').context.window.NuoI18n.lang, 'zh', 'saved preference survives reload');
const t = en.context.window.NuoI18n.t;
assert.equal(t('小鬼实物照片'), 'Little Ghost object photograph', 'composed labels have English word boundaries');
assert.equal(t('  小鬼实物照片  '), '  Little Ghost object photograph  ', 'fragment translation retains outer whitespace');
assert.equal(t('送给 {name}', {name: '趣味小游戏'}), 'For 趣味小游戏', 'interpolation preserves user words even if they match translation keys');
for (const [source, translated] of Object.entries(en.context.window.NUO_EN)) {
  assert.ok(!han.test(translated), 'dictionary values are English: ' + source.slice(0, 60));
  assert.equal(t(t(source)), t(source), 'translation is idempotent: ' + source.slice(0, 60));
}
for (const file of ['journey-content.js', 'region-content.js', 'world-content.js', 'nuo-stickman-mask-game/map-quest-data.js', 'coloring-templates.js', 'data/masks.js']) vm.runInContext(read(file), en.context);
function checkText(value, label) {
  if (typeof value === 'string') { assert.ok(!han.test(t(value)), 'missing English display text: ' + label + ': ' + value.slice(0, 100)); return; }
  if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) checkText(item, label + '.' + key);
}
for (const name of ['NUO_JOURNEY_CONTENT', 'NUO_REGION_CONTENT', 'NUO_WORLD_CONTENT', 'NUO_MAP_QUEST_ITEMS', 'NUO_COLORING_TEMPLATES']) { assert.ok(en.context.window[name]); checkText(en.context.window[name], name); }
for (const node of en.context.window.NUO_MASK_ATLAS.nodes) for (const [key, value] of Object.entries(node)) checkText(value, 'archive.' + node.id + '.' + key);
console.log('PASS: English default, Chinese preference/URL, dynamic labels, stable select/data keys, unchanged user content, language navigation, dictionary convergence, curated game/workshop and archive field coverage.');
