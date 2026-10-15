/* Run: node tests/color-atlas-model.test.cjs */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const model = require('../color-atlas-model.js');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../color-atlas/data/trial_result.json'), 'utf8'));
const archiveContext = {window: {}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../data/masks.js'), 'utf8'), archiveContext);
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-10, `${message}: ${actual} vs ${expected}`);

const original = JSON.stringify(data);
const result = model.build(data, archiveContext.window.NUO_MASK_ATLAS.nodes);
assert.equal(JSON.stringify(data), original, 'building statistics does not mutate source data');
assert.equal(result.total, 483);
assert.equal(result.masks.length, 483);
assert.equal(result.palette.length, 88);
assert.equal(result.regions.length, 25);
assert.equal(result.families.length, 10);
assert.deepEqual(result.issues, []);
assert.equal(result.masks.filter(mask => mask.archive_id !== null && mask.name && mask.source_url && mask.outline).length, 483);
assert.equal(result.masks.filter(mask => mask.numericId === mask.archive_id).length, 483);
assert.equal(result.regions.find(region => region.region === '未明确地区').count, 72);
assert.equal(result.regions.find(region => region.region === '江西·南丰（推定）').count, 96);
close(result.recorded_share, 0.9618438062452885, 'recorded shares preserve source coverage');
close(result.residual, 1 - result.recorded_share, 'missing shares remain visible');
close(result.families.reduce((sum, family) => sum + family.share, 0), result.recorded_share, 'family shares use the same denominator');
for (const color of result.palette) {
  const direct = result.masks.reduce((sum, mask) => sum + (mask.colors.find(row => row.color_id === color.color_id)?.share || 0), 0) / result.total;
  const regional = result.regions.reduce((sum, region) => sum + region.count * (region.colors.find(row => row.color_id === color.color_id)?.share || 0), 0) / result.total;
  close(color.global_share, direct, 'global means include images where color is absent');
  close(color.global_share, regional, 'regional weighted means equal global means');
  assert.equal(color.image_count, result.masks.filter(mask => mask.colors.some(row => row.color_id === color.color_id)).length);
}
const black = result.palette.find(color => color.color_id === 'Nuo-Black-01');
assert.equal(black.image_count, 388);
assert.equal(black.audit.image_count, 217);
assert.equal(black.audit.global_ratio, data.global_palette.find(color => color.color_id === black.color_id).global_ratio);
assert.notEqual(black.global_share, black.audit.global_ratio, 'candidate weight is not relabeled as pixel share');
assert.equal(black.global_ratio, undefined, 'old candidate share is only exposed through audit');
assert.equal(model.filterMasks(result.masks).length, 483, 'pure model has no 80-item display cap');
assert.equal(model.filterMasks(result.masks, {query: '龙王'}).every(mask => mask.name.includes('龙王')), true);
assert.ok(model.filterMasks(result.masks, {query: '龙王'}).length > 0);
assert.equal(model.filterMasks(result.masks, {colorId: black.color_id}).length, 388);
assert.equal(model.filterMasks(result.masks, {query: 'not-a-mask'}).length, 0);
assert.equal(model.filterMasks(result.masks, {region: 'missing-region'}).length, 0);
assert.ok(model.filterPalette(result.palette, {family: 'red'}).every(color => color.family === 'red'));
assert.equal(model.filterPalette(result.palette, {query: '  #22201e '})[0].color_id, black.color_id);
assert.equal(model.filterPalette(result.palette, {query: 'not-a-color'}).length, 0);
assert.equal(model.filterPalette(result.palette, {family: 'red', query: '#22201e'}).length, 0);
const byImages = model.filterPalette(result.palette, {sort: 'images'});
assert.ok(byImages.every((item, index) => index === 0 || byImages[index - 1].image_count >= item.image_count));

const tiny = {
  sample_size: 3,
  global_palette: [{color_id: 'red', family: 'red', family_label: '红色系', hex: '#ff0000', global_ratio: 1, image_count: 99}],
  sample_images: [{image_id: 'a', filename: '0001.jpg', region: 'A', mapped_sample_pixels: 100},
    {image_id: 'b', region: 'B'}, {image_id: 'c', region: 'B'}],
  image_color_ratios: [{image_id: 'a', color_id: 'red', ratio: .2, mapped_pixel_count: 20},
    {image_id: 'a', color_id: 'red', ratio: .3, mapped_pixel_count: 30},
    {image_id: 'b', color_id: 'red', ratio: .6}]
};
const small = model.build(tiny);
assert.equal(small.masks[0].numericId, 1, 'numeric ID does not depend on archive availability');
assert.equal(small.masks[0].colors.length, 1, 'duplicate image/color rows merge');
assert.equal(small.masks[0].colors[0].mapped_pixel_count, 50);
assert.equal(small.masks[0].colors[0].mapping_count, 2);
close(small.masks[0].colors[0].share, .5, 'merged mapping share');
close(small.palette[0].global_share, 1.1 / 3, 'missing images are included in denominator');
assert.equal(small.palette[0].image_count, 2, 'duplicate mappings do not inflate image counts');
assert.equal(small.masks[2].residual, 1, 'a sample without color mappings remains unrecorded');
close(small.regions.find(region => region.region === 'B').colors[0].share, .3, 'regional denominator includes blank samples');
close(small.residual, 1 - 1.1 / 3, 'no automatic normalization');
const overfull = model.build({...tiny, image_color_ratios: [{image_id: 'a', color_id: 'red', ratio: 1.2}]});
assert.equal(overfull.masks[0].colors[0].share, 1.2, 'overfull data is preserved for audit');
assert.equal(overfull.masks[0].residual, 0);
assert.ok(overfull.issues.some(issue => issue.code === 'image_share_overflow'));
const invalid = model.build({...tiny, image_color_ratios: [
  {image_id: 'missing', color_id: 'red', ratio: .5}, {image_id: 'a', color_id: 'missing', ratio: .2},
  {image_id: 'a', color_id: 'red', ratio: -1}, {image_id: 'a', color_id: 'red', ratio: NaN}]});
assert.deepEqual(invalid.issues.map(issue => issue.code), ['unknown_image', 'unknown_color', 'invalid_ratio', 'invalid_ratio']);
assert.equal(invalid.residual, 1);
const empty = model.build({sample_images: [], global_palette: [], image_color_ratios: []});
assert.equal(empty.total, 0); assert.equal(empty.residual, 0); assert.deepEqual(empty.palette, []);
assert.throws(() => model.build({}), /sample_images/);
assert.throws(() => model.build({...tiny, sample_images: [{image_id: 'a'}, {image_id: 'a'}]}), /unique/);
const browser = {window: {}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../color-atlas-model.js'), 'utf8'), browser);
assert.equal(typeof browser.window.NUO_COLOR_MODEL.build, 'function', 'classic script works without modules or fetch');
console.log('color-atlas-model: 483 samples, consistent global/region statistics, preserved residuals, filters and browser export passed');
