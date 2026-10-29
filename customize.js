/* Local UI prototype: no payment SDK, network submission or production order. */
(function () {
  'use strict';
  const DRAFT_KEY = 'nuo_custom_checkout_demo_v1';
  const ORDER_KEY = 'nuo_custom_orders_demo_v1';
  const HANDOFF_KEY = 'nuo_custom_work_v1';
  const STATES = ['pending', 'payment-failed', 'paid', 'making', 'shipped', 'complete'];
  const text = (value, limit = 200) => typeof value === 'string' ? value.slice(0, limit) : '';
  const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  function cleanReferences(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(ref=>ref && Number.isInteger(ref.id)).slice(0,20).map(ref=>({id:ref.id,name:text(ref.name,80),region:text(ref.region,80),note:text(ref.note,140),sources:(Array.isArray(ref.sources)?ref.sources:[]).filter(source=>source && typeof source.url==='string' && /^https:\/\/[^\s<>"']+$/.test(source.url)).slice(0,5).map(source=>({title:text(source.title,100),url:text(source.url,2000)}))}));
  }
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  function cleanWork(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (typeof raw.image !== 'string' || raw.image.length > 6000000) return null;
    const image = raw.image;
    if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(image) && !/^assets\/(masks\/\d{4}\.svg|hero\/longwang-warm\.svg)$/.test(image)) return null;
    return {id:text(raw.id,80), title:text(raw.title,60), image, wish:text(raw.wish,140), signature:text(raw.signature,30), recipient:text(raw.recipient,30), target:raw.target === 'gift' ? 'gift' : 'self', explanation:text(raw.explanation,240), productionSourceId:Number.isInteger(raw.productionSourceId)?raw.productionSourceId:null, referenceSources:cleanReferences(raw.referenceSources), referenceIds:Array.isArray(raw.referenceIds)?raw.referenceIds.filter(id=>Number.isInteger(id)&&id>0).slice(0,20):[], isExample:raw.isExample===true};
  }
  function cleanSelection(raw = {}) {
    raw = record(raw);
    const quantity = ['number','string'].includes(typeof raw.quantity) ? Number(raw.quantity) : 1;
    return {base:['panguan','custom'].includes(raw.base) ? raw.base : 'longwang', size:raw.size === 'small' ? 'small' : 'standard', packaging:raw.packaging === 'gift' ? 'gift' : 'basic', quantity:Math.max(1,Math.min(5,Math.trunc(quantity)||1))};
  }
  function costs() {
    // All prototype prices remain zero until a production quote is confirmed.
    return {unit:0,product:0,packaging:0,shipping:0,total:0};
  }
  const cleanCard = value => { const raw=record(value); return {include:raw.include !== false,recipient:text(raw.recipient,30),wish:text(raw.wish,140),signature:text(raw.signature,30)}; };
  const cleanAddress = value => { const raw=record(value); return {name:text(raw.name,30),phone:text(raw.phone,24),region:text(raw.region,80),street:text(raw.street,160)}; };
  function cleanOrder(raw) {
    if (!raw || typeof raw.id !== 'string' || !/^DEMO-[A-Z0-9-]{5,60}$/.test(raw.id)) return null;
    const work = cleanWork(raw.work);
    if (!work) return null;
    const selection = cleanSelection(raw.selection);
    return {id:raw.id,created:text(raw.created,40),work,selection,card:cleanCard(raw.card),address:cleanAddress(raw.address),payment:raw.payment==='alipay'?'alipay':'wechat',status:STATES.includes(raw.status)?raw.status:'pending',cost:costs(selection)};
  }
  function createOrder(draft, id, created) {
    return cleanOrder({...draft,id,created,status:'pending'});
  }
  if (typeof module === 'object' && module.exports) module.exports = {cleanWork,cleanSelection,costs,cleanOrder,createOrder};
  if (typeof document === 'undefined') return;

  const params = new URLSearchParams(location.search);
  let savedLanguage = 'zh';
  try { savedLanguage = localStorage.getItem('nuo-language') || 'zh'; } catch (_) {}
  const lang = (params.get('lang') || savedLanguage) === 'en' ? 'en' : 'zh';
  const t = (zh,en) => lang === 'en' ? en : zh;
  const money = cents => '¥' + (cents/100).toLocaleString(lang === 'en' ? 'en-US' : 'zh-CN',{maximumFractionDigits:2});
  const $ = id => document.getElementById(id);
  const baseName = value => value === 'custom' ? t('按当前画稿确认','Review the current design') : value === 'panguan' ? t('判官','Judge') : t('龙王','Dragon King');
  const sizeName = value => value === 'small' ? t('小号 · 高约 18 cm','Small · approx. 18 cm tall') : t('标准 · 高约 24 cm','Standard · approx. 24 cm tall');
  const packName = value => value === 'gift' ? t('赠礼包装','Gift packaging') : t('简装保护盒','Protective box');
  let noticeTimer;
  function notice(message) { $('customNotice').textContent=message; clearTimeout(noticeTimer); noticeTimer=setTimeout(()=>{$('customNotice').textContent='';},7000); }
  function read(store,key,fallback) { try { const value=store.getItem(key); return value?JSON.parse(value):fallback; } catch (_) { return fallback; } }
  let session,local;
  try { session=window.sessionStorage; local=window.localStorage; } catch (_) {}
  const demoWork = {id:'example-longwang',title:t('把平安带在身边','Carry a wish for peace'),image:'assets/hero/longwang-warm.svg',wish:t('愿你走向新的生活时，始终知道有人支持你。','May you always know someone is supporting you as you begin a new chapter.'),signature:t('同行的人','Someone by your side'),recipient:t('远行的朋友','A friend setting off'),target:'gift',referenceIds:[325],isExample:true};
  const handoff = read(session,HANDOFF_KEY,null);
  const restored = read(session,DRAFT_KEY,null);
  const receivedWork = cleanWork({...record(handoff?.work),productionSourceId:handoff?.productionSourceId,referenceSources:handoff?.references});
  const restoredWork = cleanWork(restored?.work);
  const work = receivedWork || restoredWork || demoWork;
  let draft = receivedWork || !restoredWork ? {
    work,selection:cleanSelection({base:work.productionSourceId===317?'panguan':work.productionSourceId===325||work.isExample?'longwang':'custom'}),
    card:{include:true,recipient:work.recipient,wish:work.wish,signature:work.signature},
    address:{name:t('演示收件人','Demo recipient'),phone:'13800000000',region:t('江西省 萍乡市 湘东区（示例）','Xiangdong, Pingxiang, Jiangxi (example)'),street:t('示例路 1 号（虚构地址）','1 Example Road (fictional address)')},
    step:1,proofConfirmed:false,termsConfirmed:false,payment:'wechat',activeOrderId:''
  } : {work,selection:cleanSelection(restored.selection),card:cleanCard(restored.card),address:cleanAddress(restored.address),step:[1,2,3,4].includes(restored.step)?restored.step:1,proofConfirmed:restored.proofConfirmed===true,termsConfirmed:restored.termsConfirmed===true,payment:restored.payment==='alipay'?'alipay':'wechat',activeOrderId:text(restored.activeOrderId,80)};
  if (draft.step===3 && !draft.proofConfirmed) draft.step=2;
  let orders = read(local,ORDER_KEY,[]);
  orders = (Array.isArray(orders)?orders:[]).map(cleanOrder).filter(Boolean).slice(0,10);
  let view = params.get('view')==='orders' ? 'orders' : 'checkout';
  let selectedOrder = params.has('order') ? orders.find(o=>o.id===params.get('order')) : orders.find(o=>o.id===draft.activeOrderId);
  if (params.has('order') && selectedOrder) { view='detail'; }
  else if (params.has('order')) { view='orders'; notice(t('这个浏览器中没有找到该演示订单。','This demo order was not found in this browser.')); }
  else if (draft.step===4 && selectedOrder && view!=='orders') view='detail';
  else if (draft.step===4) draft.step=1;
  function persistDraft() {
    try { session.setItem(DRAFT_KEY,JSON.stringify(draft)); return true; }
    catch (_) { notice(t('暂时无法保存定制进度。请保留当前页面。','This browser could not save your progress. Keep this page open.')); return false; }
  }
  if (receivedWork && persistDraft()) { try { session.removeItem(HANDOFF_KEY); } catch (_) {} }
  function saveOrder(order) {
    const next=[order,...orders.filter(o=>o.id!==order.id)].slice(0,10);
    try { local.setItem(ORDER_KEY,JSON.stringify(next)); orders=next; selectedOrder=order; return true; }
    catch (_) { notice(t('演示订单未能保存。请检查浏览器存储空间后重试；没有产生扣费。','The demo order could not be saved. Check browser storage and retry. No charge was made.')); return false; }
  }
  function changeView(next) {
    view=next;
    const url=new URL(location.href);
    url.searchParams.delete('order'); url.searchParams.delete('view');
    if(next==='orders')url.searchParams.set('view','orders');
    if(next==='detail'&&selectedOrder)url.searchParams.set('order',selectedOrder.id);
    history.replaceState(null,'',url);
  }
  document.documentElement.lang=lang==='en'?'en':'zh-CN';
  document.title=t('实体定制（演示）｜傩面万象','Custom mask demo | NUO ATLAS');
  $('siteHome').href='index.html?lang='+lang;
  $('siteHome').setAttribute('aria-label',t('返回网站首页','Return to website home'));
  $('ordersLink').textContent=t('我的定制订单','My custom orders');
  $('ordersLink').href='customize.html?view=orders&lang='+lang;
  $('languageSwitch').textContent=lang==='en'?'中文':'EN';
  $('languageSwitch').setAttribute('aria-label',lang==='en'?'Switch to Chinese':'Switch to English');
  $('languageSwitch').addEventListener('click',()=>{persistDraft();const url=new URL(location.href);url.searchParams.set('lang',lang==='en'?'zh':'en');location.assign(url.href);});
  $('ordersLink').addEventListener('click',event=>{event.preventDefault();persistDraft();changeView('orders');render();});
  function demoNote() { return `<p class="demo-note"><span>${t('定制流程演示','Custom-order demo')}</span><span>${t('规格、价格与工期均为示例，不会实际扣费或安排制作。','Specifications, prices and lead times are examples. No payment or production takes place.')}</span></p>`; }
  function heading(title,desc) {return `<header class="page-heading"><h1 tabindex="-1">${title}</h1><p>${desc}</p>${demoNote()}</header>`;}
  function steps(current) { const names=[t('选择制作方案','Choose a format'),t('确认制作稿','Review your design'),t('确认订单','Review & pay'),t('订单详情','Order details')];return `<ol class="steps" aria-label="${t('定制步骤','Order steps')}">${names.map((name,i)=>`<li ${i+1===current?'aria-current="step"':''} class="${i+1<current?'completed':''}"><span class="step-number">${i+1}</span><span>${name}</span></li>`).join('')}</ol>`; }
  function costHTML(selection) {const c=costs(selection);return `<dl class="cost-list"><div><dt>${t('面具制作','Mask production')} × ${selection.quantity}</dt><dd>${money(c.product)}</dd></div><div><dt>${t('包装与心意卡','Packaging & wish card')}</dt><dd>${money(c.packaging)}</dd></div><div><dt>${t('配送费（示例）','Shipping (example)')}</dt><dd>${money(c.shipping)}</dd></div><div class="total"><dt>${t('示例合计','Example total')}</dt><dd>${money(c.total)}</dd></div></dl>`;}
  function summary(value=draft) {return `<aside class="summary" aria-label="${t('作品与费用摘要','Artwork and cost summary')}"><div class="summary-art"><img src="${esc(value.work.image)}" alt="${esc(value.work.title)}"><span class="image-caption">${value.work.isExample?t('示例作品 · 金线平面稿','Example artwork · flat outline'):t('你的作品 · 平面创作稿','Your artwork · flat design')}</span></div><div class="summary-copy"><h2>${esc(value.work.title)}</h2><p class="summary-wish">${esc(value.card.include?value.card.wish:value.work.wish)}</p><dl><div><dt>${t('意向款式','Style preference')}</dt><dd>${baseName(value.selection.base)}</dd></div><div><dt>${t('尺寸','Size')}</dt><dd>${sizeName(value.selection.size)}</dd></div><div><dt>${t('包装','Packaging')}</dt><dd>${packName(value.selection.packaging)}</dd></div></dl>${costHTML(value.selection)}${provenance(value.work)}<p class="summary-note">${t('示例工期：制作稿确认后 7–10 个工作日。实际报价与交付安排需由制作方确认。','Example lead time: 7–10 working days after design approval. The maker must confirm the actual quote and schedule.')}</p></div></aside>`;}
  function option(name,value,selected,title,desc,extra='') {return `<label class="option option-text"><input type="radio" name="${name}" value="${value}" ${value===selected?'checked':''}><strong>${title}</strong><small>${desc}</small>${extra}</label>`;}
  function provenance(work) {
    if (!work.explanation && !work.referenceSources?.length) return '';
    return `<details class="prototype-tools"><summary>${t('文化参考与创作说明','Cultural references & artist’s note')}</summary>${work.explanation?`<p>${esc(work.explanation)}</p>`:''}${(work.referenceSources||[]).map(ref=>`<div class="field-group"><strong>${esc(ref.name)}</strong><p class="small">${esc(ref.region)}</p>${ref.note?`<p class="small">${esc(ref.note)}</p>`:''}${ref.sources.map(source=>`<p class="source-note"><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.title||t('文化出处','Cultural source'))}</a></p>`).join('')}</div>`).join('')}</details>`;
  }
  function selectionPage() {
    const s=draft.selection;
    return heading(t('把你的作品，做成一份实物','Give your artwork a physical form'),t('从一张平面创作出发，选择承载它的制作方案。','Start with your flat design and choose how it could be made.'))+steps(1)+`<div class="checkout-layout"><div class="main-stack">
      <section class="panel"><div class="panel-heading"><h2>${t('选择意向款式','Choose a style preference')}</h2><small>${t('作品参考图 · 非在售商品','Reference works · not products for sale')}</small></div><div class="option-grid">${[['longwang','0325'],['panguan','0317']].map(([id,num])=>`<label class="option"><input type="radio" name="base" value="${id}" ${s.base===id?'checked':''}><img class="option-photo" src="assets/pilot/${num}.jpg" alt="${baseName(id)}${t('作品参考图',' reference photograph')}"><strong>${baseName(id)}</strong><small>${id==='longwang'?t('分枝角、圆眼与卷须','Branching horns, round eyes and curled whiskers'):t('圆睁眉眼与清晰的面部结构','Wide eyes and defined facial features')}</small></label>`).join('')}${option('base','custom',s.base,t('按当前画稿确认','Review my current design'),t('由制作方确认可用坯型与造型适配','The maker would confirm a compatible form'))}</div><p class="source-note">${t('参考彭国龙作品，图源：中国傩戏网。照片为原作成品，拟用坯型、材料与尺寸尚待制作方确认。','Works by Peng Guolong, via China Nuo Opera. These are finished original works; production blanks, materials and sizes are not yet confirmed.')} <a href="https://www.zgnuoxi.com/mianju/view_1389.html" target="_blank" rel="noopener noreferrer">${t('龙王出处','Dragon King source')}</a> · <a href="https://www.zgnuoxi.com/mianju/view_1374.html" target="_blank" rel="noopener noreferrer">${t('判官出处','Judge source')}</a></p></section>
      <section class="panel"><fieldset><legend>${t('尺寸与呈现','Size & presentation')}</legend><div class="option-grid">${option('size','small',s.size,t('小号陈列版','Small display'),t('高约 18 cm · 适合桌面','Approx. 18 cm tall · tabletop'),'<span class="price">¥0 / '+t('件','piece')+'</span>')}${option('size','standard',s.size,t('标准陈列版','Standard display'),t('高约 24 cm · 适合墙面','Approx. 24 cm tall · wall display'),'<span class="price">¥0 / '+t('件','piece')+'</span>')}</div></fieldset><dl class="details-grid"><div><dt>${t('拟定制作方式','Proposed process')}</dt><dd>${t('确认坯型后定制配色','Custom colour after form approval')}</dd></div><div><dt>${t('用途','Intended use')}</dt><dd>${t('装饰陈列','Decorative display')}</dd></div></dl><div class="field-row field-group"><strong>${t('数量','Quantity')}</strong><div class="quantity"><button data-quantity="-1" aria-label="${t('减少数量','Decrease quantity')}" ${s.quantity===1?'disabled':''}>−</button><output aria-label="${t('数量','Quantity')}">${s.quantity}</output><button data-quantity="1" aria-label="${t('增加数量','Increase quantity')}" ${s.quantity===5?'disabled':''}>+</button></div></div></section>
      <section class="panel"><fieldset><legend>${t('把心意一起装好','Package your intention')}</legend><div class="option-grid">${option('packaging','basic',s.packaging,t('简装保护盒','Protective box'),t('基础保护包装，心意卡可选','Protective packaging; optional wish card'),'<span class="price">¥0 / '+t('件','piece')+'</span>')}${option('packaging','gift',s.packaging,t('赠礼包装','Gift packaging'),t('赠礼外盒，心意卡可选','Presentation box; optional wish card'),'<span class="price">¥0 / '+t('件','piece')+'</span>')}</div></fieldset></section>
      </div>${summary()}</div>`;
  }
  function wishCard(card=draft.card,work=draft.work) {return `<article class="wish-card"><small>${t('随附心意卡','Your accompanying wish card')}</small><h3>${esc(work.title)}</h3><p id="cardRecipient">${esc(card.recipient)}</p><p id="cardWish">${esc(card.wish)}</p><p class="signature" id="cardSignature">${esc(card.signature)}</p><small>${t('心意卡保留作品名称、留言与署名。','The card keeps the artwork title, your message and signature.')}</small></article>`;}
  function proofPage() {
    return heading(t('让每一处选择，都表达你的心意','Make each choice part of your intention'),t('核对图稿与随附文字，留下这一单要制作的版本。','Review your design and message, then confirm the version for this order.'))+steps(2)+`<div class="checkout-layout proof-layout"><div class="main-stack"><section class="panel"><div class="panel-heading"><h2>${t('平面制作稿','Flat design proof')}</h2><small>${draft.work.isExample?t('示例作品','Example artwork'):t('来自你的创作','From your artwork')}</small></div><figure><div class="proof-art"><img src="${esc(draft.work.image)}" alt="${esc(draft.work.title)}"></div><figcaption class="proof-caption"><span>${esc(draft.work.title)}</span><span>${t('意向：','Preference: ')}${baseName(draft.selection.base)} / ${sizeName(draft.selection.size)}</span></figcaption></figure><p class="source-note">${t('当前图稿不会因选择意向款式而自动变形。实际生产前，制作方仍需确认造型适配、颜色和细节；本演示不表示制作审核已通过。','Selecting a style does not reshape your artwork. A maker must confirm form compatibility, colour and detail before production. This demo is not manufacturing approval.')}</p><label class="check"><input id="proofConfirmed" type="checkbox" ${draft.proofConfirmed?'checked':''}><span>${t('我已核对平面图稿、所选款式与心意卡。','I have reviewed the flat design, chosen style and wish card.')}</span></label></section></div><div class="main-stack"><section class="panel"><h2>${t('随面具送出的那句话','The words that go with it')}</h2><label class="check"><input id="includeCard" type="checkbox" ${draft.card.include?'checked':''}><span>${t('附上一张心意卡（¥0）','Include a wish card (¥0)')}</span></label><div id="cardFields" ${!draft.card.include?'hidden':''}><div class="form-grid"><label class="field full-width">${t('称呼（选填）','Recipient (optional)')}<input data-card="recipient" maxlength="30" value="${esc(draft.card.recipient)}"></label><label class="field full-width">${t('你的心意','Your message')}<textarea data-card="wish" maxlength="140" rows="3">${esc(draft.card.wish)}</textarea></label><label class="field full-width">${t('署名（选填）','Signature (optional)')}<input data-card="signature" maxlength="30" value="${esc(draft.card.signature)}"></label></div>${wishCard()}</div></section><section class="panel"><h3>${t('这一版会随订单保留','This version stays with the order')}</h3><p>${t('提交后，订单会保留当前图稿与心意卡。之后修改网站里的数字作品，不会改变这份订单。','Submitting keeps a snapshot of this design and wish card. Later edits to your digital artwork will not change this order.')}</p></section></div></div>`;
  }
  function checkoutPage() {
    return heading(t('确认好，再把心意交出去','Review the details before you send it'),t('核对收件信息、制作方案与费用，体验最后一步。','Review the delivery details, design and cost before the final demo step.'))+steps(3)+`<div class="checkout-layout"><form id="orderForm" class="main-stack"><section class="panel"><h2>${t('收件信息','Delivery details')}</h2><p class="small">${t('已填入虚构地址供体验，请勿填写真实个人信息。','Fictional details are prefilled for this demo. Please do not enter real personal information.')}</p><div class="form-grid"><label class="field">${t('收件人','Recipient')}<input data-address="name" required maxlength="30" autocomplete="off" value="${esc(draft.address.name)}"></label><label class="field">${t('联系电话','Contact number')}<input data-address="phone" type="tel" required minlength="6" maxlength="24" autocomplete="off" value="${esc(draft.address.phone)}"></label><label class="field full-width">${t('所在地区','Region')}<input data-address="region" required maxlength="80" autocomplete="off" value="${esc(draft.address.region)}"></label><label class="field full-width">${t('详细地址','Street address')}<input data-address="street" required maxlength="160" autocomplete="off" value="${esc(draft.address.street)}"></label></div></section>
      <section class="panel"><div class="panel-heading"><h2>${t('本次制作内容','Your production brief')}</h2><button type="button" class="text-button" data-step="2">${t('查看制作稿','Review proof')}</button></div><div class="review-row"><img src="${esc(draft.work.image)}" alt=""><div><h3>${esc(draft.work.title)}</h3><p class="small">${baseName(draft.selection.base)} · ${sizeName(draft.selection.size)} × ${draft.selection.quantity}</p><p class="small">${packName(draft.selection.packaging)} · ${draft.card.include?t('附心意卡','Wish card included'):t('不附心意卡','No wish card')}</p></div></div><p>${t('示例安排：制作稿确认后 7–10 个工作日发货。实际工期、运费与制作前的修改取消规则，需在正式下单前确认。','Example schedule: dispatched 7–10 working days after proof approval. Actual lead time, shipping and change/cancellation terms must be confirmed before a real order.')}</p></section>
      <section class="panel"><fieldset><legend>${t('支付方式（演示）','Payment method (demo)')}</legend><div class="option-grid payment-options">${option('payment','wechat',draft.payment,t('微信支付','WeChat Pay'),t('未接通支付服务','Not connected'))}${option('payment','alipay',draft.payment,t('支付宝','Alipay'),t('未接通支付服务','Not connected'))}</div></fieldset><label class="check"><input id="termsConfirmed" type="checkbox" ${draft.termsConfirmed?'checked':''}><span>${t('我已核对图稿、规格与费用，了解这是不扣费的流程演示。','I have checked the design, specifications and cost, and understand this is a demo with no charge.')}</span></label></section></form>${summary()}</div>`;
  }
  function statusText(status) {return ({pending:t('待付款 · 演示','Awaiting payment · demo'),'payment-failed':t('支付未完成 · 演示','Payment incomplete · demo'),paid:t('已模拟付款，等待制作确认','Demo payment complete · awaiting maker'),making:t('制作中 · 状态演示','In production · demo state'),shipped:t('已发货 · 状态演示','Shipped · demo state'),complete:t('已完成 · 状态演示','Completed · demo state')})[status];}
  function statusDescription(status) {return ['pending','payment-failed'].includes(status)?t('没有发生扣款。可以继续体验支付，或稍后从演示订单中返回。','No charge has been made. Retry the payment demo or return from your demo orders later.'):t('你的图稿和心意卡已保存到本机演示订单。没有真实扣费，也不会安排制作或配送。','Your design and wish card are saved in this browser’s demo order. No charge, production or delivery takes place.');}
  function date(value) { const parsed=new Date(value);return Number.isNaN(parsed.getTime())?'—':parsed.toLocaleDateString(lang==='en'?'en-US':'zh-CN'); }
  function detailPage(order) {
    const stage=Math.max(0,['paid','making','shipped','complete'].indexOf(order.status));
    const paid=!['pending','payment-failed'].includes(order.status);
    const labels=[t('确认制作','Maker confirmation'),t('制作与检查','Making & checking'),t('包装寄出','Packing & dispatch'),t('作品送达','Delivered')];
    const descriptions=[t('正式服务中，制作方会确认适配与细节。','The maker would check compatibility and details.'),t('按已确认的制作稿完成并检查。','Made and checked against the approved proof.'),t('发货后在这里查看配送信息。','Delivery information would appear here.'),t('面具与心意卡一起抵达。','The mask and wish card arrive together.')];
    return heading(t('你的定制订单','Your custom order'),t('让图稿、心意与制作进度，都有一个可以回看的地方。','Keep the design, message and progress together in one place.'))+steps(4)+`<div class="main-stack"><section class="order-banner"><span class="status-mark" aria-hidden="true">${paid?'✓':'…'}</span><div><h2>${statusText(order.status)}</h2><p>${statusDescription(order.status)}</p><div class="order-meta"><span>${esc(order.id)}</span><span>${date(order.created)}</span></div></div></section><div class="checkout-layout"><div class="main-stack"><section class="panel"><h2>${t('制作与配送','Making & delivery')}</h2><ol class="status-track">${labels.map((label,i)=>`<li class="${!paid||i>stage?'future':i===stage?'current':'done'}"><strong>${label}</strong><p>${descriptions[i]}</p></li>`).join('')}</ol>${order.status==='shipped'||order.status==='complete'?`<p class="source-note">${t('这是配送状态展示，没有真实物流单号或包裹。','This previews delivery status. There is no real tracking number or parcel.')}</p>`:''}</section><section class="panel"><h2>${t('这一单留下的心意','The intention in this order')}</h2>${order.card.include?wishCard(order.card,order.work):`<p>${t('本次未附心意卡。','No wish card was selected.')}</p>`}<div class="field-group"><h3>${t('收件信息（演示）','Delivery details (demo)')}</h3><p>${esc(order.address.name)} · ${esc(order.address.phone)}</p><p>${esc(order.address.region)} ${esc(order.address.street)}</p></div></section><details class="prototype-tools"><summary>${t('演示：查看其他订单状态','Demo: preview other order states')}</summary><label class="field">${t('状态仅用于检查界面，不代表真实进度','These states preview the UI, not real progress')}<select id="demoStatus">${STATES.map(s=>`<option value="${s}" ${order.status===s?'selected':''}>${statusText(s)}</option>`).join('')}</select></label></details></div>${summary(order)}</div></div>`;
  }
  function ordersPage() {
    return heading(t('我的定制订单','My custom orders'),t('这里保留你在本机体验过的定制流程。','Your custom-order demos saved in this browser.'))+(draft.step<4?`<p class="field-group"><button class="button" data-action="resume">${t('返回当前定制','Return to current customization')}</button></p>`:'')+(orders.length?`<div class="order-list">${orders.map(o=>`<article class="order-list-card"><img src="${esc(o.work.image)}" alt="${esc(o.work.title)}"><div><small>${esc(o.id)} · ${date(o.created)}</small><h2>${esc(o.work.title)}</h2><p>${statusText(o.status)}</p><p class="small">${baseName(o.selection.base)} · ${sizeName(o.selection.size)} × ${o.selection.quantity}</p></div><div class="list-action"><strong>${money(o.cost.total)}</strong><button class="button" data-order="${esc(o.id)}">${t('查看订单','View order')}</button></div></article>`).join('')}</div><p class="source-note">${t('演示订单只存于本机浏览器，清除网站数据后会消失。','Demo orders are stored only in this browser and disappear if its site data is cleared.')}</p>`:`<section class="empty-orders"><h2>${t('还没有定制订单','No custom orders yet')}</h2><p>${t('可以从“我的作品”选择一件作品开始，也可以先用示例作品走一遍流程。','Choose an artwork from My works, or try the flow with an example first.')}</p><button class="button primary" data-action="continue">${t('体验定制流程','Try the custom-order demo')}</button></section>`);
  }
  function renderBar() {
    const bar=$('checkoutBar');
    if(view==='orders'){bar.hidden=true;return;}
    bar.hidden=false;
    const isDetail=view==='detail';
    const value=isDetail?selectedOrder:draft;
    const back=isDetail?`<a class="text-button" href="index.html?lang=${lang}">${t('返回网站','Back to site')}</a>`:draft.step>1?`<button class="text-button" data-action="back">${t('上一步','Back')}</button>`:`<a class="text-button" href="index.html?lang=${lang}">${t('返回网站','Back to site')}</a>`;
    let action;
    if(isDetail)action=['pending','payment-failed'].includes(selectedOrder.status)?`<button class="button primary" data-action="retry">${t('重试模拟支付','Retry demo payment')}</button>`:`<button class="button primary" data-action="orders">${t('查看全部订单','View all orders')}</button>`;
    else action=`<button class="button primary" data-action="next">${draft.step===1?t('下一步：确认制作稿','Next: review design'):draft.step===2?t('确认制作稿，继续','Confirm design & continue'):t('确认并模拟支付','Confirm & simulate payment')}</button>`;
    bar.innerHTML=`<div class="bar-inner"><div class="bar-total"><small>${t('示例合计 · 不扣费','Example total · no charge')}</small><strong>${money(costs(value.selection).total)}</strong></div><div class="bar-actions">${back}${action}</div></div>`;
  }
  function render(scroll=true) {
    $('customApp').innerHTML=view==='orders'?ordersPage():view==='detail'?detailPage(selectedOrder):draft.step===1?selectionPage():draft.step===2?proofPage():checkoutPage();
    renderBar();
    if(scroll){notice('');window.scrollTo({top:0,left:0,behavior:'instant'});$('customApp').querySelector('h1')?.focus({preventScroll:true});}
  }
  function invalidateProof() {draft.proofConfirmed=false;draft.termsConfirmed=false;}
  function showPayment(order) {
    selectedOrder=order;
    $('paymentDialog').innerHTML=`<div class="modal-heading"><h2 id="paymentTitle">${t('体验支付结果','Preview payment results')}</h2><form method="dialog"><button aria-label="${t('取消模拟支付','Cancel demo payment')}">×</button></form></div><p>${t('这一步只演示付款后的界面，不会连接支付平台或产生费用。','This previews the next screen. It does not connect to a payment platform or charge you.')}</p><p class="pay-amount">${money(order.cost.total)}</p><p class="small">${order.payment==='wechat'?t('微信支付（演示）','WeChat Pay (demo)'):t('支付宝（演示）','Alipay (demo)')}</p><div class="modal-actions"><button class="button primary" data-pay="paid">${t('模拟支付成功','Simulate success')}</button><button class="button" data-pay="payment-failed">${t('模拟支付失败','Simulate failure')}</button><form method="dialog"><button class="text-button">${t('暂不支付，保留演示订单','Not now — keep the demo order')}</button></form></div>`;
    $('paymentDialog').showModal();
  }
  document.addEventListener('input',event=>{
    const field=event.target;
    if(field.dataset.card){draft.card[field.dataset.card]=field.value;invalidateProof();if($('proofConfirmed'))$('proofConfirmed').checked=false;const preview=$('card'+field.dataset.card[0].toUpperCase()+field.dataset.card.slice(1));if(preview)preview.textContent=field.value;}
    if(field.dataset.address){draft.address[field.dataset.address]=field.value;draft.termsConfirmed=false;if($('termsConfirmed'))$('termsConfirmed').checked=false;}
  });
  document.addEventListener('change',event=>{
    const field=event.target;
    if(['base','size','packaging'].includes(field.name)){draft.selection[field.name]=field.value;invalidateProof();persistDraft();render(false);}
    else if(field.name==='payment'){draft.payment=field.value;persistDraft();}
    else if(field.id==='includeCard'){draft.card.include=field.checked;invalidateProof();persistDraft();render(false);}
    else if(field.id==='proofConfirmed'){draft.proofConfirmed=field.checked;persistDraft();}
    else if(field.id==='termsConfirmed'){draft.termsConfirmed=field.checked;persistDraft();}
    else if(field.dataset.card||field.dataset.address)persistDraft();
    else if(field.id==='demoStatus'){const next=cleanOrder({...selectedOrder,status:field.value});if(saveOrder(next))render(false);}
  });
  document.addEventListener('submit',event=>{if(event.target.id==='orderForm')event.preventDefault();});
  document.addEventListener('click',event=>{
    const button=event.target.closest('button'); if(!button)return;
    if(button.dataset.quantity){draft.selection.quantity=cleanSelection({...draft.selection,quantity:draft.selection.quantity+Number(button.dataset.quantity)}).quantity;invalidateProof();persistDraft();render(false);return;}
    if(button.dataset.step){draft.step=Number(button.dataset.step);persistDraft();render();return;}
    if(button.dataset.order){selectedOrder=orders.find(o=>o.id===button.dataset.order);if(selectedOrder){changeView('detail');render();}return;}
    if(button.dataset.pay){const next=cleanOrder({...selectedOrder,status:button.dataset.pay});if(saveOrder(next)){$('paymentDialog').close();changeView('detail');render();}return;}
    const action=button.dataset.action;
    if(action==='orders'){changeView('orders');render();}
    if(action==='resume'){changeView('checkout');render();}
    if(action==='continue'){draft.step=1;draft.activeOrderId='';changeView('checkout');persistDraft();render();}
    if(action==='back'){draft.step=Math.max(1,draft.step-1);persistDraft();render();}
    if(action==='retry')showPayment(selectedOrder);
    if(action==='next'){
      if(draft.step===1){draft.step=2;persistDraft();render();return;}
      if(draft.step===2){
        if(draft.card.include&&!draft.card.wish.trim()){notice(t('请写下心意，或取消附带心意卡。','Add a message or uncheck the wish card.'));$('cardFields').querySelector('textarea').focus();return;}
        if(!draft.proofConfirmed){notice(t('请先核对并确认制作稿。','Review and confirm the design proof first.'));$('proofConfirmed').focus();return;}
        draft.step=3;persistDraft();render();return;
      }
      if(draft.step===3){
        if(!$('orderForm').reportValidity())return;
        if(!Object.values(draft.address).every(value=>value.trim())){notice(t('请补全演示收件信息。','Complete the demo delivery details.'));return;}
        if(!draft.termsConfirmed){notice(t('请先核对订单并勾选确认。','Check the order and select the confirmation checkbox.'));$('termsConfirmed').focus();return;}
        const id='DEMO-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,6).toUpperCase();
        const order=createOrder(draft,id,new Date().toISOString());
        if(!saveOrder(order))return;
        draft.activeOrderId=order.id;draft.step=4;persistDraft();changeView('detail');render();showPayment(order);
      }
    }
  });
  $('paymentDialog').addEventListener('close',()=>{if(selectedOrder){changeView('detail');render(false);}});
  window.addEventListener('pagehide',()=>{persistDraft();});
  render(false);
})();
