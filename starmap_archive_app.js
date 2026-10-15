(function () {
  function initializeArchive() {
  const atlas = window.NUO_MASK_ATLAS;
  const t = (value, vars) => window.NuoI18n?.t(value, vars) ?? String(value).replace(/\{(\w+)\}/g, (_, key) => vars?.[key] ?? "");
  const state = {
    layout: "Region",
    search: "",
    roles: new Set(),
    province: "",
    shape: "",
    showImages: true,
    showLinks: false,
    autoRotate: true,
    selectedId: null,
    rotationX: -0.48,
    rotationY: 0.72,
    zoom: 1,
  };

  const currentPalette = {
    "神灵信仰类": "#ffe4a3",
    "武将护法类": "#ff6034",
    "兽面驱邪类": "#90dfe1",
    "世俗戏曲人物类": "#adca7a",
    "组合或未归类": "#d6a159",
  };

  const layoutMap = {
    Region: {
      label: "地域分布",
      title: "中国傩面具地域三维星图",
      field: "province",
      x: "xRegion",
      y: "yRegion",
    },
    Role: {
      label: "角色类型",
      title: "傩面具角色类型三维星图",
      field: "roleType",
      x: "xRole",
      y: "yRole",
    },
    Semantic: {
      label: "语义倾向",
      title: "傩面具符号语义三维星图",
      field: "semantic",
      x: "xSemantic",
      y: "ySemantic",
    },
  };

  const els = {
    canvas: document.getElementById("starChart"),
    tooltip: document.getElementById("tooltip"),
    search: document.getElementById("searchInput"),
    roleFilters: document.getElementById("roleFilters"),
    provinceFilters: document.getElementById("provinceFilters"),
    shapeSelect: document.getElementById("shapeSelect"),
    layoutLabel: document.getElementById("layoutLabel"),
    chartTitle: document.getElementById("chartTitle"),
    toggleImages: document.getElementById("toggleImages"),
    toggleLinks: document.getElementById("toggleLinks"),
    toggleRotate: document.getElementById("toggleRotate"),
    resetView: document.getElementById("resetView"),
    legend: document.getElementById("legend"),
    statTotal: document.getElementById("statTotal"),
    statVisible: document.getElementById("statVisible"),
    statRegions: document.getElementById("statRegions"),
    statRoles: document.getElementById("statRoles"),
    detailImage: document.getElementById("detailImage"),
    detailMeta: document.getElementById("detailMeta"),
    detailName: document.getElementById("detailName"),
    detailTags: document.getElementById("detailTags"),
    detailFeature: document.getElementById("detailFeature"),
    detailColor: document.getElementById("detailColor"),
    detailKeywords: document.getElementById("detailKeywords"),
    caseList: document.getElementById("caseList"),
  };

  const ctx = els.canvas.getContext("2d");
  const detailActions = document.createElement("div");
  detailActions.className = "detail-reference-actions";
  const sourceLink = document.createElement("a");
  sourceLink.className = "detail-source-link";
  sourceLink.textContent = "查看原始资料 ↗︎";
  sourceLink.target = "_blank";
  sourceLink.rel = "noopener noreferrer";
  const addReference = document.createElement("button");
  addReference.className = "chip detail-add-reference";
  addReference.type = "button";
  addReference.textContent = "加入创作参考";
  addReference.addEventListener("click", () => {
    if (state.selectedId == null) return;
    window.dispatchEvent(new CustomEvent("nuo:add-reference", {
      detail: { id: state.selectedId },
    }));
  });
  const viewReferences = document.createElement("a");
  viewReferences.className = "detail-source-link";
  viewReferences.href = "#journey-references";
  viewReferences.textContent = "查看我的参考";
  const sourceNote = document.createElement("p");
  sourceNote.className = "detail-source-note";
  sourceNote.textContent = "视觉特征为本项目图像观察；地域推定以档案标注为准。语义标签是对角色分类的项目解释，尚未形成独立的语义标注。";
  detailActions.append(sourceLink, addReference, viewReferences, sourceNote);
  els.detailKeywords.closest(".detail-copy").appendChild(detailActions);
  const imageCache = new Map();
  const imageQueue = [];
  const starSprites = new Map();
  const positionCache = new Map();
  let imagesLoading = 0;
  let visibleNodes = [];
  let screenNodes = [];
  let imageNodeIds = new Set();
  let labels = [];
  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  const pointers = new Map();
  let gesture = null;
  let hoveredNode = null;
  let sceneActive = !("IntersectionObserver" in window);
  let frameId = 0;
  let needsDraw = true;
  let lastAnimationTime = 0;
  let rotation = { cx: 1, sx: 0, cy: 1, sy: 0 };

  function isActive() {
    return sceneActive && !document.hidden;
  }

  function requestDraw() {
    needsDraw = true;
    if (isActive() && !frameId) frameId = requestAnimationFrame(animationLoop);
  }

  function stopAnimation() {
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
    lastAnimationTime = 0;
  }

  function trimText(value, length = 90) {
    const text = String(value || "").trim();
    return text.length > length ? `${text.slice(0, length)}...` : text;
  }

  function hashValue(value) {
    const text = String(value);
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) / 4294967295;
  }

  function hexToRgb(hex) {
    const value = String(hex || "#aeb7c8").replace("#", "");
    return {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16),
    };
  }

  function colorWithAlpha(hex, alpha) {
    const rgb = hexToRgb(hex);
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  }

  function filteredNodes() {
    const query = state.search.toLowerCase();
    return atlas.nodes.filter((node) => {
      if (!state.roles.has(node.roleType)) return false;
      if (state.province && node.province !== state.province) return false;
      if (state.shape && node.faceShape !== state.shape) return false;
      if (!query) return true;
      return [
        node.idText,
        node.name,
        node.region,
        node.province,
        node.roleType,
        node.faceShape,
        node.semantic,
        node.keywords,
        node.feature,
        node.colorDescription,
      ]
        .flatMap(value => [value, t(value)])
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }

  function basePosition(node, layout = state.layout) {
    const key = `${layout}-${node.id}`;
    if (positionCache.has(key)) return positionCache.get(key);
    const config = layoutMap[layout];
    const x = Number(node[config.x] || 0) * 420;
    const y = Number(node[config.y] || 0) * 420;
    const planar = Math.min(1.1, Math.hypot(x, y) / 420);
    const depthSeed = hashValue(`${node.id}-${layout}-${node.roleType}-${node.semantic}`);
    const z = (depthSeed - 0.5) * 420 + (0.5 - planar) * 140;
    const position = { x, y, z };
    positionCache.set(key, position);
    return position;
  }

  function rotatePoint(point) {
    const { cx, sx, cy, sy } = rotation;

    const x1 = point.x * cy + point.z * sy;
    const z1 = -point.x * sy + point.z * cy;
    const y1 = point.y * cx - z1 * sx;
    const z2 = point.y * sx + z1 * cx;
    return { x: x1, y: y1, z: z2 };
  }

  function project(point) {
    const rotated = rotatePoint(point);
    const distance = 1180;
    const scale = (distance / (distance - rotated.z)) * state.zoom;
    return {
      x: width / 2 + rotated.x * scale,
      y: height / 2 + rotated.y * scale,
      z: rotated.z,
      scale,
      visible: distance - rotated.z > 80,
    };
  }

  function loadImage(node) {
    if (imageCache.has(node.image)) {
      const entry = imageCache.get(node.image);
      imageCache.delete(node.image);
      imageCache.set(node.image, entry);
      return entry.bitmap;
    }
    imageCache.set(node.image, { bitmap: null, pending: true });
    imageQueue.push(node);
    return null;
  }

  function loadQueuedImages() {
    // Decode only two SVGs at once; the scene keeps small raster thumbnails, not full SVG surfaces.
    while (isActive() && imagesLoading < 2 && imageQueue.length) {
      const node = imageQueue.shift();
      if (!imageNodeIds.has(node.id) || !state.showImages) {
        imageCache.delete(node.image);
        continue;
      }
      const entry = imageCache.get(node.image);
      const image = new Image();
      imagesLoading++;
      const complete = () => {
        imagesLoading--;
        entry.pending = false;
        while (imageCache.size > (width < 600 ? 96 : 128)) {
          const removable = [...imageCache].find(([, value]) => !value.pending);
          if (!removable) break;
          imageCache.delete(removable[0]);
        }
        requestDraw();
        loadQueuedImages();
      };
      image.onload = () => {
        const thumbnail = document.createElement("canvas");
        thumbnail.width = thumbnail.height = 160;
        thumbnail.getContext("2d").drawImage(image, 0, 0, 160, 160);
        entry.bitmap = thumbnail;
        complete();
      };
      image.onerror = complete;
      image.decoding = "async";
      image.src = node.image;
    }
  }

  function resizeCanvas() {
    const rect = els.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const nextRatio = Math.min(window.devicePixelRatio || 1, 2);
    const nextWidth = Math.max(320, Math.floor(rect.width));
    const nextHeight = Math.max(320, Math.floor(rect.height));
    if (width === nextWidth && height === nextHeight && pixelRatio === nextRatio) return;
    pixelRatio = nextRatio;
    width = nextWidth;
    height = nextHeight;
    els.canvas.width = Math.floor(width * pixelRatio);
    els.canvas.height = Math.floor(height * pixelRatio);
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    requestDraw();
  }

  function drawPath(points, strokeStyle, lineWidth = 1) {
    let started = false;
    ctx.beginPath();
    points.forEach((point) => {
      const projected = project(point);
      if (!projected.visible) {
        started = false;
        return;
      }
      if (!started) {
        ctx.moveTo(projected.x, projected.y);
        started = true;
      } else {
        ctx.lineTo(projected.x, projected.y);
      }
    });
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  function circlePoints(axis, radius, count = 144) {
    const points = [];
    for (let i = 0; i <= count; i += 1) {
      const angle = (i / count) * Math.PI * 2;
      if (axis === "xy") points.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, z: 0 });
      if (axis === "xz") points.push({ x: Math.cos(angle) * radius, y: 0, z: Math.sin(angle) * radius });
      if (axis === "yz") points.push({ x: 0, y: Math.cos(angle) * radius, z: Math.sin(angle) * radius });
    }
    return points;
  }

  const gridCircles = [150, 285, 420, 540].map(radius =>
    ["xy", "xz", "yz"].map(axis => circlePoints(axis, radius)));

  function drawGrid() {
    gridCircles.forEach(([xy, xz, yz], index) => {
      const alpha = index === 3 ? 0.24 : 0.13;
      drawPath(xy, `rgba(255, 228, 163, ${alpha})`, 1);
      drawPath(xz, `rgba(255, 240, 210, ${alpha * 0.52})`, 1);
      drawPath(yz, `rgba(144, 223, 225, ${alpha * 0.48})`, 1);
    });

    for (let i = 0; i < 24; i += 1) {
      const angle = (i / 24) * Math.PI * 2;
      drawPath(
        [
          { x: 0, y: 0, z: 0 },
          { x: Math.cos(angle) * 540, y: Math.sin(angle) * 540, z: 0 },
        ],
        "rgba(255, 255, 255, 0.08)",
        1,
      );
    }
  }

  function drawLinks() {
    if (!state.showLinks || !state.selectedId) return;
    const selected = atlas.nodes.find((node) => node.id === state.selectedId);
    if (!selected) return;
    const start = basePosition(selected);
    visibleNodes
      .filter((node) => node.id !== selected.id && (node.semantic === selected.semantic || node.roleType === selected.roleType))
      .slice(0, 80)
      .forEach((node, index) => {
        const end = basePosition(node);
        const mid = {
          x: (start.x + end.x) * 0.42,
          y: (start.y + end.y) * 0.42,
          z: (start.z + end.z) * 0.42 + 135,
        };
        const points = [];
        for (let i = 0; i <= 18; i += 1) {
          const t = i / 18;
          const a = (1 - t) * (1 - t);
          const b = 2 * (1 - t) * t;
          const c = t * t;
          points.push({
            x: start.x * a + mid.x * b + end.x * c,
            y: start.y * a + mid.y * b + end.y * c,
            z: start.z * a + mid.z * b + end.z * c,
          });
        }
        drawPath(points, index % 2 ? "rgba(255, 96, 52, 0.28)" : "rgba(144, 223, 225, 0.24)", 1);
      });
  }

  function buildScreenNodes() {
    screenNodes = visibleNodes
      .map((node) => {
        const base = basePosition(node);
        const projected = project(base);
        const isCase = atlas.meta.caseIds.includes(node.id);
        const size = (isCase ? 15 : 9) * projected.scale;
        return { node, base, ...projected, isCase, hitRadius: Math.max(8, size + 6) };
      })
      .filter((item) => item.visible && item.x > -100 && item.x < width + 100 && item.y > -100 && item.y < height + 100)
      .sort((a, b) => a.z - b.z);
  }

  function starSprite(color, isCase, selected) {
    const key = `${color}-${isCase}-${selected}`;
    if (starSprites.has(key)) return starSprites.get(key);
    const sprite = document.createElement("canvas");
    sprite.width = sprite.height = 128;
    const paint = sprite.getContext("2d");
    const glow = paint.createRadialGradient(64, 64, 0, 64, 64, 60);
    glow.addColorStop(0, colorWithAlpha(color, selected ? 0.72 : 0.45));
    glow.addColorStop(1, colorWithAlpha(color, 0));
    paint.fillStyle = glow;
    paint.fillRect(0, 0, 128, 128);
    paint.fillStyle = color;
    paint.strokeStyle = selected ? "#ffe4a3" : "rgba(255,240,210,0.72)";
    paint.lineWidth = selected ? 3 : 1.5;
    paint.beginPath();
    paint.arc(64, 64, 60 * (isCase ? 5.8 / 24 : 3.9 / 15) / 2.1, 0, Math.PI * 2);
    paint.fill();
    paint.stroke();
    starSprites.set(key, sprite);
    return sprite;
  }

  function drawNode(item) {
    const { node, x, y, z, scale, isCase } = item;
    const depthAlpha = Math.max(0.18, Math.min(1, (z + 760) / 1200));
    const color = node.color || "#aeb7c8";
    const glowSize = (isCase ? 24 : 15) * scale;
    const dotSize = (isCase ? 5.8 : 3.9) * scale;
    const isSelected = node.id === state.selectedId;

    const spriteSize = glowSize * 2.1 * 128 / 60;
    ctx.save();
    ctx.globalAlpha = depthAlpha;
    ctx.drawImage(starSprite(color, isCase, isSelected), x - spriteSize / 2, y - spriteSize / 2, spriteSize, spriteSize);
    ctx.restore();

    if (state.showImages && imageNodeIds.has(node.id)) {
      const image = loadImage(node);
      if (image) {
        const imageSize = (isCase ? 31 : 22) * scale;
        ctx.save();
        ctx.globalAlpha = Math.max(0.26, depthAlpha);
        ctx.drawImage(image, x - imageSize / 2, y - imageSize - dotSize - 5 * scale, imageSize, imageSize);
        ctx.restore();
      }
    }

    if (isSelected) {
      ctx.save();
      ctx.strokeStyle = "rgba(255, 228, 163, 0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, glowSize * 1.35, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function rebuildLabels() {
    const config = layoutMap[state.layout];
    const groups = new Map();
    visibleNodes.forEach((node) => {
      const label = node[config.field] || "未标注";
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(node);
    });
    labels = [...groups.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, state.layout === "Semantic" ? 5 : 14)
      .map(([label, nodes]) => {
        const centroid = nodes.reduce(
          (sum, node) => {
            const pos = basePosition(node);
            sum.x += pos.x;
            sum.y += pos.y;
            sum.z += pos.z;
            return sum;
          },
          { x: 0, y: 0, z: 0 },
        );
        centroid.x /= nodes.length;
        centroid.y /= nodes.length;
        centroid.z /= nodes.length;
        const length = Math.hypot(centroid.x, centroid.y, centroid.z) || 1;
        return {
          label,
          point: {
            x: (centroid.x / length) * 560,
            y: (centroid.y / length) * 560,
            z: (centroid.z / length) * 560,
          },
        };
      });
  }

  function drawLabels() {
    ctx.save();
    ctx.font = '400 13px "Nuo Sans", "PingFang SC", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    labels.forEach((item) => {
      const projected = project(item.point);
      if (!projected.visible) return;
      const alpha = Math.max(0.24, Math.min(0.86, (projected.z + 700) / 1100));
      ctx.fillStyle = `rgba(255, 240, 210, ${alpha})`;
      ctx.strokeStyle = "rgba(7, 4, 3, 0.88)";
      ctx.lineWidth = 4;
      ctx.strokeText(t(item.label), projected.x, projected.y);
      ctx.fillText(t(item.label), projected.x, projected.y);
    });
    ctx.restore();
  }

  function drawScene() {
    if (!ctx || !width || !height) return;
    rotation = { cx: Math.cos(state.rotationX), sx: Math.sin(state.rotationX), cy: Math.cos(state.rotationY), sy: Math.sin(state.rotationY) };
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#050302";
    ctx.fillRect(0, 0, width, height);

    const radial = ctx.createRadialGradient(width / 2, height / 2, 10, width / 2, height / 2, Math.max(width, height) * 0.58);
    radial.addColorStop(0, "rgba(255, 96, 52, 0.14)");
    radial.addColorStop(0.42, "rgba(255, 228, 163, 0.08)");
    radial.addColorStop(1, "rgba(5, 3, 2, 0)");
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, width, height);

    drawGrid();
    drawLinks();
    buildScreenNodes();
    imageNodeIds = new Set(screenNodes.slice(width < 600 ? -36 : -90).map((item) => item.node.id));
    atlas.meta.caseIds.forEach((id) => imageNodeIds.add(id));
    if (state.selectedId) imageNodeIds.add(state.selectedId);
    screenNodes.forEach(drawNode);
    drawLabels();
    loadQueuedImages();
  }

  function animationLoop(time) {
    frameId = 0;
    if (!isActive()) return;
    const rotating = state.autoRotate && !pointers.size;
    const elapsed = lastAnimationTime ? time - lastAnimationTime : 0;
    const animate = rotating && (!lastAnimationTime || elapsed >= (width < 600 ? 32 : 16));
    if (animate) {
      state.rotationY += Math.min(elapsed, 64) * 0.000132;
      lastAnimationTime = time;
    }
    if (needsDraw || animate) { needsDraw = false; drawScene(); }
    if (rotating) frameId = requestAnimationFrame(animationLoop);
    else lastAnimationTime = 0;
  }

  function renderLegend() {
    els.legend.replaceChildren();
    Object.entries(atlas.colors).forEach(([role, color]) => {
      const count = atlas.stats.roleType.find(([label]) => label === role)?.[1] || 0;
      const item = document.createElement("div");
      item.className = "legend-item";
      item.style.setProperty("--role-color", color);
      item.innerHTML = `<i></i><span>${role}</span><span>${count}</span>`;
      els.legend.appendChild(item);
    });
  }

  function renderFilters() {
    els.roleFilters.replaceChildren();
    atlas.stats.roleType.forEach(([role, count]) => {
      state.roles.add(role);
      const label = document.createElement("label");
      label.className = "check-item";
      label.style.setProperty("--role-color", atlas.colors[role] || "#aeb7c8");
      label.innerHTML = `
        <input type="checkbox" checked value="${role}" />
        <span><i></i>${role}</span>
        <em>${count}</em>
      `;
      label.querySelector("input").addEventListener("change", (event) => {
        if (event.target.checked) state.roles.add(role);
        else state.roles.delete(role);
        render();
      });
      els.roleFilters.appendChild(label);
    });

    atlas.stats.faceShape.forEach(([shape, count]) => {
      const option = document.createElement("option");
      option.value = shape;
      option.textContent = `${shape} / ${count}`;
      els.shapeSelect.appendChild(option);
    });

    const allChip = document.createElement("button");
    allChip.className = "chip is-active";
    allChip.type = "button";
    allChip.dataset.province = "";
    allChip.innerHTML = `全部 <em>${atlas.meta.total}</em>`;
    els.provinceFilters.appendChild(allChip);

    atlas.stats.province.forEach(([province, count]) => {
      const chip = document.createElement("button");
      chip.className = "chip";
      chip.type = "button";
      chip.dataset.province = province;
      chip.innerHTML = `${province} <em>${count}</em>`;
      els.provinceFilters.appendChild(chip);
    });

    els.provinceFilters.addEventListener("click", (event) => {
      const chip = event.target.closest(".chip");
      if (!chip) return;
      state.province = chip.dataset.province || "";
      [...els.provinceFilters.querySelectorAll(".chip")].forEach((item) => {
        item.classList.toggle("is-active", item === chip);
      });
      render();
    });
  }

  function renderCaseStrip() {
    els.caseList.replaceChildren();
    atlas.meta.caseIds
      .map((id) => atlas.nodes.find((node) => node.id === id))
      .filter(Boolean)
      .forEach((node) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `case-item${node.id === state.selectedId ? " is-active" : ""}`;
        button.innerHTML = `
          <img src="${node.image}" alt="" />
          <div class="case-name">${node.name}</div>
          <div class="case-meta">${node.region} / ${node.roleType}</div>
        `;
        button.addEventListener("click", () => {
          selectNode(node.id);
          render();
        });
        els.caseList.appendChild(button);
      });
  }

  function selectNode(id) {
    const node = atlas.nodes.find((item) => item.id === id) || atlas.nodes[0];
    if (!node) return;
    state.selectedId = node.id;
    els.detailImage.src = node.image;
    els.detailImage.alt = node.name;
    els.detailMeta.textContent = `${node.idText} / ${node.region}`;
    els.detailName.textContent = node.name || `面具 ${node.idText}`;
    els.detailTags.replaceChildren();
    [node.roleType, node.faceShape, node.semantic].filter(Boolean).forEach((tag) => {
      const span = document.createElement("span");
      span.className = "tag";
      span.textContent = tag;
      els.detailTags.appendChild(span);
    });
    els.detailFeature.textContent = t(node.feature) || t("暂无特征描述");
    els.detailColor.textContent = t(node.colorDescription) || t("暂无色彩描述");
    els.detailKeywords.textContent = node.keywords || "暂无关键词";
    sourceLink.removeAttribute("href");
    sourceLink.hidden = true;
    try {
      const source = new URL(node.detailUrl);
      if (source.protocol === "https:" || source.protocol === "http:") {
        sourceLink.href = source.href;
        sourceLink.hidden = false;
      }
    } catch (_) {
      // Keep absent or invalid archive URLs out of the clickable source link.
    }
    addReference.dataset.referenceId = node.id;
    const isReference = Boolean(window.NuoJourney?.hasReference(node.id));
    addReference.textContent = isReference ? "已加入我的参考 ✓" : "加入创作参考";
    addReference.setAttribute("aria-label", t(isReference ? "{name}已加入我的参考" : "将{name}加入创作参考", {name:t(node.name || node.idText)}));
  }

  function updateStats() {
    els.statTotal.textContent = atlas.meta.total;
    els.statVisible.textContent = visibleNodes.length;
    els.statRegions.textContent = new Set(visibleNodes.map((node) => node.province)).size;
    els.statRoles.textContent = new Set(visibleNodes.map((node) => node.roleType)).size;
  }

  function render() {
    visibleNodes = filteredNodes();
    els.layoutLabel.textContent = layoutMap[state.layout].label;
    els.chartTitle.textContent = layoutMap[state.layout].title;
    updateStats();
    rebuildLabels();
    renderCaseStrip();
    requestDraw();
  }

  window.addEventListener("nuo:language-change", () => {
    if (state.selectedId != null) selectNode(state.selectedId);
    render();
  });

  function hitTest(clientX, clientY) {
    const rect = els.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    for (let i = screenNodes.length - 1; i >= 0; i -= 1) {
      const item = screenNodes[i];
      if (Math.hypot(x - item.x, y - item.y) <= item.hitRadius) return item.node;
    }
    return null;
  }

  function showTooltip(event, node) {
    els.tooltip.hidden = false;
    els.tooltip.innerHTML = `
      <strong>${node.name || node.idText}</strong>
      <span>${node.idText} / ${node.region}</span>
      <span>${node.roleType} / ${node.faceShape || "未标注"}</span>
      <span>${trimText(t(node.keywords || node.semantic), 160)}</span>
    `;
    positionTooltip(event);
  }

  function positionTooltip(event) {
    const rect = els.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left + 18;
    const y = event.clientY - rect.top + 18;
    els.tooltip.style.left = `${Math.min(x, rect.width - 260)}px`;
    els.tooltip.style.top = `${Math.min(y, rect.height - 132)}px`;
  }

  function hideTooltip() {
    els.tooltip.hidden = true;
  }

  function beginGesture() {
    const [first, second] = pointers.values();
    gesture = first ? {
      x: first.x, y: first.y,
      rotationX: state.rotationX, rotationY: state.rotationY,
      distance: second ? Math.hypot(second.x - first.x, second.y - first.y) : 0,
      zoom: state.zoom,
    } : null;
    els.canvas.classList.toggle("is-dragging", pointers.size > 0);
  }

  function endPointer(event) {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;
    const rect = els.canvas.getBoundingClientRect();
    const wasClick = event.type === "pointerup" && pointer.canTap && !pointer.moved &&
      Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) <= 6 &&
      event.clientX >= rect.left && event.clientX <= rect.right &&
      event.clientY >= rect.top && event.clientY <= rect.bottom;
    pointers.delete(event.pointerId);
    // Rebase the remaining finger after a pinch; lifting a finger never becomes a tap.
    pointers.forEach(point => { point.canTap = false; });
    beginGesture();
    if (els.canvas.hasPointerCapture(event.pointerId)) els.canvas.releasePointerCapture(event.pointerId);
    if (wasClick) {
      const node = hitTest(event.clientX, event.clientY);
      if (node) {
        selectNode(node.id);
        render();
      }
    }
    requestDraw();
  }

  function bindEvents() {
    els.search.addEventListener("input", (event) => {
      state.search = event.target.value.trim();
      render();
    });

    els.shapeSelect.addEventListener("change", (event) => {
      state.shape = event.target.value;
      render();
    });

    document.querySelectorAll("[data-layout]").forEach((button) => {
      button.addEventListener("click", () => {
        state.layout = button.dataset.layout;
        document.querySelectorAll("[data-layout]").forEach((item) => {
          item.classList.toggle("is-active", item.dataset.layout === state.layout);
        });
        render();
      });
    });

    els.toggleImages.addEventListener("click", () => {
      state.showImages = !state.showImages;
      els.toggleImages.classList.toggle("is-on", state.showImages);
      requestDraw();
    });

    els.toggleLinks.addEventListener("click", () => {
      state.showLinks = !state.showLinks;
      els.toggleLinks.classList.toggle("is-on", state.showLinks);
      requestDraw();
    });

    els.toggleRotate.addEventListener("click", () => {
      state.autoRotate = !state.autoRotate;
      els.toggleRotate.classList.toggle("is-on", state.autoRotate);
      requestDraw();
    });

    els.resetView.addEventListener("click", () => {
      state.rotationX = -0.48;
      state.rotationY = 0.72;
      state.zoom = 1;
      requestDraw();
    });

    els.canvas.addEventListener(
      "wheel",
      (event) => {
        // Keep browser / trackpad page zoom available; only ordinary wheel input zooms the atlas.
        if (event.ctrlKey || event.metaKey || !event.deltaY) return;
        event.preventDefault();
        const nextZoom = state.zoom * (event.deltaY > 0 ? 0.92 : 1.08);
        state.zoom = Math.min(2.25, Math.max(0.55, nextZoom));
        requestDraw();
      },
      { passive: false },
    );

    els.canvas.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      pointers.set(event.pointerId, {
        x: event.clientX, y: event.clientY,
        startX: event.clientX, startY: event.clientY,
        canTap: pointers.size === 0, moved: false,
      });
      if (pointers.size > 1) pointers.forEach(point => { point.canTap = false; });
      beginGesture();
      hideTooltip();
      els.canvas.setPointerCapture(event.pointerId);
    });

    els.canvas.addEventListener("pointermove", (event) => {
      const pointer = pointers.get(event.pointerId);
      if (pointer) {
        pointer.x = event.clientX;
        pointer.y = event.clientY;
        if (Math.hypot(pointer.x - pointer.startX, pointer.y - pointer.startY) > 6) pointer.moved = true;
        const [first, second] = pointers.values();
        if (second) {
          const distance = Math.hypot(second.x - first.x, second.y - first.y);
          if (gesture.distance > 0) state.zoom = Math.min(2.25, Math.max(0.55, gesture.zoom * distance / gesture.distance));
        } else {
          state.rotationY = gesture.rotationY + (pointer.x - gesture.x) * 0.008;
          state.rotationX = Math.max(-1.35, Math.min(1.35, gesture.rotationX + (pointer.y - gesture.y) * 0.008));
        }
        requestDraw();
        hideTooltip();
        return;
      }
      if (pointers.size || event.pointerType === "touch") return;

      const node = hitTest(event.clientX, event.clientY);
      hoveredNode = node;
      els.canvas.style.cursor = node ? "pointer" : "grab";
      if (node) showTooltip(event, node);
      else hideTooltip();
    });

    ["pointerup", "pointercancel", "lostpointercapture"].forEach(type => els.canvas.addEventListener(type, endPointer));

    els.canvas.addEventListener("pointerleave", () => {
      hoveredNode = null;
      hideTooltip();
    });

    window.addEventListener("resize", resizeCanvas);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopAnimation();
      else requestDraw();
    });
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(([entry]) => {
        sceneActive = entry.isIntersecting;
        if (sceneActive) {
          resizeCanvas();
          requestDraw();
        }
        else stopAnimation();
      }, { threshold: 0.08 });
      observer.observe(els.canvas);
    }
  }

  function init() {
    if (!atlas || !atlas.nodes) {
      document.body.innerHTML = '<pre style="padding:24px;color:#fff">未找到 data/masks.js 数据文件。</pre>';
      return;
    }
    Object.entries(currentPalette).forEach(([role, color]) => {
      atlas.colors[role] = color;
    });
    atlas.nodes.forEach((node) => {
      if (currentPalette[node.roleType]) node.color = currentPalette[node.roleType];
    });
    state.selectedId = atlas.meta.caseIds[0] || atlas.nodes[0]?.id || null;
    renderFilters();
    renderLegend();
    bindEvents();
    selectNode(state.selectedId);
    visibleNodes = filteredNodes();
    resizeCanvas();
    render();
    document.fonts?.ready.then(requestDraw);
  }

  init();
  }

  const chart = document.getElementById("starChart");
  if (!chart) return;
  if ("IntersectionObserver" in window) {
    const preloadObserver = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      preloadObserver.disconnect();
      initializeArchive();
    }, { rootMargin: "240px 0px" });
    preloadObserver.observe(chart);
  } else initializeArchive();
})();
