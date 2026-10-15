(function () {
  "use strict";

  const STORAGE_PREFIX = "nuo-stickman-mask-map";
  const MOVE_KEYS = {
    up: new Set(["ArrowUp", "w", "W"]),
    down: new Set(["ArrowDown", "s", "S"]),
    left: new Set(["ArrowLeft", "a", "A"]),
    right: new Set(["ArrowRight", "d", "D"]),
  };
  const LEVEL_DEFINITIONS = [
    {
      id: "province-open",
      title: "第一关：省域初入",
      shortTitle: "第一关",
      count: 4,
      description: "从四个省级傩面具节点开始，熟悉星图地图的移动、跳跃与收集。",
    },
    {
      id: "middle-echo",
      title: "第二关：中部回响",
      shortTitle: "第二关",
      count: 4,
      description: "继续向中部节点推进，完成本关后会打开跨地域路线。",
    },
    {
      id: "mountain-border",
      title: "第三关：山川与邻境",
      shortTitle: "第三关",
      count: 4,
      description: "连接西南傩面具与东亚面具，形成第一段世界面具路径。",
    },
    {
      id: "island-mask",
      title: "第四关：海岛面具",
      shortTitle: "第四关",
      count: 2,
      description: "收集海岛与仪式面具代表，完成整张面具星图。",
    },
  ];
  const NODE_POSITIONS = [
    [-8.5, -5.7], [-4.8, -7.8], [0, -8.8], [4.8, -7.8], [8.5, -5.7],
    [10.2, -1.2], [8.4, 4.6], [4.4, 7.6], [0, 8.8], [-4.4, 7.6],
    [-8.4, 4.6], [-10.2, -1.2], [-5.8, 0.2], [5.8, 0.2],
  ];
  const MAP_THEMES = [
    { id: "hearth-village", label: "火塘村寨", accent: 0xff6034, ground: 0x5b1b12, hint: "木桩、火塘和矮栏围出第一段路线。" },
    { id: "river-bridge", label: "溪谷木桥", accent: 0x90dfe1, ground: 0x164d52, hint: "溪流会减速，沿木桥和石阶穿过去。" },
    { id: "ridge-forest", label: "山脊密林", accent: 0xadca7a, ground: 0x33401f, hint: "石脊和竹桩让路线变窄，低石可以跳过。" },
    { id: "island-ritual", label: "海岛祭场", accent: 0xd6a159, ground: 0x1d4b58, hint: "潮池、石坛和巡游火盏构成最后的环路。" },
  ];
  const TERRAIN_PATCHES = [
    { level: 0, type: "circle", x: -5.7, z: -5.8, sx: 4.0, sz: 2.5, color: 0x5b1b12, opacity: 0.34 },
    { level: 0, type: "circle", x: 0, z: -6.6, sx: 5.6, sz: 2.0, color: 0x7a2415, opacity: 0.28 },
    { level: 0, type: "box", x: 0, z: -3.7, sx: 5.0, sz: 0.32, rot: -0.08, color: 0xff6034, opacity: 0.18 },
    { level: 1, type: "box", x: 7.1, z: 2.3, sx: 1.2, sz: 8.8, rot: -0.45, color: 0x90dfe1, opacity: 0.18 },
    { level: 1, type: "box", x: 4.7, z: 5.8, sx: 4.4, sz: 0.42, rot: -0.3, color: 0xd6a159, opacity: 0.24 },
    { level: 1, type: "circle", x: 8.0, z: 2.1, sx: 3.0, sz: 3.8, color: 0x164d52, opacity: 0.26 },
    { level: 2, type: "circle", x: -4.8, z: 5.1, sx: 5.0, sz: 3.1, color: 0x33401f, opacity: 0.32 },
    { level: 2, type: "box", x: -5.8, z: 1.9, sx: 5.8, sz: 0.36, rot: 0.9, color: 0xadca7a, opacity: 0.17 },
    { level: 2, type: "box", x: -1.6, z: 6.4, sx: 4.2, sz: 0.32, rot: -0.5, color: 0xd6a159, opacity: 0.18 },
    { level: 3, type: "circle", x: -3.9, z: 0.3, sx: 3.0, sz: 2.2, color: 0x1d4b58, opacity: 0.35 },
    { level: 3, type: "circle", x: 3.9, z: 0.3, sx: 3.0, sz: 2.2, color: 0x1d4b58, opacity: 0.35 },
    { level: 3, type: "box", x: 0, z: 0.1, sx: 7.6, sz: 0.34, rot: 0, color: 0xd6a159, opacity: 0.2 },
  ];
  const OBSTACLE_DEFS = [
    { level: 0, type: "post", x: -6.9, z: -4.2, r: 0.34, h: 0.88, clearable: false },
    { level: 0, type: "post", x: -2.5, z: -4.8, r: 0.32, h: 0.82, clearable: false },
    { level: 0, type: "post", x: 2.6, z: -4.8, r: 0.32, h: 0.82, clearable: false },
    { level: 0, type: "low-log", x: 0, z: -2.75, r: 0.48, h: 0.28, clearable: true, rot: 0.1 },
    { level: 1, type: "stone", x: 7.0, z: 0.6, r: 0.48, h: 0.62, clearable: false },
    { level: 1, type: "low-log", x: 6.3, z: 3.5, r: 0.54, h: 0.26, clearable: true, rot: -0.85 },
    { level: 1, type: "stone", x: 3.0, z: 5.6, r: 0.46, h: 0.58, clearable: false },
    { level: 1, type: "post", x: 8.4, z: 5.0, r: 0.34, h: 0.84, clearable: false },
    { level: 2, type: "stone", x: -2.5, z: 5.0, r: 0.5, h: 0.72, clearable: false },
    { level: 2, type: "low-stone", x: -5.1, z: 3.6, r: 0.46, h: 0.24, clearable: true },
    { level: 2, type: "post", x: -7.3, z: 1.0, r: 0.34, h: 0.95, clearable: false },
    { level: 2, type: "low-log", x: -4.0, z: -0.7, r: 0.52, h: 0.25, clearable: true, rot: 0.75 },
    { level: 3, type: "stone", x: -3.1, z: 1.2, r: 0.5, h: 0.6, clearable: false },
    { level: 3, type: "stone", x: 3.1, z: 1.2, r: 0.5, h: 0.6, clearable: false },
    { level: 3, type: "low-stone", x: -1.7, z: -1.2, r: 0.44, h: 0.22, clearable: true },
    { level: 3, type: "low-stone", x: 1.7, z: -1.2, r: 0.44, h: 0.22, clearable: true },
  ];
  const HAZARD_DEFS = [
    { level: 0, type: "ember", x: 1.4, z: -3.65, r: 0.9, slow: 0.74 },
    { level: 1, type: "mist", x: 7.35, z: 2.5, r: 1.35, slow: 0.62 },
    { level: 1, type: "mist", x: 5.5, z: 5.2, r: 1.0, slow: 0.7 },
    { level: 2, type: "patrol", x: -5.1, z: 2.0, r: 0.42, axis: "x", range: 1.5, speed: 1.05 },
    { level: 3, type: "mist", x: -3.8, z: 0.4, r: 1.15, slow: 0.66 },
    { level: 3, type: "patrol", x: 3.8, z: 0.35, r: 0.42, axis: "z", range: 1.2, speed: 1.2 },
  ];
  const COLLECT_RADIUS = 1.18;
  const ACTIVATE_RADIUS = 1.24;
  const SHORTCUT_GROUPS = [
    { title: "移动", items: [["WASD / 方向键", "行走"], ["点击地图", "移动到目标位置"], ["空格 / J", "跳跃"]] },
    { title: "探索", items: [["E", "激活机关"], ["Enter", "收集面具 / 继续"], ["F", "追踪当前目标"]] },
    { title: "界面", items: [["P", "暂停 / 继续"], ["R", "打开重置菜单"], ["C", "回到中心"], ["1 / 2", "切换图鉴分组"], ["H / ?", "显示快捷键"], ["Esc", "关闭菜单 / 暂停"]] },
  ];
  const LEVEL_ROUTE_REQUIREMENTS = ["village-gate", "river-bridge", "forest-path", "island-ritual"];
  const MECHANISM_DEFS = [
    { id: "village-lamp-west", level: 0, type: "lamp", label: "西侧心火", x: -3.8, z: -2.45, routeId: "village-gate", to: [0, -4.75], hint: "点亮西侧心火，木栅会记住这道火纹。" },
    { id: "village-lamp-east", level: 0, type: "lamp", label: "东侧心火", x: 3.8, z: -2.45, routeId: "village-gate", to: [0, -4.75], hint: "两座心火都亮起后，南侧木栅会打开。" },
    { id: "river-plate", level: 1, type: "plate", label: "溪谷石板", x: 5.25, z: 1.55, routeId: "river-bridge", to: [7.25, 2.65], duration: 14, hint: "踩下石板，木桥会短暂升起。" },
    { id: "forest-clue", level: 2, type: "clue", label: "雾区纹路", x: -2.45, z: 4.55, routeId: "forest-path", to: [-5.6, 5.25], hint: "雾中纹路指向一条藏在山脊后的路。" },
    { id: "island-altar-west", level: 3, type: "altar", label: "西侧祭台", x: -2.55, z: -0.72, routeId: "island-ritual", to: [0, 0.18], hint: "西侧祭台回应了最后的面具。" },
    { id: "island-altar-east", level: 3, type: "altar", label: "东侧祭台", x: 2.55, z: -0.72, routeId: "island-ritual", to: [0, 0.18], hint: "两座祭台都点亮后，世界面具会显现。" },
  ];
  const ROUTE_DEFS = [
    { id: "village-gate", level: 0, type: "gate", label: "村寨木栅", x: 0, z: -4.72, requires: ["village-lamp-west", "village-lamp-east"], blockedText: "先点亮两座心火灯柱，木栅打开后再收集本关面具。" },
    { id: "river-bridge", level: 1, type: "bridge", label: "溪谷木桥", x: 7.2, z: 2.65, requires: ["river-plate"], blockedText: "先激活溪谷石板，木桥升起时再穿过去收集面具。" },
    { id: "forest-path", level: 2, type: "path", label: "山脊隐路", x: -5.5, z: 5.25, requires: ["forest-clue"], blockedText: "先在雾区激活纹路线索，隐藏小路显现后再收集面具。" },
    { id: "island-ritual", level: 3, type: "ritual", label: "海岛双祭台", x: 0, z: 0.18, requires: ["island-altar-west", "island-altar-east"], blockedText: "先点亮左右两座祭台，最后的世界面具才会显现。" },
  ];

  function detectAssetBase() {
    const script = document.currentScript;
    if (script && script.src) {
      const url = new URL(script.src, window.location.href);
      url.pathname = url.pathname.replace(/[^/]*$/, "");
      url.search = "";
      url.hash = "";
      return url.href;
    }
    return new URL("./", window.location.href).href;
  }

  function normalizeBase(base) {
    const url = new URL(base || detectAssetBase(), window.location.href);
    if (!url.pathname.endsWith("/")) url.pathname += "/";
    url.search = "";
    url.hash = "";
    return url.href;
  }

  function ensureStyles(assetBase) {
    if (document.querySelector("link[data-nuo-game-style]")) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = new URL("style.css", assetBase).href;
    link.setAttribute("data-nuo-game-style", "");
    document.head.appendChild(link);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function isTypingTarget(target) {
    return !!target && (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable);
  }

  function distance2(a, b) {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  class NuoStickmanMap {
    constructor(container, options) {
      this.container = container;
      this.options = Object.assign(
        {
          assetBase: detectAssetBase(),
          height: 640,
          sound: false,
          onScoreChange: null,
          onGameOver: null,
          onMaskCollected: null,
          onMechanismSolved: null,
        },
        options || {}
      );
      this.assetBase = normalizeBase(this.options.assetBase);
      this.height = Number(this.options.height) || 640;
      this.lowPower = window.matchMedia("(max-width: 640px)").matches || (navigator.hardwareConcurrency || 8) <= 4;
      this.collection = this.loadCollection();
      this.mechanismStates = this.loadMechanismStates();
      this.timedMechanismUntil = new Map();
      this.state = "boot";
      this.galleryFilter = "china";
      this.keys = { up: false, down: false, left: false, right: false };
      this.elapsed = 0;
      this.lastFrame = performance.now();
      this.ready = false;
      this.stageVisible = !("IntersectionObserver" in window);
      this.renderActive = false;
      this.raf = null;
      this.targetPoint = null;
      this.nearestItem = null;
      this.nearPromptItemId = null;
      this.nearestMechanism = null;
      this.nearMechanismId = null;
      this.galleryFlashId = null;
      this.galleryFlashTimer = null;
      this.collectEffects = [];
      this.selectedItem = null;
      this.dragStart = null;
      this.dragged = false;
      this.playerVelocity = { x: 0, z: 0 };
      this.jumpY = 0;
      this.jumpVelocity = 0;
      this.runPhase = 0;
      this.currentLevelIndex = 0;
      this.levels = [];
      this.textureById = new Map();
      this.nodeById = new Map();
      this.nodes = [];
      this.terrainFeatures = [];
      this.obstacles = [];
      this.hazards = [];
      this.mechanisms = [];
      this.mechanismById = new Map();
      this.routes = [];
      this.routeById = new Map();
      this.routeBlocks = [];
      this.orbitLines = [];
      this.stars = [];
      this.lastBumpTime = 0;
      this.disposables = [];
      this.animate = this.animate.bind(this);
      this.handleResize = this.handleResize.bind(this);
      this.syncVisibility = this.syncVisibility.bind(this);
      this.handleKeyDown = this.handleKeyDown.bind(this);
      this.handleKeyUp = this.handleKeyUp.bind(this);
      this.releaseKeys = () => {
        for (const direction of Object.keys(this.keys)) this.keys[direction] = false;
      };
    }

    async init() {
      this.state = "loading";
      ensureStyles(this.assetBase);
      this.renderShell();
      this.cacheElements();
      this.bindUi();

      try {
        await this.loadData();
        await this.loadThree();
        this.allMasks = [...(this.data.chinaMasks || []), ...(this.data.worldMasks || [])].map((item, index) => ({
          ...item,
          order: index,
        }));
        this.assignLevels();
        this.selectedItem = this.allMasks[0] || null;
        this.renderLevelTrack();
        this.renderGallery();
        this.buildScene();
        await this.loadTextures();
        this.setPlayerMask(this.selectedItem);
        this.createMapNodes();
        this.ready = true;
        this.state = "idle";
        this.updateHud();
        if (this.selectedItem) this.focusNode(this.selectedItem.id);
        this.setOverlay(
          "面具星图",
          "按关卡穿过不同地图，点亮心火、踩下石板、显现隐路，再收集中国傩面具与世界面具节点。点击地图移动，WASD 或方向键行走，E 激活机关，Enter 收集面具。",
          "开始探索"
        );
        this.setStatus("进入第一关，先点亮两座心火灯柱打开木栅。");
        this.syncVisibility();
      } catch (error) {
        console.error(error);
        this.state = "error";
        this.setOverlay("载入失败", "请确认本地静态服务、vendor/three.module.min.js 与 data/game-data.json 可访问。", "重新载入");
        this.setStatus("游戏载入失败。");
      }
    }

    renderShell() {
      this.root = document.createElement("div");
      this.root.className = "nuo-game-widget";
      this.root.style.minHeight = `${this.height}px`;
      this.root.innerHTML = `
        <div class="nuo-game-root" style="height:${this.height}px; min-height:${this.height}px">
          <section class="nuo-stage" data-stage tabindex="0" aria-label="面具星图闯关地图">
            <div class="nuo-canvas-slot" data-canvas-slot></div>
            <div class="nuo-hud">
              <div class="nuo-stats" aria-label="探索状态">
                <div class="nuo-stat"><span>已收集</span><strong data-collected>0/0</strong></div>
                <div class="nuo-stat"><span>当前关卡</span><strong data-level>第一关</strong></div>
                <div class="nuo-stat"><span>面具进度</span><strong data-level-progress>0/0</strong></div>
                <div class="nuo-stat"><span>机关进度</span><strong data-mechanism-progress>0/0</strong></div>
                <div class="nuo-stat"><span>当前地图</span><strong data-map-label>火塘村寨</strong></div>
                <div class="nuo-stat nuo-target-stat"><span>当前目标</span><strong data-target-mask>寻找面具</strong></div>
              </div>
              <div class="nuo-action-row">
                <button class="nuo-small-action nuo-activate-action" type="button" data-action="activate">激活</button>
                <button class="nuo-small-action nuo-collect-action" type="button" data-action="collect">收集</button>
                <button class="nuo-small-action" type="button" data-action="jump">跳跃</button>
                <button class="nuo-small-action" type="button" data-action="pause">暂停</button>
                <button class="nuo-small-action" type="button" data-action="open-reset">重置</button>
                <button class="nuo-small-action" type="button" data-action="open-shortcuts">键位</button>
              </div>
            </div>
            <div class="nuo-compass" aria-hidden="true">
              <span></span><span></span><span></span>
            </div>
            <div class="nuo-status-line" data-status role="status">正在载入。</div>
            <div class="nuo-mobile-controls" aria-label="移动与跳跃控制">
              <button class="nuo-touch-button nuo-touch-left" type="button" data-control="left" aria-label="左移"></button>
              <button class="nuo-touch-button nuo-touch-up" type="button" data-control="up" aria-label="上移"></button>
              <button class="nuo-touch-button nuo-touch-down" type="button" data-control="down" aria-label="下移"></button>
              <button class="nuo-touch-button nuo-touch-right" type="button" data-control="right" aria-label="右移"></button>
              <button class="nuo-touch-button nuo-touch-activate" type="button" data-control="activate" aria-label="激活机关">激</button>
              <button class="nuo-touch-button nuo-touch-jump" type="button" data-control="jump" aria-label="跳跃">跳</button>
            </div>
            <div class="nuo-overlay is-visible" data-overlay>
              <div class="nuo-overlay-panel">
                <h1 data-overlay-title>面具星图</h1>
                <p data-overlay-copy>正在载入矢量面具与关卡地图。</p>
                <div class="nuo-level-reward" data-level-reward hidden></div>
                <div class="nuo-overlay-actions">
                  <button class="nuo-primary-action" type="button" data-action="start">开始探索</button>
                  <button class="nuo-secondary-action" type="button" data-action="open-shortcuts">快捷键</button>
                </div>
              </div>
            </div>
            <div class="nuo-reset-menu" data-reset-menu aria-hidden="true">
              <div class="nuo-reset-panel" role="dialog" aria-modal="true" aria-labelledby="nuo-reset-title">
                <h2 id="nuo-reset-title">重置游戏</h2>
                <p>选择要重置的范围。回到中心不会改变图鉴，重置本关会保留之前关卡，重新开始全部会清空所有收集。</p>
                <div class="nuo-reset-actions">
                  <button class="nuo-reset-action" type="button" data-action="restart">回到中心</button>
                  <button class="nuo-reset-action" type="button" data-action="reset-level">重置本关</button>
                  <button class="nuo-reset-action is-danger" type="button" data-action="reset-all">重新开始全部</button>
                </div>
                <button class="nuo-reset-close" type="button" data-action="close-reset">关闭</button>
              </div>
            </div>
            <div class="nuo-shortcut-menu" data-shortcut-menu aria-hidden="true">
              <div class="nuo-shortcut-panel" role="dialog" aria-modal="true" aria-labelledby="nuo-shortcut-title">
                <h2 id="nuo-shortcut-title">快捷键</h2>
                <p>点击地图或用 Tab 选中游戏后，键盘快捷键才会生效；输入文字时不启用。移动端仍可使用下方触控按钮。</p>
                <div class="nuo-shortcut-grid">
                  ${SHORTCUT_GROUPS.map((group) => `
                    <section class="nuo-shortcut-group">
                      <h3>${escapeHtml(group.title)}</h3>
                      ${group.items.map(([key, action]) => `
                        <div class="nuo-shortcut-row">
                          <kbd>${escapeHtml(key)}</kbd>
                          <span>${escapeHtml(action)}</span>
                        </div>
                      `).join("")}
                    </section>
                  `).join("")}
                </div>
                <button class="nuo-reset-close" type="button" data-action="close-shortcuts">关闭</button>
              </div>
            </div>
          </section>
          <aside class="nuo-gallery-panel" aria-label="面具图鉴">
            <div class="nuo-gallery-head">
              <div class="nuo-gallery-title">
                <h2>面具图鉴</h2>
                <span class="nuo-gallery-count" data-gallery-count>0/0</span>
              </div>
              <div class="nuo-level-track" data-level-track aria-label="关卡进度"></div>
              <div class="nuo-gallery-tabs" role="group" aria-label="图鉴分组">
                <button class="nuo-gallery-toggle is-active" type="button" data-gallery-filter="china">中国代表</button>
                <button class="nuo-gallery-toggle" type="button" data-gallery-filter="world">世界代表</button>
              </div>
              <button class="nuo-gallery-reset" type="button" data-action="open-reset">重置进度</button>
            </div>
            <div class="nuo-mask-grid" data-gallery-grid></div>
            <div class="nuo-detail-panel" data-detail-panel></div>
          </aside>
        </div>
      `;
      this.container.innerHTML = "";
      this.container.appendChild(this.root);
    }

    cacheElements() {
      this.stage = this.root.querySelector("[data-stage]");
      this.canvasSlot = this.root.querySelector("[data-canvas-slot]");
      this.overlay = this.root.querySelector("[data-overlay]");
      this.overlayTitle = this.root.querySelector("[data-overlay-title]");
      this.overlayCopy = this.root.querySelector("[data-overlay-copy]");
      this.overlayButton = this.root.querySelector("[data-action='start']");
      this.resetMenu = this.root.querySelector("[data-reset-menu]");
      this.shortcutMenu = this.root.querySelector("[data-shortcut-menu]");
      this.collectedEl = this.root.querySelector("[data-collected]");
      this.levelEl = this.root.querySelector("[data-level]");
      this.levelProgressEl = this.root.querySelector("[data-level-progress]");
      this.mechanismProgressEl = this.root.querySelector("[data-mechanism-progress]");
      this.mapLabelEl = this.root.querySelector("[data-map-label]");
      this.targetMaskEl = this.root.querySelector("[data-target-mask]");
      this.levelRewardEl = this.root.querySelector("[data-level-reward]");
      this.statusEl = this.root.querySelector("[data-status]");
      this.galleryGrid = this.root.querySelector("[data-gallery-grid]");
      this.galleryCount = this.root.querySelector("[data-gallery-count]");
      this.detailPanel = this.root.querySelector("[data-detail-panel]");
      this.levelTrack = this.root.querySelector("[data-level-track]");
      this.pauseButton = this.root.querySelector("[data-action='pause']");
      this.collectButton = this.root.querySelector("[data-action='collect']");
      this.activateButton = this.root.querySelector("[data-action='activate']");
    }

    bindUi() {
      this.root.addEventListener("click", (event) => {
        const actionButton = event.target.closest("[data-action]");
        if (actionButton) {
          this.handleAction(actionButton.dataset.action);
          if (actionButton.dataset.action === "start") this.stage.focus({ preventScroll: true });
        }

        if (event.target === this.resetMenu) this.closeResetMenu();
        if (event.target === this.shortcutMenu) this.closeShortcutMenu();

        const filterButton = event.target.closest("[data-gallery-filter]");
        if (filterButton) this.setGalleryFilter(filterButton.dataset.galleryFilter);

        const controlButton = event.target.closest("[data-control]");
        if (controlButton) this.bumpControl(controlButton.dataset.control);

        const card = event.target.closest("[data-mask-id]");
        if (card) this.focusNode(card.dataset.maskId, true);
      });

      this.stage.addEventListener("pointerdown", (event) => {
        if (!event.target.closest("button, a, input, textarea, select, [contenteditable]")) this.stage.focus({ preventScroll: true });
        this.dragStart = { x: event.clientX, y: event.clientY };
        this.dragged = false;
      });
      this.stage.addEventListener("pointermove", (event) => {
        if (!this.dragStart) return;
        if (Math.hypot(event.clientX - this.dragStart.x, event.clientY - this.dragStart.y) > 8) this.dragged = true;
      });
      this.stage.addEventListener("pointerup", (event) => {
        if (this.dragged || !this.ready || this.state !== "running") {
          this.dragStart = null;
          return;
        }
        this.dragStart = null;
        const point = this.pickMapPoint(event.clientX, event.clientY);
        if (point) this.targetPoint = point;
      });

      this.root.addEventListener("keydown", this.handleKeyDown);
      this.root.addEventListener("keyup", this.handleKeyUp);
      this.root.addEventListener("focusout", (event) => {
        if (!this.root.contains(event.relatedTarget)) this.releaseKeys();
      });
      window.addEventListener("blur", this.releaseKeys);
      window.addEventListener("resize", this.handleResize);
      document.addEventListener("visibilitychange", this.syncVisibility);
      if ("IntersectionObserver" in window) {
        this.visibilityObserver = new IntersectionObserver(([entry]) => {
          this.stageVisible = entry.isIntersecting;
          this.syncVisibility();
        });
        this.visibilityObserver.observe(this.stage);
      }
      if ("ResizeObserver" in window) {
        this.resizeObserver = new ResizeObserver(this.handleResize);
        this.resizeObserver.observe(this.stage);
      }
    }

    handleAction(action) {
      if (action === "start") {
        if (this.state === "paused") this.resume();
        else if (this.state === "levelComplete") this.advanceLevel();
        else if (this.state === "complete") this.continueExploration();
        else if (this.state === "error") this.init();
        else this.start();
      }
      if (action === "pause") this.togglePause();
      if (action === "open-reset") this.openResetMenu();
      if (action === "close-reset") this.closeResetMenu();
      if (action === "open-shortcuts") this.openShortcutMenu();
      if (action === "close-shortcuts") this.closeShortcutMenu();
      if (action === "restart") {
        this.closeResetMenu();
        this.resetPosition();
      }
      if (action === "reset-level") this.resetLevel();
      if (action === "reset-all") this.resetAll();
      if (action === "clear-collection") this.openResetMenu();
      if (action === "activate") this.tryActivateMechanism();
      if (action === "collect") this.tryCollectNearest();
      if (action === "jump") this.jump();
    }

    handleKeyDown(event) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;
      const bounds = this.stage.getBoundingClientRect();
      if (!bounds.width || !bounds.height || bounds.bottom <= 0 || bounds.top >= window.innerHeight) return;
      const key = event.key;
      if ((key === "Enter" || key === " ") && event.target.closest("button, a, summary, [role='button']")) return;
      const shortcutOpen = this.shortcutMenu && this.shortcutMenu.classList.contains("is-visible");
      if (shortcutOpen) {
        if (key === "Escape" || key === "h" || key === "H" || key === "?") {
          this.closeShortcutMenu();
          event.preventDefault();
        }
        return;
      }
      if (key === "h" || key === "H" || key === "?") {
        this.openShortcutMenu();
        event.preventDefault();
        return;
      }
      let handled = false;
      for (const [direction, keys] of Object.entries(MOVE_KEYS)) {
        if (keys.has(key)) {
          this.keys[direction] = true;
          handled = true;
        }
      }
      if (key === " ") {
        handled = true;
        if (this.state === "idle") this.start();
        else if (this.state === "running") this.jump();
      }
      if (key === "j" || key === "J") {
        handled = true;
        if (this.state === "running") this.jump();
      }
      if (key === "e" || key === "E") {
        handled = true;
        this.tryActivateMechanism();
      }
      if (key === "Enter") {
        handled = true;
        if (["idle", "paused", "levelComplete", "complete", "error"].includes(this.state)) this.handleAction("start");
        else this.tryCollectNearest();
      }
      if (key === "p" || key === "P") {
        handled = true;
        this.togglePause();
      }
      if (key === "r" || key === "R") {
        handled = true;
        this.openResetMenu();
      }
      if (key === "c" || key === "C") {
        handled = true;
        this.resetPosition(true);
      }
      if (key === "f" || key === "F") {
        handled = true;
        this.focusCurrentObjective();
      }
      if (key === "1") {
        handled = true;
        this.setGalleryFilter("china");
      }
      if (key === "2") {
        handled = true;
        this.setGalleryFilter("world");
      }
      if (key === "Escape") {
        handled = true;
        if (this.resetMenu && this.resetMenu.classList.contains("is-visible")) this.closeResetMenu();
        else if (this.shortcutMenu && this.shortcutMenu.classList.contains("is-visible")) this.closeShortcutMenu();
        else this.togglePause();
      }
      if (handled) event.preventDefault();
    }

    handleKeyUp(event) {
      for (const [direction, keys] of Object.entries(MOVE_KEYS)) {
        if (keys.has(event.key)) this.keys[direction] = false;
      }
    }

    bumpControl(control) {
      if (!this.ready) return;
      if (control === "activate") {
        if (this.state === "idle") this.start();
        this.tryActivateMechanism();
        return;
      }
      if (control === "jump") {
        if (this.state === "idle") this.start();
        this.jump();
        return;
      }
      if (this.state === "idle") this.start();
      if (this.state !== "running") return;
      const step = 1.8;
      const current = this.player ? this.player.position : { x: 0, z: 0 };
      const point = { x: current.x, z: current.z };
      if (control === "left") point.x -= step;
      if (control === "right") point.x += step;
      if (control === "up") point.z -= step;
      if (control === "down") point.z += step;
      this.targetPoint = this.clampToMap(point);
    }

    async loadData() {
      const response = await fetch(this.assetUrl("data/game-data.json"), { cache: "no-store" });
      if (!response.ok) throw new Error(`game-data.json ${response.status}`);
      this.data = await response.json();
    }

    async loadThree() {
      this.THREE = await import(this.assetUrl("vendor/three.module.min.js"));
    }

    async loadTextures() {
      const THREE = this.THREE;
      const loader = new THREE.TextureLoader();
      const tasks = this.allMasks.map(
        (item) =>
          new Promise((resolve) => {
            loader.load(
              this.assetUrl(item.image),
              (texture) => {
                texture.colorSpace = THREE.SRGBColorSpace;
                texture.anisotropy = this.lowPower ? 2 : 8;
                this.textureById.set(item.id, texture);
                resolve();
              },
              undefined,
              () => {
                this.textureById.set(item.id, this.createFallbackTexture(item));
                resolve();
              }
            );
          })
      );
      await Promise.all(tasks);
    }

    createFallbackTexture(item) {
      const THREE = this.THREE;
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "rgba(255, 228, 163, 0.08)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "#ffe4a3";
      ctx.lineWidth = 9;
      ctx.strokeRect(26, 28, 204, 200);
      ctx.fillStyle = "#ffe4a3";
      ctx.font = '600 32px "Nuo Sans", sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(item.regionOrCountry || "面具", 128, 128);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    }

    assignLevels() {
      this.levels = LEVEL_DEFINITIONS.map((definition, index) => ({
        ...definition,
        index,
        number: index + 1,
        items: [],
      }));
      let cursor = 0;
      this.levels.forEach((level, levelIndex) => {
        const count = levelIndex === this.levels.length - 1 ? this.allMasks.length - cursor : level.count;
        for (let i = 0; i < count && cursor < this.allMasks.length; i += 1) {
          const item = this.allMasks[cursor];
          item.levelIndex = levelIndex;
          item.levelId = level.id;
          item.levelTitle = level.title;
          item.levelShortTitle = level.shortTitle;
          item.levelOrder = i + 1;
          item.levelTotal = count;
          level.items.push(item);
          cursor += 1;
        }
      });
      while (cursor < this.allMasks.length) {
        const level = this.levels[this.levels.length - 1];
        const item = this.allMasks[cursor];
        item.levelIndex = level.index;
        item.levelId = level.id;
        item.levelTitle = level.title;
        item.levelShortTitle = level.shortTitle;
        item.levelOrder = level.items.length + 1;
        item.levelTotal = level.items.length + 1;
        level.items.push(item);
        cursor += 1;
      }
      this.currentLevelIndex = this.findCurrentLevelIndex();
    }

    findCurrentLevelIndex() {
      if (!this.levels.length) return 0;
      const next = this.levels.findIndex((level) => level.items.some((item) => !this.collection.has(item.id)));
      return next === -1 ? this.levels.length - 1 : next;
    }

    getCurrentLevel() {
      return this.levels[this.currentLevelIndex] || this.levels[0];
    }

    getLevelProgress(level = this.getCurrentLevel()) {
      if (!level) return { collected: 0, total: 0 };
      const total = this.getLevelMasksRequired(level);
      const collected = level.items.filter((item) => this.collection.has(item.id)).length;
      return { collected, total };
    }

    getLevelMechanisms(level = this.getCurrentLevel()) {
      if (!level) return [];
      return MECHANISM_DEFS.filter((def) => def.level === level.index);
    }

    getMechanismProgress(level = this.getCurrentLevel()) {
      const mechanisms = this.getLevelMechanisms(level);
      const solved = mechanisms.filter((def) => this.isMechanismSolved(def.id)).length;
      return { solved, total: mechanisms.length };
    }

    getMechanismProgressLabel(level = this.getCurrentLevel()) {
      const progress = this.getMechanismProgress(level);
      const nouns = ["心火", "木桥", "线索", "祭台"];
      return `${nouns[level ? level.index : 0] || "机关"} ${progress.solved}/${progress.total}`;
    }

    getLevelMasksRequired(level = this.getCurrentLevel()) {
      return level && Array.isArray(level.items) ? level.items.length : 0;
    }

    getNextMaskTarget(level = this.getCurrentLevel()) {
      if (!level || !level.items.length) return null;
      return level.items.find((item) => !this.collection.has(item.id)) || null;
    }

    isItemAccessible(item) {
      if (!item) return false;
      if (this.collection.has(item.id) || this.state === "complete") return true;
      return this.isLevelUnlocked(item.levelIndex) && this.isItemRouteOpen(item);
    }

    isCurrentLevelComplete() {
      const level = this.getCurrentLevel();
      return !!level && this.getLevelMasksRequired(level) > 0 && level.items.every((item) => this.collection.has(item.id));
    }

    assetUrl(path) {
      return new URL(path, this.assetBase).href;
    }

    buildScene() {
      const THREE = this.THREE;
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x070403);
      this.scene.fog = new THREE.FogExp2(0x070403, 0.035);

      this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
      this.camera.position.set(0, 15.2, 16.5);

      this.renderer = new THREE.WebGLRenderer({
        antialias: !this.lowPower,
        alpha: false,
        powerPreference: this.lowPower ? "low-power" : "high-performance",
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.lowPower ? 1.15 : 1.7));
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.shadowMap.enabled = !this.lowPower;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.canvasSlot.appendChild(this.renderer.domElement);

      const ambient = new THREE.HemisphereLight(0xffe4a3, 0x120403, 1.35);
      const key = new THREE.DirectionalLight(0xffd6a1, 1.65);
      key.position.set(-6, 10, 8);
      key.castShadow = !this.lowPower;
      const red = new THREE.PointLight(0xff6034, 2.2, 22);
      red.position.set(0, 3.5, 0);
      const cyan = new THREE.PointLight(0x90dfe1, 1.1, 24);
      cyan.position.set(-8, 4, 7);
      this.scene.add(ambient, key, red, cyan);

      this.mapGroup = new THREE.Group();
      this.scene.add(this.mapGroup);
      this.createTerrain();
      this.createStarmapLines();
      this.createMapFeatures();
      this.createPlayer();
      this.createStars();
      this.handleResize();
    }

    createTerrain() {
      const THREE = this.THREE;
      const ground = new THREE.Mesh(
        this.geometry(new THREE.CircleGeometry(12.6, this.lowPower ? 64 : 112)),
        this.material(0x140806, { roughness: 0.86, metalness: 0.06, emissive: 0x080202, emissiveIntensity: 0.55 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = !this.lowPower;
      this.mapGroup.add(ground);

      for (let radius = 3.2; radius <= 12.2; radius += 3) {
        const ring = new THREE.Mesh(
          this.geometry(new THREE.TorusGeometry(radius, 0.012, 6, this.lowPower ? 80 : 160)),
          this.basicMaterial({ color: 0xffe4a3, transparent: true, opacity: radius > 9 ? 0.12 : 0.18 })
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.035;
        this.mapGroup.add(ring);
      }

      for (let i = 0; i < 24; i += 1) {
        const angle = (i / 24) * Math.PI * 2;
        const lineGeo = this.geometry(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(Math.cos(angle) * 1.4, 0.04, Math.sin(angle) * 1.4),
            new THREE.Vector3(Math.cos(angle) * 12.3, 0.04, Math.sin(angle) * 12.3),
          ])
        );
        const line = new THREE.Line(
          lineGeo,
          this.basicMaterial({ color: i % 4 === 0 ? 0xff6034 : 0xffe4a3, transparent: true, opacity: i % 4 === 0 ? 0.18 : 0.07 })
        );
        this.mapGroup.add(line);
      }
    }

    createStarmapLines() {
      const THREE = this.THREE;
      const ringPoints = NODE_POSITIONS.map(([x, z]) => new THREE.Vector3(x, 0.08, z));
      ringPoints.push(ringPoints[0].clone());
      const outer = new THREE.Line(
        this.geometry(new THREE.BufferGeometry().setFromPoints(ringPoints)),
        this.basicMaterial({ color: 0xff6034, transparent: true, opacity: 0.32 })
      );
      this.mapGroup.add(outer);
      this.orbitLines.push(outer);

      const crossPairs = [
        [0, 7], [1, 8], [2, 9], [3, 10], [4, 11], [5, 12], [6, 13],
      ];
      crossPairs.forEach(([a, b], index) => {
        if (!NODE_POSITIONS[a] || !NODE_POSITIONS[b]) return;
        const pa = NODE_POSITIONS[a];
        const pb = NODE_POSITIONS[b];
        const line = new THREE.Line(
          this.geometry(
            new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(pa[0], 0.07, pa[1]),
              new THREE.Vector3(pb[0], 0.07, pb[1]),
            ])
          ),
          this.basicMaterial({ color: index % 2 ? 0x90dfe1 : 0xffe4a3, transparent: true, opacity: 0.18 })
        );
        this.mapGroup.add(line);
        this.orbitLines.push(line);
      });
    }

    createMapFeatures() {
      this.createTerrainPatches();
      this.createObstacles();
      this.createHazards();
      this.createMechanisms();
      this.updateEnvironmentStates();
    }

    createTerrainPatches() {
      const THREE = this.THREE;
      TERRAIN_PATCHES.forEach((patch) => {
        const material = this.basicMaterial({ color: patch.color, transparent: true, opacity: patch.opacity, side: THREE.DoubleSide, depthWrite: false });
        const mesh = new THREE.Mesh(
          this.geometry(patch.type === "box" ? new THREE.PlaneGeometry(1, 1) : new THREE.CircleGeometry(0.5, this.lowPower ? 32 : 64)),
          material
        );
        mesh.rotation.x = -Math.PI / 2;
        mesh.rotation.z = patch.rot || 0;
        mesh.position.set(patch.x, 0.052 + patch.level * 0.002, patch.z);
        mesh.scale.set(patch.sx, patch.sz, 1);
        mesh.userData.baseOpacity = patch.opacity;
        this.mapGroup.add(mesh);
        this.terrainFeatures.push({ level: patch.level, mesh, material });
      });
    }

    createObstacles() {
      const THREE = this.THREE;
      OBSTACLE_DEFS.forEach((def) => {
        const theme = MAP_THEMES[def.level] || MAP_THEMES[0];
        const group = new THREE.Group();
        group.position.set(def.x, 0, def.z);

        let mesh;
        if (def.type === "low-log") {
          mesh = new THREE.Mesh(
            this.geometry(new THREE.CylinderGeometry(def.h * 0.36, def.h * 0.42, def.r * 1.8, 8)),
            this.material(0x7b4a25, { emissive: 0x1b0704, emissiveIntensity: 0.24, roughness: 0.82 })
          );
          mesh.rotation.z = Math.PI / 2;
          mesh.rotation.y = def.rot || 0;
          mesh.position.y = def.h;
        } else if (def.type === "post") {
          mesh = new THREE.Mesh(
            this.geometry(new THREE.CylinderGeometry(def.r * 0.34, def.r * 0.42, def.h, 7)),
            this.material(0x8a542c, { emissive: 0x231006, emissiveIntensity: 0.28, roughness: 0.78 })
          );
          mesh.position.y = def.h / 2;
          const cap = new THREE.Mesh(
            this.geometry(new THREE.ConeGeometry(def.r * 0.55, def.h * 0.22, 7)),
            this.material(theme.accent, { emissive: theme.accent, emissiveIntensity: 0.16, roughness: 0.7 })
          );
          cap.position.y = def.h + def.h * 0.11;
          group.add(cap);
        } else {
          mesh = new THREE.Mesh(
            this.geometry(new THREE.CylinderGeometry(def.r * 0.75, def.r * 0.95, def.h, 7)),
            this.material(def.clearable ? 0x6d5a43 : 0x514035, { emissive: 0x0b0705, emissiveIntensity: 0.18, roughness: 0.9 })
          );
          mesh.position.y = def.h / 2;
        }

        const base = new THREE.Mesh(
          this.geometry(new THREE.TorusGeometry(def.r, 0.012, 6, 36)),
          this.basicMaterial({ color: theme.accent, transparent: true, opacity: def.clearable ? 0.3 : 0.42 })
        );
        base.rotation.x = Math.PI / 2;
        base.position.y = 0.06;
        group.add(mesh, base);
        group.traverse((child) => {
          if (child.isMesh) child.castShadow = !this.lowPower;
          if (child.material && "opacity" in child.material) child.userData.baseOpacity = child.material.opacity;
        });
        this.mapGroup.add(group);
        this.obstacles.push({ ...def, group, mesh, base, baseOpacity: def.clearable ? 0.3 : 0.42, radius: def.r + 0.18 });
      });
    }

    createHazards() {
      const THREE = this.THREE;
      HAZARD_DEFS.forEach((def) => {
        const theme = MAP_THEMES[def.level] || MAP_THEMES[0];
        const group = new THREE.Group();
        group.position.set(def.x, 0, def.z);
        const color = def.type === "mist" ? 0x90dfe1 : def.type === "ember" ? 0xff6034 : theme.accent;
        const disk = new THREE.Mesh(
          this.geometry(new THREE.CircleGeometry(def.r, this.lowPower ? 32 : 56)),
          this.basicMaterial({ color, transparent: true, opacity: def.type === "patrol" ? 0.16 : 0.22, side: THREE.DoubleSide, depthWrite: false })
        );
        disk.rotation.x = -Math.PI / 2;
        disk.position.y = 0.075;
        group.add(disk);

        let core = null;
        if (def.type === "patrol") {
          core = new THREE.Mesh(
            this.geometry(new THREE.IcosahedronGeometry(0.28, 1)),
            this.material(color, { emissive: color, emissiveIntensity: 0.52, roughness: 0.5 })
          );
          core.position.y = 0.62;
          const ring = new THREE.Mesh(
            this.geometry(new THREE.TorusGeometry(0.42, 0.014, 6, 36)),
            this.basicMaterial({ color, transparent: true, opacity: 0.72 })
          );
          ring.rotation.x = Math.PI / 2;
          ring.position.y = 0.62;
          group.add(core, ring);
        } else {
          const sparks = new THREE.Mesh(
            this.geometry(new THREE.TorusGeometry(def.r * 0.68, 0.014, 6, 48)),
            this.basicMaterial({ color, transparent: true, opacity: 0.46 })
          );
          sparks.rotation.x = Math.PI / 2;
          sparks.position.y = 0.12;
          group.add(sparks);
        }
        group.traverse((child) => {
          if (child.material && "opacity" in child.material) child.userData.baseOpacity = child.material.opacity;
        });
        this.mapGroup.add(group);
        this.hazards.push({ ...def, group, disk, core, baseX: def.x, baseZ: def.z, color });
      });
    }

    createMechanisms() {
      const THREE = this.THREE;
      MECHANISM_DEFS.forEach((def) => {
        const theme = MAP_THEMES[def.level] || MAP_THEMES[0];
        const color = def.type === "plate" || def.type === "clue" ? 0x90dfe1 : def.type === "altar" ? 0xd6a159 : 0xff6034;
        const group = new THREE.Group();
        group.position.set(def.x, 0, def.z);

        const floorMaterial = this.basicMaterial({ color, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });
        const floor = new THREE.Mesh(this.geometry(new THREE.CircleGeometry(def.type === "plate" ? 0.72 : 0.64, this.lowPower ? 32 : 56)), floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0.09;

        const ringMaterial = this.basicMaterial({ color, transparent: true, opacity: 0.56 });
        const ring = new THREE.Mesh(this.geometry(new THREE.TorusGeometry(def.type === "plate" ? 0.76 : 0.64, 0.018, 6, 48)), ringMaterial);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.16;

        let core;
        if (def.type === "plate") {
          core = new THREE.Mesh(
            this.geometry(new THREE.CylinderGeometry(0.54, 0.62, 0.12, 8)),
            this.material(0x24494d, { emissive: 0x081f22, emissiveIntensity: 0.26, roughness: 0.78 })
          );
          core.position.y = 0.1;
        } else if (def.type === "clue") {
          core = new THREE.Mesh(
            this.geometry(new THREE.IcosahedronGeometry(0.34, 1)),
            this.material(0x90dfe1, { emissive: 0x2e7478, emissiveIntensity: 0.36, roughness: 0.58 })
          );
          core.position.y = 0.62;
        } else {
          core = new THREE.Mesh(
            this.geometry(new THREE.ConeGeometry(def.type === "altar" ? 0.38 : 0.28, def.type === "altar" ? 0.72 : 0.62, 8)),
            this.material(color, { emissive: color, emissiveIntensity: 0.42, roughness: 0.54 })
          );
          core.position.y = def.type === "altar" ? 0.58 : 0.64;
        }

        const pedestal = new THREE.Mesh(
          this.geometry(new THREE.CylinderGeometry(def.type === "altar" ? 0.58 : 0.38, def.type === "altar" ? 0.7 : 0.48, 0.22, 8)),
          this.material(0x2a120c, { emissive: 0x140504, emissiveIntensity: 0.22, roughness: 0.84 })
        );
        pedestal.position.y = 0.11;
        if (def.type !== "plate") group.add(pedestal);

        const light = new THREE.PointLight(color, 0.75, 4.8);
        light.position.y = 0.9;
        group.add(floor, ring, core, light);

        let link = null;
        let linkMaterial = null;
        if (def.to) {
          linkMaterial = this.basicMaterial({ color: theme.accent, transparent: true, opacity: 0.08, depthWrite: false });
          link = new THREE.Line(
            this.geometry(
              new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(def.x, 0.14, def.z),
                new THREE.Vector3(def.to[0], 0.14, def.to[1]),
              ])
            ),
            linkMaterial
          );
          this.mapGroup.add(link);
        }

        group.traverse((child) => {
          if (child.material && "opacity" in child.material) child.userData.baseOpacity = child.material.opacity;
          if (child.isMesh) child.castShadow = !this.lowPower;
        });
        this.mapGroup.add(group);
        const mechanism = { def, group, floor, floorMaterial, ring, ringMaterial, core, light, link, linkMaterial, color };
        this.mechanisms.push(mechanism);
        this.mechanismById.set(def.id, mechanism);
      });

      this.createRouteVisuals();
    }

    createRouteVisuals() {
      const THREE = this.THREE;
      ROUTE_DEFS.forEach((def) => {
        const theme = MAP_THEMES[def.level] || MAP_THEMES[0];
        const group = new THREE.Group();
        group.position.set(def.x, 0, def.z);
        let bodyMaterial = null;
        let glowMaterial = null;

        if (def.type === "gate") {
          bodyMaterial = this.material(0x7b4a25, { emissive: 0x1b0704, emissiveIntensity: 0.22, roughness: 0.82, transparent: true, opacity: 1 });
          for (let i = -1; i <= 1; i += 1) {
            const rail = new THREE.Mesh(this.geometry(new THREE.BoxGeometry(1.25, 0.18, 0.18)), bodyMaterial);
            rail.position.set(i * 1.28, 0.56, 0);
            group.add(rail);
          }
          glowMaterial = this.basicMaterial({ color: theme.accent, transparent: true, opacity: 0.24, depthWrite: false });
          const line = new THREE.Mesh(this.geometry(new THREE.PlaneGeometry(4.4, 0.18)), glowMaterial);
          line.rotation.x = -Math.PI / 2;
          line.position.y = 0.08;
          group.add(line);
          [-1.9, 0, 1.9].forEach((x) => {
            this.routeBlocks.push({ routeId: def.id, level: def.level, x: def.x + x, z: def.z, radius: 0.62, text: def.blockedText });
          });
        } else if (def.type === "bridge") {
          bodyMaterial = this.material(0x8a542c, { emissive: 0x123438, emissiveIntensity: 0.22, roughness: 0.78, transparent: true, opacity: 0.2 });
          const bridge = new THREE.Mesh(this.geometry(new THREE.BoxGeometry(1.28, 0.16, 4.6)), bodyMaterial);
          bridge.rotation.y = -0.42;
          bridge.position.y = 0.02;
          group.add(bridge);
          glowMaterial = this.basicMaterial({ color: 0x90dfe1, transparent: true, opacity: 0.16, depthWrite: false });
          const glow = new THREE.Mesh(this.geometry(new THREE.PlaneGeometry(1.56, 4.9)), glowMaterial);
          glow.rotation.x = -Math.PI / 2;
          glow.rotation.z = 0.42;
          glow.position.y = 0.09;
          group.add(glow);
        } else if (def.type === "path") {
          glowMaterial = this.basicMaterial({ color: 0xadca7a, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide });
          const path = new THREE.Mesh(this.geometry(new THREE.PlaneGeometry(1.05, 5.4)), glowMaterial);
          path.rotation.x = -Math.PI / 2;
          path.rotation.z = 0.92;
          path.position.y = 0.1;
          group.add(path);
          for (let i = 0; i < 5; i += 1) {
            const stone = new THREE.Mesh(
              this.geometry(new THREE.CylinderGeometry(0.14, 0.18, 0.08, 7)),
              this.material(0x606c38, { emissive: 0x263514, emissiveIntensity: 0.2, roughness: 0.88, transparent: true, opacity: 0.65 })
            );
            stone.position.set((i - 2) * 0.72, 0.05, Math.sin(i) * 0.24);
            group.add(stone);
          }
        } else {
          glowMaterial = this.basicMaterial({ color: 0xd6a159, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide });
          const ring = new THREE.Mesh(this.geometry(new THREE.TorusGeometry(1.55, 0.025, 8, 80)), glowMaterial);
          ring.rotation.x = Math.PI / 2;
          ring.position.y = 0.12;
          group.add(ring);
          const center = new THREE.PointLight(0xd6a159, 0.25, 6);
          center.position.y = 0.82;
          group.add(center);
        }

        group.traverse((child) => {
          if (child.material && "opacity" in child.material) child.userData.baseOpacity = child.material.opacity;
          if (child.isMesh) child.castShadow = !this.lowPower;
        });
        this.mapGroup.add(group);
        const route = { def, group, bodyMaterial, glowMaterial, lastOpen: this.isRouteOpen(def.id) };
        this.routes.push(route);
        this.routeById.set(def.id, route);
      });
    }

    isEnvironmentActive(levelIndex) {
      return this.state === "complete" || levelIndex <= this.currentLevelIndex;
    }

    isLevelUnlocked(levelIndex) {
      return this.state === "complete" || levelIndex <= this.currentLevelIndex;
    }

    getRouteForLevel(levelIndex) {
      const routeId = LEVEL_ROUTE_REQUIREMENTS[levelIndex];
      return routeId ? ROUTE_DEFS.find((route) => route.id === routeId) : null;
    }

    isMechanismSolved(id) {
      const def = MECHANISM_DEFS.find((entry) => entry.id === id);
      if (def && def.duration) return (this.timedMechanismUntil.get(id) || 0) > this.elapsed;
      return this.mechanismStates.has(id);
    }

    isRouteOpen(routeId) {
      const route = ROUTE_DEFS.find((entry) => entry.id === routeId);
      if (!route) return true;
      const level = this.levels[route.level];
      if (this.state === "complete" || (level && level.items.length && level.items.every((item) => this.collection.has(item.id)))) return true;
      return route.requires.every((id) => this.isMechanismSolved(id));
    }

    isItemRouteOpen(item) {
      if (!item || this.collection.has(item.id) || this.state === "complete") return true;
      const route = this.getRouteForLevel(item.levelIndex);
      return !route || this.isRouteOpen(route.id);
    }

    getRoutePromptForLevel(levelIndex = this.currentLevelIndex) {
      const route = this.getRouteForLevel(levelIndex);
      if (!route || this.isRouteOpen(route.id)) return "";
      return route.blockedText;
    }

    updateEnvironmentStates() {
      const fadeFuture = 0.28;
      this.terrainFeatures.forEach((feature) => {
        const active = this.isEnvironmentActive(feature.level);
        feature.material.opacity = feature.mesh.userData.baseOpacity * (active ? 1 : fadeFuture);
      });
      this.obstacles.forEach((obstacle) => {
        const active = this.isEnvironmentActive(obstacle.level);
        obstacle.group.visible = true;
        obstacle.group.traverse((child) => {
          if (child.material && "opacity" in child.material) {
            child.material.transparent = true;
            child.material.opacity = (child.userData.baseOpacity ?? 1) * (active ? 1 : 0.28);
          }
        });
        if (obstacle.base && obstacle.base.material) obstacle.base.material.opacity = obstacle.baseOpacity * (active ? 1 : 0.32);
      });
      this.hazards.forEach((hazard) => {
        const active = this.isEnvironmentActive(hazard.level);
        hazard.group.visible = true;
        hazard.group.traverse((child) => {
          if (child.material && "opacity" in child.material) {
            child.material.transparent = true;
            child.material.opacity = (child.userData.baseOpacity ?? 0.45) * (active ? 1 : 0.25);
          }
        });
      });
      this.mechanisms.forEach((mechanism) => {
        const active = this.isEnvironmentActive(mechanism.def.level);
        mechanism.group.visible = true;
        mechanism.group.traverse((child) => {
          if (child.material && "opacity" in child.material) {
            child.material.transparent = true;
            child.material.opacity = (child.userData.baseOpacity ?? 1) * (active ? 1 : 0.22);
          }
        });
        if (mechanism.linkMaterial) mechanism.linkMaterial.opacity = active ? 0.08 : 0.02;
      });
      this.routes.forEach((route) => {
        const active = this.isEnvironmentActive(route.def.level);
        route.group.visible = true;
        route.group.traverse((child) => {
          if (child.material && "opacity" in child.material) {
            child.material.transparent = true;
            child.material.opacity = (child.userData.baseOpacity ?? 1) * (active ? 1 : 0.18);
          }
        });
      });
    }

    createPlayer() {
      const THREE = this.THREE;
      this.player = new THREE.Group();
      this.player.position.set(0, 0, 0);

      const bodyMat = this.material(0xffe4a3, { emissive: 0x4a1b10, emissiveIntensity: 0.48, roughness: 0.52 });
      const redMat = this.material(0xff6034, { emissive: 0xbd251f, emissiveIntensity: 0.62, roughness: 0.56 });
      const cyanMat = this.material(0x90dfe1, { emissive: 0x144f55, emissiveIntensity: 0.52, roughness: 0.48 });
      const jointMat = this.material(0xd6a159, { emissive: 0x4a1b10, emissiveIntensity: 0.36, roughness: 0.58 });

      this.playerModel = new THREE.Group();
      this.playerModel.position.y = 0;
      this.player.add(this.playerModel);

      this.playerShadow = new THREE.Mesh(
        this.geometry(new THREE.CircleGeometry(0.42, 36)),
        this.basicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 })
      );
      this.playerShadow.rotation.x = -Math.PI / 2;
      this.playerShadow.position.y = 0.025;
      this.player.add(this.playerShadow);

      const waist = new THREE.Mesh(this.geometry(new THREE.SphereGeometry(0.09, 12, 8)), jointMat);
      waist.position.y = 0.72;
      const torso = new THREE.Mesh(this.geometry(new THREE.CylinderGeometry(0.105, 0.082, 0.88, 7)), bodyMat);
      torso.position.y = 1.16;
      torso.rotation.x = -0.04;
      const chest = new THREE.Mesh(this.geometry(new THREE.SphereGeometry(0.13, 12, 8)), bodyMat);
      chest.position.y = 1.58;
      chest.scale.set(0.9, 0.82, 0.72);
      const neck = new THREE.Mesh(this.geometry(new THREE.CylinderGeometry(0.042, 0.052, 0.15, 8)), jointMat);
      neck.position.y = 1.76;
      const head = new THREE.Mesh(this.geometry(new THREE.IcosahedronGeometry(0.18, 1)), redMat);
      head.position.y = 1.94;

      this.playerMaskMaterial = this.basicMaterial({ color: 0xffffff, transparent: true, opacity: 0.96, side: THREE.DoubleSide });
      this.playerMask = new THREE.Mesh(this.geometry(new THREE.PlaneGeometry(0.25, 0.31)), this.playerMaskMaterial);
      this.playerMask.position.set(0, 1.94, 0.18);
      this.playerMask.scale.set(0.74, 0.74, 0.74);

      this.leftArm = this.createLimb(0.52, 0.48, 0.024, bodyMat, jointMat, false);
      this.rightArm = this.createLimb(0.52, 0.48, 0.024, bodyMat, jointMat, false);
      this.leftLeg = this.createLimb(0.6, 0.56, 0.03, bodyMat, jointMat, true);
      this.rightLeg = this.createLimb(0.6, 0.56, 0.03, bodyMat, jointMat, true);
      this.leftArm.group.position.set(-0.18, 1.52, 0);
      this.rightArm.group.position.set(0.18, 1.52, 0);
      this.leftArm.group.rotation.z = -0.16;
      this.rightArm.group.rotation.z = 0.16;
      this.leftLeg.group.position.set(-0.075, 0.76, 0);
      this.rightLeg.group.position.set(0.075, 0.76, 0);
      this.leftLeg.group.rotation.z = 0.045;
      this.rightLeg.group.rotation.z = -0.045;

      this.playerHalo = new THREE.Mesh(
        this.geometry(new THREE.TorusGeometry(0.44, 0.012, 8, 58)),
        this.basicMaterial({ color: 0x90dfe1, transparent: true, opacity: 0.66 })
      );
      this.playerHalo.rotation.x = Math.PI / 2;
      this.playerHalo.position.y = 0.05;

      const shoulderBar = new THREE.Mesh(this.geometry(new THREE.CylinderGeometry(0.022, 0.026, 0.38, 6)), cyanMat);
      shoulderBar.position.y = 1.52;
      shoulderBar.rotation.z = Math.PI / 2;

      this.playerModel.add(
        waist,
        torso,
        chest,
        neck,
        head,
        this.playerMask,
        shoulderBar,
        this.leftArm.group,
        this.rightArm.group,
        this.leftLeg.group,
        this.rightLeg.group
      );
      this.player.add(this.playerHalo);
      this.player.traverse((child) => {
        if (child.isMesh) child.castShadow = !this.lowPower;
      });
      this.scene.add(this.player);
    }

    createLimb(upperLength, lowerLength, radius, limbMat, jointMat, hasFoot) {
      const THREE = this.THREE;
      const group = new THREE.Group();
      const upper = new THREE.Mesh(this.geometry(new THREE.CylinderGeometry(radius, radius * 0.82, upperLength, 6)), limbMat);
      upper.position.y = -upperLength / 2;
      const joint = new THREE.Mesh(this.geometry(new THREE.SphereGeometry(radius * 1.18, 10, 8)), jointMat);
      joint.position.y = -upperLength;

      const lowerPivot = new THREE.Group();
      lowerPivot.position.y = -upperLength;
      const lower = new THREE.Mesh(this.geometry(new THREE.CylinderGeometry(radius * 0.76, radius * 0.64, lowerLength, 6)), limbMat);
      lower.position.y = -lowerLength / 2;
      lowerPivot.add(lower);

      if (hasFoot) {
        const foot = new THREE.Mesh(this.geometry(new THREE.BoxGeometry(radius * 2.7, radius * 1.05, radius * 4.2)), jointMat);
        foot.position.set(0, -lowerLength - radius * 0.3, 0.09);
        lowerPivot.add(foot);
      } else {
        const hand = new THREE.Mesh(this.geometry(new THREE.SphereGeometry(radius * 0.92, 8, 6)), jointMat);
        hand.position.y = -lowerLength - radius * 0.5;
        lowerPivot.add(hand);
      }

      group.add(upper, joint, lowerPivot);
      return { group, upper, joint, lowerPivot };
    }

    setPlayerMask(item) {
      if (!this.playerMaskMaterial || !item) return;
      const texture = this.textureById.get(item.id);
      if (!texture) return;
      this.playerMaskMaterial.map = texture;
      this.playerMaskMaterial.color.set(0xffffff);
      this.playerMaskMaterial.needsUpdate = true;
    }

    createStars() {
      const THREE = this.THREE;
      const geo = new THREE.BufferGeometry();
      const positions = [];
      const count = this.lowPower ? 220 : 380;
      for (let i = 0; i < count; i += 1) {
        const radius = 10 + Math.random() * 46;
        const angle = Math.random() * Math.PI * 2;
        positions.push(Math.cos(angle) * radius, 1.4 + Math.random() * 18, Math.sin(angle) * radius);
      }
      geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      this.disposables.push(geo);
      const mat = new THREE.PointsMaterial({ color: 0xfff0d2, size: 0.06, transparent: true, opacity: 0.62 });
      this.disposables.push(mat);
      const points = new THREE.Points(geo, mat);
      this.scene.add(points);
      this.stars.push(points);
    }

    createMapNodes() {
      const THREE = this.THREE;
      this.nodes = [];
      this.allMasks.forEach((item, index) => {
        const [x, z] = NODE_POSITIONS[index] || [0, 0];
        item.mapX = x;
        item.mapZ = z;

        const group = new THREE.Group();
        group.position.set(x, 0, z);
        group.userData.item = item;

        const color = item.group === "china" ? 0xff6034 : 0x90dfe1;
        const pedestalMaterial = this.material(0x32110c, { emissive: 0x120403, emissiveIntensity: 0.2, roughness: 0.72 });
        const pedestal = new THREE.Mesh(this.geometry(new THREE.CylinderGeometry(0.72, 0.86, 0.36, 8)), pedestalMaterial);
        pedestal.position.y = 0.18;

        const texture = this.textureById.get(item.id) || this.createFallbackTexture(item);
        const cardMaterial = this.basicMaterial({
          map: texture,
          transparent: true,
          alphaTest: 0.02,
          side: THREE.DoubleSide,
          color: 0x8f7356,
        });
        const card = new THREE.Mesh(this.geometry(new THREE.PlaneGeometry(1.34, 1.62)), cardMaterial);
        card.position.y = 1.46;

        const ringMaterial = this.basicMaterial({ color, transparent: true, opacity: 0.5 });
        const ring = new THREE.Mesh(this.geometry(new THREE.TorusGeometry(0.98, 0.025, 8, 60)), ringMaterial);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.42;

        const lockBand = new THREE.Mesh(
          this.geometry(new THREE.TorusGeometry(1.12, 0.018, 6, 48)),
          this.basicMaterial({ color: 0xffe4a3, transparent: true, opacity: 0.12 })
        );
        lockBand.rotation.x = Math.PI / 2;
        lockBand.position.y = 0.18;

        const beacon = new THREE.PointLight(color, 0.9, 5.4);
        beacon.position.y = 1.15;
        group.add(pedestal, ring, lockBand, card, beacon);
        this.mapGroup.add(group);
        this.nodes.push({ item, group, card, ring, lockBand, pedestal, beacon, cardMaterial, ringMaterial, pedestalMaterial, color });
        this.nodeById.set(item.id, group);
      });
      this.updateNodeStates();
    }

    start() {
      if (!this.ready) return;
      this.state = "running";
      this.showOverlay(false);
      this.pauseButton.textContent = "暂停";
      const level = this.getCurrentLevel();
      const theme = MAP_THEMES[this.currentLevelIndex] || MAP_THEMES[0];
      this.updateEnvironmentStates();
      this.setStatus(`${level.title}开始。当前地图：${theme.label}。${this.getRoutePromptForLevel(level.index) || theme.hint}`);
      this.lastFrame = performance.now();
    }

    resume() {
      if (this.state !== "paused") return;
      this.state = "running";
      this.showOverlay(false);
      this.pauseButton.textContent = "暂停";
      this.lastFrame = performance.now();
    }

    continueExploration() {
      if (!this.ready) return;
      this.state = "running";
      this.showOverlay(false);
      this.pauseButton.textContent = "暂停";
      this.setStatus("整张星图已完成，可以继续自由查看所有面具节点。");
      this.lastFrame = performance.now();
    }

    togglePause() {
      if (!this.ready) return;
      if (this.resetMenu && this.resetMenu.classList.contains("is-visible")) {
        this.closeResetMenu();
        return;
      }
      if (this.state === "running") {
        this.state = "paused";
        this.setOverlay("暂停", "星图探索已暂停。", "继续");
        this.showOverlay(true);
        this.pauseButton.textContent = "继续";
      } else if (this.state === "paused") {
        this.resume();
      }
    }

    openResetMenu() {
      if (!this.ready || !this.resetMenu) return;
      if (this.shortcutMenu && this.shortcutMenu.classList.contains("is-visible")) this.closeShortcutMenu(false);
      this.resetReturnState = this.state;
      if (this.state === "running") this.state = "menu";
      this.resetMenu.classList.add("is-visible");
      this.resetMenu.setAttribute("aria-hidden", "false");
      const first = this.resetMenu.querySelector("[data-action='restart']");
      if (first) first.focus({ preventScroll: true });
      this.setStatus("选择重置范围。");
    }

    closeResetMenu(restoreState = true) {
      if (!this.resetMenu) return;
      this.resetMenu.classList.remove("is-visible");
      this.resetMenu.setAttribute("aria-hidden", "true");
      if (restoreState && this.state === "menu") {
        this.state = this.resetReturnState === "running" ? "running" : this.resetReturnState || "idle";
        if (this.state === "running") this.lastFrame = performance.now();
      }
      this.resetReturnState = null;
    }

    openShortcutMenu() {
      if (!this.ready || !this.shortcutMenu) return;
      if (this.resetMenu && this.resetMenu.classList.contains("is-visible")) this.closeResetMenu(false);
      this.shortcutReturnState = this.state;
      if (this.state === "running") this.state = "menu";
      this.shortcutMenu.classList.add("is-visible");
      this.shortcutMenu.setAttribute("aria-hidden", "false");
      const close = this.shortcutMenu.querySelector("[data-action='close-shortcuts']");
      if (close) close.focus({ preventScroll: true });
      this.setStatus("快捷键面板已打开。按 H 或 Esc 可关闭。");
    }

    closeShortcutMenu(restoreState = true) {
      if (!this.shortcutMenu) return;
      this.shortcutMenu.classList.remove("is-visible");
      this.shortcutMenu.setAttribute("aria-hidden", "true");
      if (restoreState && this.state === "menu") {
        this.state = this.shortcutReturnState === "running" ? "running" : this.shortcutReturnState || "idle";
        if (this.state === "running") this.lastFrame = performance.now();
      }
      this.shortcutReturnState = null;
    }

    resetPosition(autostart = true) {
      if (!this.player) return;
      this.player.position.set(0, 0, 0);
      this.targetPoint = null;
      this.nearPromptItemId = null;
      this.nearestMechanism = null;
      this.nearMechanismId = null;
      this.clearCollectEffects();
      this.playerVelocity = { x: 0, z: 0 };
      this.jumpY = 0;
      this.jumpVelocity = 0;
      if (this.playerModel) this.playerModel.position.y = 0;
      if (this.state === "idle" && autostart) this.start();
      this.setStatus("已回到星图中心。");
      this.updateHud();
    }

    resetLevel() {
      if (!this.ready || !this.levels.length) return;
      const level = this.getCurrentLevel();
      if (!level) return;
      level.items.forEach((item) => this.collection.delete(item.id));
      this.resetMechanismsForLevel(level.index);
      this.currentLevelIndex = level.index;
      this.selectedItem = level.items[0] || this.allMasks[0] || null;
      this.setPlayerMask(this.selectedItem);
      this.saveCollection();
      this.closeResetMenu(false);
      this.resetPosition(false);
      this.updateNodeStates();
      this.updateEnvironmentStates();
      this.renderLevelTrack();
      this.renderGallery();
      this.updateHud();
      this.state = "running";
      this.showOverlay(false);
      this.pauseButton.textContent = "暂停";
      this.setStatus(`${level.title}已重置。保留之前关卡，重新收集本关节点。`);
      this.lastFrame = performance.now();
    }

    resetAll() {
      if (!this.ready) return;
      this.collection.clear();
      this.mechanismStates.clear();
      this.timedMechanismUntil.clear();
      this.saveMechanismStates();
      this.currentLevelIndex = 0;
      this.selectedItem = this.allMasks[0] || null;
      this.setPlayerMask(this.selectedItem);
      this.saveCollection();
      this.closeResetMenu(false);
      this.resetPosition(false);
      this.updateNodeStates();
      this.updateEnvironmentStates();
      this.renderLevelTrack();
      this.renderGallery();
      this.updateHud();
      this.state = "idle";
      this.pauseButton.textContent = "暂停";
      this.setOverlay("重新开始", "全部收集和关卡进度已清空。星图回到第一关。", "开始探索");
      this.showOverlay(true);
      this.setStatus("已重新开始全部进度。");
    }

    jump() {
      if (!this.ready || this.state !== "running") return;
      if (this.jumpY > 0.03) return;
      this.jumpVelocity = 6.8;
      this.jumpY = 0.04;
      this.setStatus("跳跃中。落地后继续向面具节点移动。");
    }

    syncVisibility() {
      this.renderActive = this.ready && this.state !== "destroyed" && !document.hidden && this.stageVisible;
      if (!this.renderActive) {
        if (this.raf !== null) cancelAnimationFrame(this.raf);
        this.raf = null;
        this.releaseKeys();
        this.dragStart = null;
      } else if (this.raf === null) {
        // Visibility suspends the clock without changing a user's pause/menu state.
        this.lastFrame = performance.now();
        this.handleResize();
        this.raf = requestAnimationFrame(this.animate);
      }
    }

    animate(now) {
      this.raf = null;
      if (!this.renderActive) return;
      const dt = Math.min((now - this.lastFrame) / 1000 || 0, 0.05);
      this.lastFrame = now;
      this.elapsed += dt;

      if (this.state === "running") this.update(dt);
      else this.updateIdle(dt);

      if (this.renderer && this.scene && this.camera) this.renderer.render(this.scene, this.camera);
      this.raf = requestAnimationFrame(this.animate);
    }

    update(dt) {
      this.updatePlayer(dt);
      this.updateNodes(dt);
      this.updateCamera(dt);
      this.updateHud();
    }

    updateIdle(dt) {
      this.updateJump(dt);
      this.updatePlayerMotion(false, 0, dt);
      this.updateNodes(dt);
      this.updateCamera(dt, true);
    }

    updatePlayer(dt) {
      const input = { x: 0, z: 0 };
      if (this.keys.left) input.x -= 1;
      if (this.keys.right) input.x += 1;
      if (this.keys.up) input.z -= 1;
      if (this.keys.down) input.z += 1;

      const hasKeyboard = input.x !== 0 || input.z !== 0;
      if (hasKeyboard) this.targetPoint = null;

      if (this.targetPoint) {
        const toTarget = {
          x: this.targetPoint.x - this.player.position.x,
          z: this.targetPoint.z - this.player.position.z,
        };
        const length = Math.hypot(toTarget.x, toTarget.z);
        if (length < 0.18) {
          this.targetPoint = null;
        } else {
          input.x = toTarget.x / length;
          input.z = toTarget.z / length;
        }
      } else if (hasKeyboard) {
        const length = Math.hypot(input.x, input.z);
        input.x /= length;
        input.z /= length;
      }

      const previous = { x: this.player.position.x, z: this.player.position.z };
      const speed = (this.lowPower ? 5.0 : 5.8) * this.getHazardSpeedMultiplier();
      this.playerVelocity.x += (input.x * speed - this.playerVelocity.x) * Math.min(1, dt * 8.5);
      this.playerVelocity.z += (input.z * speed - this.playerVelocity.z) * Math.min(1, dt * 8.5);

      this.player.position.x += this.playerVelocity.x * dt;
      this.player.position.z += this.playerVelocity.z * dt;
      const clamped = this.clampToMap(this.player.position);
      this.player.position.x = clamped.x;
      this.player.position.z = clamped.z;
      this.resolveObstacleCollisions(previous);
      this.resolveRouteBlockCollisions(previous);
      this.resolveHazardCollisions();

      const moveSpeed = Math.hypot(this.playerVelocity.x, this.playerVelocity.z);
      const moving = moveSpeed > 0.08;
      if (moving) this.player.rotation.y = Math.atan2(this.playerVelocity.x, this.playerVelocity.z);
      this.updateJump(dt);
      this.updatePlayerMotion(moving, clamp(moveSpeed / speed, 0, 1), dt);

      this.nearestItem = this.findNearestItem();
      this.nearestMechanism = this.findNearestMechanism();
      this.updateMechanismPrompt();
      this.updateCollectPrompt();
    }

    getHazardSpeedMultiplier() {
      if (!this.player || this.jumpY > 0.28) return 1;
      let multiplier = 1;
      for (const hazard of this.hazards) {
        if (!this.isEnvironmentActive(hazard.level) || hazard.type === "patrol") continue;
        const dist = distance2(this.player.position, hazard.group.position);
        if (dist < hazard.r) multiplier = Math.min(multiplier, hazard.slow || 0.72);
      }
      return multiplier;
    }

    resolveObstacleCollisions(previous) {
      if (!this.player) return;
      const playerRadius = 0.22;
      for (const obstacle of this.obstacles) {
        if (!this.isEnvironmentActive(obstacle.level)) continue;
        if (obstacle.clearable && this.jumpY > 0.42) continue;
        const dx = this.player.position.x - obstacle.group.position.x;
        const dz = this.player.position.z - obstacle.group.position.z;
        const dist = Math.hypot(dx, dz);
        const minDist = obstacle.radius + playerRadius;
        if (dist >= minDist) continue;
        const fallbackX = previous.x - obstacle.group.position.x;
        const fallbackZ = previous.z - obstacle.group.position.z;
        const fallbackLength = Math.hypot(fallbackX, fallbackZ) || 1;
        const nx = dist > 0.001 ? dx / dist : fallbackX / fallbackLength;
        const nz = dist > 0.001 ? dz / dist : fallbackZ / fallbackLength;
        this.player.position.x = obstacle.group.position.x + nx * minDist;
        this.player.position.z = obstacle.group.position.z + nz * minDist;
        this.playerVelocity.x *= obstacle.clearable ? 0.35 : 0.12;
        this.playerVelocity.z *= obstacle.clearable ? 0.35 : 0.12;
        this.targetPoint = null;
        this.setBumpStatus(obstacle.clearable ? "这是矮障碍，助跑后跳跃可以越过去。" : "前方有高障碍，需要绕行。");
      }
    }

    resolveRouteBlockCollisions(previous) {
      if (!this.player || !this.routeBlocks.length) return;
      const playerRadius = 0.22;
      for (const block of this.routeBlocks) {
        if (!this.isEnvironmentActive(block.level) || this.isRouteOpen(block.routeId)) continue;
        const dx = this.player.position.x - block.x;
        const dz = this.player.position.z - block.z;
        const dist = Math.hypot(dx, dz);
        const minDist = block.radius + playerRadius;
        if (dist >= minDist) continue;
        const fallbackX = previous.x - block.x;
        const fallbackZ = previous.z - block.z;
        const fallbackLength = Math.hypot(fallbackX, fallbackZ) || 1;
        const nx = dist > 0.001 ? dx / dist : fallbackX / fallbackLength;
        const nz = dist > 0.001 ? dz / dist : fallbackZ / fallbackLength;
        this.player.position.x = block.x + nx * minDist;
        this.player.position.z = block.z + nz * minDist;
        this.playerVelocity.x *= 0.1;
        this.playerVelocity.z *= 0.1;
        this.targetPoint = null;
        this.setBumpStatus(block.text || this.getRoutePromptForLevel(block.level));
      }
    }

    resolveHazardCollisions() {
      if (!this.player || this.jumpY > 0.46) return;
      const playerRadius = 0.22;
      for (const hazard of this.hazards) {
        if (!this.isEnvironmentActive(hazard.level) || hazard.type !== "patrol") continue;
        const dx = this.player.position.x - hazard.group.position.x;
        const dz = this.player.position.z - hazard.group.position.z;
        const dist = Math.hypot(dx, dz);
        const minDist = hazard.r + playerRadius;
        if (dist >= minDist) continue;
        const nx = dist > 0.001 ? dx / dist : 1;
        const nz = dist > 0.001 ? dz / dist : 0;
        this.player.position.x = hazard.group.position.x + nx * minDist;
        this.player.position.z = hazard.group.position.z + nz * minDist;
        this.playerVelocity.x = nx * 1.8;
        this.playerVelocity.z = nz * 1.8;
        this.targetPoint = null;
        this.setBumpStatus("巡游火盏会把你弹开，跳跃或绕行更稳。");
      }
    }

    setBumpStatus(text) {
      if (performance.now() - this.lastBumpTime < 900) return;
      this.lastBumpTime = performance.now();
      this.setStatus(text);
    }

    updateJump(dt) {
      if (this.jumpY > 0 || this.jumpVelocity > 0) {
        this.jumpVelocity -= 15.5 * dt;
        this.jumpY += this.jumpVelocity * dt;
        if (this.jumpY <= 0) {
          this.jumpY = 0;
          this.jumpVelocity = 0;
        }
      }
      if (this.playerModel) this.playerModel.position.y = this.jumpY;
      if (this.playerShadow) {
        const scale = 1 - clamp(this.jumpY / 3.0, 0, 0.35);
        this.playerShadow.scale.set(scale, scale, scale);
        this.playerShadow.material.opacity = 0.25 - clamp(this.jumpY / 5, 0, 0.12);
      }
    }

    updatePlayerMotion(moving, speedRatio, dt) {
      if (!this.playerModel || !this.leftArm) return;
      this.runPhase += dt * (moving ? 8.5 + speedRatio * 6.5 : 2.5);
      const stride = Math.sin(this.runPhase);
      const counter = Math.sin(this.runPhase + Math.PI);
      const airborne = this.jumpY > 0.04;
      const amp = moving ? 0.7 + speedRatio * 0.24 : 0.07;

      this.playerModel.rotation.x = airborne ? -0.055 : moving ? -0.025 : Math.sin(this.elapsed * 1.6) * 0.01;
      this.playerModel.position.y = this.jumpY + (airborne ? 0 : Math.abs(stride) * 0.018 * speedRatio);
      this.playerHalo.rotation.z += dt * (airborne ? 2.2 : moving ? 1.75 : 0.7);

      this.leftArm.group.rotation.x = airborne ? -0.68 : stride * amp;
      this.rightArm.group.rotation.x = airborne ? 0.34 : counter * amp;
      this.leftArm.lowerPivot.rotation.x = airborne ? -0.28 : Math.max(0, -stride) * 0.52;
      this.rightArm.lowerPivot.rotation.x = airborne ? -0.44 : Math.max(0, -counter) * 0.52;

      this.leftLeg.group.rotation.x = airborne ? 0.46 : counter * amp * 0.9;
      this.rightLeg.group.rotation.x = airborne ? -0.42 : stride * amp * 0.9;
      this.leftLeg.lowerPivot.rotation.x = airborne ? 0.64 : Math.max(0, -counter) * 0.72;
      this.rightLeg.lowerPivot.rotation.x = airborne ? 0.52 : Math.max(0, -stride) * 0.72;

      this.leftArm.group.rotation.z = -0.16;
      this.rightArm.group.rotation.z = 0.16;
      this.leftLeg.group.rotation.z = 0.045;
      this.rightLeg.group.rotation.z = -0.045;
    }

    updateNodes(dt) {
      this.updateHazards(dt);
      this.updateMechanisms(dt);
      this.updateCollectEffects(dt);
      for (const node of this.nodes) {
        const collected = this.collection.has(node.item.id);
        const accessible = this.isItemAccessible(node.item);
        const selected = this.selectedItem && this.selectedItem.id === node.item.id;
        const near = this.nearestItem && this.nearestItem.id === node.item.id;
        const current = node.item.levelIndex === this.currentLevelIndex && !collected;
        const locked = !accessible && !collected;

        node.card.rotation.y = -this.camera.rotation.y;
        node.card.rotation.x = -0.15;
        node.card.position.y = 1.46 + Math.sin(this.elapsed * 1.8 + node.item.mapX) * 0.08;
        node.cardMaterial.color.set(collected ? 0xffffff : accessible ? 0xffd9a0 : 0x6f5d50);
        node.cardMaterial.opacity = collected ? 1 : accessible ? 0.72 : 0.26;
        node.ring.rotation.z += dt * (collected ? 1.45 : accessible ? 1.0 : 0.38);
        node.ring.scale.setScalar(selected || near ? 1.2 : current ? 1.08 : 1);
        node.ringMaterial.opacity = collected ? 0.95 : current ? 0.82 : accessible ? 0.54 : 0.18;
        node.lockBand.visible = locked;
        node.lockBand.rotation.z -= dt * 0.35;
        node.pedestalMaterial.color.setHex(collected ? 0xd6a159 : accessible ? 0x5b1b12 : 0x1b0b08);
        node.pedestalMaterial.emissive.setHex(collected ? 0x6a2a12 : accessible ? 0x331008 : 0x080202);
        node.beacon.intensity = collected ? 2.2 : near && accessible ? 2.1 : current ? 1.55 : accessible ? 0.9 : 0.22;
        node.group.position.y = locked ? -0.06 : 0;
      }
      for (const line of this.orbitLines) line.rotation.y += dt * 0.035;
      for (const star of this.stars) star.rotation.y += dt * 0.01;
    }

    createCollectEffect(item) {
      if (!this.THREE || !this.mapGroup || !item) return;
      const THREE = this.THREE;
      const color = item.group === "china" ? 0xff6034 : 0x90dfe1;
      const group = new THREE.Group();
      group.position.set(item.mapX, 0.16, item.mapZ);

      const ring = new THREE.Mesh(
        this.geometry(new THREE.TorusGeometry(0.64, 0.025, 8, 72)),
        this.basicMaterial({ color, transparent: true, opacity: 0.95 })
      );
      ring.rotation.x = Math.PI / 2;

      const crown = new THREE.Mesh(
        this.geometry(new THREE.TorusGeometry(0.34, 0.018, 8, 56)),
        this.basicMaterial({ color: 0xffe4a3, transparent: true, opacity: 0.86 })
      );
      crown.position.y = 1.18;
      crown.rotation.x = Math.PI / 2;

      const sparks = [];
      const sparkCount = this.lowPower ? 10 : 16;
      const sparkGeometry = this.geometry(new THREE.SphereGeometry(0.035, 8, 8));
      for (let i = 0; i < sparkCount; i += 1) {
        const angle = (Math.PI * 2 * i) / sparkCount;
        const material = this.basicMaterial({ color: i % 3 === 0 ? 0xffe4a3 : color, transparent: true, opacity: 0.94 });
        const spark = new THREE.Mesh(sparkGeometry, material);
        spark.position.set(Math.cos(angle) * 0.16, 0.72 + (i % 4) * 0.08, Math.sin(angle) * 0.16);
        spark.userData.direction = {
          x: Math.cos(angle) * (0.85 + (i % 3) * 0.18),
          y: 0.72 + (i % 5) * 0.08,
          z: Math.sin(angle) * (0.85 + (i % 3) * 0.18),
        };
        sparks.push(spark);
        group.add(spark);
      }

      group.add(ring, crown);
      this.mapGroup.add(group);
      this.collectEffects.push({ group, ring, crown, sparks, start: this.elapsed, duration: 1.15 });
    }

    createMechanismEffect(def) {
      if (!this.THREE || !this.mapGroup || !def) return;
      const THREE = this.THREE;
      const color = def.type === "plate" || def.type === "clue" ? 0x90dfe1 : def.type === "altar" ? 0xd6a159 : 0xff6034;
      const group = new THREE.Group();
      group.position.set(def.x, 0.12, def.z);
      const ring = new THREE.Mesh(
        this.geometry(new THREE.TorusGeometry(0.72, 0.022, 8, 64)),
        this.basicMaterial({ color, transparent: true, opacity: 0.86 })
      );
      ring.rotation.x = Math.PI / 2;
      const crown = new THREE.Mesh(
        this.geometry(new THREE.TorusGeometry(0.28, 0.014, 8, 48)),
        this.basicMaterial({ color: 0xffe4a3, transparent: true, opacity: 0.74 })
      );
      crown.rotation.x = Math.PI / 2;
      crown.position.y = 0.72;
      group.add(ring, crown);
      this.mapGroup.add(group);
      this.collectEffects.push({ group, ring, crown, sparks: [], start: this.elapsed, duration: 0.92 });
    }

    updateCollectEffects(dt) {
      if (!this.collectEffects.length) return;
      for (let i = this.collectEffects.length - 1; i >= 0; i -= 1) {
        const effect = this.collectEffects[i];
        const t = clamp((this.elapsed - effect.start) / effect.duration, 0, 1);
        const fade = 1 - t;
        effect.ring.scale.setScalar(1 + t * 2.35);
        effect.ring.rotation.z += dt * 2.6;
        effect.ring.material.opacity = 0.9 * fade;
        effect.crown.position.y = 1.18 + t * 0.92;
        effect.crown.scale.setScalar(1 + t * 0.78);
        effect.crown.rotation.z -= dt * 3.2;
        effect.crown.material.opacity = 0.82 * fade;
        for (const spark of effect.sparks) {
          const direction = spark.userData.direction;
          spark.position.x = direction.x * t;
          spark.position.y = 0.58 + direction.y * t + Math.sin(t * Math.PI) * 0.45;
          spark.position.z = direction.z * t;
          spark.scale.setScalar(1 + Math.sin(t * Math.PI) * 1.7);
          spark.material.opacity = 0.92 * fade;
        }
        if (t >= 1) {
          if (effect.group.parent) effect.group.parent.remove(effect.group);
          this.collectEffects.splice(i, 1);
        }
      }
    }

    clearCollectEffects() {
      if (!this.collectEffects) return;
      for (const effect of this.collectEffects) {
        if (effect.group && effect.group.parent) effect.group.parent.remove(effect.group);
      }
      this.collectEffects = [];
    }

    updateMechanisms(dt) {
      if (!this.mechanisms.length && !this.routes.length) return;
      for (const mechanism of this.mechanisms) {
        const active = this.isEnvironmentActive(mechanism.def.level);
        const solved = this.isMechanismSolved(mechanism.def.id);
        const near = this.nearestMechanism && this.nearestMechanism.def.id === mechanism.def.id;
        const pulse = 1 + Math.sin(this.elapsed * 3.2 + mechanism.def.level) * 0.035;
        mechanism.group.visible = true;
        mechanism.ring.rotation.z += dt * (solved ? 1.45 : near ? 1.2 : 0.52);
        mechanism.ring.scale.setScalar((near ? 1.18 : solved ? 1.08 : 1) * pulse);
        mechanism.ringMaterial.opacity = active ? (solved ? 0.88 : near ? 0.78 : 0.42) : 0.1;
        mechanism.floorMaterial.opacity = active ? (solved ? 0.34 : near ? 0.28 : 0.18) : 0.05;
        mechanism.core.position.y += Math.sin(this.elapsed * 2.6 + mechanism.def.x) * dt * 0.03;
        mechanism.core.rotation.y += dt * (solved ? 1.6 : 0.7);
        if (mechanism.core.material && "emissiveIntensity" in mechanism.core.material) {
          mechanism.core.material.emissiveIntensity = active ? (solved ? 0.82 : near ? 0.58 : 0.32) : 0.06;
        }
        mechanism.light.intensity = active ? (solved ? 1.65 : near ? 1.25 : 0.58) : 0.08;
        if (mechanism.linkMaterial) mechanism.linkMaterial.opacity = active ? (solved ? 0.52 : near ? 0.24 : 0.07) : 0.02;
      }

      for (const route of this.routes) {
        const active = this.isEnvironmentActive(route.def.level);
        const open = this.isRouteOpen(route.def.id);
        if (route.lastOpen !== open) {
          route.lastOpen = open;
          this.updateNodeStates();
          this.renderGallery();
        }
        const targetY = route.def.type === "gate" ? (open ? 1.08 : 0) : route.def.type === "bridge" ? (open ? 0.16 : -0.04) : 0;
        route.group.position.y += (targetY - route.group.position.y) * Math.min(1, dt * 5);
        route.group.visible = true;
        if (route.bodyMaterial) {
          route.bodyMaterial.opacity = active ? (open ? (route.def.type === "gate" ? 0.18 : 0.86) : 0.22) : 0.08;
          if ("emissiveIntensity" in route.bodyMaterial) route.bodyMaterial.emissiveIntensity = active && open ? 0.52 : 0.18;
        }
        if (route.glowMaterial) {
          route.glowMaterial.opacity = active ? (open ? 0.62 : 0.1) : 0.03;
        }
        if (open) route.group.rotation.y += route.def.type === "ritual" ? dt * 0.28 : 0;
      }
    }

    updateHazards(dt) {
      for (const hazard of this.hazards) {
        const active = this.isEnvironmentActive(hazard.level);
        if (!active) continue;
        const pulse = 0.85 + Math.sin(this.elapsed * 2.2 + hazard.level) * 0.08;
        hazard.disk.scale.set(pulse, pulse, pulse);
        hazard.disk.rotation.z += dt * (hazard.type === "patrol" ? 0.8 : 0.28);
        if (hazard.type === "patrol") {
          const offset = Math.sin(this.elapsed * hazard.speed + hazard.level) * hazard.range;
          hazard.group.position.x = hazard.baseX + (hazard.axis === "x" ? offset : 0);
          hazard.group.position.z = hazard.baseZ + (hazard.axis === "z" ? offset : 0);
          if (hazard.core) {
            hazard.core.position.y = 0.62 + Math.sin(this.elapsed * 4 + hazard.level) * 0.08;
            hazard.core.rotation.y += dt * 2.2;
          }
        }
      }
    }

    updateCamera(dt, idle) {
      if (!this.camera || !this.player) return;
      const target = this.player.position;
      const idleDrift = idle ? Math.sin(this.elapsed * 0.24) * 1.2 : 0;
      const desired = {
        x: target.x * 0.42 + idleDrift,
        y: 15.2,
        z: target.z * 0.42 + 16.5,
      };
      this.camera.position.x += (desired.x - this.camera.position.x) * Math.min(1, dt * 2.4);
      this.camera.position.y += (desired.y - this.camera.position.y) * Math.min(1, dt * 2.4);
      this.camera.position.z += (desired.z - this.camera.position.z) * Math.min(1, dt * 2.4);
      this.camera.lookAt(target.x * 0.65, 0.2 + this.jumpY * 0.18, target.z * 0.65);
    }

    clampToMap(point) {
      const radius = Math.hypot(point.x, point.z);
      const max = 11.2;
      if (radius <= max) return { x: point.x, z: point.z };
      return { x: (point.x / radius) * max, z: (point.z / radius) * max };
    }

    pickMapPoint(clientX, clientY) {
      if (!this.renderer || !this.camera) return null;
      const THREE = this.THREE;
      const rect = this.renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -(((clientY - rect.top) / rect.height) * 2 - 1));
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, this.camera);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const point = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(plane, point)) return null;
      return this.clampToMap({ x: point.x, z: point.z });
    }

    findNearestItem() {
      if (!this.allMasks || !this.player) return null;
      let nearest = null;
      let best = Infinity;
      for (const item of this.allMasks) {
        if (!this.isItemAccessible(item)) continue;
        const dist = distance2(this.player.position, { x: item.mapX, z: item.mapZ });
        if (dist < best) {
          best = dist;
          nearest = item;
        }
      }
      return nearest;
    }

    findNearestMechanism() {
      if (!this.mechanisms || !this.player) return null;
      let nearest = null;
      let best = Infinity;
      for (const mechanism of this.mechanisms) {
        if (!this.isEnvironmentActive(mechanism.def.level)) continue;
        const dist = distance2(this.player.position, { x: mechanism.def.x, z: mechanism.def.z });
        if (dist < best) {
          best = dist;
          nearest = mechanism;
        }
      }
      return best <= ACTIVATE_RADIUS ? nearest : null;
    }

    canActivateMechanism(mechanism) {
      if (!mechanism || !this.isEnvironmentActive(mechanism.def.level)) return false;
      if (mechanism.def.duration) return true;
      return !this.isMechanismSolved(mechanism.def.id);
    }

    updateMechanismPrompt() {
      if (this.state !== "running") return;
      const mechanism = this.nearestMechanism;
      if (!mechanism) {
        this.nearMechanismId = null;
        return;
      }
      if (this.nearMechanismId === mechanism.def.id) return;
      this.nearMechanismId = mechanism.def.id;
      if (this.canActivateMechanism(mechanism)) {
        this.setStatus(`已靠近${mechanism.def.label}。按 E 或点“激活”来开启机关。`);
      } else {
        this.setStatus(`${mechanism.def.label}已经点亮。${this.getRoutePromptForLevel(mechanism.def.level) || "继续寻找本关面具。"}`);
      }
    }

    tryActivateMechanism() {
      if (!this.ready) return;
      if (this.state === "idle") this.start();
      if (this.state !== "running") return;
      const mechanism = this.findNearestMechanism();
      if (!mechanism) {
        const prompt = this.getRoutePromptForLevel();
        this.setStatus(prompt || "靠近心火、石板、纹路或祭台后，再按 E 或点“激活”。");
        return;
      }
      if (!this.canActivateMechanism(mechanism)) {
        this.setStatus(`${mechanism.def.label}已经点亮。继续寻找当前目标面具。`);
        return;
      }
      if (mechanism.def.duration) {
        this.timedMechanismUntil.set(mechanism.def.id, this.elapsed + mechanism.def.duration);
      } else {
        this.mechanismStates.add(mechanism.def.id);
        this.saveMechanismStates();
      }
      this.nearestMechanism = mechanism;
      this.nearMechanismId = mechanism.def.id;
      this.createMechanismEffect(mechanism.def);
      this.updateEnvironmentStates();
      this.updateNodeStates();
      this.renderGallery();
      this.updateHud();
      const routeOpen = mechanism.def.routeId ? this.isRouteOpen(mechanism.def.routeId) : false;
      const route = mechanism.def.routeId ? ROUTE_DEFS.find((entry) => entry.id === mechanism.def.routeId) : null;
      const timed = mechanism.def.duration ? `木桥会保持 ${Math.round(mechanism.def.duration)} 秒，失败后可再次激活。` : "";
      const done = routeOpen && route ? `${route.label}已开启。` : mechanism.def.hint;
      this.setStatus(`${mechanism.def.label}已激活。${done}${timed}`);
      if (typeof this.options.onMechanismSolved === "function") {
        this.options.onMechanismSolved({
          level: this.levels[mechanism.def.level],
          mechanismId: mechanism.def.id,
          mechanism: mechanism.def,
          routeId: mechanism.def.routeId,
          routeOpen,
        });
      }
    }

    getCollectibleNearby() {
      if (!this.allMasks || !this.player) return null;
      let nearest = null;
      let best = Infinity;
      for (const item of this.allMasks) {
        if (this.collection.has(item.id) || !this.isItemAccessible(item)) continue;
        const dist = distance2(this.player.position, { x: item.mapX, z: item.mapZ });
        if (dist <= COLLECT_RADIUS && dist < best) {
          best = dist;
          nearest = item;
        }
      }
      return nearest;
    }

    updateCollectPrompt() {
      if (this.state !== "running") return;
      const item = this.getCollectibleNearby();
      if (!item) {
        this.nearPromptItemId = null;
        return;
      }
      if (this.nearPromptItemId === item.id) return;
      this.nearPromptItemId = item.id;
      this.selectedItem = item;
      this.updateNodeStates();
      this.renderGallery();
      const target = this.getNextMaskTarget();
      if (target && target.id !== item.id) {
        this.setStatus(`这里是${item.regionOrCountry}面具。当前目标是${target.regionOrCountry}，先收集它才能继续推进本关。`);
        return;
      }
      this.setStatus(`已靠近${item.regionOrCountry}面具。按 Enter 或点“收集”完成采集。`);
    }

    tryCollectNearest() {
      if (!this.ready) return;
      if (this.state === "idle") this.start();
      if (this.state !== "running") return;
      const item = this.getCollectibleNearby();
      if (!item) {
        const target = this.getNextMaskTarget();
        if (target && !this.isItemRouteOpen(target)) {
          this.setStatus(this.getRoutePromptForLevel(target.levelIndex));
          return;
        }
        this.setStatus(target ? `靠近${target.regionOrCountry}面具后，再按 Enter 或点“收集”。` : "本关面具已经收齐。");
        return;
      }
      const target = this.getNextMaskTarget();
      if (target && target.id !== item.id) {
        this.selectedItem = item;
        this.updateNodeStates();
        this.renderGallery();
        this.setStatus(`这里是${item.regionOrCountry}面具。当前目标是${target.regionOrCountry}，先收集当前目标。`);
        return;
      }
      this.collect(item);
    }

    collect(item) {
      if (!item || this.collection.has(item.id)) return;
      if (!this.isItemAccessible(item)) {
        const level = this.getCurrentLevel();
        this.setStatus(`先收齐${level.shortTitle}的面具，再解锁${item.levelShortTitle}。`);
        return;
      }
      this.createCollectEffect(item);
      this.collection.add(item.id);
      this.selectedItem = item;
      this.setPlayerMask(item);
      this.saveCollection();
      this.updateNodeStates();
      this.renderLevelTrack();
      this.flashGalleryCard(item.id);
      this.updateHud();
      const level = this.levels[item.levelIndex];
      const progress = this.getLevelProgress(level);
      const cultureLine = this.getCultureLine(item);
      this.setStatus(`${item.regionOrCountry}面具已收集。${cultureLine}`);
      if (typeof this.options.onMaskCollected === "function") {
        this.options.onMaskCollected({ item, level, progress, collected: [...this.collection], complete: progress.collected === progress.total });
      }

      if (level && item.levelIndex === this.currentLevelIndex && this.isCurrentLevelComplete()) {
        this.completeLevel(level);
      }
    }

    getCultureLine(item) {
      if (!item) return "";
      if (item.group === "china") {
        return `${item.regionOrCountry}傩面具常承载驱邪、迎福与守护的仪式含义。`;
      }
      return `${item.regionOrCountry}面具呈现当地仪式、戏剧或祈福传统中的角色身份。`;
    }

    completeLevel(level) {
      const total = this.allMasks.length;
      const collected = this.allMasks.filter((entry) => this.collection.has(entry.id)).length;
      const finalLevel = this.currentLevelIndex >= this.levels.length - 1;
      this.targetPoint = null;
      this.playerVelocity = { x: 0, z: 0 };

      if (finalLevel || collected === total) {
        this.state = "complete";
        this.pauseButton.textContent = "继续";
        this.setOverlay("面具星图完成", `全部 ${total} 张面具已经收齐。最后一组面具已归入祭台，图鉴保存在本地。`, "继续查看", level);
        this.showOverlay(true);
        this.setStatus("所有关卡完成，全部面具已收齐。");
        if (typeof this.options.onGameOver === "function") {
          this.options.onGameOver({ collected, total, complete: true });
        }
        return;
      }

      this.state = "levelComplete";
      this.pauseButton.textContent = "继续";
      const progress = this.getLevelProgress(level);
      const theme = MAP_THEMES[level.index] || MAP_THEMES[0];
      this.setOverlay(`${level.shortTitle}通关`, `${theme.label}的 ${progress.collected}/${progress.total} 张面具已收齐。它们会留在本关祭台上，下一张地图即将开放。`, "进入下一关", level);
      this.showOverlay(true);
      this.setStatus(`${level.title}通关，本关面具已收齐。`);
    }

    advanceLevel() {
      if (!this.ready) return;
      if (this.state !== "levelComplete" && !this.isCurrentLevelComplete()) {
        const target = this.getNextMaskTarget();
        this.setStatus(target ? `先收集${target.regionOrCountry}面具，收齐本关后才能进入下一关。` : "收齐本关面具后才能进入下一关。");
        return;
      }
      this.currentLevelIndex = clamp(this.currentLevelIndex + 1, 0, this.levels.length - 1);
      this.state = "running";
      this.showOverlay(false);
      this.pauseButton.textContent = "暂停";
      this.renderLevelTrack();
      this.updateNodeStates();
      this.updateEnvironmentStates();
      this.renderGallery();
      this.updateHud();
      const level = this.getCurrentLevel();
      const next = level.items.find((item) => !this.collection.has(item.id)) || level.items[0];
      if (next) this.focusNode(next.id, true);
      const theme = MAP_THEMES[this.currentLevelIndex] || MAP_THEMES[0];
      this.setStatus(`${level.title}开启。当前地图：${theme.label}。${this.getRoutePromptForLevel(level.index) || theme.hint}`);
      this.lastFrame = performance.now();
    }

    updateNodeStates() {
      if (!this.nodes.length) return;
      for (const node of this.nodes) {
        const collected = this.collection.has(node.item.id);
        const accessible = this.isItemAccessible(node.item);
        node.group.userData.locked = !accessible && !collected;
        node.cardMaterial.color.set(collected ? 0xffffff : accessible ? 0xffd9a0 : 0x6f5d50);
        node.cardMaterial.opacity = collected ? 1 : accessible ? 0.72 : 0.26;
        node.ringMaterial.opacity = collected ? 0.95 : accessible ? 0.62 : 0.18;
      }
    }

    focusCurrentObjective() {
      if (!this.ready) return;
      const level = this.getCurrentLevel();
      const route = this.getRouteForLevel(level ? level.index : this.currentLevelIndex);
      if (route && !this.isRouteOpen(route.id)) {
        const mechanism = this.mechanisms.find((entry) => entry.def.level === route.level && this.canActivateMechanism(entry));
        if (mechanism) {
          this.targetPoint = this.clampToMap({ x: mechanism.def.x, z: mechanism.def.z });
          if (this.state === "idle") this.start();
          this.setStatus(`正在前往${mechanism.def.label}。靠近后按 E 或点“激活”。`);
          return;
        }
      }
      const target = this.getNextMaskTarget(level);
      if (target) {
        this.focusNode(target.id, true);
        this.setStatus(`正在追踪${target.regionOrCountry}面具。靠近后按 Enter 或点“收集”。`);
        return;
      }
      this.setStatus(level ? `${level.shortTitle}已完成。按 Enter 进入下一关。` : "当前目标已完成。");
    }

    focusNode(id, movePlayer) {
      const item = this.allMasks ? this.allMasks.find((entry) => entry.id === id) : null;
      if (!item) return;
      this.selectedItem = item;
      this.setPlayerMask(item);
      if (movePlayer) {
        if (!this.isItemAccessible(item)) {
          const level = this.getCurrentLevel();
          if (this.isLevelUnlocked(item.levelIndex) && !this.isItemRouteOpen(item)) {
            this.setStatus(this.getRoutePromptForLevel(item.levelIndex));
          } else {
            this.setStatus(`${item.regionOrCountry}面具将在${item.levelShortTitle}开放。当前先收齐${level.shortTitle}面具。`);
          }
        } else {
          this.targetPoint = this.clampToMap({ x: item.mapX * 0.92, z: item.mapZ * 0.92 });
          if (this.state === "idle") this.start();
        }
      }
      this.updateNodeStates();
      this.renderGallery();
      this.updateHud();
    }

    updateHud() {
      const total = this.allMasks ? this.allMasks.length : 0;
      const collected = this.allMasks ? this.allMasks.filter((item) => this.collection.has(item.id)).length : 0;
      const level = this.getCurrentLevel();
      const progress = this.getLevelProgress(level);
      this.collectedEl.textContent = `${collected}/${total}`;
      this.galleryCount.textContent = `${collected}/${total}`;
      this.levelEl.textContent = level ? level.shortTitle : "无";
      this.levelProgressEl.textContent = `${progress.collected}/${progress.total}`;
      if (this.mechanismProgressEl) this.mechanismProgressEl.textContent = this.getMechanismProgressLabel(level);
      const theme = MAP_THEMES[this.currentLevelIndex] || MAP_THEMES[0];
      this.mapLabelEl.textContent = theme.label;
      const target = this.getNextMaskTarget(level);
      this.targetMaskEl.textContent = target ? `寻找${target.regionOrCountry}` : "本关已收齐";
      if (this.collectButton) {
        const nearby = this.state === "running" ? this.getCollectibleNearby() : null;
        const readyToCollect = nearby && (!target || nearby.id === target.id);
        this.collectButton.classList.toggle("is-ready", Boolean(readyToCollect));
        this.collectButton.title = readyToCollect ? `收集${nearby.regionOrCountry}面具` : "靠近当前目标面具后收集";
      }
      if (this.activateButton) {
        const readyToActivate = this.state === "running" && this.canActivateMechanism(this.nearestMechanism);
        this.activateButton.classList.toggle("is-ready", Boolean(readyToActivate));
        this.activateButton.title = readyToActivate ? `激活${this.nearestMechanism.def.label}` : "靠近机关后激活";
      }
      this.renderDetail();
      if (typeof this.options.onScoreChange === "function") {
        this.options.onScoreChange({ collected, total, selected: this.selectedItem, level, map: theme, mechanisms: this.getMechanismProgress(level) });
      }
    }

    renderLevelTrack() {
      if (!this.levelTrack || !this.levels.length) return;
      this.levelTrack.innerHTML = this.levels
        .map((level) => {
          const progress = this.getLevelProgress(level);
          const done = progress.total > 0 && progress.collected === progress.total;
          const active = level.index === this.currentLevelIndex && this.state !== "complete";
          const locked = level.index > this.currentLevelIndex && !done;
          return `
            <span class="nuo-level-dot ${done ? "is-done" : ""} ${active ? "is-active" : ""} ${locked ? "is-locked" : ""}">
              <b>${escapeHtml(level.shortTitle)}</b>
              <em>${progress.collected}/${progress.total}</em>
            </span>
          `;
        })
        .join("");
    }

    renderGallery() {
      if (!this.allMasks) return;
      const list = this.allMasks.filter((item) => item.group === this.galleryFilter);
      this.galleryGrid.innerHTML = list
        .map((item) => {
          const collected = this.collection.has(item.id);
          const selected = this.selectedItem && this.selectedItem.id === item.id;
          const accessible = this.isItemAccessible(item);
          const current = item.levelIndex === this.currentLevelIndex && !collected;
          const routeLocked = this.isLevelUnlocked(item.levelIndex) && !this.isItemRouteOpen(item);
          const stateText = collected ? item.label : accessible ? "当前关卡" : routeLocked ? "机关未开" : `${item.levelShortTitle}解锁`;
          return `
            <button class="nuo-mask-card ${collected ? "is-unlocked" : ""} ${selected ? "is-selected" : ""} ${accessible ? "is-accessible" : "is-locked"} ${current ? "is-current" : ""} ${this.galleryFlashId === item.id ? "is-flashing" : ""}" type="button" data-mask-id="${escapeHtml(item.id)}">
              <span class="nuo-mask-thumb">
                <img src="${escapeHtml(this.assetUrl(item.image))}" alt="${escapeHtml(item.label)}">
              </span>
              <span class="nuo-mask-label">
                <strong>${escapeHtml(item.regionOrCountry)}</strong>
                <span>${escapeHtml(stateText)}</span>
              </span>
            </button>
          `;
        })
        .join("");
      this.root.querySelectorAll("[data-gallery-filter]").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.galleryFilter === this.galleryFilter);
      });
      this.renderDetail();
    }

    renderDetail() {
      if (!this.detailPanel || !this.selectedItem) return;
      const item = this.selectedItem;
      const collected = this.collection.has(item.id);
      const accessible = this.isItemAccessible(item);
      const groupLabel = item.group === "china" ? "中国傩面" : "世界面具";
      const copy = collected
        ? `${item.label}。${this.getCultureLine(item)}`
        : accessible
          ? "靠近地图中的发光面具后按 Enter 或点“收集”。本关收齐后会进入通关祭台。"
          : this.isLevelUnlocked(item.levelIndex) && !this.isItemRouteOpen(item)
            ? this.getRoutePromptForLevel(item.levelIndex)
          : `收齐前面的关卡后，${item.levelShortTitle}会开放这张面具。`;
      this.detailPanel.innerHTML = `
        <small>${escapeHtml(item.levelTitle)} · ${groupLabel}</small>
        <h3>${escapeHtml(item.regionOrCountry)}</h3>
        <p>${escapeHtml(copy)}</p>
        <div class="nuo-detail-image ${collected || accessible ? "" : "is-locked"}">
          <img src="${escapeHtml(this.assetUrl(item.image))}" alt="${escapeHtml(item.label)}">
        </div>
      `;
    }

    flashGalleryCard(id) {
      const item = this.allMasks ? this.allMasks.find((entry) => entry.id === id) : null;
      if (item) this.galleryFilter = item.group;
      this.galleryFlashId = id;
      this.renderGallery();
      if (this.galleryFlashTimer) window.clearTimeout(this.galleryFlashTimer);
      this.galleryFlashTimer = window.setTimeout(() => {
        if (this.galleryFlashId !== id) return;
        this.galleryFlashId = null;
        this.renderGallery();
      }, 900);
    }

    setGalleryFilter(filter) {
      this.galleryFilter = filter;
      this.renderGallery();
    }

    clearCollection() {
      this.openResetMenu();
    }

    setOverlay(title, copy, buttonText, rewardLevel = null) {
      this.overlayTitle.textContent = title;
      this.overlayCopy.textContent = copy;
      this.overlayButton.textContent = buttonText;
      this.renderLevelReward(rewardLevel);
    }

    renderLevelReward(level) {
      if (!this.levelRewardEl) return;
      if (!level || !Array.isArray(level.items) || !level.items.length) {
        this.levelRewardEl.hidden = true;
        this.levelRewardEl.innerHTML = "";
        return;
      }
      const theme = MAP_THEMES[level.index] || MAP_THEMES[0];
      this.levelRewardEl.hidden = false;
      this.levelRewardEl.innerHTML = `
        <div class="nuo-reward-heading">
          <span>${escapeHtml(theme.label)}</span>
          <strong>${escapeHtml(level.items.length)} 张面具</strong>
        </div>
        <div class="nuo-reward-grid">
          ${level.items
            .map(
              (item) => `
                <span class="nuo-reward-card">
                  <span class="nuo-reward-thumb"><img src="${escapeHtml(this.assetUrl(item.image))}" alt="${escapeHtml(item.label)}"></span>
                  <span class="nuo-reward-meta">${escapeHtml(item.regionOrCountry)}</span>
                </span>
              `
            )
            .join("")}
        </div>
      `;
    }

    showOverlay(show) {
      if (!show) this.renderLevelReward(null);
      this.overlay.classList.toggle("is-visible", Boolean(show));
    }

    setStatus(text) {
      this.statusEl.textContent = text;
    }

    handleResize() {
      if (!this.renderer || !this.camera || !this.stage) return;
      if (!this.stage.clientWidth || !this.stage.clientHeight) return;
      const width = Math.max(320, this.stage.clientWidth);
      const height = Math.max(360, this.stage.clientHeight);
      if (this.renderWidth === width && this.renderHeight === height) return;
      this.renderWidth = width;
      this.renderHeight = height;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height, false);
    }

    material(color, options = {}) {
      const mat = new this.THREE.MeshStandardMaterial({
        color,
        roughness: options.roughness ?? 0.65,
        metalness: options.metalness ?? 0.08,
        emissive: options.emissive ?? 0x000000,
        emissiveIntensity: options.emissiveIntensity ?? 0,
        transparent: options.transparent ?? false,
        opacity: options.opacity ?? 1,
        side: options.side,
      });
      this.disposables.push(mat);
      return mat;
    }

    basicMaterial(options = {}) {
      const mat = new this.THREE.MeshBasicMaterial(options);
      this.disposables.push(mat);
      return mat;
    }

    geometry(geo) {
      this.disposables.push(geo);
      return geo;
    }

    loadCollection() {
      try {
        const raw = localStorage.getItem(`${STORAGE_PREFIX}:collection`);
        const values = raw ? JSON.parse(raw) : [];
        return new Set(Array.isArray(values) ? values : []);
      } catch {
        return new Set();
      }
    }

    saveCollection() {
      try {
        localStorage.setItem(`${STORAGE_PREFIX}:collection`, JSON.stringify([...this.collection]));
      } catch {
        // localStorage may be unavailable in strict privacy modes.
      }
    }

    loadMechanismStates() {
      try {
        const raw = localStorage.getItem(`${STORAGE_PREFIX}:mechanisms`);
        const values = raw ? JSON.parse(raw) : [];
        return new Set(Array.isArray(values) ? values : []);
      } catch {
        return new Set();
      }
    }

    saveMechanismStates() {
      try {
        localStorage.setItem(`${STORAGE_PREFIX}:mechanisms`, JSON.stringify([...this.mechanismStates]));
      } catch {
        // localStorage may be unavailable in strict privacy modes.
      }
    }

    resetMechanismsForLevel(levelIndex) {
      MECHANISM_DEFS.filter((def) => def.level === levelIndex).forEach((def) => {
        this.mechanismStates.delete(def.id);
        this.timedMechanismUntil.delete(def.id);
      });
      this.nearestMechanism = null;
      this.nearMechanismId = null;
      this.saveMechanismStates();
    }

    restart() {
      this.resetPosition();
    }

    unmount() {
      this.state = "destroyed";
      this.syncVisibility();
      if (this.galleryFlashTimer) window.clearTimeout(this.galleryFlashTimer);
      this.root.removeEventListener("keydown", this.handleKeyDown);
      this.root.removeEventListener("keyup", this.handleKeyUp);
      window.removeEventListener("blur", this.releaseKeys);
      window.removeEventListener("resize", this.handleResize);
      document.removeEventListener("visibilitychange", this.syncVisibility);
      if (this.visibilityObserver) this.visibilityObserver.disconnect();
      if (this.resizeObserver) this.resizeObserver.disconnect();
      this.destroyScene();
      if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
      this.state = "destroyed";
    }

    destroyScene() {
      this.clearCollectEffects();
      if (this.renderer) {
        this.renderer.dispose();
        if (this.renderer.domElement && this.renderer.domElement.parentNode) {
          this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
        }
      }
      for (const texture of this.textureById.values()) {
        if (texture && texture.dispose) texture.dispose();
      }
      for (const item of this.disposables) {
        if (item && item.dispose) item.dispose();
      }
      this.textureById.clear();
      this.disposables = [];
      this.nodes = [];
      this.nodeById.clear();
      this.mechanisms = [];
      this.mechanismById.clear();
      this.routes = [];
      this.routeById.clear();
      this.routeBlocks = [];
      this.scene = null;
      this.camera = null;
      this.renderer = null;
      this.renderWidth = null;
      this.renderHeight = null;
    }
  }

  function mount(target, options) {
    const container = typeof target === "string" ? document.querySelector(target) : target;
    if (!container) throw new Error("NuoStickmanGame mount target not found.");
    const game = new NuoStickmanMap(container, options || {});
    game.init();
    return {
      restart: () => game.restart(),
      resetLevel: () => game.resetLevel(),
      resetAll: () => game.resetAll(),
      unmount: () => game.unmount(),
      pause: () => game.togglePause(),
      get state() {
        return game.state;
      },
      get instance() {
        return game;
      },
    };
  }

  window.NuoStickmanGame = { mount };
})();
