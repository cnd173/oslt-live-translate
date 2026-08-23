const { intToRGBA } = require('jimp');

function imageSignature(image, sampleWidth = 48, sampleHeight = 32) {
  const width = image.bitmap.width;
  const height = image.bitmap.height;
  let hash = 2166136261;

  function add(value) {
    hash ^= value & 0xff;
    hash = Math.imul(hash, 16777619);
  }

  add(width);
  add(width >> 8);
  add(height);
  add(height >> 8);

  for (let row = 0; row < sampleHeight; row += 1) {
    const y = Math.min(height - 1, Math.floor((row + 0.5) * height / sampleHeight));
    for (let column = 0; column < sampleWidth; column += 1) {
      const x = Math.min(width - 1, Math.floor((column + 0.5) * width / sampleWidth));
      const { r, g, b } = intToRGBA(image.getPixelColor(x, y));
      add(r >> 4);
      add(g >> 4);
      add(b >> 4);
    }
  }

  return `${width}x${height}:${hash >>> 0}`;
}

module.exports = { imageSignature };
