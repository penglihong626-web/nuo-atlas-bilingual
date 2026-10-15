/* Pure color statistics. Each image has equal weight; unrecorded shares stay visible. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NUO_COLOR_MODEL = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const EPSILON = 1e-9;
  const FAMILY_ORDER = ['brown', 'black', 'red', 'gray', 'white', 'orange', 'yellow', 'blue', 'green', 'purple', 'other'];
  const text = value => String(value == null ? '' : value);
  const searchText = values => values.flatMap(value => [text(value), typeof window !== 'undefined' && window.NuoI18n ? window.NuoI18n.t(text(value)) : text(value)]).join(' ').toLowerCase();
  const compareText = (a, b) => text(a).localeCompare(text(b), 'zh-CN');
  const byShare = (a, b) => b.share - a.share || compareText(a.color_id || a.family, b.color_id || b.family);

  function build(data, archiveNodes = []) {
    for (const key of ['sample_images', 'global_palette', 'image_color_ratios']) {
      if (!data || !Array.isArray(data[key])) throw new TypeError('Color data requires ' + key + ' array');
    }
    const issues = [];
    const paletteById = new Map();
    const imagesById = new Map();
    const archive = new Map((Array.isArray(archiveNodes) ? archiveNodes : []).map(node => [Number(node.id), node]));
    const palette = data.global_palette.map(color => {
      if (!color || typeof color.color_id !== 'string' || !color.color_id || paletteById.has(color.color_id)) {
        throw new TypeError('Palette color_id must be unique and nonempty');
      }
      const {global_ratio, image_count, candidate_weight, member_count, ...fields} = color;
      const result = {...fields, global_share: 0, image_count: 0,
        audit: {global_ratio, image_count, candidate_weight, member_count}};
      paletteById.set(color.color_id, result);
      return result;
    });
    const masks = data.sample_images.map(image => {
      if (!image || typeof image.image_id !== 'string' || !image.image_id || imagesById.has(image.image_id)) {
        throw new TypeError('Sample image_id must be unique and nonempty');
      }
      const idMatch = /^(\d+)\.[^.]+$/.exec(text(image.filename));
      const source = idMatch ? archive.get(Number(idMatch[1])) : null;
      const mask = {...image, region: image.region || '未明确地区',
        name: image.name || (source && source.name) || image.filename || image.image_id,
        source_url: image.source_url || (source && source.detailUrl) || '',
        outline: image.outline || (source && source.image) || '',
        numericId: idMatch ? Number(idMatch[1]) : null, archive_id: source ? source.id : null,
        colors: [], families: [], recorded_share: 0, residual: 1, overflow: 0};
      imagesById.set(image.image_id, {mask, colors: new Map()});
      return mask;
    });
    data.image_color_ratios.forEach((row, index) => {
      const image = row && imagesById.get(row.image_id);
      const color = row && paletteById.get(row.color_id);
      if (!image || !color) {
        issues.push({code: !image ? 'unknown_image' : 'unknown_color', index,
          image_id: row && row.image_id, color_id: row && row.color_id});
        return;
      }
      if (typeof row.ratio !== 'number' || !Number.isFinite(row.ratio) || row.ratio < 0) {
        issues.push({code: 'invalid_ratio', index, image_id: row.image_id, color_id: row.color_id});
        return;
      }
      if (!image.colors.has(row.color_id)) {
        image.colors.set(row.color_id, {color_id: color.color_id, name: color.name,
          family: color.family, family_label: color.family_label, hex: color.hex,
          share: 0, ratio: 0, mapped_pixel_count: 0, mapping_count: 0});
      }
      const item = image.colors.get(row.color_id);
      item.share += row.ratio;
      item.ratio = item.share;
      item.mapping_count += 1;
      if (Number.isFinite(row.mapped_pixel_count) && row.mapped_pixel_count >= 0) {
        item.mapped_pixel_count += row.mapped_pixel_count;
        if (image.mask.mapped_sample_pixels > 0 &&
            Math.abs(row.mapped_pixel_count / image.mask.mapped_sample_pixels - row.ratio) > EPSILON) {
          issues.push({code: 'pixel_ratio_mismatch', index, image_id: row.image_id, color_id: row.color_id});
        }
      }
    });

    for (const {mask, colors} of imagesById.values()) {
      mask.colors = Array.from(colors.values()).filter(color => color.share > 0).sort(byShare);
      mask.recorded_share = mask.colors.reduce((sum, color) => sum + color.share, 0);
      // Do not redistribute missing pixels among known colors or disguise overfull data.
      mask.residual = Math.max(0, 1 - mask.recorded_share);
      mask.overflow = Math.max(0, mask.recorded_share - 1);
      if (mask.overflow > EPSILON) issues.push({code: 'image_share_overflow', image_id: mask.image_id, share: mask.recorded_share});
      const families = new Map();
      mask.colors.forEach(color => {
        const globalColor = paletteById.get(color.color_id);
        globalColor.global_share += color.share / masks.length;
        globalColor.image_count += 1;
        if (!families.has(color.family)) families.set(color.family, {family: color.family, family_label: color.family_label, share: 0});
        families.get(color.family).share += color.share;
      });
      mask.families = Array.from(families.values()).sort(byShare);
    }

    function summarize(group) {
      const colors = new Map(), families = new Map();
      let residual = 0, recordedShare = 0, overflow = 0;
      group.forEach(mask => {
        residual += mask.residual / group.length;
        recordedShare += mask.recorded_share / group.length;
        overflow += mask.overflow / group.length;
        mask.colors.forEach(color => {
          if (!colors.has(color.color_id)) colors.set(color.color_id, {
            color_id: color.color_id, name: color.name, family: color.family,
            family_label: color.family_label, hex: color.hex, share: 0, image_count: 0});
          const item = colors.get(color.color_id);
          item.share += color.share / group.length;
          item.image_count += 1;
        });
        mask.families.forEach(family => {
          if (!families.has(family.family)) families.set(family.family, {
            family: family.family, family_label: family.family_label, share: 0, image_count: 0});
          const item = families.get(family.family);
          item.share += family.share / group.length;
          item.image_count += 1;
        });
      });
      return {count: group.length, colors: Array.from(colors.values()).sort(byShare),
        families: Array.from(families.values()).sort(byShare), recorded_share: recordedShare, residual, overflow};
    }
    const grouped = new Map();
    masks.forEach(mask => {
      if (!grouped.has(mask.region)) grouped.set(mask.region, []);
      grouped.get(mask.region).push(mask);
    });
    const regions = Array.from(grouped, ([region, group]) => ({region, ...summarize(group)}))
      .sort((a, b) => b.count - a.count || compareText(a.region, b.region));
    const global = summarize(masks);
    if (Number.isFinite(data.sample_size) && data.sample_size !== masks.length) {
      issues.push({code: 'sample_size_mismatch', declared: data.sample_size, actual: masks.length});
    }
    return {palette: palette.sort((a, b) => b.global_share - a.global_share || compareText(a.color_id, b.color_id)),
      masks, regions, families: global.families, residual: global.residual,
      recorded_share: global.recorded_share, overflow: global.overflow, total: masks.length, issues,
      method: {aggregation: 'equal_image_mean', ratio_basis: 'recorded_foreground_pixel_ratio',
        residual_policy: 'preserved', per_image_colors: data.per_image_colors,
        merge_threshold_delta_e_2000: data.merge_threshold_delta_e_2000,
        original_family_summary: data.family_summary || []}};
  }

  function filterPalette(palette, {family = 'all', query = '', sort = 'weight'} = {}) {
    const needle = text(query).trim().toLowerCase();
    const order = family => { const index = FAMILY_ORDER.indexOf(family); return index < 0 ? FAMILY_ORDER.length : index; };
    const sorters = {
      weight: (a, b) => b.global_share - a.global_share,
      images: (a, b) => b.image_count - a.image_count,
      lightness: (a, b) => (Number(b.lab && b.lab[0]) || 0) - (Number(a.lab && a.lab[0]) || 0),
      family: (a, b) => order(a.family) - order(b.family) || b.global_share - a.global_share
    };
    return palette.filter(color => (family === 'all' || color.family === family) &&
      (!needle || searchText([color.color_id, color.name, color.family, color.family_label, color.hex]).includes(needle)))
      .sort((a, b) => (sorters[sort] || sorters.weight)(a, b) || compareText(a.color_id, b.color_id));
  }

  function filterMasks(masks, {region = 'all', query = '', colorId = ''} = {}) {
    const needle = text(query).trim().toLowerCase();
    return masks.filter(mask => (region === 'all' || mask.region === region) &&
      (!needle || searchText([mask.filename, mask.image_id, mask.name, mask.region]).includes(needle)) &&
      (!colorId || mask.colors.some(color => color.color_id === colorId && color.share > 0)));
  }

  return {build, filterPalette, filterMasks};
});
