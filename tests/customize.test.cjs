/* Run: node tests/customize.test.cjs. Local demo orders must be bounded, safe snapshots. */
const assert = require('node:assert/strict');
const {cleanWork, cleanSelection, costs, cleanOrder, createOrder} = require('../customize.js');

const png = 'data:image/png;base64,aGVsbG8=';
const work = {id:'work-1', title:'送给朋友', image:png, wish:'愿你一路平安', signature:'同行的人', recipient:'朋友', target:'gift', explanation:'从龙王的轮廓开始创作。', referenceIds:[325], productionSourceId:325, referenceSources:[{id:325,name:'龙王',region:'江西 · 萍乡 · 湘东',note:'分枝角与卷须',sources:[{title:'龙王作品资料',url:'https://www.zgnuoxi.com/mianju/view_1389.html'}]}]};
const draft = {
  work, selection:{base:'longwang', size:'small', packaging:'gift', quantity:2},
  card:{include:true, recipient:'朋友', wish:'愿你一路平安', signature:'同行的人'},
  address:{name:'演示收件人', phone:'13800000000', region:'示例地区', street:'示例路 1 号'},
  payment:'alipay', proofConfirmed:true, termsConfirmed:true
};

assert.deepEqual(costs(draft.selection), {unit:0, product:0, packaging:0, shipping:0, total:0});
assert.deepEqual(costs({size:'standard', packaging:'basic', quantity:5}), {unit:0, product:0, packaging:0, shipping:0, total:0});
assert.equal(costs({}).total, 0);
for (const [input, expected] of [[0,1],[-9,1],[1,1],[2.9,2],[5,5],[99,5],['3',3],['not-a-number',1],[NaN,1],[Infinity,5],[-Infinity,1]]) {
  assert.equal(cleanSelection({quantity:input}).quantity, expected, 'bound quantity: '+String(input));
}
assert.deepEqual(cleanSelection({base:'<script>', size:'unknown', packaging:'unknown', quantity:4}), {base:'longwang', size:'standard', packaging:'basic', quantity:4});
assert.equal(cleanSelection({base:'custom'}).base,'custom','unsupported source artworks can stay custom');
for (const image of ['https://example.org/a.png','javascript:alert(1)','data:image/svg+xml,<svg/>','assets/masks/../secret.svg','assets/masks/0317.svg" onerror="alert(1)','file:///tmp/photo.png','']) {
  assert.equal(cleanWork({...work,image}), null, 'reject unsafe image source: '+image);
}
for (const image of [png,'assets/masks/0317.svg','assets/hero/longwang-warm.svg']) assert.equal(cleanWork({...work,image}).image,image);
assert.equal(cleanWork(null),null);
assert.equal(cleanWork('wrong type'),null);
const bounded = cleanWork({...work,title:'x'.repeat(100),wish:'x'.repeat(200),referenceIds:[325,'317',-1,0,1.5,...Array.from({length:30},(_,i)=>i+1)],isExample:'true',target:'unknown',extra:'ignored'});
assert.equal(bounded.title.length,60);
assert.equal(bounded.wish.length,140);
assert.equal(bounded.referenceIds.length,20);
assert.ok(bounded.referenceIds.every(id=>Number.isInteger(id)&&id>0));
assert.equal(bounded.target,'self');
assert.equal(bounded.isExample,false);
assert.equal(bounded.extra,undefined);
const safeReferences=cleanWork({...work,productionSourceId:'317',referenceSources:[{id:325,name:'龙王',sources:[{title:'unsafe',url:'javascript:alert(1)'},{title:'source',url:'https://www.zgnuoxi.com/mianju/view_1389.html'}]}]});
assert.equal(safeReferences.productionSourceId,null,'source IDs cannot be inferred from text');
assert.equal(safeReferences.referenceSources[0].sources.length,1);
assert.equal(safeReferences.referenceSources[0].sources[0].title,'source');

const order = createOrder(draft,'DEMO-ABC12-TEST','2026-10-29T12:00:00Z');
assert.equal(order.status,'pending');
assert.equal(order.cost.total,0);
assert.equal(order.payment,'alipay');
assert.equal(order.proofConfirmed,undefined);
draft.work.title='后来改过的作品';
draft.work.referenceIds.push(317);
draft.work.referenceSources[0].note='后来修改的参考理由';
draft.work.referenceSources[0].sources[0].title='后来修改的来源';
draft.selection.quantity=5;
draft.card.wish='后来修改的心意';
draft.address.street='另一条路';
assert.equal(order.work.title,'送给朋友');
assert.deepEqual(order.work.referenceIds,[325]);
assert.equal(order.work.referenceSources[0].note,'分枝角与卷须');
assert.equal(order.work.referenceSources[0].sources[0].title,'龙王作品资料');
assert.equal(order.work.productionSourceId,325);
assert.equal(order.selection.quantity,2);
assert.equal(order.card.wish,'愿你一路平安');
assert.equal(order.address.street,'示例路 1 号');
assert.equal(order.cost.total,0,'the submitted order remains an independent snapshot');

for (const status of ['pending','payment-failed','paid','making','shipped','complete']) assert.equal(cleanOrder({...order,status}).status,status);
const forged = cleanOrder({...order,status:'<script>alert(1)</script>',payment:'fake',cost:{total:-1},selection:{quantity:99},card:{include:false,wish:123},address:{phone:123},untrusted:'ignored'});
assert.equal(forged.status,'pending');
assert.equal(forged.payment,'wechat');
assert.equal(forged.cost.total,0,'stored costs are always recomputed');
assert.equal(forged.card.include,false);
assert.equal(forged.card.wish,'');
assert.equal(forged.address.phone,'');
assert.equal(forged.untrusted,undefined);
for (const id of ['', 'REAL-ABC12', 'DEMO-x', 'DEMO-<script>']) assert.equal(cleanOrder({...order,id}),null);
assert.equal(cleanOrder({...order,work:{...work,image:'https://example.org/a.png'}}),null);
assert.equal(createOrder(draft,'bad-id',''),null);
assert.equal(cleanOrder(null),null);

// A damaged JSON record must not crash the whole checkout/order-list page.
assert.deepEqual(cleanSelection(null),cleanSelection({}));
assert.equal(cleanSelection({quantity:JSON.parse('{"valueOf":null,"toString":null}')}).quantity,1,'malformed quantity objects do not invoke number coercion');
assert.equal(cleanOrder({...order,selection:null,card:null,address:null}).cost.total,0);
assert.equal(cleanOrder({...order,id:['DEMO-ABC12']}),null,'IDs must remain strings, not regex-coerced JSON values');
const polluted = cleanOrder({...order,selection:JSON.parse('{"__proto__":{"polluted":true}}')});
assert.equal(polluted.selection.polluted,undefined);
assert.equal({}.polluted,undefined);
const previousPaidOrder=cleanOrder({...order,cost:{unit:29800,product:59600,packaging:5600,shipping:1200,total:66400}});
assert.deepEqual(previousPaidOrder.cost,costs(), 'old demo orders also use the current zero-price preview');
console.log('Custom-order checks passed: zero demo prices, allowed images, immutable snapshots and damaged storage.');
