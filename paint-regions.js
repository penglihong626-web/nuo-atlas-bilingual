/* Select a connected area in visible Canvas RGBA pixels; never changes the image. */
(function () {
  var MAX_IMAGE_PIXELS = 4000000;

  function findRegion(pixels, width, height, x, y, options) {
    var empty = { indices: new Uint32Array(0), touchesEdge: false, tooLarge: false, invalid: false };
    var count = width * height;
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 ||
        !Number.isSafeInteger(count) || !ArrayBuffer.isView(pixels) || pixels.BYTES_PER_ELEMENT !== 1 ||
        pixels.length !== count * 4 || !Number.isFinite(x) || !Number.isFinite(y) ||
        x < 0 || x >= width || y < 0 || y >= height) {
      empty.invalid = true;
      return empty;
    }
    // ponytail: bounded synchronous search; tile or move to a worker if the artboard grows beyond 4M pixels.
    if (count > MAX_IMAGE_PIXELS) { empty.tooLarge = true; return empty; }
    options = options || {};
    var tolerance = options.tolerance === undefined ? 32 : options.tolerance;
    var limit = options.maxPixels === undefined ? count : options.maxPixels;
    if (!Number.isFinite(tolerance) || tolerance < 0 || tolerance > 255 || !Number.isInteger(limit) || limit < 1) {
      empty.invalid = true;
      return empty;
    }
    limit = Math.min(count, limit);
    var queue = new Uint32Array(limit);
    var visited = new Uint8Array(count);
    var seed = Math.floor(y) * width + Math.floor(x);
    var seedOffset = seed * 4;
    var alpha = pixels[seedOffset + 3];
    var red = pixels[seedOffset] * alpha / 255;
    var green = pixels[seedOffset + 1] * alpha / 255;
    var blue = pixels[seedOffset + 2] * alpha / 255;
    var end = 1, head = 0, touchesEdge = false, tooLarge = false;
    queue[0] = seed;
    visited[seed] = 1;

    function visit(index) {
      if (visited[index]) return;
      visited[index] = 1;
      var offset = index * 4, candidateAlpha = pixels[offset + 3];
      // Compare every pixel to the seed, so a gradual color ramp cannot walk across an outline.
      // Premultiplied colors ignore hidden RGB in fully transparent pixels.
      if (Math.abs(candidateAlpha - alpha) > tolerance ||
          Math.abs(pixels[offset] * candidateAlpha / 255 - red) > tolerance ||
          Math.abs(pixels[offset + 1] * candidateAlpha / 255 - green) > tolerance ||
          Math.abs(pixels[offset + 2] * candidateAlpha / 255 - blue) > tolerance) return;
      if (end === limit) { tooLarge = true; return; }
      queue[end++] = index;
    }

    while (head < end && !tooLarge) {
      var index = queue[head++], column = index % width;
      if (column === 0 || column === width - 1 || index < width || index >= count - width) touchesEdge = true;
      if (column > 0) visit(index - 1);
      if (column < width - 1) visit(index + 1);
      if (index >= width) visit(index - width);
      if (index < count - width) visit(index + width);
    }
    return { indices: queue.subarray(0, end), touchesEdge: touchesEdge, tooLarge: tooLarge, invalid: false };
  }

  var api = { findRegion: findRegion };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.NuoPaintRegions = api;
})();
