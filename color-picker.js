/* A dependency-free HSV wheel. External setColor updates never emit a change. */
(function () {
  'use strict';
  var clamp = function (n, min, max) { return Math.min(max, Math.max(min, n)); };
  function normalize(value) {
    var hex = String(value || '').trim().replace(/^#/, '');
    if (/^[\da-f]{3}$/i.test(hex)) hex = hex.replace(/./g, function (c) { return c + c; });
    return /^[\da-f]{6}$/i.test(hex) ? '#' + hex.toLowerCase() : null;
  }
  function toHSV(hex, previousHue) {
    var rgb = [1, 3, 5].map(function (i) { return parseInt(hex.slice(i, i + 2), 16) / 255; });
    var r = rgb[0], g = rgb[1], b = rgb[2], v = Math.max(r, g, b), d = v - Math.min(r, g, b);
    var h = previousHue || 0;
    if (d) h = (((v === r ? (g - b) / d : v === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60) + 360) % 360;
    return { h: h, s: v ? d / v : 0, v: v };
  }
  function toHex(hsv) {
    var h = ((hsv.h % 360) + 360) % 360 / 60, c = hsv.v * hsv.s;
    var x = c * (1 - Math.abs(h % 2 - 1)), m = hsv.v - c;
    var rgb = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(h)];
    return '#' + rgb.map(function (n) { return Math.round((n + m) * 255).toString(16).padStart(2, '0'); }).join('');
  }
  function create(root, options) {
    options = options || {};
    var doc = root.ownerDocument || document;
    var color = normalize(options.color) || '#ff6034', hsv = toHSV(color, 0);
    var pointers = new Set(), active = null, blocked = false;
    root.classList.add('nuo-color-picker');
    root.innerHTML = '<div class="ncp-wheel">' +
      '<div class="ncp-hue" role="slider" tabindex="0" aria-label="色相" aria-valuemin="0" aria-valuemax="359"><i class="ncp-hue-thumb" aria-hidden="true"></i></div>' +
      '<div class="ncp-sv" role="group" tabindex="0"><i class="ncp-sv-thumb" aria-hidden="true"></i></div>' +
      '</div><div class="ncp-controls"><span class="ncp-preview" aria-hidden="true"></span>' +
      '<label class="ncp-hex-label">当前色号<input class="ncp-hex" type="text" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="7" aria-label="十六进制颜色，3 或 6 位色号"></label>' +
      '<p class="ncp-hint">色环选颜色<br>方块调深浅</p></div><p class="ncp-error" role="status"></p>';
    var hue = root.querySelector('.ncp-hue'), square = root.querySelector('.ncp-sv');
    var hueThumb = root.querySelector('.ncp-hue-thumb'), squareThumb = root.querySelector('.ncp-sv-thumb');
    var preview = root.querySelector('.ncp-preview'), input = root.querySelector('.ncp-hex'), error = root.querySelector('.ncp-error');
    function render() {
      var radians = hsv.h * Math.PI / 180;
      hueThumb.style.left = (50 + 44.5 * Math.sin(radians)) + '%';
      hueThumb.style.top = (50 - 44.5 * Math.cos(radians)) + '%';
      hueThumb.style.background = toHex({ h: hsv.h, s: 1, v: 1 });
      hue.setAttribute('aria-valuenow', Math.min(359, Math.round(hsv.h)));
      hue.setAttribute('aria-valuetext', Math.round(hsv.h) + ' 度；方向键调整，按住 Shift 加快');
      square.style.backgroundColor = toHex({ h: hsv.h, s: 1, v: 1 });
      squareThumb.style.left = (hsv.s * 100) + '%';
      squareThumb.style.top = ((1 - hsv.v) * 100) + '%';
      squareThumb.style.background = color;
      square.setAttribute('aria-label', '浓淡 ' + Math.round(hsv.s * 100) + '%，明暗 ' + Math.round(hsv.v * 100) + '%；左右键调浓淡，上下键调明暗，按住 Shift 加快');
      preview.style.background = color;
      input.value = color;
      input.removeAttribute('aria-invalid');
      error.textContent = '';
    }
    function publish() {
      var next = toHex(hsv), changed = next !== color;
      color = next;
      render();
      if (changed && typeof options.onChange === 'function') options.onChange(color);
    }
    function setColor(value) {
      var next = normalize(value);
      if (!next) return false;
      if (next === color) { render(); return true; }
      hsv = toHSV(next, hsv.h);
      color = next;
      render();
      return true;
    }
    function point(event, plane) {
      var rect = plane.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      var x = event.clientX - rect.left, y = event.clientY - rect.top;
      if (plane === hue) {
        if (Math.hypot(x - rect.width / 2, y - rect.height / 2) < rect.width * 0.30) return;
        hsv.h = (Math.atan2(y - rect.height / 2, x - rect.width / 2) * 180 / Math.PI + 450) % 360;
      } else {
        hsv.s = clamp(x / rect.width, 0, 1);
        hsv.v = 1 - clamp(y / rect.height, 0, 1);
      }
      publish();
    }
    function consume(event) { event.preventDefault(); event.stopPropagation(); }
    function capture(id) { try { root.setPointerCapture(id); } catch (_) {} }
    function listen(add) {
      var method = add ? 'addEventListener' : 'removeEventListener';
      doc[method]('pointerdown', extraPointer, true);
      doc[method]('pointermove', move, true);
      doc[method]('pointerup', end, true);
      doc[method]('pointercancel', end, true);
    }
    function extraPointer(event) {
      if (!pointers.size || pointers.has(event.pointerId)) return;
      // Stop a second finger reaching the artboard while the picker owns a gesture.
      consume(event);
      pointers.add(event.pointerId);
      active = null;
      blocked = true;
      capture(event.pointerId);
    }
    function start(event, plane) {
      if (event.button !== undefined && event.button !== 0) return;
      consume(event);
      // Touch focus can make Safari pull the page back here on a later viewport resize.
      if (event.pointerType === 'mouse' && plane.focus) plane.focus({ preventScroll: true });
      pointers.add(event.pointerId);
      active = { id: event.pointerId, plane: plane };
      blocked = false;
      capture(event.pointerId);
      listen(true);
      point(event, plane);
    }
    function move(event) {
      if (!pointers.has(event.pointerId)) return;
      consume(event);
      if (!blocked && active && active.id === event.pointerId) point(event, active.plane);
    }
    function end(event) {
      if (!pointers.has(event.pointerId)) return;
      consume(event);
      if (event.type === 'pointerup' && !blocked && active && active.id === event.pointerId) point(event, active.plane);
      pointers.delete(event.pointerId);
      if (active && active.id === event.pointerId) active = null;
      try { if (root.hasPointerCapture(event.pointerId)) root.releasePointerCapture(event.pointerId); } catch (_) {}
      if (!pointers.size) { active = null; blocked = false; listen(false); }
    }
    hue.addEventListener('pointerdown', function (event) { start(event, hue); });
    square.addEventListener('pointerdown', function (event) { start(event, square); });
    root.addEventListener('lostpointercapture', end);
    [hue, square].forEach(function (plane) {
      plane.addEventListener('dblclick', consume);
      plane.addEventListener('click', function (event) { event.stopPropagation(); });
      plane.addEventListener('keydown', function (event) {
        var step = event.shiftKey ? 10 : 1;
        if (plane === hue) {
          if (event.key === 'ArrowRight' || event.key === 'ArrowUp') hsv.h = (hsv.h + step) % 360;
          else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') hsv.h = (hsv.h + 360 - step) % 360;
          else if (event.key === 'Home') hsv.h = 0;
          else if (event.key === 'End') hsv.h = 359;
          else return;
        } else {
          if (event.key === 'ArrowRight') hsv.s = clamp(hsv.s + step / 100, 0, 1);
          else if (event.key === 'ArrowLeft') hsv.s = clamp(hsv.s - step / 100, 0, 1);
          else if (event.key === 'ArrowUp') hsv.v = clamp(hsv.v + step / 100, 0, 1);
          else if (event.key === 'ArrowDown') hsv.v = clamp(hsv.v - step / 100, 0, 1);
          else if (event.key === 'Home') hsv.s = 0;
          else if (event.key === 'End') hsv.s = 1;
          else if (event.key === 'PageUp') hsv.v = 1;
          else if (event.key === 'PageDown') hsv.v = 0;
          else return;
        }
        consume(event);
        publish();
      });
    });
    function commitInput() {
      var next = normalize(input.value);
      if (!next) {
        input.setAttribute('aria-invalid', 'true');
        error.textContent = '请输入 3 或 6 位色号，例如 #d6a159';
        return;
      }
      hsv = toHSV(next, hsv.h);
      publish();
    }
    input.addEventListener('change', commitInput);
    input.addEventListener('input', function () { input.removeAttribute('aria-invalid'); error.textContent = ''; });
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') { consume(event); commitInput(); hue.focus({preventScroll:true}); }
      else if (event.key === 'Escape') { consume(event); render(); hue.focus({preventScroll:true}); }
    });
    render();
    return { setColor: setColor };
  }
  window.NuoColorPicker = { create: create };
})();
