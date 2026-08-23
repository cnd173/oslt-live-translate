const fs = require('fs/promises');
const fsSync = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const screenshotDesktop = require('screenshot-desktop');

const localNativeCapturePath = path.join(
  __dirname,
  '..',
  'native',
  'bin',
  'oslt-region-capture'
);
const packagedNativeCapturePath = process.resourcesPath
  ? path.join(process.resourcesPath, 'native', 'bin', 'oslt-region-capture')
  : '';
const nativeCapturePath = fsSync.existsSync(packagedNativeCapturePath)
  ? packagedNativeCapturePath
  : localNativeCapturePath;

function buildRegionArgs(bounds, excludedPID, outputPath) {
  return [
    String(Math.round(bounds.x)),
    String(Math.round(bounds.y)),
    String(Math.round(bounds.width)),
    String(Math.round(bounds.height)),
    String(excludedPID),
    outputPath,
  ];
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    const errors = [];
    child.stderr.on('data', (chunk) => errors.push(chunk));
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${code}: ${Buffer.concat(errors).toString()}`));
    });
  });
}

async function captureRegionMac(bounds) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oslt-region-'));
  const outputPath = path.join(tempDir, 'capture.png');
  try {
    await run('/usr/sbin/screencapture', [
      '-x',
      '-t',
      'png',
      '-R',
      `${Math.round(bounds.x)},${Math.round(bounds.y)},${Math.round(bounds.width)},${Math.round(bounds.height)}`,
      outputPath,
    ]);
    return {
      buffer: await fs.readFile(outputPath),
      isRegion: true,
      isOverlayExcluded: false,
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function captureRegionWithoutOverlay(bounds) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oslt-region-'));
  const outputPath = path.join(tempDir, 'capture.png');
  try {
    await run(nativeCapturePath, buildRegionArgs(bounds, process.pid, outputPath));
    return {
      buffer: await fs.readFile(outputPath),
      isRegion: true,
      isOverlayExcluded: true,
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

function hasNativeOverlayCapture() {
  return process.platform === 'darwin' && fsSync.existsSync(nativeCapturePath);
}

async function captureScreenRegion(bounds, { excludeOverlay = false } = {}) {
  if (process.platform === 'darwin') {
    if (excludeOverlay && hasNativeOverlayCapture()) {
      try {
        return await captureRegionWithoutOverlay(bounds);
      } catch (error) {
        console.warn('Overlay-excluding capture failed; falling back to region capture:', error.message);
      }
    }
    try {
      return await captureRegionMac(bounds);
    } catch (error) {
      console.warn('Native region capture failed; falling back to full-screen capture:', error.message);
    }
  }
  return {
    buffer: await screenshotDesktop({ format: 'png' }),
    isRegion: false,
    isOverlayExcluded: false,
  };
}

module.exports = {
  buildRegionArgs,
  captureScreenRegion,
  hasNativeOverlayCapture,
  nativeCapturePath,
};
