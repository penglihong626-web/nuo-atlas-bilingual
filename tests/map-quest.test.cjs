/* Run: node tests/map-quest.test.cjs. Exercises the real map, routes and progress rules. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const gamePath = path.join(__dirname, '..', 'nuo-stickman-mask-game');
for (const relative of ['index.html', 'nuo-stickman-mask-game/index.html', 'nuo-stickman-mask-game/embed.html']) {
  const entryPath = path.join(__dirname, '..', relative);
  const html = fs.readFileSync(entryPath, 'utf8');
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)].map(match => match[1].split('?')[0]);
  const styles = [...html.matchAll(/<link\b[^>]*\bhref=["']([^"']+)["']/gi)].map(match => match[1].split('?')[0]);
  const names = scripts.map(src => path.basename(src));
  assert.equal(names.filter(name => name === 'map-quest-data.js').length, 1, `${relative}: map data loads exactly once`);
  assert.equal(names.filter(name => name === 'map-quest.js').length, 1, `${relative}: map game loads exactly once`);
  assert.ok(names.indexOf('map-quest-data.js') < names.indexOf('map-quest.js'), `${relative}: map data loads before its engine`);
  assert.ok(!names.includes('chapters.js') && !names.includes('panguan.js'), `${relative}: old engines cannot overwrite the map API`);
  const style = styles.find(src => path.basename(src) === 'map-quest.css');
  assert.ok(style, `${relative}: includes the map UI stylesheet`);
  for (const src of [...scripts.filter(src => /^map-quest(?:-data)?\.js$/.test(path.basename(src))), style]) {
    assert.ok(fs.existsSync(path.resolve(path.dirname(entryPath), src)), `${relative}: ${src} resolves to a real local asset`);
  }
}
const context = vm.createContext({ window: {}, URL, document: { currentScript: { src: 'http://localhost/nuo-stickman-mask-game/map-quest.js' } } });
for (const name of ['map-quest-data.js', 'map-quest.js']) vm.runInContext(fs.readFileSync(path.join(gamePath, name), 'utf8'), context, { filename: name });
const { project, inside, provinceAt, buildMap, findRoute, attempt, restore, cameraView, easeCamera, walkFrame } = context.window.NuoMapQuestMath;
const items = context.window.NUO_MAP_QUEST_ITEMS;
const plain = value => JSON.parse(JSON.stringify(value));
const geo = JSON.parse(fs.readFileSync(path.join(gamePath, 'data/china-provinces.geojson'), 'utf8'));
const map = buildMap(geo);
const point = (x, y) => ({ x, y });
const ring = coordinates => coordinates.map(([x, y]) => point(x, y));

const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-8, `${message}: ${actual} ≈ ${expected}`);
const groundHeight = 760 * .68;
for (const aspect of [.65, 1, 1.8, 3.2]) {
  const overview = cameraView(point(620, 430), 1, aspect);
  near(overview.w / overview.h, aspect, 'overview matches the viewport aspect without stretching geography');
  assert.ok(overview.x <= 1e-8 && overview.y <= 1e-8, 'overview includes the northwest map corner');
  assert.ok(overview.x + overview.w >= 1000 - 1e-8 && overview.y + overview.h >= groundHeight - 1e-8, 'overview includes the southeast map corner');
  near(overview.x + overview.w / 2, 500, 'overview stays centered on the whole map');
  near(overview.y + overview.h / 2, groundHeight / 2, 'overview stays centered vertically');
  assert.deepEqual(plain(cameraView(point(10, 20), 1, aspect)), plain(overview), 'whole-map mode does not drift with the player');
  for (const player of [point(620, 430), point(40, 40), point(940, 700)]) {
    const following = cameraView(player, 2.2, aspect);
    near(following.w / following.h, aspect, 'following camera keeps the same map proportions');
    near((player.x - following.x) / following.w, .5, 'player remains horizontally centered even near a map edge');
    near((player.y * .68 - following.y) / following.h, .6, 'player feet remain below center, leaving space to see ahead');
    assert.ok(following.w * following.h < overview.w * overview.h, 'the default travelling view visibly enlarges the map');
    const closer = cameraView(player, 3, aspect);
    assert.ok(closer.w < following.w && closer.h < following.h, 'zooming in shows a smaller region');
  }
}

const cameraStart = { x: -200, y: 80, w: 1000, h: 700 };
const cameraTarget = { x: 300, y: -40, w: 500, h: 280 };
const cameraFields = ['x', 'y', 'w', 'h'];
const originalStart = { ...cameraStart }, originalTarget = { ...cameraTarget };
assert.deepEqual(plain(easeCamera(cameraStart, cameraTarget, 0)), cameraStart, 'no elapsed time means no camera movement');
assert.deepEqual(plain(easeCamera(cameraStart, cameraTarget, -.1)), cameraStart, 'negative frame times cannot move the camera backwards');
assert.deepEqual(plain(easeCamera(cameraStart, cameraTarget, 1 / 60, true)), cameraTarget, 'reduced motion immediately settles the camera');
let previousCamera = cameraStart;
for (let frame = 0; frame < 120; frame++) {
  const nextCamera = easeCamera(previousCamera, cameraTarget, 1 / 60);
  for (const field of cameraFields) {
    assert.ok(Number.isFinite(nextCamera[field]), `camera ${field} remains finite`);
    assert.ok(Math.abs(nextCamera[field] - cameraTarget[field]) <= Math.abs(previousCamera[field] - cameraTarget[field]) + 1e-8, `camera ${field} approaches its target monotonically`);
    assert.ok(nextCamera[field] >= Math.min(cameraStart[field], cameraTarget[field]) - 1e-8 && nextCamera[field] <= Math.max(cameraStart[field], cameraTarget[field]) + 1e-8, `camera ${field} never overshoots`);
  }
  previousCamera = nextCamera;
}
function cameraAfterOneSecond(fps) {
  let view = cameraStart;
  for (let frame = 0; frame < fps; frame++) view = easeCamera(view, cameraTarget, 1 / fps);
  return view;
}
const cameraAt30 = cameraAfterOneSecond(30), cameraAt120 = cameraAfterOneSecond(120);
for (const field of cameraFields) near(cameraAt30[field], cameraAt120[field], `camera ${field} follows equally on slow and fast screens`);
assert.ok(Math.abs(cameraAt30.x - cameraTarget.x) < Math.abs(cameraStart.x - cameraTarget.x) * .12, 'camera catches up promptly rather than trailing indefinitely');
assert.deepEqual(plain(easeCamera(cameraStart, cameraTarget, 10)), plain(easeCamera(cameraStart, cameraTarget, .1)), 'resuming after a long frame cannot make the camera jump');
assert.deepEqual(cameraStart, originalStart, 'camera easing does not mutate the current frame');
assert.deepEqual(cameraTarget, originalTarget, 'camera easing does not mutate its destination');

// A stride follows distance travelled, so releasing a control cannot restart the legs.
const circularNear = (actual, expected, message) => near(Math.atan2(Math.sin(actual - expected), Math.cos(actual - expected)), 0, message);
function walkFor(fps, seconds = 1, speed = 78) {
  let pose = { phase: .7, strength: 0 };
  for (let frame = 0; frame < fps * seconds; frame++) pose = walkFrame(pose, speed / fps, 1 / fps);
  return pose;
}
const walkAt30 = walkFor(30), walkAt120 = walkFor(120);
circularNear(walkAt30.phase, walkAt120.phase, 'equal walking distance gives equal stride phase on slow and fast screens');
circularNear(walkAt30.phase, .7 + 78 / 62 * Math.PI * 2, 'one stride advances over its travelled distance');
near(walkAt30.strength, walkAt120.strength, 'walking eases in equally across frame rates');
const walking = { ...walkAt120 }, walkingBefore = { ...walking };
let resting = walkFrame(walking, 0, 1 / 60);
assert.ok(resting.strength > 0 && resting.strength < walking.strength, 'releasing a control eases out instead of snapping the body to rest');
for (let frame = 0; frame < 120; frame++) {
  const next = walkFrame(resting, 0, 1 / 60);
  circularNear(next.phase, walking.phase, 'resting preserves the stride phase');
  assert.ok(next.strength >= 0 && next.strength <= resting.strength, 'rest settles monotonically without overshooting');
  resting = next;
}
assert.ok(resting.strength < .001, 'the character settles promptly after stopping');
const resumed = walkFrame(resting, 78 / 60, 1 / 60);
circularNear(resumed.phase, resting.phase + 78 / 60 / 62 * Math.PI * 2, 'resuming continues the previous step rather than starting a fresh animation');
assert.ok(resumed.strength > resting.strength && resumed.strength < 1, 'resuming eases the walk back in');
assert.deepEqual(walking, walkingBefore, 'walking pose calculation does not mutate the previous frame');
assert.deepEqual(plain(walkFrame(walking, 0, 10)), plain(walkFrame(walking, 0, .1)), 'a long suspended frame cannot snap the stopping animation');
for (const speed of [0, 20, 78, 100, 1000]) {
  let pose = { phase: 0, strength: 0 };
  for (let frame = 0; frame < 180; frame++) {
    const previousStrength = pose.strength;
    pose = walkFrame(pose, speed / 60, 1 / 60);
    for (const field of ['phase', 'strength', 'stride', 'liftA', 'liftB', 'bob']) assert.ok(Number.isFinite(pose[field]), `${field} stays finite at speed ${speed}`);
    assert.ok(pose.strength >= previousStrength - 1e-8 && pose.strength <= 1, 'walk strength rises monotonically and never exceeds full motion');
    assert.ok(Math.abs(pose.stride) <= pose.strength + 1e-8, 'leg swing stays within the current walking strength');
    for (const field of ['liftA', 'liftB', 'bob']) assert.ok(pose[field] >= 0 && pose[field] <= pose.strength + 1e-8, `${field} remains in its normalized range`);
    assert.ok(pose.liftA * pose.liftB < 1e-8, 'only one foot lifts at a time');
  }
}
const oneStep = walkFrame({ phase: .7, strength: .8 }, 1, 1 / 60);
const oneStepLater = walkFrame({ phase: .7 + 2 * Math.PI, strength: .8 }, 1, 1 / 60);
for (const field of ['stride', 'liftA', 'liftB', 'bob']) near(oneStep[field], oneStepLater[field], `${field} repeats smoothly each stride cycle`);
for (const dt of [0, -1]) {
  const still = walkFrame({ phase: .7, strength: .4 }, 0, dt);
  circularNear(still.phase, .7, 'non-positive frame time preserves the stride phase');
  near(still.strength, .4, 'non-positive frame time preserves the current animation strength');
  assert.ok(Object.values(still).every(Number.isFinite), 'a paused frame keeps all body positions finite');
}

assert.equal(items.length, 10, 'the journey has ten distinct mask tasks');
assert.equal(new Set(items.map(item => item.id)).size, 10);
assert.equal(new Set(items.map(item => item.propKind)).size, 10);
assert.equal(map.length, 34, 'linework is not counted as a province');
assert.ok(map.some(province => province.name === '台湾'));
assert.ok(map.some(province => province.name === '香港'));
assert.ok(map.some(province => province.name === '澳门'));
assert.ok(project([120, 30]).x > project([110, 30]).x, 'east is right');
assert.ok(project([110, 40]).y < project([110, 30]).y, 'north is up');
for (const province of [...new Set(items.map(item => item.province)), '湖北']) {
  const feature = map.find(feature => feature.name === province);
  assert.ok(feature, `${province} has actual map geometry`);
  assert.equal(provinceAt(map, feature.center)?.name, province, `${province} beacon is inside its own province`);
}
for (const [coordinates, province] of [[[106.713, 26.578], '贵州'], [[119.306, 26.075], '福建'], [[108.320, 22.824], '广西'], [[112.982, 28.194], '湖南'], [[115.892, 28.676], '江西'], [[114.299, 30.584], '湖北']]) {
  assert.equal(provinceAt(map, project(coordinates))?.name, province, 'known geographical position');
}
assert.equal(provinceAt(map, project([125, 25])), null, 'open sea is not a province');
for (const badPoint of [null, undefined, {}, point(NaN, 10), point(20, Infinity), point('100', 100), point(-500, -500)]) assert.equal(provinceAt(map, badPoint), null);

const square = ring([[0, 0], [20, 0], [20, 20], [0, 20], [0, 0]]);
assert.equal(inside(point(10, 10), square), true);
assert.equal(inside(point(25, 10), square), false);
assert.equal(inside(point(10, 10), [...square].reverse()), true, 'ring winding does not change containment');
const synthetic = buildMap({ features: [
  { properties: { name: '测试省', center: [105, 35] }, geometry: { type: 'Polygon', coordinates: [[[100, 30], [110, 30], [110, 40], [100, 40], [100, 30]], [[104, 34], [106, 34], [106, 36], [104, 36], [104, 34]]] } },
  { properties: { name: '群岛省', centroid: [114.5, 30.5] }, geometry: { type: 'MultiPolygon', coordinates: [[[[114, 30], [115, 30], [115, 31], [114, 31], [114, 30]]], [[[117, 30], [118, 30], [118, 31], [117, 31], [117, 30]]]] } }
] });
assert.equal(provinceAt(synthetic, project([102, 32]))?.name, '测试');
assert.equal(provinceAt(synthetic, project([105, 35])), null, 'a polygon hole remains unwalkable');
assert.equal(provinceAt(synthetic, project([114.5, 30.5]))?.name, '群岛');
assert.equal(provinceAt(synthetic, project([117.5, 30.5]))?.name, '群岛', 'all disconnected polygon parts are represented');
assert.equal(provinceAt(synthetic, project([116, 30.5])), null, 'water between polygon parts is not filled');

const judge = items.find(item => item.id === 'panguan');
const fellow = items.find(item => item.province === judge.province && item.id !== judge.id);
const foreign = items.find(item => item.province !== judge.province);
const lit = [];
assert.equal(attempt(items, lit, judge.province, judge.id, '').reason, 'select');
assert.equal(attempt(items, lit, judge.province, judge.id, 'not-a-prop').reason, 'select');
assert.equal(attempt(items, lit, foreign.province, judge.id, judge.id).reason, 'province');
assert.equal(attempt(items, lit, judge.province, judge.id, fellow.id).reason, 'mask', 'same province still requires matching the current mask');
assert.equal(attempt(items, lit, judge.province, '', judge.id).ok, false, 'a province alone cannot identify the active task');
assert.equal(lit.length, 0, 'failed attempts never award progress');
const first = attempt(items, lit, judge.province, judge.id, judge.id);
assert.equal(first.ok, true); assert.equal(first.reason, 'ok'); assert.equal(first.item.id, judge.id);
assert.equal(lit.length, 0, 'the pure matching rule does not mutate progress');
lit.push(first.item.id);
assert.equal(attempt(items, lit, judge.province, judge.id, judge.id).reason, 'duplicate');
assert.equal(attempt(items, lit, fellow.province, fellow.id, fellow.id).ok, true, 'lighting one mask does not finish other masks in its province');
for (const item of [...items].reverse()) {
  if (lit.includes(item.id)) continue;
  const result = attempt(items, lit, item.province, item.id, item.id);
  assert.equal(result.ok, true, `${item.name} can be completed without a prescribed order`);
  lit.push(result.item.id);
}
assert.equal(new Set(lit).size, 10, 'all ten separate masks can be lit');
assert.ok(items.every(item => attempt(items, lit, item.province, item.id, item.id).reason === 'duplicate'));

const home = map.find(province => province.name === '湖北').center;
const validPosition = map.find(province => province.name === judge.province).center;
for (const malformed of [null, undefined, {}, [], 'bad JSON value', { version: 0, lit, position: validPosition }, { version: 99, lit, position: validPosition }]) {
  const state = restore(malformed, items, map);
  assert.deepEqual(plain(state.lit), []);
  assert.deepEqual(plain(state.position), plain(home));
}
for (const invalidPosition of [null, {}, point(NaN, 0), point(0, Infinity), point('500', 500), project([125, 25])]) {
  const state = restore({ version: 1, lit: [judge.id], position: invalidPosition }, items, map);
  assert.deepEqual(plain(state.lit), [judge.id], 'invalid position must not erase valid mask progress');
  assert.deepEqual(plain(state.position), plain(home));
}
const saved = { version: 1, lit: [judge.id, judge.id, 'unknown', null, {}, fellow.id], position: { ...validPosition } };
const recovered = restore(saved, items, map);
assert.deepEqual(plain(recovered.lit), [judge.id, fellow.id], 'unknown IDs, duplicates and invalid records are discarded');
assert.deepEqual(plain(recovered.position), plain(validPosition));
recovered.position.x += 1; recovered.lit.push(foreign.id);
assert.deepEqual(saved.position, { ...validPosition }, 'restored position does not alias saved input');
assert.equal(saved.lit.length, 6, 'restored progress does not alias saved input');
assert.deepEqual(plain(restore({ version: 1, lit: 'all', position: validPosition }, items, map).lit), []);
assert.equal(restore({ version: 1, lit, position: validPosition }, items, map).lit.length, 10, 'a completed journey survives reload');

function checkLandRoute(features, start, end, label) {
  const route = findRoute(features, start, end);
  assert.ok(route.length, `${label}: connected land has a route`);
  assert.deepEqual(plain(route.at(-1)), plain(end), `${label}: reaches the intended destination`);
  let previous = start;
  for (const next of route) {
    const steps = Math.max(1, Math.ceil(Math.hypot(next.x - previous.x, next.y - previous.y)));
    for (let i = 0; i <= steps; i++) {
      const sample = point(previous.x + (next.x - previous.x) * i / steps, previous.y + (next.y - previous.y) * i / steps);
      assert.ok(provinceAt(features, sample), `${label}: route crosses water at ${JSON.stringify(sample)}`);
    }
    previous = next;
  }
  return route;
}
const taskProvinces = [...new Set(['湖北', ...items.map(item => item.province)])].map(name => map.find(feature => feature.name === name));
for (let i = 0; i < taskProvinces.length; i++) for (let j = i + 1; j < taskProvinces.length; j++) {
  const a = taskProvinces[i], b = taskProvinces[j];
  checkLandRoute(map, a.center, b.center, `${a.name} → ${b.name}`);
}
function land(name, coordinates) {
  const outline = ring(coordinates);
  return { name, polygons: [[outline]], bounds: { minX: Math.min(...outline.map(p => p.x)), maxX: Math.max(...outline.map(p => p.x)), minY: Math.min(...outline.map(p => p.y)), maxY: Math.max(...outline.map(p => p.y)) } };
}
const bay = [land('绕湾陆地', [[100, 100], [180, 100], [180, 180], [160, 180], [160, 120], [120, 120], [120, 180], [100, 180], [100, 100]])];
const detour = checkLandRoute(bay, point(110, 170), point(170, 170), 'A* around a water inlet');
assert.ok(detour.length > 1, 'the water inlet requires a detour rather than a direct route');
const islands = [land('西岛', [[100, 100], [130, 100], [130, 130], [100, 130], [100, 100]]), land('东岛', [[170, 100], [200, 100], [200, 130], [170, 130], [170, 100]])];
assert.equal(findRoute(islands, point(115, 115), point(185, 115)).length, 0, 'disconnected islands cannot be reached by walking');
assert.equal(findRoute(map, home, project([125, 25])).length, 0, 'cannot walk to open sea');
assert.equal(findRoute(map, project([125, 25]), home).length, 0, 'invalid starting position is rejected');

console.log('map quest: three entry points, geography, adaptive camera, smooth following and walking, ten independent tasks, progress recovery and land-only routes passed');
