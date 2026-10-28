/* Run: node tests/site-entry.test.cjs — entry resets must never interrupt active reading. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../site-entry.js'), 'utf8');

function setup(hash = '#galaxy', restricted = false) {
  const target = () => {
    const events = new Map();
    return {
      addEventListener(type, fn, options) { events.set(type, [...(events.get(type) || []), {fn, once: options?.once}]); },
      emit(type, values = {}) {
        for (const listener of events.get(type) || []) listener.fn({type, ...values});
        events.set(type, (events.get(type) || []).filter(listener => !listener.once));
      }
    };
  };
  const window = target(), document = target(), button = target();
  const scrolls = [], replacements = [];
  const location = {pathname: '/nuo-atlas-bilingual/', search: '?lang=zh&entry=qr', hash};
  const state = {saved: 'preserve-me'};
  const history = {state, scrollRestoration: 'auto', replaceState(nextState, title, url) {
    if (restricted) throw new Error('History unavailable for this file preview');
    replacements.push({state: nextState, title, url});
    location.hash = new URL(url, 'https://example.org').hash;
  }};
  const dialog = {open: false, showModal() { this.open = true; }, close() { this.open = false; }};
  let blurs = 0;
  document.activeElement = {blur() { blurs++; }};
  document.getElementById = id => ({siteQrDialog: dialog, openSiteQr: button})[id];
  window.scrollTo = position => scrolls.push(JSON.parse(JSON.stringify(position)));
  vm.runInNewContext(source, {window, document, location, history});
  return {window, document, location, history, state, scrolls, replacements, dialog, button, blurs: () => blurs};
}

const visit = setup();
assert.equal(visit.history.scrollRestoration, 'manual');
assert.equal(visit.location.hash, '');
assert.equal(visit.replacements[0].state, visit.state, 'keep existing history state');
assert.equal(visit.replacements[0].url, '/nuo-atlas-bilingual/?lang=zh&entry=qr', 'keep language and query parameters');
assert.deepEqual(visit.scrolls, [{top: 0, left: 0, behavior: 'instant'}]);
visit.window.emit('pageshow', {persisted: false});
assert.equal(visit.scrolls.length, 2, 'finish a fresh visit at the cover');
assert.equal(visit.replacements.length, 1, 'no unnecessary URL rewrite');

for (const type of ['pointerdown', 'touchstart', 'wheel', 'keydown', 'click']) {
  const reading = setup();
  reading.window.emit(type);
  reading.location.hash = '#timeline';
  reading.window.emit('pageshow', {persisted: false});
  assert.equal(reading.scrolls.length, 1, `${type}: late page load must not pull the reader back`);
  assert.equal(reading.location.hash, '#timeline', `${type}: preserve the user's navigation`);
  for (const event of ['hashchange', 'popstate', 'resize', 'scroll', 'visibilitychange']) reading.window.emit(event);
  assert.equal(reading.scrolls.length, 1, 'ordinary browsing and viewport changes do not reset the page');
}

visit.document.emit('DOMContentLoaded');
visit.button.emit('click');
assert.equal(visit.dialog.open, true, 'the home-page QR entry opens the native dialog');
visit.window.emit('pointerdown');
visit.location.hash = '#galaxy';
visit.window.emit('pageshow', {persisted: true});
assert.equal(visit.location.hash, '', 'a cached return is a new visit from the cover');
assert.equal(visit.scrolls.length, 3);
assert.equal(visit.dialog.open, false, 'do not reopen a stale QR modal on cached return');
assert.equal(visit.blurs(), 1, 'release old focused fields on cached return');
visit.window.emit('wheel');
visit.window.emit('pageshow', {persisted: false});
assert.equal(visit.scrolls.length, 3, 'interaction guards still work after a cached return');
assert.equal(setup('', true).scrolls.length, 1, 'file-preview history restrictions do not prevent the initial scroll');
assert.equal(setup('#timeline', true).scrolls.length, 1, 'a rejected history rewrite is handled');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
assert.ok(html.indexOf('src="site-entry.js?') < html.indexOf('<body'), 'run before body fragments can scroll into view');
assert.match(html, /<script src="site-entry\.js\?[^"\n]+"><\/script>/, 'the entry script must load synchronously');
assert.match(html, /<form method="dialog"><button[^>]+aria-label="关闭二维码"/, 'the QR dialog has a native close action');
console.log('Entry checks passed: clean home entry, cached return, uninterrupted reading, and QR dialog.');
