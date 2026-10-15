/* Translate display text only. Archive keys, form values and saved user work remain unchanged. */
(function () {
  'use strict';
  let lang = 'en';
  try { lang = new URLSearchParams(location.search).get('lang') || localStorage.getItem('nuo-language') || 'en'; } catch (_) {}
  lang = lang === 'zh' ? 'zh' : 'en';
  const dictionary = window.NUO_EN || {};
  const han = /[\u3400-\u9fff]/;
  const normalize = text => text.replace(/\s+/g, ' ').trim();
  const exact = new Map(Object.entries(dictionary).map(([key, value]) => [normalize(key), value]));
  const keys = [...exact.keys()].filter(key => han.test(key)).sort((a, b) => b.length - a.length);
  const fragments = new RegExp(keys.map(key => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
  function t(value, variables) {
    const source = String(value ?? '');
    let result = source;
    if (lang === 'en' && han.test(source)) {
      const trimmed = normalize(source);
      const translation = exact.get(trimmed);
      if (translation !== undefined) result = source.replace(source.trim(), translation);
      else {
        result = source.replace(fragments, (match, offset) => {
          const replacement = exact.get(match);
          const before = source[offset - 1] || '', after = source[offset + match.length] || '';
          const word = /[A-Za-z0-9\u3400-\u9fff]/;
          return (word.test(before) && /^[A-Za-z0-9]/.test(replacement) ? ' ' : '') + replacement +
            (word.test(after) && /[A-Za-z0-9]$/.test(replacement) ? ' ' : '');
        });
        result = source.match(/^\s*/)[0] + result.trim().replace(/[ \t]{2,}/g, ' ') + source.match(/\s*$/)[0];
      }
    }
    if (variables) result = result.replace(/\{(\w+)\}/g, (match, name) => Object.prototype.hasOwnProperty.call(variables, name) ? String(variables[name]) : match);
    return result;
  }
  window.NuoI18n = {t, lang};
  document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
  const skip = 'script,style,code,pre,[contenteditable]:not([contenteditable="false"]),[data-i18n-skip]';
  const attributes = ['aria-label', 'aria-description', 'aria-valuetext', 'title', 'alt', 'placeholder'];
  function translateText(node) {
    if (!node.parentElement || node.parentElement.closest(skip + ',textarea')) return;
    const original = node.nodeValue;
    if (!han.test(original)) return;
    // An option without an explicit value uses its label as its value. Keep the source key.
    const parent = node.parentElement;
    if (parent.tagName === 'OPTION' && !parent.hasAttribute('value')) parent.setAttribute('value', parent.textContent);
    const translated = t(original);
    if (translated !== original) node.nodeValue = translated;
  }
  function translateElement(element) {
    if (element.closest(skip)) return;
    attributes.forEach(name => {
      const value = element.getAttribute(name);
      if (value && han.test(value)) {
        const translated = t(value);
        if (translated !== value) element.setAttribute(name, translated);
      }
    });
  }
  function translateTree(root) {
    if (lang !== 'en') return;
    if (root.nodeType === 3) { translateText(root); return; }
    if (root.nodeType !== 1 || root.closest(skip)) return;
    translateElement(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(node) { return node.nodeType === 1 && node.matches(skip) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }
    });
    while (walker.nextNode()) {
      if (walker.currentNode.nodeType === 3) translateText(walker.currentNode);
      else translateElement(walker.currentNode);
    }
  }
  function init() {
    document.querySelectorAll('[data-language-switch]').forEach(button => {
      button.textContent = lang === 'en' ? '中文' : 'EN';
      button.setAttribute('aria-label', lang === 'en' ? 'Switch to Chinese' : 'Switch to English');
      button.setAttribute('lang', lang === 'en' ? 'zh-CN' : 'en');
      button.addEventListener('click', () => {
        const next = lang === 'en' ? 'zh' : 'en';
        // Existing input handlers save drafts as the user edits; give consumers a final flush hook.
        const pending = new CustomEvent('nuo:before-language-change', {cancelable: true, detail: {message: ''}});
        if (!window.dispatchEvent(pending)) {
          window.alert(t(pending.detail.message || '切换语言前，请先保存或下载当前作品。当前页面已保留。'));
          return;
        }
        try { localStorage.setItem('nuo-language', next); } catch (_) {}
        const url = new URL(location.href);
        url.searchParams.set('lang', next);
        location.assign(url.href);
      });
    });
    if (lang !== 'en') return;
    translateTree(document.documentElement);
    new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'characterData') translateText(record.target);
        else if (record.type === 'attributes') translateElement(record.target);
        else record.addedNodes.forEach(translateTree);
      }
    }).observe(document.documentElement, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:attributes});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
