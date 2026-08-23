const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildRegionArgs,
  nativeCapturePath,
} = require('../lib/screen-capture');

test('builds stable native capture arguments from window bounds', () => {
  assert.deepEqual(
    buildRegionArgs(
      { x: 12.4, y: 48.8, width: 640.2, height: 320.7 },
      1234,
      '/tmp/oslt-capture.png'
    ),
    ['12', '49', '640', '321', '1234', '/tmp/oslt-capture.png']
  );
});

test('native helper lives outside the tracked build output', () => {
  assert.match(nativeCapturePath, /native[\\/]bin[\\/]oslt-region-capture$/);
});
