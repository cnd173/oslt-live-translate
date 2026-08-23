const test = require('node:test');
const assert = require('node:assert/strict');
const { detectTextAlign, joinParagraphLines } = require('../lib/layout');

function line(x0, x1, y0) {
  return { text: `line ${y0}`, bbox: { x0, x1, y0, y1: y0 + 12 } };
}

test('detects left, right and centered line groups', () => {
  assert.equal(detectTextAlign([line(10, 90, 0), line(10, 70, 16)]), 'left');
  assert.equal(detectTextAlign([line(10, 90, 0), line(30, 90, 16)]), 'right');
  assert.equal(detectTextAlign([
    line(10, 90, 0),
    line(20, 80, 16),
    line(30, 70, 32),
  ]), 'center');
});

test('keeps source paragraph line breaks for the translator', () => {
  assert.equal(joinParagraphLines([line(0, 10, 0), line(0, 10, 16)]), 'line 0\nline 16');
});
