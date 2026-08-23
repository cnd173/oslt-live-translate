const test = require('node:test');
const assert = require('node:assert/strict');
const { imageSignature } = require('../lib/image-signature');

function fakeImage(pixels) {
  return {
    bitmap: { width: 4, height: 4 },
    getPixelColor(x, y) {
      return pixels[y][x];
    },
  };
}

test('image signature is stable for identical pixels', () => {
  const pixels = Array.from({ length: 4 }, () => Array(4).fill(0x202020ff));
  assert.equal(imageSignature(fakeImage(pixels)), imageSignature(fakeImage(pixels)));
});

test('image signature changes when sampled content changes', () => {
  const original = Array.from({ length: 4 }, () => Array(4).fill(0x202020ff));
  const changed = original.map((row) => [...row]);
  changed[2][2] = 0xe0e0e0ff;
  assert.notEqual(imageSignature(fakeImage(original)), imageSignature(fakeImage(changed)));
});
