(function () {
  'use strict';
  const BASE = new URL('./', document.currentScript.src).href;
  const KEY = 'nuo-map-quest-v1';
  const TILT = .68, TRAVEL_ZOOM = 2.2;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const project = ([lng,lat]) => ({x:40+(lng-73.5)*14.4,y:35+(54-lat)*17.5});
  const shortName = s => s.replace(/壮族自治区|维吾尔自治区|回族自治区|自治区|特别行政区|省|市/g,'');
  function cameraView(position,zoom,aspect) {
    const h=zoom===1?Math.max(760*TILT,1000/aspect):760*TILT/zoom,w=h*aspect;
    return zoom===1?{x:(1000-w)/2,y:(760*TILT-h)/2,w,h}:{x:position.x-w/2,y:position.y*TILT-h*.6,w,h};
  }
  function easeCamera(current,target,dt,reducedMotion=false) {
    const amount=reducedMotion?1:1-Math.exp(-2.4*Math.max(0,Math.min(dt,.1)));
    return Object.fromEntries(['x','y','w','h'].map(k=>[k,current[k]+(target[k]-current[k])*amount]));
  }
  function walkFrame(previous,travelled,dt) {
    dt=Math.max(0,Math.min(dt,.1));
    const phase=previous.phase+travelled/62*Math.PI*2,target=dt?Math.min(1,travelled/dt/78):0;
    const strength=previous.strength+(target-previous.strength)*(1-Math.exp(-14*dt));
    const stride=Math.sin(phase)*strength,lift=Math.cos(phase);
    return {phase,strength,stride,liftA:Math.max(0,lift)*strength,liftB:Math.max(0,-lift)*strength,bob:Math.abs(Math.sin(phase))*strength};
  }
  function inside(p, ring) {
    let yes=false;
    for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
      const a=ring[i],b=ring[j];
      if((a.y>p.y)!==(b.y>p.y) && p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x) yes=!yes;
    }
    return yes;
  }
  function buildMap(geo) {
    return geo.features.filter(f=>f.properties.name).map(f=>{
      const all=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
      const polygons=all.filter(p=>p[0].some(c=>c[1]>=17.5)).map(p=>p.map(r=>r.map(project)));
      const points=polygons.flat(2),bounds={minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y))};
      return {name:shortName(f.properties.name),center:project(f.properties.centroid||f.properties.center),polygons,bounds};
    });
  }
  function provinceAt(map,p) {
    if(!p || !Number.isFinite(p.x)||!Number.isFinite(p.y)) return null;
    return map.find(f=>p.x>=f.bounds.minX&&p.x<=f.bounds.maxX&&p.y>=f.bounds.minY&&p.y<=f.bounds.maxY&&f.polygons.some(poly=>inside(p,poly[0])&&!poly.slice(1).some(h=>inside(p,h)))) || null;
  }
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function findRoute(map,start,end) {
    if(!provinceAt(map,start)||!provinceAt(map,end)) return [];
    const clear=(a,b)=>{const n=Math.ceil(distance(a,b)/4);for(let i=1;i<=n;i++)if(!provinceAt(map,{x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n}))return false;return true;};
    if(clear(start,end))return [end];
    // A small on-demand grid routes around coastlines, without a pathfinding dependency.
    const step=10,cols=101,encode=(x,y)=>y*cols+x,point=k=>({x:(k%cols)*step,y:Math.floor(k/cols)*step});
    const near=p=>{const cx=Math.round(p.x/step),cy=Math.round(p.y/step);let best=null,d=Infinity;for(let y=cy-2;y<=cy+2;y++)for(let x=cx-2;x<=cx+2;x++){const q={x:x*step,y:y*step};if(x<0||x>100||y<0||y>75||!provinceAt(map,q)||!clear(p,q))continue;const t=distance(p,q);if(t<d){d=t;best=encode(x,y);}}return best;};
    const first=near(start),last=near(end);if(first===null||last===null)return [];
    const open=new Set([first]),from=new Map(),cost=new Map([[first,0]]),closed=new Set();
    while(open.size && closed.size<7500){
      let current,score=Infinity;for(const k of open){const f=cost.get(k)+distance(point(k),point(last));if(f<score){score=f;current=k;}}
      if(current===last){let k=last,path=[end,point(last)];while(from.has(k)){k=from.get(k);path.push(point(k));}path.reverse();let simplified=[],anchor=start;for(let i=0;i<path.length;){let j=path.length-1;while(j>i&&!clear(anchor,path[j]))j--;simplified.push(path[j]);anchor=path[j];i=j+1;}return simplified;}
      open.delete(current);closed.add(current);const p=point(current);
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){
        const x=p.x/step+dx,y=p.y/step+dy;if(x<0||x>100||y<0||y>75)continue;const k=encode(x,y);if(closed.has(k))continue;const q=point(k);if(!provinceAt(map,q)||!clear(p,q))continue;
        const g=cost.get(current)+distance(p,q);if(g<(cost.get(k)??Infinity)){from.set(k,current);cost.set(k,g);open.add(k);}
      }
    }
    return [];
  }
  function attempt(items,lit,province,activeId,selectedId) {
    const item=items.find(i=>i.id===selectedId);
    if(!item)return {ok:false,reason:'select'};
    if(lit.includes(item.id))return {ok:false,reason:'duplicate'};
    if(item.province!==province)return {ok:false,reason:'province'};
    if(item.id!==activeId)return {ok:false,reason:'mask'};
    return {ok:true,reason:'ok',item};
  }
  function restore(raw,items,map) {
    const lit=raw?.version===1&&Array.isArray(raw.lit)?[...new Set(raw.lit.filter(id=>items.some(i=>i.id===id)))]:[];
    const fallback=map.find(p=>p.name==='湖北').center;
    return {lit,position:raw?.version===1&&provinceAt(map,raw.position)?{x:raw.position.x,y:raw.position.y}:{...fallback}};
  }
  function propIcon(kind) {
    const shapes={
      'brush-seal':'<path d="M8 32 28 7l4 3-20 25Z" fill="#c18b4a"/><path d="m9 30-5 9 9-5" fill="#f5dfae"/><path d="M29 27h9v10H26v-7h3z" fill="#b4472e"/>',
      rulers:'<path d="m7 9 5-2 12 29-5 2zM31 7l5 2-11 29-5-2z" fill="#c08b4a"/><path d="m11 15 3-1m0 6 3-1m14-5 3 1m-6 5 3 1"/>',
      woodfish:'<ellipse cx="22" cy="28" rx="15" ry="10" fill="#a15b30"/><path d="m11 29 22-3M10 7l21 15"/><circle cx="9" cy="7" r="3" fill="#eacb83"/>',
      chisel:'<path d="m12 29 14-21 7 4-15 21z" fill="#b57d43"/><path d="m12 29-6 11 12-7" fill="#91bdc1"/>',
      axe:'<path d="m13 38 13-29" stroke="#aa7541" stroke-width="5"/><path d="M25 8 40 13 33 26 19 16Z" fill="#86aaa6"/>',
      puzzle:'<path d="M7 10h11c-4-8 12-8 8 0h11v11c-8-4-8 12 0 8v9H7V27c8 4 8-12 0-8Z" fill="#c59a56"/>',
      rain:'<path d="M10 8h24v31H10Z" fill="#385c62"/><path d="m17 15-4 6m12-6-4 6m12-6-4 6m-12 5-4 6m12-6-4 6m12-6-4 6" stroke="#b4e0dd"/>',
      altar:'<path d="M5 21h34v5H5ZM9 26v13m26-13v13" fill="#a45931"/><path d="M17 18v-8m5 8V6m5 12v-8" stroke="#dfb45b"/>',
      pair:'<path d="M5 8h34v29H5Z" fill="#83562c"/><circle cx="15" cy="19" r="5" fill="#e9c983"/><circle cx="29" cy="19" r="5" fill="#b74b2d"/><path d="M9 32c0-10 12-10 12 0m2 0c0-10 12-10 12 0"/>',
      jug:'<path d="M17 5h10v9c14 9 10 24-5 24S3 23 17 14Z" fill="#a87744"/><path d="M30 17c14-4 14 14 3 13M17 8h10M10 26h24"/>'
    };
    return `<svg viewBox="0 0 44 44" aria-hidden="true" fill="none" stroke="#f6d797" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${shapes[kind]||shapes.puzzle}</svg>`;
  }
  class MapQuest {
    constructor(container,options={}) {
      this.container=container;this.options=options;this.base=new URL(options.assetBase||BASE,location.href).href;
      this.items=window.NUO_MAP_QUEST_ITEMS;this.lit=[];this.selected='';this.active='';this.route=[];this.keys=new Set();this.visible=true;this.dead=false;this.zoom=TRAVEL_ZOOM;this.travelZoom=TRAVEL_ZOOM;this.aspect=1;this.view=null;this.motion=window.matchMedia('(prefers-reduced-motion: reduce)');
      this.inputs=new Map();this.walk={phase:0,strength:0};this.build();this.bind();this.ready=this.load();
    }
    url(path){return new URL(path,this.base).href;}
    build(){
      this.container.innerHTML=`<section class="mq-game nuo-game-widget" aria-label="傩火行旅，中国地图探索"><header class="mq-header"><div><h3>傩火行旅</h3><p class="mq-subtitle">走过山河，点亮十张傩面。</p></div><div class="mq-total"><b>0</b><span>/ 10 已点亮</span></div><button type="button" data-command="help">玩法</button><button type="button" data-command="restart">重来</button></header><div class="mq-layout"><div class="mq-world"><div class="mq-map-wrap"><svg class="mq-map" viewBox="0 0 1000 760" role="group" aria-label="中国地图，点击省份行走，方向键或WASD移动" tabindex="0"></svg><div class="mq-map-tools"><button data-command="zoom-in" aria-label="放大地图">＋</button><button data-command="zoom-out" aria-label="缩小地图">−</button><button data-command="fit">全图</button></div><div class="mq-location">正在展开地图…</div><p class="mq-loading">地图载入中</p></div></div><aside class="mq-inventory" aria-label="十件面具道具"><h4>行囊 <span>选一道具</span></h4><div class="mq-props">${this.items.map(i=>`<button type="button" class="mq-prop" data-item="${i.id}" aria-pressed="false" aria-label="选择${esc(i.prop)}">${propIcon(i.propKind)}<span>${esc(i.prop)}</span><small>未使用</small></button>`).join('')}</div></aside></div><section class="mq-encounter" aria-label="当前省份面具任务"><img class="mq-mask" alt="" hidden><div class="mq-clue"><span class="mq-place"></span><h4 class="mq-mask-name">从湖北出发</h4><p class="mq-riddle">向有灯台的省份走去，寻找第一张面具。</p><div class="mq-local-tabs" role="group" aria-label="选择本省面具"></div></div><button type="button" class="mq-use" data-command="use" disabled>使用道具</button></section><footer class="mq-footer"><p class="mq-status" role="status" aria-live="polite">抵达省份 → 观察线索 → 选择道具 → 点燃傩火</p><div class="mq-meter" aria-label="面具点亮进度">${this.items.map(i=>`<i data-light="${i.id}" title="${esc(i.name)}"></i>`).join('')}</div><button type="button" data-command="collection">面具册</button></footer><dialog class="mq-dialog" aria-label="游戏说明"><form method="dialog"><button aria-label="关闭窗口">关闭</button></form><div class="mq-dialog-body"></div></dialog></section>`;
      this.root=this.container.querySelector('.mq-game');this.svg=this.root.querySelector('.mq-map');this.dialog=this.root.querySelector('dialog');this.status=this.root.querySelector('.mq-status');
    }
    async load(){
      const loadId=this.loadId=(this.loadId||0)+1;
      try {
        const response=await fetch(this.url('data/china-provinces.geojson'));if(!response.ok)throw Error('map');const geo=await response.json();if(this.dead||loadId!==this.loadId)return this;
        this.map=buildMap(geo);let saved;try{saved=JSON.parse(localStorage.getItem(KEY));}catch(_){this.saveError=true;}
        const state=restore(saved,this.items,this.map);this.lit=state.lit;this.position=state.position;this.drawMap(geo);this.resizeView();this.setZoom(TRAVEL_ZOOM,true);this.updateProvince();this.render();
        this.root.querySelector('.mq-loading').hidden=true;if(this.saveError)this.message('可以开始探索。');this.svg.focus({preventScroll:true});this.last=performance.now();this.frame=requestAnimationFrame(t=>this.tick(t));
      } catch(_){if(!this.dead&&loadId===this.loadId){this.root.querySelector('.mq-loading').innerHTML='地图暂未载入。<button type="button" data-command="reload">重新载入</button>';this.message('请重新载入地图后开始探索。');}}
      return this;
    }
    drawMap(geo){
      const path=polys=>polys.map(poly=>poly.map(r=>'M'+r.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('L')+'Z').join('')).join('');
      const tasks=[...new Set(this.items.map(i=>i.province))];
      this.svg.innerHTML=`<defs><radialGradient id="mq-fire"><stop stop-color="#ffe4a3"/><stop offset=".5" stop-color="#ff6034"/><stop offset="1" stop-color="#ff6034" stop-opacity="0"/></radialGradient><pattern id="mq-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#ad8050" stroke-opacity=".1"/></pattern></defs><g class="mq-scene" transform="scale(1 ${TILT})"><rect x="-1500" y="-1500" width="4000" height="4000" fill="url(#mq-grid)"/><g class="mq-geography">${this.map.map(f=>`<path class="mq-edge" d="${path(f.polygons)}" transform="translate(0 7)"/>`).join('')}${this.map.map(f=>`<path class="mq-province" data-region="${f.name}" d="${path(f.polygons)}" fill-rule="evenodd" tabindex="0" role="button" aria-label="走向${f.name}"/>`).join('')}${this.map.filter(f=>!tasks.includes(f.name)&&!['香港','澳门'].includes(f.name)).map(f=>`<text class="mq-province-label" x="${f.center.x}" y="${f.center.y}">${f.name}</text>`).join('')}</g><path class="mq-route" fill="none"/><g class="mq-beacons">${tasks.map(name=>{const f=this.map.find(p=>p.name===name);return `<g class="mq-beacon" data-province="${name}" role="button" tabindex="0" aria-label="走向${name}" transform="translate(${f.center.x},${f.center.y}) scale(.8 ${.8/TILT})"><circle class="mq-glow" r="34"/><ellipse class="mq-platform" cy="7" rx="19" ry="8"/><path class="mq-flame" d="M0-21C-12-8-9 0 0 0S12-9 4-14C4-8-1-10 0-21Z"/><text y="28">${name}</text><text class="mq-beacon-count" y="43"></text></g>`;}).join('')}</g><g class="mq-player" aria-label="旅行小人"><circle class="mq-burst" r="50" fill="url(#mq-fire)"/><ellipse cx="0" cy="1" rx="12" ry="5" fill="#000" opacity=".6"/><ellipse cx="0" cy="0" rx="16" ry="6" fill="none" stroke="#90dfe1" stroke-width="1.5"/><g class="mq-person"><path class="mq-leg-a" d="M0-17-7 0"/><path class="mq-leg-b" d="M0-17 7 0"/><path d="M0-37V-17" stroke-width="5"/><path class="mq-arm-a" d="M-1-32-10-21"/><path class="mq-arm-b" d="M1-32 11-24"/><path d="M-4-36 11-33 7-26" stroke="#90dfe1"/><circle cy="-45" r="8" fill="#ff6034" stroke="#ffe4a3" stroke-width="1.5"/></g></g><circle class="mq-target" r="9" fill="none" stroke="#90dfe1" stroke-dasharray="3 3" hidden/></g>`;
      // Keep offshore geometry in an inset so the walking map stays readable.
      const offshore=geo.features.flatMap(f=>(f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates).filter(p=>p[0].every(c=>c[1]<17.5)).map(p=>p.map(r=>r.map(([x,y])=>({x:835+(x-105)*5.5,y:650+(18-y)*5.5})))));
      this.svg.querySelector('.mq-scene').insertAdjacentHTML('beforeend',`<g class="mq-inset" aria-label="南海诸岛示意"><rect x="824" y="626" width="135" height="110" rx="5"/><path d="${path(offshore)}"/><text x="892" y="647">南海诸岛</text></g><text class="mq-map-note" x="40" y="727">中国 · 傩面探索图</text>`);
      this.scene=this.svg.querySelector('.mq-scene');this.player=this.svg.querySelector('.mq-player');this.routeEl=this.svg.querySelector('.mq-route');this.target=this.svg.querySelector('.mq-target');this.person=this.svg.querySelector('.mq-person');this.limbs=['leg-a','leg-b','arm-a','arm-b'].map(n=>this.svg.querySelector('.mq-'+n));this.movePlayer();this.animatePlayer(0,0);
    }
    bind(){
      this.onClick=e=>{
        const b=e.target.closest('button');
        if(b?.dataset.item){this.selected=b.dataset.item;this.render();return;}
        if(b?.dataset.local){this.active=b.dataset.local;this.render();this.root.querySelector(`[data-local="${this.active}"]`)?.focus({preventScroll:true});return;}
        if(b?.dataset.command){const c=b.dataset.command;if(c==='use')this.use();else if(c==='help'||c==='collection'||c==='restart')this.open(c);else if(c==='reset')this.reset();else if(c==='reload')this.ready=this.load();else if(c==='zoom-in')this.setZoom(this.zoom*1.45);else if(c==='zoom-out')this.setZoom(this.zoom/1.45);else if(c==='fit')this.setZoom(this.zoom===1?this.travelZoom:1);return;}
        if(!this.map||!this.svg.contains(e.target))return;
        const region=e.target.closest('[data-province]');if(region){const name=region.dataset.province;this.walkTo(this.map.find(p=>p.name===name).center);return;}
        const p=this.svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const q=p.matrixTransform(this.scene.getScreenCTM().inverse());this.walkTo(q);
      };
      this.root.addEventListener('click',this.onClick);
      this.onKey=e=>{
        if(this.dialog.open||e.target.matches('input,textarea,select'))return;
        const directions={ArrowUp:'up',w:'up',W:'up',ArrowDown:'down',s:'down',S:'down',ArrowLeft:'left',a:'left',A:'left',ArrowRight:'right',d:'right',D:'right'};
        if(directions[e.key]&&this.map){e.preventDefault();this.svg.focus({preventScroll:true});if(!e.repeat)this.startInput('key:'+(e.code||e.key),directions[e.key]);}
        if(this.map&&(e.key==='Enter'||e.key===' ')&&e.target.matches('[data-region],[data-province]')){e.preventDefault();this.walkTo(this.map.find(p=>p.name===(e.target.dataset.region||e.target.dataset.province)).center);}
      };
      this.onKeyUp=e=>this.releaseInput('key:'+(e.code||e.key));this.root.addEventListener('keydown',this.onKey);this.root.addEventListener('keyup',this.onKeyUp);
      this.pause=()=>{this.clearInput();this.route=[];this.walk.strength=0;this.animatePlayer(0,0);this.save();this.movePlayer();this.render();};
      this.onVisibility=()=>{if(document.hidden)this.pause();};document.addEventListener('visibilitychange',this.onVisibility);window.addEventListener('blur',this.pause);window.addEventListener('pagehide',this.pause);
      this.onFocusOut=e=>{if(!this.root.contains(e.relatedTarget))this.pause();};this.root.addEventListener('focusout',this.onFocusOut);
      if('IntersectionObserver'in window){this.observer=new IntersectionObserver(e=>{this.visible=e[0].isIntersecting;if(!this.visible)this.pause();});this.observer.observe(this.root);}
      this.resizeObserver=new ResizeObserver(()=>this.resizeView());this.resizeObserver.observe(this.svg);
    }
    startInput(id,direction){this.route=[];this.resumeView();this.inputs.set(id,{direction,started:performance.now(),expires:Infinity});this.syncInput();this.render();}
    releaseInput(id){const input=this.inputs.get(id);if(!input)return;input.expires=input.started+90;this.syncInput();}
    syncInput(t=performance.now()){
      for(const [id,input]of this.inputs)if(input.expires<=t)this.inputs.delete(id);
      const next=new Set([...this.inputs.values()].map(i=>i.direction));
      if(next.size===this.keys.size&&[...next].every(k=>this.keys.has(k)))return;
      this.keys=next;this.render();if(!this.keys.size)this.save();
    }
    clearInput(){this.inputs.clear();this.syncInput();}
    walkTo(p){
      if(!this.map||this.dialog.open||this.dead)return;if(!provinceAt(this.map,p)){this.message('请点地图陆地，或用方向键沿省界行走。');return;}
      this.clearInput();this.route=findRoute(this.map,this.position,p);if(!this.route.length){this.message('这里隔着水域，先探索相连的省份吧。');return;}
      this.resumeView();this.message(`正在走向${provinceAt(this.map,p).name}…`);this.target.setAttribute('cx',p.x);this.target.setAttribute('cy',p.y);this.target.removeAttribute('hidden');this.render();
    }
    stepDirection(dt){
      if(!this.position||!this.keys.size)return;
      let x=(this.keys.has('right')?1:0)-(this.keys.has('left')?1:0),y=(this.keys.has('down')?1:0)-(this.keys.has('up')?1:0);const length=Math.hypot(x,y)||1;
      const p={x:this.position.x+x/length*78*dt,y:this.position.y+y/length*78*dt};if(provinceAt(this.map,p))this.position=p;
    }
    tick(t){
      if(this.dead)return;const dt=Math.min((t-this.last)/1000,.1);this.last=t;
      if(this.visible&&!document.hidden&&!this.dialog.open){
        this.syncInput(t);const previous={...this.position};
        if(this.keys.size)this.stepDirection(dt);
        else if(this.route.length){let remaining=78*dt;while(remaining>0&&this.route.length){const p=this.route[0],d=distance(this.position,p);if(d<=remaining){this.position={x:p.x,y:p.y};this.route.shift();remaining-=d;}else{this.position.x+=(p.x-this.position.x)/d*remaining;this.position.y+=(p.y-this.position.y)/d*remaining;remaining=0;}}if(!this.route.length){this.save();this.message(`已抵达${provinceAt(this.map,this.position)?.name||'目的地'}。观察面具线索，选择道具。`);this.render();}}
        this.updateProvince();this.movePlayer();this.animatePlayer(distance(previous,this.position),dt);this.updateCamera(dt);
      }
      this.frame=requestAnimationFrame(time=>this.tick(time));
    }
    animatePlayer(travelled,dt){
      if(!this.person)return;this.walk=walkFrame(this.walk,travelled,dt);
      const {stride,liftA,liftB,bob}=this.motion.matches?{stride:0,liftA:0,liftB:0,bob:0}:this.walk;
      const swing=stride*9,a=liftA*4,b=liftB*4;
      const paths=[`M-1-17 Q${-4+swing*.35} ${-8-a*.4} ${-6+swing} ${-a}`,`M1-17 Q${4-swing*.35} ${-8-b*.4} ${6-swing} ${-b}`,`M-2-32 Q${-7-swing*.3} -27 ${-10-swing*.7} -22`,`M2-32 Q${7+swing*.3} -27 ${10+swing*.7} -22`];
      this.limbs.forEach((limb,i)=>limb.setAttribute('d',paths[i]));this.person.setAttribute('transform',`translate(0 ${-bob*1.2})`);
    }
    updateProvince(){const name=provinceAt(this.map,this.position)?.name||'';if(name!==this.province){this.province=name;this.active=this.items.find(i=>i.province===name&&!this.lit.includes(i.id))?.id||this.items.find(i=>i.province===name)?.id||'';this.render();}}
    movePlayer(){if(!this.player)return;this.player.setAttribute('transform',`translate(${this.position.x} ${this.position.y}) scale(.78 ${.78/TILT})`);this.player.classList.toggle('is-walking',!!(this.keys.size||this.route.length));this.target.toggleAttribute('hidden',!this.route.length);this.routeEl.setAttribute('d',this.route.length?'M'+[this.position,...this.route].map(p=>`${p.x},${p.y}`).join('L'):'');}
    resizeView(){const r=this.svg.getBoundingClientRect();if(!r.width||!r.height)return;this.aspect=r.width/r.height;if(this.view){const w=this.view.h*this.aspect;this.view.x+=(this.view.w-w)/2;this.view.w=w;}this.updateCamera(0);}
    resumeView(){if(this.zoom===1)this.setZoom(this.travelZoom);}
    setZoom(z,snap=false){this.zoom=Math.max(1,Math.min(3.6,z));if(this.zoom>1)this.travelZoom=this.zoom;const fit=this.root.querySelector('[data-command="fit"]');fit.textContent=this.zoom===1?'跟随':'全图';fit.setAttribute('aria-label',this.zoom===1?'回到小人跟随视角':'查看完整中国地图');this.updateCamera(.016,snap);}
    updateCamera(dt,snap=false){if(!this.position)return;const target=cameraView(this.position,this.zoom,this.aspect);this.view=snap||!this.view?target:easeCamera(this.view,target,dt,this.motion.matches);const {x,y,w,h}=this.view;this.svg.setAttribute('viewBox',`${x} ${y} ${w} ${h}`);this.root.classList.toggle('mq-overview',this.zoom===1);}
    message(text){this.status.textContent=text+(this.saveError?' 进度暂时无法保存，请保留页面。':'');}
    use(){
      if(!this.map||this.route.length||this.keys.size)return;
      const result=attempt(this.items,this.lit,this.province,this.active,this.selected);
      if(!result.ok){this.message({select:'先从行囊里选一道具。',duplicate:'这件道具已完成它的任务，换一件试试。',province:'道具暂时用不上。看看眼前面具的线索，或带着它继续旅行。',mask:'同省也有不同角色。这件道具与眼前的线索不合，再观察一下。'}[result.reason]);return;}
      this.lit.push(result.item.id);this.save();this.message(`点亮${result.item.name}！${result.item.discovery}`);this.root.classList.remove('mq-igniting');void this.root.offsetWidth;this.root.classList.add('mq-igniting');this.render();
      if(this.lit.length===this.items.length)this.open('win');
    }
    render(){
      if(!this.root)return;this.root.querySelector('.mq-total b').textContent=this.lit.length;this.root.querySelector('.mq-location').textContent=this.province?`当前位置 · ${this.province}`:'正在展开地图…';
      this.root.querySelectorAll('[data-item]').forEach(b=>{const done=this.lit.includes(b.dataset.item);b.classList.toggle('is-lit',done);b.setAttribute('aria-pressed',String(b.dataset.item===this.selected));b.querySelector('small').textContent=done?'已点亮':b.dataset.item===this.selected?'已选中':'未使用';});
      this.root.querySelectorAll('[data-light]').forEach(b=>b.classList.toggle('is-lit',this.lit.includes(b.dataset.light)));
      this.svg.querySelectorAll('[data-region]').forEach(p=>{const items=this.items.filter(i=>i.province===p.dataset.region),lit=items.filter(i=>this.lit.includes(i.id)).length;p.classList.toggle('is-current',p.dataset.region===this.province);p.classList.toggle('is-partial',lit>0&&lit<items.length);p.classList.toggle('is-lit',items.length>0&&lit===items.length);});
      this.svg.querySelectorAll('[data-province]').forEach(p=>{const items=this.items.filter(i=>i.province===p.dataset.province),n=items.filter(i=>this.lit.includes(i.id)).length;p.classList.toggle('is-lit',n===items.length);p.classList.toggle('is-partial',n>0);p.querySelector('.mq-beacon-count').textContent=`${n}/${items.length}`;});
      const item=this.items.find(i=>i.id===this.active),local=this.items.filter(i=>i.province===this.province);const photo=this.root.querySelector('.mq-mask');photo.hidden=!item;if(item){photo.src=this.url(item.photo);photo.alt=item.name+'实物照片';}
      this.root.querySelector('.mq-place').textContent=item?.location||this.province||'';this.root.querySelector('.mq-mask-name').textContent=item?item.name:(this.lit.length===10?'十面傩火，已全部点亮':'此地暂无线索');
      this.root.querySelector('.mq-riddle').textContent=item?(this.lit.includes(item.id)?item.discovery:item.clue):'向有灯台的省份前进，点地图可以让小人自动走过去。';
      const tabMarkup=local.length>1?local.map(i=>`<button type="button" data-local="${i.id}" aria-pressed="${i.id===this.active}">${esc(i.name)}${this.lit.includes(i.id)?' ✓':''}</button>`).join(''):'';
      if(this.tabMarkup!==tabMarkup){this.root.querySelector('.mq-local-tabs').innerHTML=tabMarkup;this.tabMarkup=tabMarkup;}
      const use=this.root.querySelector('.mq-use');use.disabled=!item||this.route.length>0||this.keys.size>0||this.lit.includes(item?.id);use.textContent=(this.route.length||this.keys.size)?'行走中…':item&&this.lit.includes(item.id)?'已点亮':'使用道具';
    }
    save(){if(!this.map||this.dead)return;try{localStorage.setItem(KEY,JSON.stringify({version:1,lit:this.lit,position:this.position}));this.saveError=false;}catch(_){this.saveError=true;this.message('本次可以继续探索。');}}
    open(kind){
      this.pause();const body=this.root.querySelector('.mq-dialog-body');
      if(kind==='help')body.innerHTML=`<h3>带着道具，走进傩的故乡</h3><ol><li>点击或轻触地图，让小人走向目的地；电脑也可用方向键 / WASD 移动。</li><li>到有灯台的省份，观察面具与线索。同省可切换不同面具。</li><li>从行囊选一道具，点“使用道具”。省份、面具与道具都相合，才会点燃。</li><li>点亮全部十张面具通关。没有倒计时，试错不扣分。</li></ol><p>镜头会跟随小人平滑移动；“全图”可查看所有省份，开始行走时回到跟随视角。道具既有地方记录中的器物，也有帮助观察的教学线索；具体出处见面具册。</p><p>地图底图：<a href="https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json" target="_blank" rel="noopener">DataV 省级地理数据</a>。仅作游戏探索示意。</p>`;
      if(kind==='restart')body.innerHTML='<h3>重新踏上旅程？</h3><p>只清除这张地图的十个点亮记录。原先小游戏的进度仍会保留。</p><button class="mq-use" data-command="reset">重新出发</button>';
      if(kind==='collection')body.innerHTML=`<h3>我的傩面行旅 · ${this.lit.length}/10</h3><div class="mq-collection">${this.items.map(i=>`<article><img src="${esc(this.url(i.photo))}" alt="${esc(i.name)}"><div><h4>${esc(i.name)} · ${esc(i.province)} ${this.lit.includes(i.id)?'已点亮':'待发现'}</h4><p>${esc(this.lit.includes(i.id)?i.discovery:i.clue)}</p><p>${esc(i.boundary)}</p><small>${esc(i.credit)}</small><a href="${esc(i.sourceUrl)}" target="_blank" rel="noopener">查看资料出处</a> · <a href="${esc(i.photoSource)}" target="_blank" rel="noopener">照片来源</a></div></article>`).join('')}</div>`;
      if(kind==='win')body.innerHTML=`<div class="mq-victory"><span>10 / 10</span><h3>山河之间，傩火相连。</h3><p>十张面具全部点亮。带着这些发现，创作你的傩面。</p><div class="mq-victory-masks">${this.items.map(i=>`<img src="${esc(this.url(i.photo))}" alt="${esc(i.name)}">`).join('')}</div><a class="mq-use" href="${esc(this.options.createHref||'../index.html#galaxy')}">带着发现去创作</a><button data-command="collection">翻看面具册</button></div>`;
      this.dialog.setAttribute('aria-label',{help:'地图玩法',restart:'重新开始地图',collection:'十个面具资料',win:'全部点亮，通关'}[kind]);if(!this.dialog.open)this.dialog.showModal();
    }
    reset(){if(!this.map){this.dialog.close();return;}this.lit=[];this.selected='';this.active='';this.position={...this.map.find(p=>p.name==='湖北').center};this.province='';this.route=[];this.clearInput();this.walk={phase:0,strength:0};this.animatePlayer(0,0);this.dialog.close();this.updateProvince();this.setZoom(TRAVEL_ZOOM,true);this.save();this.render();this.movePlayer();this.message('新的旅程开始了。走向有灯台的省份，点亮第一张面具。');}
    unmount(){this.pause();this.dead=true;cancelAnimationFrame(this.frame);this.observer?.disconnect();this.resizeObserver?.disconnect();document.removeEventListener('visibilitychange',this.onVisibility);window.removeEventListener('blur',this.pause);window.removeEventListener('pagehide',this.pause);if(this.dialog.open)this.dialog.close();this.container.innerHTML='';}
  }
  window.NuoMapQuestMath={project,inside,provinceAt,buildMap,findRoute,attempt,restore,cameraView,easeCamera,walkFrame};
  window.NuoCultureGame={mount(target,options){const container=typeof target==='string'?document.querySelector(target):target;if(!container)throw Error('找不到地图容器');container.nuoCultureGame?.unmount();return(container.nuoCultureGame=new MapQuest(container,options));}};
})();
