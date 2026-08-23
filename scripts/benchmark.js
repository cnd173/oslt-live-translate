const fs = require('fs');
const { performance } = require('perf_hooks');
const { Jimp } = require('jimp');
const { createWorker } = require('tesseract.js');

const inputPath = process.argv[2];
const language = process.argv[3] || 'eng';

if (!inputPath || !fs.existsSync(inputPath)) {
  console.error('Usage: npm run benchmark -- path/to/image.png [ocr-language]');
  process.exit(2);
}

async function main() {
  const image = await Jimp.read(inputPath);
  const buffer = await image.getBuffer('image/png');
  const worker = await createWorker(language);
  const startedAt = performance.now();
  try {
    const { data } = await worker.recognize(buffer, {}, { blocks: true });
    const lines = (data.lines || []).filter((line) => (line.text || '').trim());
    const elapsedMs = Math.round(performance.now() - startedAt);
    console.log(JSON.stringify({
      input: inputPath,
      language,
      width: image.bitmap.width,
      height: image.bitmap.height,
      lines: lines.length,
      characters: (data.text || '').length,
      elapsedMs,
    }, null, 2));
  } finally {
    await worker.terminate();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
