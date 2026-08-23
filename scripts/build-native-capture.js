const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

if (process.platform !== 'darwin') {
  console.log('Native macOS capture is only built on macOS.');
  process.exit(0);
}

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'native', 'oslt-region-capture.swift');
const outputDir = path.join(root, 'native', 'bin');
const output = path.join(outputDir, 'oslt-region-capture');
const moduleCachePath = path.join(os.tmpdir(), 'oslt-swift-module-cache');
fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(moduleCachePath, { recursive: true });

const result = spawnSync('swiftc', [
  source,
  '-O',
  '-module-cache-path',
  moduleCachePath,
  '-o',
  output,
], {
  cwd: root,
  stdio: 'inherit',
});
if (result.status !== 0) process.exit(result.status || 1);
console.log(`Built ${output}`);
