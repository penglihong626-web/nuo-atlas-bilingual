/* ================================================
       傩面自由绘制系统 / Nuo Mask Free-Draw System
       ================================================
       Features:
       - Continuous, lightly smoothed canvas strokes with pen pressure
       - Ten suggested colors for contemporary creation
       - Local canvas drafts and undo/redo (max 20 steps)
       - Cursor glow following the brush
       - A dedicated drawing canvas, independent from the published gallery
       ================================================ */

    (function () {
      /* ---- Color Palette ---- */
      var NUO_PALETTE = [
        {name:'朱砂红',hex:'#bd251f'}, {name:'火焰赤',hex:'#ff6034'},
        {name:'古金',hex:'#d6a159'}, {name:'青绿',hex:'#6f9290'},
        {name:'群青',hex:'#345ea8'}, {name:'紫棠',hex:'#6b3a5b'},
        {name:'墨黑',hex:'#1a0c08'}, {name:'米白',hex:'#fff0d2'},
        {name:'桃红',hex:'#e87691'}, {name:'绛红',hex:'#782e3d'},
        {name:'珊瑚',hex:'#f28c6c'}, {name:'赭褐',hex:'#5a301d'},
        {name:'金粉',hex:'#ffe4a3'}, {name:'藤黄',hex:'#f6c64b'},
        {name:'翠绿',hex:'#adca7a'}, {name:'竹青',hex:'#468767'},
        {name:'松绿',hex:'#254c42'}, {name:'青蓝',hex:'#90dfe1'},
        {name:'天青',hex:'#6fb6d3'}, {name:'黛蓝',hex:'#283e4d'},
        {name:'藤紫',hex:'#ad91c6'}, {name:'烟灰',hex:'#8a8580'},
        {name:'纯黑',hex:'#000000'}, {name:'纯白',hex:'#ffffff'}
      ];

      /* ---- DOM References ---- */
      var drawToolsGroup = document.getElementById('drawToolsGroup');
      var drawLayer = document.getElementById('drawLayer');
      var drawCanvas = document.getElementById('drawCanvas');
      var compositeCtx = drawCanvas ? drawCanvas.getContext('2d') : null;
      var strokeCanvas = document.createElement('canvas');
      var drawCtx = strokeCanvas.getContext('2d');
      var outlineCanvas = document.createElement('canvas');
      var outlineCtx = outlineCanvas.getContext('2d');
      var fillCanvas = document.createElement('canvas');
      var fillCtx = fillCanvas.getContext('2d');
      var partCanvas = document.createElement('canvas');
      var partCtx = partCanvas.getContext('2d');
      var galaxyStage = document.getElementById('galaxyStage');
      var stageHud = document.getElementById('stageHud');
      var btnEraser = document.getElementById('btnEraser');
      var btnUndo = document.getElementById('btnUndo');
      var btnRedo = document.getElementById('btnRedo');
      var btnClear = document.getElementById('btnClearDraw');
      var btnSaveToGalaxy = document.getElementById('btnSaveToGalaxy');
      var btnSymmetry = document.getElementById('btnSymmetry');
      var btnTemplate = document.getElementById('btnTemplate');
      var btnBrushHard = document.getElementById('btnBrushHard');
      var btnBrushInk = document.getElementById('btnBrushInk');
      var btnBrushSpray = document.getElementById('btnBrushSpray');
      var brushSlider = document.getElementById('brushSizeSlider');
      var smoothingSlider = document.getElementById('brushSmoothingSlider');
      var smoothingOutput = document.getElementById('brushSmoothingValue');
      var brushSizeOutput = document.getElementById('brushSizeValue');
      var drawPalette = document.getElementById('drawPalette');
      var extendedPalette = document.getElementById('extendedPalette');
      var paintingDesk = document.getElementById('paintingDesk');
      var colorTray = document.getElementById('colorTray');
      var brushSettings = document.getElementById('freeBrushSettings');
      var deskBackdrop = document.getElementById('deskPanelBackdrop');
      var colorPicker = null, colorSaveTimer = null, colorSavePending = false;
      var lastColorTrigger = null;
      var cursorGlow = null;
      var templateOverlay = null;
      var selectionOverlay = null;
      var coloringTemplates = Array.isArray(window.NUO_COLORING_TEMPLATES) ? window.NUO_COLORING_TEMPLATES : [];
      var creationMethod = coloringTemplates.length ? 'coloring' : 'free';
      var drawingTool = creationMethod === 'coloring' ? 'coloring' : 'brush';
      var coloringTemplate = null;
      var coloringPaths = new Map();
      var coloringTemplateButtons = [];
      var coloringRegionButtons = [];
      var renderedColoringTemplate = null;
      var canvasAction = null;
      var parts = [];
      var selectedPart = -1;
      var cachedFills = null;
      var cachedFillPixels = null;
      var cachedStrokePixels = null;

      /* ---- Drawing State ---- */
      var isDrawing = false;
      var brushSize = 8;
      var brushSmoothing = 60;
      var brushColor = '#ff6034';
      var isErasing = false;
      var isSymmetryOn = false;
      var isTemplateOn = false;
      var brushStyle = 'hard';    // 'hard' | 'ink' | 'spray'
      var undoStack = [];
      var redoStack = [];
      var maxUndoSteps = 20; // ponytail: bounded history shares unchanged layer pixels; compress snapshots for longer history.
      var activePointerId = null;
      var activePointerType = null;
      var touchPointers = new Set();
      var drawingRevision = 0;
      var draftLoading = true;
      var draftSaveError = '';
      var currentJourneyMetadata = null;
      var backgroundColor = '#0d0906';
      var outline = null;
      var outlineImages = new Map();
      var outlineRequest = 0;
      var legacyFlattened = false;
      var layerEditing = false;
      var preserveUnreadDraft = false;
      var cachedImage = null;
      var cachedStrokes = null;
      var lastStrokePoint = null;
      var lastRenderedPoint = null;

      var STORAGE_KEY_DRAFT = 'nuo_drawing_draft_v1';
      var CANVAS_WIDTH = 900;
      var CANVAS_HEIGHT = 1000;

      if (!drawCanvas || !drawCtx || !compositeCtx || !outlineCtx) return;

      /* ---- Independent background, region fills, reference, cropped parts and user strokes ---- */
      function validColor(value) { return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value); }
      function validPNG(value) {
        return typeof value === 'string' && value.length < 6000000 && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value);
      }
      function validOutlinePath(value) { return typeof value === 'string' && /^assets\/masks\/\d{4}\.svg$/.test(value); }
      function copyRect(value) { return { x: value.x, y: value.y, w: value.w, h: value.h }; }
      function copyOutline(value) { return value ? { src: value.src, color: value.color, scale: value.scale, x: value.x, y: value.y, locked: value.locked, cuts: (value.cuts || []).map(copyRect) } : null; }
      function copyParts(value) { return value.map(function (part) { return { src: part.src, crop: copyRect(part.crop), home: copyRect(part.home), color: part.color, scale: part.scale, x: part.x, y: part.y, rotation: part.rotation }; }); }
      function templateDefinition(id) { return coloringTemplates.find(function (item) { return item.id === id; }); }
      function copyTemplate(value) { return value ? { id: value.id, colors: Object.assign({}, value.colors) } : null; }
      function validTemplate(value) {
        if (!value || typeof value.id !== 'string' || !value.colors || Object.prototype.toString.call(value.colors) !== '[object Object]') return false;
        var definition = templateDefinition(value.id);
        return !!definition && Object.keys(value.colors).every(function (id) {
          return definition.regions.some(function (region) { return region.id === id; }) && validColor(value.colors[id]);
        });
      }
      function templatePath(path) {
        if (!coloringPaths.has(path)) coloringPaths.set(path, new Path2D(path));
        return coloringPaths.get(path);
      }
      function renderColoringTemplate() {
        var definition = coloringTemplate && templateDefinition(coloringTemplate.id);
        if (!definition) return;
        compositeCtx.save();
        compositeCtx.lineJoin = 'round'; compositeCtx.lineCap = 'round';
        compositeCtx.strokeStyle = '#28211c'; compositeCtx.lineWidth = 5;
        if (definition.silhouette) { compositeCtx.fillStyle = '#fffaf0'; compositeCtx.fill(templatePath(definition.silhouette), 'evenodd'); }
        definition.regions.forEach(function (region) {
          var path = templatePath(region.path);
          compositeCtx.fillStyle = coloringTemplate.colors[region.id] || '#fffaf0';
          compositeCtx.fill(path, definition.kind === 'original' ? 'evenodd' : 'nonzero');
          // New layouts share exact edges. A subpixel color underlap closes
          // antialiasing seams without changing the original ink or hit areas.
          if (definition.kind === 'original' && definition.regionEdgeUnderlap) {
            compositeCtx.strokeStyle = compositeCtx.fillStyle;
            compositeCtx.lineWidth = definition.regionEdgeUnderlap;
            compositeCtx.stroke(path);
          }
          if (definition.kind !== 'original') compositeCtx.stroke(path);
        });
        if (definition.overlay && outlineImages.has(definition.overlay)) compositeCtx.drawImage(outlineImages.get(definition.overlay), 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        (definition.details || []).forEach(function (detail) {
          var path = templatePath(detail.path);
          compositeCtx.strokeStyle = detail.stroke || '#28211c'; compositeCtx.lineWidth = detail.lineWidth || 5;
          if (detail.fill && detail.fill !== 'none') { compositeCtx.fillStyle = detail.fill; compositeCtx.fill(path); }
          if (detail.stroke !== 'none') compositeCtx.stroke(path);
        });
        compositeCtx.restore();
      }
      function validRect(rect, normalized) {
        return rect && ['x', 'y', 'w', 'h'].every(function (key) { return Number.isFinite(rect[key]); }) && rect.w > 0 && rect.h > 0 && rect.x >= 0 && rect.y >= 0 && rect.x + rect.w <= (normalized ? 1.00001 : CANVAS_WIDTH) && rect.y + rect.h <= (normalized ? 1.00001 : CANVAS_HEIGHT);
      }
      function validateEditable(value) {
        if (!value || [2, 3].indexOf(value.version) < 0 || value.width !== CANVAS_WIDTH || value.height !== CANVAS_HEIGHT || !validPNG(value.strokes)) return null;
        if (value.background !== 'transparent' && !validColor(value.background)) return null;
        if (value.creationMethod !== undefined && ['coloring', 'free'].indexOf(value.creationMethod) < 0) return null;
        if (value.template != null && !validTemplate(value.template)) return null;
        if (value.template && value.outline) return null;
        var line = value.outline;
        if (line !== null) {
          if (!line || !validOutlinePath(line.src) || !validColor(line.color) || typeof line.locked !== 'boolean') return null;
          if (!Number.isFinite(line.scale) || line.scale < 40 || line.scale > 140 || !Number.isFinite(line.x) || Math.abs(line.x) > 40 || !Number.isFinite(line.y) || Math.abs(line.y) > 40) return null;
          if (value.version === 3 && (!Array.isArray(line.cuts) || line.cuts.length > 32 || !line.cuts.every(function (rect) { return validRect(rect, true); }))) return null;
        }
        var nextParts = value.version === 3 ? value.parts : [];
        if (value.version === 3 && !validPNG(value.fills)) return null;
        if (!Array.isArray(nextParts) || nextParts.length > 8 || !nextParts.every(function (part) {
          return part && validOutlinePath(part.src) && validColor(part.color) && validRect(part.crop, true) && validRect(part.home, false) && Number.isFinite(part.scale) && part.scale >= 25 && part.scale <= 200 && Number.isFinite(part.x) && Math.abs(part.x) <= 100 && Number.isFinite(part.y) && Math.abs(part.y) <= 100 && Number.isFinite(part.rotation) && Math.abs(part.rotation) <= 180;
        })) return null;
        var cleanLine = line && copyOutline(value.version === 2 ? { src: line.src, color: line.color, scale: line.scale, x: line.x, y: line.y, locked: line.locked, cuts: [] } : line);
        if (cleanLine && value.version === 2) cleanLine.cuts = [];
        return { version: value.version, width: CANVAS_WIDTH, height: CANVAS_HEIGHT, background: value.background, strokes: value.strokes, fills: value.version === 3 ? value.fills : null, outline: cleanLine, parts: copyParts(nextParts), template: copyTemplate(value.template), creationMethod: value.creationMethod || 'free', legacyFlattened: value.legacyFlattened === true };
      }
      function invalidateFills() { cachedFills = null; cachedFillPixels = null; cachedImage = null; }
      function invalidatePixels(strokesChanged) {
        cachedImage = null;
        if (strokesChanged) { cachedStrokes = null; cachedStrokePixels = null; }
      }
      function outlineBounds(line, image) {
        var fit = Math.min(CANVAS_WIDTH * 0.8 / image.naturalWidth, CANVAS_HEIGHT * 0.8 / image.naturalHeight) * line.scale / 100;
        var width = image.naturalWidth * fit, height = image.naturalHeight * fit;
        return { x: (CANVAS_WIDTH - width) / 2 + CANVAS_WIDTH * line.x / 100, y: (CANVAS_HEIGHT - height) / 2 + CANVAS_HEIGHT * line.y / 100, w: width, h: height };
      }
      function renderComposite() {
        compositeCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        compositeCtx.globalCompositeOperation = 'source-over';
        compositeCtx.globalAlpha = 1;
        if (backgroundColor !== 'transparent') {
          compositeCtx.fillStyle = backgroundColor;
          compositeCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        }
        compositeCtx.drawImage(fillCanvas, 0, 0);
        // Keep the catalog's fill/stroke order so upper shapes cover lower borders exactly as in its SVG preview.
        renderColoringTemplate();
        outlineCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        var image = outline && outlineImages.get(outline.src);
        if (image) {
          var bounds = outlineBounds(outline, image);
          outlineCtx.globalCompositeOperation = 'source-over';
          outlineCtx.drawImage(image, bounds.x, bounds.y, bounds.w, bounds.h);
          (outline.cuts || []).forEach(function (cut) { outlineCtx.clearRect(bounds.x + cut.x * bounds.w, bounds.y + cut.y * bounds.h, cut.w * bounds.w, cut.h * bounds.h); });
          outlineCtx.globalCompositeOperation = 'source-in';
          outlineCtx.fillStyle = outline.color;
          outlineCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
          outlineCtx.globalCompositeOperation = 'source-over';
          compositeCtx.drawImage(outlineCanvas, 0, 0);
        }
        parts.forEach(function (part) {
          var source = outlineImages.get(part.src);
          if (!source) return;
          partCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
          partCtx.save();
          partCtx.translate(part.home.x + part.home.w / 2 + CANVAS_WIDTH * part.x / 100, part.home.y + part.home.h / 2 + CANVAS_HEIGHT * part.y / 100);
          partCtx.rotate(part.rotation * Math.PI / 180);
          partCtx.scale(part.scale / 100, part.scale / 100);
          partCtx.drawImage(source, part.crop.x * source.naturalWidth, part.crop.y * source.naturalHeight, part.crop.w * source.naturalWidth, part.crop.h * source.naturalHeight, -part.home.w / 2, -part.home.h / 2, part.home.w, part.home.h);
          partCtx.restore();
          partCtx.globalCompositeOperation = 'source-in';
          partCtx.fillStyle = part.color;
          partCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
          partCtx.globalCompositeOperation = 'source-over';
          compositeCtx.drawImage(partCanvas, 0, 0);
        });
        compositeCtx.drawImage(strokeCanvas, 0, 0);
      }
      function getImage() {
        if (!cachedImage) { renderComposite(); cachedImage = drawCanvas.toDataURL('image/png'); }
        return cachedImage;
      }
      function exportEditable() {
        if (!cachedStrokes) cachedStrokes = strokeCanvas.toDataURL('image/png');
        if (!cachedFills) cachedFills = fillCanvas.toDataURL('image/png');
        return { version: 3, width: CANVAS_WIDTH, height: CANVAS_HEIGHT, background: backgroundColor, strokes: cachedStrokes, fills: cachedFills, outline: copyOutline(outline), parts: copyParts(parts), template: copyTemplate(coloringTemplate), creationMethod: creationMethod, legacyFlattened: legacyFlattened };
      }
      function syncLayerControls() {
        syncColoringControls();
        syncPartControls();
        var background = document.getElementById('drawBackground');
        if (background) background.value = backgroundColor === 'transparent' ? '#0d0906' : backgroundColor;
        var controls = document.getElementById('outlineControls');
        if (controls) controls.disabled = !outline;
        var values = {outlineColor: outline ? outline.color : '#fff0d2', outlineScale: outline ? outline.scale : 100, outlineX: outline ? outline.x : 0, outlineY: outline ? outline.y : 0};
        Object.keys(values).forEach(function (id) {
          var input = document.getElementById(id);
          if (input) { input.value = values[id]; if (id !== 'outlineColor') input.disabled = !outline || outline.locked; }
          var output = document.getElementById(id + 'Value');
          if (output) output.textContent = values[id] + '%';
        });
        var lock = document.getElementById('outlineLocked');
        if (lock) lock.checked = !outline || outline.locked;
        var reset = document.getElementById('btnResetOutline');
        if (reset) reset.disabled = !outline || outline.locked;
        var remove = document.getElementById('btnRemoveOutline');
        if (remove) remove.disabled = !outline;
        var note = document.getElementById('drawingLegacyNote');
        if (note) {
          note.hidden = !legacyFlattened;
          note.textContent = legacyFlattened ? '这份旧作品以完整图像保留，原有线稿与笔触不能单独调整；新加入的线稿可独立编辑。' : '';
        }
      }
      function syncPartControls() {
        var select = document.getElementById('partSelect');
        if (select) {
          select.innerHTML = parts.map(function (part, index) {
            var id = part.src.match(/(\d{4})/)[1];
            var nodes = window.NUO_MASK_ATLAS && window.NUO_MASK_ATLAS.nodes;
            var source = Array.isArray(nodes) && nodes.find(function (node) { return Number(node.id) === Number(id); });
            var name = String(source && source.name || '来源 ' + id).replace(/[&<>"']/g, function (char) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]; });
            return '<option value="' + index + '">局部 ' + (index + 1) + ' · ' + name + '</option>';
          }).join('');
          select.value = String(selectedPart);
          select.disabled = !parts.length;
        }
        var panel = document.getElementById('partControls');
        if (panel) panel.disabled = selectedPart < 0;
        var part = parts[selectedPart];
        var values = { partColor: part ? part.color : brushColor, partScale: part ? part.scale : 100, partX: part ? part.x : 0, partY: part ? part.y : 0, partRotation: part ? part.rotation : 0 };
        Object.keys(values).forEach(function (id) {
          var input = document.getElementById(id);
          if (input) { input.value = values[id]; input.disabled = !part; }
          var output = document.getElementById(id + 'Value');
          if (output) output.textContent = values[id] + (id === 'partRotation' ? '°' : '%');
        });
        ['btnResetPart', 'btnDeletePart'].forEach(function (id) { var button = document.getElementById(id); if (button) button.disabled = !part; });
        var extract = document.getElementById('btnExtractPart');
        if (extract) extract.disabled = !outline || parts.length >= 8;
        var selectTool = document.getElementById('btnSelectPart');
        if (selectTool) selectTool.disabled = !outline || parts.length >= 8;
      }
      function updateToolHint() {
        var hint = document.getElementById('drawingToolHint');
        if (hint) hint.textContent = drawingTool === 'coloring' ? (coloringTemplate ? '分区填色：先选颜色，再轻点面具块面；也可按区域名称上色。切到自由绘画可继续添画，原有颜色会保留。' : '分区填色：先在上方选择一张底稿，再选颜色、轻点块面。') : drawingTool === 'fill' ? (coloringTemplate ? '填色：当前使用分区底稿，轻点固定块面即可换色；原有笔画保留。' : '填色：先选颜色，再轻点封闭区域内部。滑动不会填色；未封闭区域请先用勾线笔补齐。') : drawingTool === 'select' ? '框选局部：在参考线稿上拖出一个矩形，松手后调整这个局部。也可在下方输入位置和尺寸。' : isErasing ? '橡皮只擦除自己的笔画，保留线稿与区域填色。' : '绘画：在画布内单指绘制，从画布外滑动页面。';
        [['btnFillRegion', 'fill'], ['btnSelectPart', 'select']].forEach(function (entry) {
          var button = document.getElementById(entry[0]);
          if (button) { button.classList.toggle('is-on', drawingTool === entry[1]); button.setAttribute('aria-pressed', String(drawingTool === entry[1])); }
        });
      }
      function setTool(value) {
        if (['brush', 'fill', 'select'].indexOf(value) < 0) return false;
        finishStroke(); finishLayerEdit(); cancelCanvasAction();
        if (value === 'select' && !outline) { reportStatus('先使用一张参考线稿，再框选局部。'); return false; }
        creationMethod = 'free'; drawingTool = value; isErasing = false;
        syncColoringControls();
        btnEraser.classList.remove('is-on'); drawCanvas.classList.remove('eraser-active');
        hideCursorGlow(); updateButtonStates();
        return true;
      }
      function renderColoringChoices() {
        var list = document.getElementById('coloringTemplateList');
        if (!list) return;
        list.innerHTML = ''; coloringTemplateButtons = [];
        coloringTemplates.filter(function (definition) { return !definition.hidden; }).forEach(function (definition) {
          var button = document.createElement('button');
          button.type = 'button'; button.className = 'coloring-template';
          var preview = document.createElement('img');
          preview.src = definition.preview; preview.alt = ''; preview.width = 90; preview.height = 100;
          var name = document.createElement('strong'); name.textContent = definition.name;
          var count = document.createElement('span'); count.textContent = definition.regions.length + ' 个块面';
          button.appendChild(preview); button.appendChild(name); button.appendChild(count);
          button.setAttribute('aria-label', '使用' + definition.name + '分区底稿');
          button.addEventListener('click', function () { selectColoringTemplate(definition.id); });
          list.appendChild(button); coloringTemplateButtons.push({ id: definition.id, button: button });
        });
      }
      function syncColoringControls() {
        var simple = creationMethod === 'coloring';
        [['btnMethodColoring', simple], ['btnMethodFree', !simple], ['btnDeskColoring', simple], ['btnDeskFree', !simple]].forEach(function (entry) {
          var button = document.getElementById(entry[0]);
          if (button) { button.setAttribute('aria-pressed', String(entry[1])); button.classList.toggle('is-on', entry[1]); }
        });
        ['coloringPanel', 'coloringRegionPanel'].forEach(function (id) { var panel = document.getElementById(id); if (panel) panel.hidden = !simple; });
        ['freeDrawingControls', 'brushQuickControls', 'freeBrushSettings', 'drawingAdjustments', 'partPanel'].forEach(function (id) { var panel = document.getElementById(id); if (panel) panel.hidden = simple; });
        if (simple && brushSettings) { brushSettings.open = false; syncDeskBackdrop(); }
        var definition = coloringTemplate && templateDefinition(coloringTemplate.id);
        coloringTemplateButtons.forEach(function (entry) {
          var active = !!definition && entry.id === definition.id;
          entry.button.setAttribute('aria-pressed', String(active)); entry.button.classList.toggle('is-selected', active);
        });
        var description = document.getElementById('coloringTemplateDescription');
        if (description) description.textContent = definition ? definition.description : '选择一张已经分好块面的创作底稿。换底稿会替换基础线稿，自己的笔画、纸面填色和局部仍保留；可撤销。';
        var upgrade = document.getElementById('upgradeColoringTemplate');
        if (upgrade) {
          var replacement = definition && definition.legacy && coloringTemplates.find(function (item) { return item.kind === 'original' && !item.hidden && !item.legacy && item.sourceId === definition.sourceId; });
          upgrade.hidden = !replacement;
          upgrade.dataset.templateId = replacement ? replacement.id : '';
          if (replacement && description) description.textContent = '这份草稿使用旧版分区，原有配色已保留。换用新底稿需要重新配色，手绘笔触仍保留；可以撤销恢复旧稿。';
        }
        var progress = document.getElementById('coloringProgress');
        if (progress) progress.textContent = definition ? '已上色 ' + Object.keys(coloringTemplate.colors).length + ' / ' + definition.regions.length + ' 个块面 · 可以保留留白' : '先选底稿，再选颜色、轻点块面';
        var list = document.getElementById('coloringRegionList');
        var id = definition ? definition.id : null;
        if (list && renderedColoringTemplate !== id) {
          list.innerHTML = ''; coloringRegionButtons = []; renderedColoringTemplate = id;
          if (definition) definition.regions.forEach(function (region) {
            var button = document.createElement('button');
            button.type = 'button'; button.className = 'coloring-region';
            var swatch = document.createElement('span'); swatch.className = 'coloring-region-swatch'; swatch.setAttribute('aria-hidden', 'true');
            var label = document.createElement('span'); label.textContent = region.name;
            button.appendChild(swatch); button.appendChild(label);
            button.addEventListener('click', function () { fillTemplateRegion(region.id); });
            list.appendChild(button); coloringRegionButtons.push({ id: region.id, name: region.name, button: button, swatch: swatch });
          });
        }
        coloringRegionButtons.forEach(function (entry) {
          var color = coloringTemplate && coloringTemplate.colors[entry.id];
          entry.swatch.style.background = color || '#fffaf0';
          entry.button.classList.toggle('is-colored', !!color);
          entry.button.setAttribute('aria-label', entry.name + (color ? '，已上色 ' + color : '，未上色') + '，使用当前颜色填色');
        });
      }
      function setCreationMethod(value) {
        if (['coloring', 'free'].indexOf(value) < 0) return false;
        if (value === 'coloring' && !coloringTemplates.length) { reportStatus('分区底稿尚未加载，当前画布已保留，请刷新后重试。'); return false; }
        finishStroke(); finishLayerEdit();
        outlineRequest++;
        creationMethod = value; drawingTool = value === 'coloring' ? 'coloring' : 'brush'; isErasing = false;
        drawCanvas.classList.remove('eraser-active'); hideCursorGlow();
        // Switching tools is a preference, not another undo step. Pixels and region colors stay intact.
        if (undoStack.length) undoStack[undoStack.length - 1].creationMethod = value;
        syncColoringControls(); enterDrawing(); updateButtonStates(); saveStateToStorage();
        reportStatus(value === 'coloring' ? (coloringTemplate ? '已切到分区填色，原有笔画保留。选颜色后轻点块面即可。' : '已切到分区填色，请先选择一张底稿；当前画布保留。') : '已切到自由绘画，底稿和已填颜色保留，可以继续添画。');
        return true;
      }
      function selectColoringTemplate(id) {
        var definition = templateDefinition(id);
        if (!definition) { reportStatus('这张分区底稿不可用，当前画布已保留。'); return false; }
        finishStroke(); finishLayerEdit();
        var request = ++outlineRequest, revision = drawingRevision;
        if (coloringTemplate && coloringTemplate.id === id) { setCreationMethod('coloring'); reportStatus('正在使用这张底稿，已填颜色保留。'); return true; }
        function applyDefinition() {
          if (request !== outlineRequest || drawingRevision !== revision || isDrawing) return false;
          coloringTemplate = { id: id, colors: {} }; outline = null;
          creationMethod = 'coloring'; drawingTool = 'coloring'; isErasing = false; drawCanvas.classList.remove('eraser-active');
          commitDrawing(); enterDrawing();
          reportStatus('已使用' + definition.name + '分区底稿。选择颜色后轻点块面；原有笔画保留，更换可撤销。');
          return true;
        }
        if (definition.overlay && !outlineImages.has(definition.overlay)) {
          reportStatus('正在加载原稿细节，当前作品会保留。');
          return loadImage(definition.overlay).then(function (image) {
            outlineImages.set(definition.overlay, image);
            return applyDefinition();
          }).catch(function () { if (request === outlineRequest) reportStatus('这张原稿暂时无法加载，当前作品已保留，请重试。'); return false; });
        }
        return applyDefinition();
      }
      function fillTemplateRegion(id) {
        var definition = coloringTemplate && templateDefinition(coloringTemplate.id);
        var region = definition && definition.regions.find(function (item) { return item.id === id; });
        if (!region) { reportStatus('请先选择一张分区底稿，再轻点其中的块面。'); return false; }
        finishStroke(); finishLayerEdit();
        if (coloringTemplate.colors[id] === brushColor) { reportStatus(region.name + '已经是所选颜色。'); return false; }
        coloringTemplate.colors[id] = brushColor;
        commitDrawing(); reportStatus('已为' + region.name + '上色，可重新填色或撤销。');
        return true;
      }
      var COLORING_SCHEMES = {
        vermilion: { name: '朱金', face:'#b84732', crown:'#c69a52', horn:'#d8b36c', scales:'#9c6c36', whisker:'#3f6b61', ornament:'#3f6b61', brow:'#30211b', eye:'#eee1c5', pupil:'#30211b', nostril:'#30211b', teeth:'#f4e8cf', nose:'#bb5038', mouth:'#682722', beard:'#25201d' },
        teal: { name: '青黛', face:'#538180', crown:'#283e4d', horn:'#c6a367', scales:'#72938b', whisker:'#e5d6b7', ornament:'#c6a367', brow:'#e5d6b7', eye:'#eee1c5', pupil:'#30211b', nostril:'#30211b', teeth:'#f4e8cf', nose:'#669090', mouth:'#754439', beard:'#263c43' },
        ivory: { name: '素雅', face:'#e8d7b9', crown:'#b99357', horn:'#d0b17b', scales:'#aa9671', whisker:'#665141', ornament:'#665141', brow:'#3a3028', eye:'#f5eddd', pupil:'#3a3028', nostril:'#3a3028', teeth:'#f5eddd', nose:'#dac19d', mouth:'#875342', beard:'#42372c' }
      };
      function applyColoringScheme(id) {
        var definition = coloringTemplate && templateDefinition(coloringTemplate.id), scheme = COLORING_SCHEMES[id];
        if (!definition || !scheme) { reportStatus('先选择一张分区底稿，再试配色。'); return false; }
        finishStroke(); finishLayerEdit();
        definition.regions.forEach(function (region) { coloringTemplate.colors[region.id] = scheme[region.family] || scheme.ornament; });
        commitDrawing();
        reportStatus('已试用“' + scheme.name + '”配色。可以逐块改色，或撤销恢复；这是当代创作配色。');
        return true;
      }
      [['colorSchemeVermilion','vermilion'],['colorSchemeTeal','teal'],['colorSchemeIvory','ivory']].forEach(function (entry) {
        var button = document.getElementById(entry[0]);
        if (button) button.addEventListener('click', function () { applyColoringScheme(entry[1]); });
      });
      function fillTemplateAt(point) {
        var definition = coloringTemplate && templateDefinition(coloringTemplate.id);
        if (!definition) { reportStatus('请先选择一张分区底稿，再轻点其中的块面。'); return false; }
        for (var i = definition.regions.length - 1; i >= 0; i--) {
          var region = definition.regions[i];
          if (compositeCtx.isPointInPath(templatePath(region.path), point.x, point.y, definition.kind === 'original' ? 'evenodd' : 'nonzero')) return fillTemplateRegion(region.id);
        }
        reportStatus('请轻点面具块面内部；细小部位也可以在下方按名称上色。'); return false;
      }
      var upgradeTemplateButton = document.getElementById('upgradeColoringTemplate');
      if (upgradeTemplateButton) upgradeTemplateButton.addEventListener('click', function () { selectColoringTemplate(upgradeTemplateButton.dataset.templateId); });
      [['btnMethodColoring', 'coloring'], ['btnMethodFree', 'free'], ['btnDeskColoring', 'coloring'], ['btnDeskFree', 'free']].forEach(function (entry) {
        var button = document.getElementById(entry[0]);
        if (button) button.addEventListener('click', function () {
          setCreationMethod(entry[1]);
          if (entry[0].indexOf('btnDesk') === 0 && paintingDesk && paintingDesk.scrollIntoView) paintingDesk.scrollIntoView({block:'start',behavior:'instant'});
        });
      });
      function fillRegion(point) {
        if (coloringTemplate) return fillTemplateAt(point);
        if (!window.NuoPaintRegions) { reportStatus('填色工具尚未加载，请刷新后重试；当前画布已保留。'); return false; }
        renderComposite();
        var region = window.NuoPaintRegions.findRegion(compositeCtx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT).data, CANVAS_WIDTH, CANVAS_HEIGHT, Math.floor(point.x), Math.floor(point.y), { tolerance: 32 });
        if (region.invalid || region.tooLarge || region.touchesEdge || !region.indices.length) {
          reportStatus('这一区域连到了画布边缘或没有闭合，暂未填色。请先补齐线条；整张纸面请用背景色调整。'); return false;
        }
        var pixels = fillCtx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        var red = parseInt(brushColor.slice(1, 3), 16), green = parseInt(brushColor.slice(3, 5), 16), blue = parseInt(brushColor.slice(5, 7), 16);
        var changed = false;
        region.indices.forEach(function (index) {
          var p = index * 4;
          if (pixels.data[p] !== red || pixels.data[p + 1] !== green || pixels.data[p + 2] !== blue || pixels.data[p + 3] !== 255) changed = true;
          pixels.data[p] = red; pixels.data[p + 1] = green; pixels.data[p + 2] = blue; pixels.data[p + 3] = 255;
        });
        if (!changed) { reportStatus('这一区域已经是所选颜色。'); return false; }
        fillCtx.putImageData(pixels, 0, 0); invalidateFills(); commitDrawing();
        reportStatus('已填入颜色，可撤销。填色留在纸面位置，不随线稿或局部移动。'); return true;
      }
      function extractPart(rect) {
        finishStroke(); finishLayerEdit(); cancelCanvasAction();
        var image = outline && outlineImages.get(outline.src);
        if (!image) { reportStatus('先使用一张参考线稿，再框选局部。'); return false; }
        if (parts.length >= 8 || outline.cuts.length >= 32) { reportStatus('这张作品最多保留 8 个局部、进行 32 次框选；请先撤销多余的拆分。'); return false; }
        if (!rect || !['x', 'y', 'w', 'h'].every(function (key) { return Number.isFinite(rect[key]); }) || rect.w <= 0 || rect.h <= 0) return false;
        var bounds = outlineBounds(outline, image);
        var x = Math.max(0, bounds.x, rect.x), y = Math.max(0, bounds.y, rect.y);
        var right = Math.min(CANVAS_WIDTH, bounds.x + bounds.w, rect.x + rect.w), bottom = Math.min(CANVAS_HEIGHT, bounds.y + bounds.h, rect.y + rect.h);
        if (right - x < 8 || bottom - y < 8) { reportStatus('框选范围太小或未覆盖参考线稿，请重新选择。'); return false; }
        var crop = { x: (x - bounds.x) / bounds.w, y: (y - bounds.y) / bounds.h, w: (right - x) / bounds.w, h: (bottom - y) / bounds.h };
        if (outline.cuts.some(function (cut) { return crop.x < cut.x + cut.w && crop.x + crop.w > cut.x && crop.y < cut.y + cut.h && crop.y + crop.h > cut.y; })) { reportStatus('这个范围与已经拆出的局部重叠，请避开原剪口，或先撤销拆分。'); return false; }
        renderComposite();
        var pixels = outlineCtx.getImageData(Math.floor(x), Math.floor(y), Math.ceil(right - x), Math.ceil(bottom - y)).data;
        var hasLine = false;
        for (var p = 3; p < pixels.length; p += 4) { if (pixels[p] > 0) { hasLine = true; break; } }
        if (!hasLine) { reportStatus('这个范围内没有参考线条，请框住需要调整的线条。'); return false; }
        outline.cuts.push(crop);
        parts.push({ src: outline.src, crop: copyRect(crop), home: { x: x, y: y, w: right - x, h: bottom - y }, color: outline.color, scale: 100, x: 0, y: 0, rotation: 0 });
        selectedPart = parts.length - 1;
        drawingTool = 'brush';
        commitDrawing();
        var panel = document.getElementById('partPanel'); if (panel) panel.open = true;
        reportStatus('已拆出局部 ' + (selectedPart + 1) + '，可在画布下方改色、移动、缩放或旋转。原位置保留剪口；撤销可还原。');
        return true;
      }
      function showSelection(rect) {
        if (!selectionOverlay) {
          selectionOverlay = document.createElement('div');
          selectionOverlay.className = 'part-selection-overlay';
          selectionOverlay.style.position = 'absolute'; selectionOverlay.style.pointerEvents = 'none'; selectionOverlay.style.border = '2px dashed #ffb461'; selectionOverlay.style.background = 'rgba(255,180,97,.12)'; selectionOverlay.style.boxSizing = 'border-box';
          drawLayer.appendChild(selectionOverlay);
        }
        selectionOverlay.hidden = false;
        selectionOverlay.style.left = rect.x / CANVAS_WIDTH * 100 + '%'; selectionOverlay.style.top = rect.y / CANVAS_HEIGHT * 100 + '%';
        selectionOverlay.style.width = rect.w / CANVAS_WIDTH * 100 + '%'; selectionOverlay.style.height = rect.h / CANVAS_HEIGHT * 100 + '%';
      }
      function cancelCanvasAction() {
        var action = canvasAction; canvasAction = null;
        if (selectionOverlay) selectionOverlay.hidden = true;
        if (action && drawCanvas.hasPointerCapture(action.id)) drawCanvas.releasePointerCapture(action.id);
      }
      function selectionRect(start, end) {
        var x1 = Math.max(0, Math.min(CANVAS_WIDTH, start.x)), y1 = Math.max(0, Math.min(CANVAS_HEIGHT, start.y));
        var x2 = Math.max(0, Math.min(CANVAS_WIDTH, end.x)), y2 = Math.max(0, Math.min(CANVAS_HEIGHT, end.y));
        return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
      }
      function finishLayerEdit() {
        if (!layerEditing) return;
        layerEditing = false;
        commitDrawing();
      }

      /* ---- Local Draft ---- */
      function reportStatus(message) {
        var text = [message, draftSaveError].filter(Boolean).join(' ');
        ['drawingStatus', 'canvasSaveStatus'].forEach(function (id) {
          var status = document.getElementById(id);
          if (status) status.textContent = text;
        });
      }

      function copyJourneyMetadata(value, requireVersion) {
        if (!value || Object.prototype.toString.call(value) !== '[object Object]' || (requireVersion && value.version !== 1)) {
          throw new Error('无效的创作资料');
        }
        var copy = JSON.parse(JSON.stringify(value));
        if (!copy || Object.prototype.toString.call(copy) !== '[object Object]' || (requireVersion && copy.version !== 1)) {
          throw new Error('无效的创作资料');
        }
        return copy;
      }

      function saveStateToStorage(journeyMetadata) {
        // Neither image nor metadata may replace the stored draft while it is being restored.
        if (draftLoading) return false;
        if (preserveUnreadDraft) { reportStatus('原草稿未能完整读取，暂未覆盖。请先查看画布；开始新作品或作出绘画修改后再保存。'); return false; }
        try {
          if (journeyMetadata !== undefined) {
            currentJourneyMetadata = copyJourneyMetadata(journeyMetadata, false);
          }
          localStorage.setItem(STORAGE_KEY_DRAFT, JSON.stringify({
            version: 1,
            image: getImage(),
            drawing: exportEditable(),
            brushColor: brushColor,
            brushSize: brushSize,
            brushSmoothing: brushSmoothing,
            brushStyle: brushStyle,
            isSymmetryOn: isSymmetryOn,
            journey: currentJourneyMetadata
          }));
          draftSaveError = '';
          reportStatus('画布草稿已保存在本机浏览器。');
          return true;
        } catch (error) {
          draftSaveError = '本机草稿保存失败，画布仍在。请先完成作品并下载，避免刷新后丢失。';
          reportStatus('');
          return false;
        }
      }

      function loadImage(source) {
        return new Promise(function (resolve, reject) {
          var image = new Image();
          image.onload = function () { resolve(image); };
          image.onerror = function () { reject(new Error('图像无法读取')); };
          image.src = source;
        });
      }

      async function restoreImage(dataUrl, journeyMetadata, editableState) {
        if (!validPNG(dataUrl)) {
          reportStatus('草稿图像格式无效，当前画布已保留。');
          return false;
        }
        finishStroke();
        finishLayerEdit();
        var revision = drawingRevision;
        var request = ++outlineRequest;
        try {
          var nextJourney = journeyMetadata === undefined ? undefined : copyJourneyMetadata(journeyMetadata, true);
          var editable = editableState == null ? null : validateEditable(editableState);
          if (editableState != null && !editable) throw new Error('无效的可编辑图层');
          var image = await loadImage(editable ? editable.strokes : dataUrl);
          if (drawingRevision !== revision || isDrawing || request !== outlineRequest) { reportStatus('画布已更新，本次恢复没有覆盖当前内容。'); return false; }
          var fillImage = editable && editable.fills ? await loadImage(editable.fills) : null;
          var sources = editable ? Array.from(new Set((editable.outline ? [editable.outline.src] : []).concat(editable.parts.map(function (part) { return part.src; })))) : [];
          var restoredTemplate = editable && editable.template && templateDefinition(editable.template.id);
          if (restoredTemplate && restoredTemplate.overlay) sources.push(restoredTemplate.overlay);
          var loaded = await Promise.all(sources.map(function (source) { return loadImage(source); }));
          if (drawingRevision !== revision || isDrawing || request !== outlineRequest) {
            reportStatus('画布已更新，本次恢复没有覆盖当前内容。');
            return false;
          }
          if (nextJourney !== undefined) currentJourneyMetadata = nextJourney;
          drawCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
          drawCtx.globalAlpha = 1;
          drawCtx.globalCompositeOperation = 'source-over';
          drawCtx.drawImage(image, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
          backgroundColor = editable ? editable.background : 'transparent';
          outline = editable ? copyOutline(editable.outline) : null;
          coloringTemplate = editable ? copyTemplate(editable.template) : null;
          creationMethod = editable ? editable.creationMethod : 'free';
          drawingTool = creationMethod === 'coloring' ? 'coloring' : 'brush';
          isErasing = false; drawCanvas.classList.remove('eraser-active');
          legacyFlattened = editable ? editable.legacyFlattened : true;
          parts = editable ? copyParts(editable.parts) : [];
          selectedPart = parts.length ? 0 : -1;
          fillCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
          if (fillImage) fillCtx.drawImage(fillImage, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
          sources.forEach(function (source, index) { outlineImages.set(source, loaded[index]); });
          invalidateFills();
          invalidatePixels(true);
          commitDrawing();
          return true;
        } catch (error) {
          reportStatus('无法恢复这份草稿，当前画布已保留；原存储内容未覆盖。');
          return false;
        }
      }

      async function loadStateFromStorage() {
        try {
          var raw = localStorage.getItem(STORAGE_KEY_DRAFT);
          if (!raw) return;
          var state = JSON.parse(raw);
          if (!state || state.version !== 1) throw new Error('不支持的草稿');
          if (/^#[0-9a-f]{6}$/i.test(state.brushColor)) brushColor = state.brushColor;
          if (Number.isFinite(state.brushSize)) brushSize = Math.max(2, Math.min(40, state.brushSize));
          if (Number.isFinite(state.brushSmoothing)) brushSmoothing = Math.max(0, Math.min(100, state.brushSmoothing));
          syncBrushControls();
          if (['hard', 'ink', 'spray'].indexOf(state.brushStyle) >= 0) brushStyle = state.brushStyle;
          isSymmetryOn = state.isSymmetryOn === true;
          if (brushSlider) brushSlider.value = brushSize;
          btnSymmetry.classList.toggle('is-on', isSymmetryOn);
          btnBrushHard.classList.toggle('is-on', brushStyle === 'hard');
          btnBrushInk.classList.toggle('is-on', brushStyle === 'ink');
          btnBrushSpray.classList.toggle('is-on', brushStyle === 'spray');
          renderPalette();
          var loadRevision = drawingRevision;
          var restored = await restoreImage(state.image, undefined, state.drawing);
          if (!restored && drawingRevision === loadRevision) {
            // Keep a readable image if an editable layer cannot load, without rewriting the original draft.
            if (state.drawing) restored = await restoreImage(state.image);
            preserveUnreadDraft = restored || drawingRevision === loadRevision;
            if (restored) reportStatus('已显示原作品的完整图像，独立线稿暂未恢复；原草稿尚未覆盖。');
          }
          if (restored && state.journey && Object.prototype.toString.call(state.journey) === '[object Object]') {
            currentJourneyMetadata = JSON.parse(JSON.stringify(state.journey));
          }
        } catch (error) {
          preserveUnreadDraft = true;
          reportStatus('无法读取本机草稿，原存储内容未覆盖。可开始新作品，或先保留浏览器中的原记录。');
        }
      }

      function drawingChanged() {
        drawingRevision++;
        updateButtonStates();
        // Let the journey synchronously provide its current metadata before the complete draft is saved.
        window.dispatchEvent(new Event('nuo:drawing-change'));
        saveStateToStorage();
      }

      function commitDrawing() {
        if (!draftLoading) preserveUnreadDraft = false;
        invalidatePixels(false);
        renderComposite();
        syncLayerControls();
        saveSnapshot();
        drawingChanged();
      }

      async function addReference(imagePath) {
        if (!validOutlinePath(imagePath)) {
          reportStatus('请选择档案库中的本地线稿作为参考。');
          return false;
        }
        finishStroke(); finishLayerEdit();
        var request = ++outlineRequest;
        try {
          var image = outlineImages.get(imagePath) || await loadImage(imagePath);
          if (request !== outlineRequest) { reportStatus('已切换作品，本次线稿未加入。'); return false; }
          finishStroke(); finishLayerEdit();
          outlineImages.set(imagePath, image);
          coloringTemplate = null; creationMethod = 'free'; drawingTool = 'brush'; isErasing = false; drawCanvas.classList.remove('eraser-active');
          outline = { src: imagePath, color: '#fff0d2', scale: 100, x: 0, y: 0, locked: true, cuts: [] };
          commitDrawing();
          enterDrawing();
          if (parts.length) reportStatus('已使用新的基础线稿；之前拆出的局部与纸面填色仍保留，可分别删除或清除。');
          return true;
        } catch (error) {
          reportStatus('参考线稿加载失败，当前画布已保留，请重试。');
          return false;
        }
      }

      /* ---- Drawing Engine ---- */

      function fitDrawingCanvas() {
        // CSS controls the display size; the drawing pixels never change on a viewport resize.
        if (drawCanvas.width !== CANVAS_WIDTH || drawCanvas.height !== CANVAS_HEIGHT) {
          drawCanvas.width = CANVAS_WIDTH;
          drawCanvas.height = CANVAS_HEIGHT;
        }
        [strokeCanvas, outlineCanvas, fillCanvas, partCanvas].forEach(function (canvas) {
          if (canvas.width !== CANVAS_WIDTH || canvas.height !== CANVAS_HEIGHT) { canvas.width = CANVAS_WIDTH; canvas.height = CANVAS_HEIGHT; }
        });
        drawCtx.lineCap = 'round';
        drawCtx.lineJoin = 'round';
        return { width: CANVAS_WIDTH, height: CANVAS_HEIGHT };
      }

      function initBlankCanvas() {
        fitDrawingCanvas();
        drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
        undoStack = [];
        redoStack = [];
        invalidatePixels(true);
        renderComposite();
        syncLayerControls();
        saveSnapshot();
      }

      function saveSnapshot() {
        var w = drawCanvas.width;
        var h = drawCanvas.height;
        if (w === 0 || h === 0) return;
        if (!cachedStrokePixels) cachedStrokePixels = drawCtx.getImageData(0, 0, w, h);
        var data = cachedStrokePixels;
        if (!cachedFillPixels) cachedFillPixels = fillCtx.getImageData(0, 0, w, h);
        undoStack.push({ strokes: data, fills: cachedFillPixels, background: backgroundColor, outline: copyOutline(outline), parts: copyParts(parts), template: copyTemplate(coloringTemplate), creationMethod: creationMethod, legacyFlattened: legacyFlattened });
        if (undoStack.length > maxUndoSteps + 1) undoStack.shift();
        redoStack = [];
      }

      function resetHistory() {
        finishStroke(); finishLayerEdit();
        outlineRequest++;
        undoStack = [];
        redoStack = [];
        saveSnapshot();
        drawingRevision++;
        updateButtonStates();
      }

      function restoreSnapshot(data) {
        var w = drawCanvas.width;
        var h = drawCanvas.height;
        drawCtx.clearRect(0, 0, w, h);
        drawCtx.putImageData(data.strokes, 0, 0);
        fillCtx.clearRect(0, 0, w, h);
        fillCtx.putImageData(data.fills, 0, 0);
        parts = copyParts(data.parts);
        selectedPart = parts.length ? Math.min(Math.max(selectedPart, 0), parts.length - 1) : -1;
        invalidateFills();
        backgroundColor = data.background;
        outline = copyOutline(data.outline);
        coloringTemplate = copyTemplate(data.template);
        creationMethod = data.creationMethod || 'free';
        if (creationMethod === 'coloring') { drawingTool = 'coloring'; isErasing = false; drawCanvas.classList.remove('eraser-active'); }
        else if (drawingTool === 'coloring' || (drawingTool === 'select' && !outline)) drawingTool = 'brush';
        legacyFlattened = data.legacyFlattened;
        invalidatePixels(true);
        renderComposite();
        syncLayerControls();
      }

      function hasDrawingContent() {
        if (coloringTemplate) return true;
        if (parts.length || (outline && !outline.cuts.length)) return true;
        if (outline) {
          var remainingLines = outlineCtx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT).data;
          for (var line = 3; line < remainingLines.length; line += 4) { if (remainingLines[line] > 0) return true; }
        }
        var w = drawCanvas.width;
        var h = drawCanvas.height;
        if (w === 0 || h === 0) return false;
        var data = drawCtx.getImageData(0, 0, w, h).data;
        var fills = fillCtx.getImageData(0, 0, w, h).data;
        for (var f = 3; f < fills.length; f += 4) { if (fills[f] > 0) return true; }
        for (var i = 3; i < data.length; i += 4) {
          if (data[i] > 0) return true;
        }
        return false;
      }

      function doUndo() {
        finishStroke(); finishLayerEdit();
        outlineRequest++;
        if (undoStack.length <= 1) return;
        redoStack.push(undoStack.pop());
        restoreSnapshot(undoStack[undoStack.length - 1]);
        drawingChanged();
      }

      function doRedo() {
        finishStroke(); finishLayerEdit();
        outlineRequest++;
        if (redoStack.length === 0) return;
        var next = redoStack.pop();
        undoStack.push(next);
        restoreSnapshot(next);
        drawingChanged();
      }

      function clearCanvas(journeyMetadata) {
        var nextJourney;
        try {
          nextJourney = journeyMetadata === undefined ? undefined : copyJourneyMetadata(journeyMetadata, true);
        } catch (error) {
          reportStatus('创作资料无效，当前画布已保留。');
          return false;
        }
        finishStroke(); finishLayerEdit();
        outlineRequest++;
        if (!hasDrawingContent() && nextJourney === undefined && backgroundColor === '#0d0906') return true;
        if (nextJourney !== undefined) currentJourneyMetadata = nextJourney;
        drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
        fillCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        invalidateFills(); parts = []; selectedPart = -1;
        outline = null; coloringTemplate = null; backgroundColor = '#0d0906'; legacyFlattened = false;
        if (nextJourney !== undefined) creationMethod = coloringTemplates.length ? 'coloring' : 'free';
        drawingTool = creationMethod === 'coloring' ? 'coloring' : 'brush';
        isErasing = false; drawCanvas.classList.remove('eraser-active');
        invalidatePixels(true);
        commitDrawing();
        triggerClearFlash();
        return true;
      }

      function updateToggleStates() {
        updateToolHint();
        [[btnEraser, isErasing], [btnSymmetry, isSymmetryOn], [btnTemplate, isTemplateOn], [btnBrushHard, drawingTool === 'brush' && !isErasing && brushStyle === 'hard'], [btnBrushInk, drawingTool === 'brush' && !isErasing && brushStyle === 'ink'], [btnBrushSpray, drawingTool === 'brush' && !isErasing && brushStyle === 'spray']].forEach(function (entry) {
          if (entry[0]) { entry[0].setAttribute('aria-pressed', String(entry[1])); entry[0].classList.toggle('is-on', entry[1]); }
        });
        syncPickedColor();
      }

      function updateButtonStates() {
        updateToggleStates();
        if (btnUndo) btnUndo.disabled = undoStack.length <= 1;
        if (btnRedo) btnRedo.disabled = redoStack.length === 0;
        if (btnClear) btnClear.classList.toggle('is-on', !hasDrawingContent());
      }

      function triggerClearFlash() {
        var flash = document.createElement('div');
        flash.className = 'draw-stage-flash';
        galaxyStage.appendChild(flash);
        flash.addEventListener('animationend', function () { flash.remove(); });
      }

      /* ---- Continuous brush strokes ---- */
      var mirrorAxis = 0;

      function syncBrushControls() {
        if (brushSlider) brushSlider.value = brushSize;
        if (brushSizeOutput) brushSizeOutput.textContent = brushSize;
        if (smoothingSlider) smoothingSlider.value = brushSmoothing;
        if (smoothingOutput) smoothingOutput.textContent = brushSmoothing + '%';
      }

      function drawDot(x, y, radius) {
        drawCtx.globalCompositeOperation = isErasing ? 'destination-out' : 'source-over';
        drawCtx.globalAlpha = brushStyle === 'spray' && !isErasing ? 0.18 : 1;
        function stamp(px) {
          if (isErasing || brushStyle === 'hard') {
            // A solid round edge gives a clean line and an eraser that removes ink in one pass.
            drawCtx.fillStyle = brushColor;
          } else {
            var gradient = drawCtx.createRadialGradient(px, y, 0, px, y, radius);
            gradient.addColorStop(0, brushColor);
            gradient.addColorStop(brushStyle === 'ink' ? 0.78 : 0.12, brushColor);
            gradient.addColorStop(1, 'rgba(0,0,0,0)');
            drawCtx.fillStyle = gradient;
          }
          drawCtx.beginPath();
          drawCtx.arc(px, y, radius, 0, Math.PI * 2);
          drawCtx.fill();
        }
        stamp(x);
        if (isSymmetryOn && !isErasing && Math.abs(mirrorAxis - x) > 0.01) stamp(mirrorAxis * 2 - x);
        drawCtx.globalAlpha = 1;
        drawCtx.globalCompositeOperation = 'source-over';
      }

      function drawCurve(start, control, end) {
        var distance = 2 * Math.max(Math.hypot(control.x - start.x, control.y - start.y), Math.hypot(end.x - control.x, end.y - control.y));
        var spacing = Math.max(0.5, Math.min(start.radius, control.radius, end.radius) * 0.25);
        var steps = Math.max(1, Math.ceil(distance / spacing));
        for (var i = 1; i <= steps; i++) {
          var t = i / steps, u = 1 - t;
          drawDot(u * u * start.x + 2 * u * t * control.x + t * t * end.x,
            u * u * start.y + 2 * u * t * control.y + t * t * end.y,
            u * u * start.radius + 2 * u * t * control.radius + t * t * end.radius);
        }
      }

      function appendStrokePoint(point) {
        if (point.x === lastStrokePoint.x && point.y === lastStrokePoint.y && point.radius === lastStrokePoint.radius) return false;
        // The curve starts where the previous curve ended, never at the previous raw input.
        // Smoothing holds at most half of one input interval instead of a five-event average.
        var hold = brushSmoothing / 200;
        var end = {
          x: point.x * (1 - hold) + lastStrokePoint.x * hold,
          y: point.y * (1 - hold) + lastStrokePoint.y * hold,
          radius: point.radius * (1 - hold) + lastStrokePoint.radius * hold
        };
        drawCurve(lastRenderedPoint, lastStrokePoint, end);
        lastRenderedPoint = end;
        lastStrokePoint = point;
        return true;
      }

      /* ---- Cursor Glow ---- */
      function ensureCursorGlow() {
        if (cursorGlow) return;
        cursorGlow = document.createElement('div');
        cursorGlow.className = 'draw-cursor-glow';
        document.body.appendChild(cursorGlow);
      }

      function updateCursorGlow(x, y) {
        if (!cursorGlow) return;
        cursorGlow.style.left = x + 'px';
        cursorGlow.style.top = y + 'px';
        var diameter = brushSize * 2 * drawCanvas.getBoundingClientRect().width / CANVAS_WIDTH;
        cursorGlow.style.setProperty('--brush-size-px', diameter + 'px');
        cursorGlow.style.setProperty('--brush-color', brushColor);
        cursorGlow.style.width = diameter + 'px';
        cursorGlow.style.height = diameter + 'px';
      }

      function showCursorGlow() { if (cursorGlow) cursorGlow.classList.add('is-visible'); }
      function hideCursorGlow() { if (cursorGlow) cursorGlow.classList.remove('is-visible'); }

      /* ---- Pointer Handlers ---- */
      function getCanvasPoint(e, ending) {
        var rect = drawCanvas.getBoundingClientRect();
        var radius = brushSize;
        // Touch and mouse pressure is often a synthetic 0.5; only a pen changes stroke width.
        if (activePointerType === 'pen') {
          if (!ending && Number.isFinite(e.pressure) && e.pressure > 0 && e.pressure <= 1) radius *= 0.25 + e.pressure * 0.75;
          else if (lastStrokePoint) radius = lastStrokePoint.radius;
        }
        return {
          x: (e.clientX - rect.left) * (drawCanvas.width / Math.max(1, rect.width)),
          y: (e.clientY - rect.top) * (drawCanvas.height / Math.max(1, rect.height)),
          radius: radius
        };
      }

      function onDrawPointerDown(e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault();
        if (e.pointerType === 'touch') {
          touchPointers.add(e.pointerId);
          if (touchPointers.size > 1) {
            if (activePointerType === 'touch' || canvasAction) finishStroke();
            return;
          }
        }
        if (isDrawing || canvasAction || (e.pointerType === 'touch' && e.isPrimary === false)) return;
        finishLayerEdit();
        if (drawingTool !== 'brush') {
          canvasAction = { id: e.pointerId, tool: drawingTool, start: getCanvasPoint(e, false), moved: false };
          drawCanvas.setPointerCapture(e.pointerId);
          if (drawingTool === 'select') showSelection(selectionRect(canvasAction.start, canvasAction.start));
          return;
        }
        isDrawing = true;
        activePointerId = e.pointerId;
        activePointerType = e.pointerType;
        drawingRevision++;
        mirrorAxis = drawCanvas.width / 2;
        drawCanvas.setPointerCapture(e.pointerId);
        // Mobile browsers may later scroll back to a focused canvas when their viewport changes.
        if (e.pointerType === 'mouse') drawCanvas.focus({ preventScroll: true });
        lastStrokePoint = lastRenderedPoint = getCanvasPoint(e, false);
        drawDot(lastStrokePoint.x, lastStrokePoint.y, lastStrokePoint.radius);
        invalidatePixels(true); renderComposite();
      }

      function appendPointerSamples(e, ending) {
        var events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
        // The dispatched event is not guaranteed to be included in the coalesced list.
        var samples = Array.from(events);
        samples.push(e);
        var changed = false;
        samples.forEach(function (sample) {
          if (!Number.isFinite(sample.clientX) || !Number.isFinite(sample.clientY)) return;
          changed = appendStrokePoint(getCanvasPoint(sample, ending)) || changed;
        });
        return changed;
      }

      function onDrawPointerMove(e) {
        if (canvasAction && e.pointerId === canvasAction.id) {
          var point = getCanvasPoint(e, false);
          canvasAction.moved = canvasAction.moved || Math.hypot(point.x - canvasAction.start.x, point.y - canvasAction.start.y) > 12;
          if (canvasAction.tool === 'select') showSelection(selectionRect(canvasAction.start, point));
          e.preventDefault(); return;
        }
        if (e.pointerType !== 'touch') updateCursorGlow(e.clientX, e.clientY);
        if (!isDrawing || e.pointerId !== activePointerId) return;
        if (appendPointerSamples(e, false)) { invalidatePixels(true); renderComposite(); }
        e.preventDefault();
      }

      function finishStroke() {
        cancelCanvasAction();
        if (!isDrawing) return;
        // Flush the short smoothing tail, including a final pointerup coordinate when available.
        if (lastRenderedPoint.x !== lastStrokePoint.x || lastRenderedPoint.y !== lastStrokePoint.y || lastRenderedPoint.radius !== lastStrokePoint.radius) {
          drawCurve(lastRenderedPoint, lastStrokePoint, lastStrokePoint);
          invalidatePixels(true);
        }
        var pointerId = activePointerId;
        isDrawing = false;
        activePointerId = null;
        activePointerType = null;
        lastStrokePoint = lastRenderedPoint = null;
        if (pointerId !== null && drawCanvas.hasPointerCapture(pointerId)) drawCanvas.releasePointerCapture(pointerId);
        commitDrawing();
      }

      function onDrawPointerUp(e) {
        touchPointers.delete(e.pointerId);
        if (canvasAction && e.pointerId === canvasAction.id) {
          var action = canvasAction, point = getCanvasPoint(e, true);
          cancelCanvasAction();
          if (e.type === 'pointerup') {
            if (action.tool === 'select') extractPart(selectionRect(action.start, point));
            else if (!action.moved && Math.hypot(point.x - action.start.x, point.y - action.start.y) <= 12) {
              if (action.tool === 'coloring') fillTemplateAt(point);
              else fillRegion(point);
            }
          }
          return;
        }
        if (e.pointerId !== activePointerId) return;
        if (e.type === 'pointerup' && appendPointerSamples(e, true)) invalidatePixels(true);
        // Cancellation and capture loss keep the existing ink, without connecting to bogus coordinates.
        finishStroke();
      }

      function onDrawPointerEnter(e) {
        if (drawingTool !== 'brush' || e.pointerType === 'touch') return;
        ensureCursorGlow();
        showCursorGlow();
        updateCursorGlow(e.clientX, e.clientY);
      }

      function onDrawPointerLeave(e) {
        hideCursorGlow();
      }

      /* ---- Dedicated drawing workspace ---- */
      function enterDrawing() {
        finishStroke(); finishLayerEdit();
        if (paintingDesk) paintingDesk.classList.add('is-drawing');
        isErasing = false;
        btnEraser.classList.remove('is-on');
        drawCanvas.classList.remove('eraser-active');
        drawCtx.globalCompositeOperation = 'source-over';
        drawToolsGroup.classList.add('is-shown');
        drawLayer.classList.add('is-active');
        stageHud.innerHTML = '<span>选颜色，留下自己的创作</span>';
        fitDrawingCanvas();
        mirrorAxis = drawCanvas.width / 2;
        ensureCursorGlow();
        updateButtonStates();
        updateToggleStates();
      }

      /* ---- Finish in the shared journey ---- */
      function finishWork() {
        finishStroke(); finishLayerEdit();
        if (document.activeElement && document.activeElement.closest('#galaxy')) document.activeElement.blur();
        window.dispatchEvent(new Event('nuo:finish'));
      }

      /* ---- Template Overlay ---- */
      function createTemplateOverlay() {
        if (templateOverlay) return;
        templateOverlay = document.createElement('div');
        templateOverlay.className = 'template-overlay';
        templateOverlay.innerHTML = '<svg viewBox="0 0 400 520"><ellipse cx="200" cy="240" rx="130" ry="170" fill="none" stroke="rgba(255,240,210,.5)" stroke-width="1.5"/><circle cx="165" cy="200" r="24" fill="none" stroke="rgba(255,240,210,.45)" stroke-width="1.2"/><circle cx="235" cy="200" r="24" fill="none" stroke="rgba(255,240,210,.45)" stroke-width="1.2"/><ellipse cx="200" cy="300" rx="28" ry="34" fill="none" stroke="rgba(255,240,210,.4)" stroke-width="1.2"/><path d="M170 340 Q200 370 230 340" fill="none" stroke="rgba(255,240,210,.35)" stroke-width="1.2"/><ellipse cx="200" cy="140" rx="50" ry="18" fill="none" stroke="rgba(255,240,210,.35)" stroke-width="1" stroke-dasharray="6 4"/></svg>';
        drawLayer.appendChild(templateOverlay);
      }

      function toggleTemplate(force) {
        isTemplateOn = typeof force === 'boolean' ? force : !isTemplateOn;
        if (isTemplateOn) {
          createTemplateOverlay();
          templateOverlay.classList.add('is-shown');
          btnTemplate.classList.add('is-on');
        } else {
          if (templateOverlay) templateOverlay.classList.remove('is-shown');
          btnTemplate.classList.remove('is-on');
        }
        updateToggleStates();
      }

      /* ---- Symmetry Toggle ---- */
      function toggleSymmetry(force) {
        finishStroke();
        isSymmetryOn = typeof force === 'boolean' ? force : !isSymmetryOn;
        if (isSymmetryOn) {
          btnSymmetry.classList.add('is-on');
        } else {
          btnSymmetry.classList.remove('is-on');
        }
        mirrorAxis = drawCanvas.width / 2;
        updateToggleStates();
        saveStateToStorage();
      }

      /* ---- Brush Style Switching ---- */
      function setBrushStyle(style) {
        setTool('brush');
        brushStyle = style;
        btnBrushHard.classList.remove('is-on');
        btnBrushInk.classList.remove('is-on');
        btnBrushSpray.classList.remove('is-on');
        if (style === 'hard') btnBrushHard.classList.add('is-on');
        else if (style === 'ink') btnBrushInk.classList.add('is-on');
        else if (style === 'spray') btnBrushSpray.classList.add('is-on');
        updateToggleStates();
        saveStateToStorage();
      }

      /* ---- Layer controls: one slider/color gesture is one undo action ---- */
      function previewLayerControl(id) {
        var input = document.getElementById(id);
        if (!input) return;
        finishStroke();
        if (layerEditing && layerEditing !== id) finishLayerEdit();
        var changed = false;
        if (id === 'drawBackground') {
          if (validColor(input.value) && input.value !== backgroundColor) { backgroundColor = input.value; changed = true; }
        } else if (outline && id === 'outlineColor') {
          if (validColor(input.value) && input.value !== outline.color) { outline.color = input.value; changed = true; }
        } else if (outline && !outline.locked) {
          var field = { outlineScale: 'scale', outlineX: 'x', outlineY: 'y' }[id];
          var value = Number(input.value);
          var valid = field === 'scale' ? value >= 40 && value <= 140 : value >= -40 && value <= 40;
          if (field && Number.isFinite(value) && valid && value !== outline[field]) { outline[field] = value; changed = true; }
        }
        if (!changed) { syncLayerControls(); return; }
        layerEditing = id;
        drawingRevision++;
        invalidatePixels(false);
        renderComposite();
        syncLayerControls();
      }
      ['drawBackground', 'outlineColor', 'outlineScale', 'outlineX', 'outlineY'].forEach(function (id) {
        var input = document.getElementById(id);
        if (!input) return;
        input.addEventListener('input', function () { previewLayerControl(id); });
        input.addEventListener('change', function () { previewLayerControl(id); finishLayerEdit(); });
      });
      var outlineLockedInput = document.getElementById('outlineLocked');
      if (outlineLockedInput) outlineLockedInput.addEventListener('change', function () {
        finishStroke(); finishLayerEdit();
        if (!outline || outline.locked === this.checked) return;
        outline.locked = this.checked;
        commitDrawing();
      });
      var resetOutlineButton = document.getElementById('btnResetOutline');
      if (resetOutlineButton) resetOutlineButton.addEventListener('click', function () {
        finishStroke(); finishLayerEdit();
        if (!outline || outline.locked || (outline.scale === 100 && outline.x === 0 && outline.y === 0)) return;
        outline.scale = 100; outline.x = 0; outline.y = 0;
        commitDrawing();
      });
      var removeOutlineButton = document.getElementById('btnRemoveOutline');
      if (removeOutlineButton) removeOutlineButton.addEventListener('click', function () {
        finishStroke(); finishLayerEdit();
        outlineRequest++;
        if (!outline) return;
        outline = null;
        if (drawingTool === 'select') drawingTool = 'brush';
        commitDrawing();
        reportStatus('已移除基础线稿；已拆出的局部、填色与笔画仍保留，可分别删除或清除。');
      });

      ['btnFillRegion', 'btnSelectPart'].forEach(function (id) {
        var button = document.getElementById(id);
        if (button) button.addEventListener('click', function () { setTool(id === 'btnFillRegion' ? 'fill' : 'select'); });
      });
      var clearFillsButton = document.getElementById('btnClearFills');
      if (clearFillsButton) clearFillsButton.addEventListener('click', function () {
        finishStroke(); finishLayerEdit();
        var pixels = fillCtx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT).data;
        var hasFill = false;
        for (var i = 3; i < pixels.length; i += 4) { if (pixels[i] > 0) { hasFill = true; break; } }
        var hasTemplateColors = coloringTemplate && Object.keys(coloringTemplate.colors).length > 0;
        if (!hasFill && !hasTemplateColors) { reportStatus('还没有区域填色。'); return; }
        if (coloringTemplate) coloringTemplate.colors = {};
        fillCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT); invalidateFills(); commitDrawing();
        reportStatus('已清除填色，保留底稿、局部与笔画；可撤销。');
      });
      var partSelect = document.getElementById('partSelect');
      if (partSelect) partSelect.addEventListener('change', function () {
        var index = Number(this.value);
        finishStroke(); finishLayerEdit();
        if (Number.isInteger(index) && index >= 0 && index < parts.length) selectedPart = index;
        syncPartControls();
      });
      function previewPartControl(id) {
        var input = document.getElementById(id), part = parts[selectedPart];
        if (!input || !part) return;
        var nextValue = input.value;
        finishStroke();
        if (layerEditing && layerEditing !== id) finishLayerEdit();
        var field = { partColor: 'color', partScale: 'scale', partX: 'x', partY: 'y', partRotation: 'rotation' }[id];
        var value = field === 'color' ? nextValue : Number(nextValue);
        var valid = field === 'color' ? validColor(value) : Number.isFinite(value) && (field === 'scale' ? value >= 25 && value <= 200 : Math.abs(value) <= (field === 'rotation' ? 180 : 100));
        if (!valid || part[field] === value) { syncPartControls(); return; }
        part[field] = value; layerEditing = id; drawingRevision++;
        invalidatePixels(false); renderComposite(); syncPartControls();
      }
      ['partColor', 'partScale', 'partX', 'partY', 'partRotation'].forEach(function (id) {
        var input = document.getElementById(id);
        if (!input) return;
        input.addEventListener('input', function () { previewPartControl(id); });
        input.addEventListener('change', function () { previewPartControl(id); finishLayerEdit(); });
      });
      var resetPartButton = document.getElementById('btnResetPart');
      if (resetPartButton) resetPartButton.addEventListener('click', function () {
        finishStroke(); finishLayerEdit();
        var part = parts[selectedPart];
        if (!part || (part.x === 0 && part.y === 0 && part.scale === 100 && part.rotation === 0)) return;
        part.x = 0; part.y = 0; part.scale = 100; part.rotation = 0; commitDrawing();
      });
      var deletePartButton = document.getElementById('btnDeletePart');
      if (deletePartButton) deletePartButton.addEventListener('click', function () {
        finishStroke(); finishLayerEdit();
        if (!parts[selectedPart]) return;
        parts.splice(selectedPart, 1); selectedPart = Math.min(selectedPart, parts.length - 1); commitDrawing();
        reportStatus('已删除选中的局部线条，原剪口仍保留；撤销可以恢复。');
      });
      var extractPartButton = document.getElementById('btnExtractPart');
      if (extractPartButton) extractPartButton.addEventListener('click', function () {
        var values = ['partCropX', 'partCropY', 'partCropWidth', 'partCropHeight'].map(function (id) { return Number(document.getElementById(id).value); });
        if (values.some(function (value) { return !Number.isFinite(value) || value < 0 || value > 100; }) || values[2] <= 0 || values[3] <= 0 || values[0] + values[2] > 100 || values[1] + values[3] > 100) { reportStatus('位置与尺寸请填写 0–100 之间的百分比，并让选区完整落在画布内。'); return; }
        extractPart({ x: values[0] * CANVAS_WIDTH / 100, y: values[1] * CANVAS_HEIGHT / 100, w: values[2] * CANVAS_WIDTH / 100, h: values[3] * CANVAS_HEIGHT / 100 });
      });

      /* ---- Event Binding ---- */
      btnSaveToGalaxy.addEventListener('click', finishWork);

      btnEraser.addEventListener('click', function () {
        var nextErasing = !isErasing;
        setTool('brush');
        isErasing = nextErasing;
        if (isErasing) {
          btnEraser.classList.add('is-on');
          drawCanvas.classList.add('eraser-active');
          drawCtx.globalCompositeOperation = 'destination-out';
          if (drawPalette) {
            drawPalette.querySelectorAll('.swatch').forEach(function (b) { b.classList.remove('is-active'); });
          }
          hideCursorGlow();
        } else {
          btnEraser.classList.remove('is-on');
          drawCanvas.classList.remove('eraser-active');
          drawCtx.globalCompositeOperation = 'source-over';
          if (drawPalette) {
            drawPalette.querySelectorAll('.swatch').forEach(function (b) {
              b.classList.toggle('is-active', b.dataset.hex === brushColor);
            });
          }
          ensureCursorGlow();
          showCursorGlow();
        }
        updateButtonStates();
      });

      btnUndo.addEventListener('click', function () { doUndo(); });
      btnRedo.addEventListener('click', function () { doRedo(); });
      btnClear.addEventListener('click', function () {
        if ((hasDrawingContent() || backgroundColor !== '#0d0906') && !window.confirm(window.NuoI18n ? window.NuoI18n.t('清空当前画布？线稿、填色和笔触都会移除；清空后可以撤销，心意与文字会保留。') : '清空当前画布？线稿、填色和笔触都会移除；清空后可以撤销，心意与文字会保留。')) return;
        clearCanvas();
      });

      brushSlider.addEventListener('input', function () {
        finishStroke();
        brushSize = Math.max(2, Math.min(40, Number(brushSlider.value) || 8));
        syncBrushControls();
        hideCursorGlow();
        saveStateToStorage();
      });
      if (smoothingSlider) smoothingSlider.addEventListener('input', function () {
        finishStroke();
        brushSmoothing = Math.max(0, Math.min(100, Number(smoothingSlider.value) || 0));
        syncBrushControls();
        saveStateToStorage();
      });

      btnSymmetry.addEventListener('click', function () { toggleSymmetry(); });
      btnTemplate.addEventListener('click', function () { toggleTemplate(); });
      btnBrushHard.addEventListener('click', function () { setBrushStyle('hard'); });
      btnBrushInk.addEventListener('click', function () { setBrushStyle('ink'); });
      btnBrushSpray.addEventListener('click', function () { setBrushStyle('spray'); });

      // Draw canvas pointer events
      drawCanvas.addEventListener('pointerdown', onDrawPointerDown);
      drawCanvas.addEventListener('pointermove', onDrawPointerMove);
      drawCanvas.addEventListener('pointerup', onDrawPointerUp);
      drawCanvas.addEventListener('pointercancel', onDrawPointerUp);
      drawCanvas.addEventListener('lostpointercapture', function (e) {
        if (e.pointerId === activePointerId || (canvasAction && e.pointerId === canvasAction.id)) finishStroke();
      });
      // A second touch is not captured, so its release may occur outside the canvas.
      window.addEventListener('pointerup', function (e) { touchPointers.delete(e.pointerId); });
      window.addEventListener('pointercancel', function (e) { touchPointers.delete(e.pointerId); });
      window.addEventListener('blur', function () { finishStroke(); touchPointers.clear(); hideCursorGlow(); });
      drawCanvas.style.touchAction = 'none';
      drawCanvas.tabIndex = 0;
      drawCanvas.addEventListener('pointerleave', onDrawPointerLeave);
      drawLayer.addEventListener('pointerenter', onDrawPointerEnter);
      drawLayer.addEventListener('pointerleave', onDrawPointerLeave);

      // Keyboard commands belong to the focused, visible workshop, never the result or game.
      document.addEventListener('keydown', function (e) {
        var target = e.target;
        if (!target || typeof target.closest !== 'function' || !target.closest('#galaxy')) return;
        if (e.key === 'Escape' && ((colorTray && !colorTray.hidden) || (brushSettings && brushSettings.open))) { e.preventDefault(); closeDeskPanels(); return; }
        if (target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])') || e.isComposing) return;
        var rect = galaxyStage.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0 || rect.bottom <= 0 || rect.top >= window.innerHeight || rect.right <= 0 || rect.left >= window.innerWidth) return;
        if (e.key === 'Escape') {
          finishStroke(); finishLayerEdit(); hideCursorGlow();
          return;
        }
        if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
        var key = e.key.toLowerCase();
        if (key === 'z') { e.preventDefault(); if (e.shiftKey) doRedo(); else doUndo(); }
        if (key === 'y') { e.preventDefault(); doRedo(); }
      });

      window.addEventListener('nuo:before-language-change', function () { finishStroke(); finishLayerEdit(); flushColorSave(); });
      window.addEventListener('pagehide', function () { finishStroke(); finishLayerEdit(); flushColorSave(); });
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) return;
        finishStroke(); finishLayerEdit(); flushColorSave(); touchPointers.clear(); hideCursorGlow();
      });

      // Keep the drawing resolution stable when the layout changes
      window.addEventListener('resize', function () {
        finishStroke();
        fitDrawingCanvas();
      });

      function setColor(hex, persist) {
        if (typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex)) return false;
        finishStroke();
        brushColor = hex;
        isErasing = false;
        btnEraser.classList.remove('is-on');
        drawCanvas.classList.remove('eraser-active');
        drawCtx.globalCompositeOperation = 'source-over';
        if (drawPalette) drawPalette.querySelectorAll('.swatch').forEach(function (button) {
          button.classList.toggle('is-active', button.dataset.hex.toLowerCase() === hex.toLowerCase());
        });
        if (cursorGlow) cursorGlow.style.setProperty('--brush-color', brushColor);
        updateToggleStates();
        if (persist !== false) { colorSavePending = true; flushColorSave(); }
        return true;
      }

      /* ---- Color Palette Rendering ---- */
      function renderPalette() {
        [[drawPalette, NUO_PALETTE.slice(0, 8)], [extendedPalette, NUO_PALETTE]].forEach(function (entry) {
          if (!entry[0]) return;
          entry[0].innerHTML = entry[1].map(function (color) {
            return '<button class="swatch" style="--swatch-color:' + color.hex + '" data-hex="' + color.hex + '" title="' + color.name + '" aria-label="' + color.name + '" type="button"></button>';
          }).join('');
          entry[0].querySelectorAll('.swatch').forEach(function (button) { button.addEventListener('click', function () { setColor(button.dataset.hex); }); });
        });
        syncPickedColor();
      }
      function syncPickedColor() {
        [drawPalette, extendedPalette].forEach(function (palette) {
          if (palette) palette.querySelectorAll('.swatch').forEach(function (button) {
            var active = !isErasing && button.dataset.hex.toLowerCase() === brushColor.toLowerCase();
            button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', String(active));
          });
        });
        var chip = document.getElementById('currentColorChip'), value = document.getElementById('currentColorValue');
        if (chip) chip.style.background = brushColor;
        if (value) value.textContent = brushColor.toUpperCase();
        if (colorPicker) colorPicker.setColor(brushColor);
      }
      function flushColorSave() {
        clearTimeout(colorSaveTimer); colorSaveTimer = null;
        if (colorSavePending) { colorSavePending = false; saveStateToStorage(); }
      }
      function syncDeskBackdrop() {
        if (deskBackdrop) deskBackdrop.hidden = !((colorTray && !colorTray.hidden) || (brushSettings && !brushSettings.hidden && brushSettings.open));
      }
      var deskPointerType = 'mouse';
      if (paintingDesk) paintingDesk.addEventListener('pointerdown', function (event) { deskPointerType = event.pointerType; }, true);
      function shouldFocusDesk(event) {
        // Older Safari emits MouseEvent clicks for touch; keep the preceding pointer type.
        return event.detail === 0 || (event.pointerType || deskPointerType) === 'mouse';
      }
      function closeDeskPanels(returnFocus) {
        if (colorTray) colorTray.hidden = true;
        if (brushSettings) brushSettings.open = false;
        ['btnMoreColors','btnColorWheel'].forEach(function (id) { var button = document.getElementById(id); if (button) button.setAttribute('aria-expanded','false'); });
        syncDeskBackdrop(); flushColorSave();
        if (returnFocus !== false && lastColorTrigger) lastColorTrigger.focus({preventScroll:true});
      }
      function openColorTray(wheel, trigger, moveFocus) {
        finishStroke(); finishLayerEdit();
        if (!colorTray) return;
        if (brushSettings) brushSettings.open = false;
        colorTray.hidden = false;
        if (trigger) lastColorTrigger = trigger;
        var mount = document.getElementById('colorPickerMount');
        if (mount) mount.hidden = !wheel;
        if (extendedPalette) extendedPalette.hidden = wheel;
        [['showColorWheel',wheel],['showColorSwatches',!wheel]].forEach(function (entry) { var button = document.getElementById(entry[0]); if (button) button.setAttribute('aria-pressed',String(entry[1])); });
        ['btnMoreColors','btnColorWheel'].forEach(function (id) { var button = document.getElementById(id); if (button) button.setAttribute('aria-expanded','true'); });
        syncPickedColor(); syncDeskBackdrop();
        var focusButton = document.getElementById(wheel ? 'showColorWheel' : 'showColorSwatches');
        if (moveFocus && focusButton) focusButton.focus({preventScroll:true});
      }
      [['btnMoreColors',false],['btnColorWheel',true],['showColorSwatches',false],['showColorWheel',true]].forEach(function (entry) {
        var button = document.getElementById(entry[0]);
        if (button) button.addEventListener('click', function (event) { openColorTray(entry[1], entry[0].indexOf('btn') === 0 ? button : null, shouldFocusDesk(event)); });
      });
      ['closeColorTray','closeBrushSettings','deskPanelBackdrop'].forEach(function (id) {
        var button = document.getElementById(id); if (button) button.addEventListener('click', function (event) { closeDeskPanels(shouldFocusDesk(event)); });
      });
      if (brushSettings) brushSettings.addEventListener('toggle', function () {
        if (brushSettings.open) {
          if (colorTray) colorTray.hidden = true;
          if (brushSettings.querySelector) lastColorTrigger = brushSettings.querySelector('summary');
        }
        syncDeskBackdrop();
      });

      /* ---- Cross-module API ---- */
      window.NuoDrawing = {
        ready: false,
        enter: function () { enterDrawing(); },
        closePanels: function () { closeDeskPanels(false); },
        setColor: setColor,
        setTool: setTool,
        setCreationMethod: setCreationMethod,
        selectTemplate: selectColoringTemplate,
        fillTemplateRegion: fillTemplateRegion,
        applyColoringScheme: applyColoringScheme,
        extractPart: extractPart,
        getImage: getImage,
        exportEditable: exportEditable,
        validateEditable: validateEditable,
        hasContent: hasDrawingContent,
        restore: restoreImage,
        addReference: addReference,
        clear: clearCanvas,
        resetHistory: resetHistory,
        saveDraft: saveStateToStorage
      };

      /* ---- Init ---- */
      async function init() {
        renderColoringChoices();
        initBlankCanvas();
        renderPalette();
        syncBrushControls();
        mirrorAxis = drawCanvas.width / 2;
        closeDeskPanels(false);
        enterDrawing();
        updateButtonStates();
        await loadStateFromStorage();
        var pickerMount = document.getElementById('colorPickerMount');
        if (pickerMount && window.NuoColorPicker) colorPicker = window.NuoColorPicker.create(pickerMount, {
          color: brushColor,
          onChange: function (hex) {
            setColor(hex, false);
            colorSavePending = true; clearTimeout(colorSaveTimer);
            colorSaveTimer = setTimeout(flushColorSave, 240);
          }
        });
        updateToggleStates();
        draftLoading = false;
        window.NuoDrawing.ready = true;
        window.dispatchEvent(new Event('nuo:drawing-ready'));
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
      } else {
        init();
      }
    })();
