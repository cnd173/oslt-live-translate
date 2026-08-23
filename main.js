const { app, BrowserWindow, ipcMain, screen } = require('electron');
const os = require('os');
const path = require('path');
const { Jimp, intToRGBA } = require('jimp');
const { createWorker, PSM } = require('tesseract.js');
const { createPromiseCache } = require('./lib/promise-cache');
const { imageSignature } = require('./lib/image-signature');
const { detectTextAlign, joinParagraphLines } = require('./lib/layout');
const { createTranslator } = require('./lib/translator');
const {
  captureScreenRegion,
  hasNativeOverlayCapture,
} = require('./lib/screen-capture');
const {
  createTranslationPlan,
  restoreStyledRuns,
} = require('./lib/style-preserver');

const CAPTURE_INTERVAL_MS = 1500;
const MIN_CONFIDENCE = 35;
const MAX_LINES = 60;
const TOOLBAR_HEIGHT = 30;
const OCR_TARGET_PIXEL_RATIO = 1.5;
const TRANSLATE_CONCURRENCY = 2;
const TRANSLATION_RATE_LIMIT_COOLDOWN_MS = 30_000;
const MAX_OCR_WORKERS = Math.min(2, Math.max(1, os.availableParallelism() - 1));
const OCR_PARALLEL_MIN_HEIGHT = 900;
const LIVE_EMPTY_SCANS_TO_CLEAR = 2;
const MAX_LOW_CONFIDENCE_LINES = 8;
const LOW_CONFIDENCE_THRESHOLD = 45;
const TRANSLATION_CACHE_LIMIT = 256;

const translator = createTranslator();

let overlayWin = null;
let workers = [];
let captureTimer = null;

let ocrLang = 'eng';
let targetLang = 'vi';
let paused = false;
let capturing = false;
let switchingLang = false;
let overlayLocked = false;
let liveMode = false;
let scanGeneration = 0;
let refreshTimer = null;
let lastImageSignature = '';
let lastSourceSignature = '';
let emptyLiveScans = 0;
let lastLiveScanHadText = true;
const translationCache = createPromiseCache(TRANSLATION_CACHE_LIMIT);
let translationBackoffUntil = 0;

function createOverlayWindow() {
  const win = new BrowserWindow({
    width: 480,
    height: 160,
    x: 140,
    y: 160,
    minWidth: 180,
    minHeight: 90,
    frame: false,
    transparent: true,
    hasShadow: true,
    resizable: true,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });
  // Nổi trên app thông thường nhưng không che các giao diện hệ thống như Spotlight.
  win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  // Không bật content protection: người dùng vẫn cần chụp được overlay bằng công cụ hệ thống.
  win.loadFile(path.join(__dirname, 'renderer', 'overlay.html'));
  return win;
}

function sendStatus(status) {
  if (overlayWin && !overlayWin.isDestroyed()) {
    overlayWin.webContents.send('overlay:status', status);
  }
}

function sendTranslation(lines) {
  if (overlayWin && !overlayWin.isDestroyed()) {
    overlayWin.webContents.send('translation:update', { lines });
  }
}

function requestScan({ clearOverlay = true } = {}) {
  scanGeneration += 1;
  overlayLocked = false;
  lastImageSignature = '';
  lastSourceSignature = '';
  emptyLiveScans = 0;
  lastLiveScanHadText = true;
  if (clearOverlay) sendTranslation([]);
  setTimeout(captureAndOcr, 100);
}

function scheduleScan() {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(requestScan, 400);
}

function createOcrWorkers(lang, count = MAX_OCR_WORKERS) {
  return Promise.all(
    Array.from({ length: count }, () => createWorker(lang))
  );
}

async function ensureOcrWorkerCount(count, lang = ocrLang) {
  if (workers.length >= count) return;
  const additional = await createOcrWorkers(lang, count - workers.length);
  workers.push(...additional);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Dịch 1 đoạn văn bản, có retry nhẹ nếu endpoint free của Google tạm thời lỗi/giới hạn tốc độ.
async function translateWithRetry(text, tl, attempts = 3) {
  const cacheText = text.replace(/[ \t]+/g, ' ').trim();
  const cacheKey = `${tl}\u0000${cacheText}`;
  try {
    return await translationCache.getOrCreate(
      cacheKey,
      () => translateWithRetryUncached(text, tl, attempts)
    );
  } catch (error) {
    if (error.code !== 'TRANSLATION_COOLDOWN' && error.status !== 429) {
      console.warn(`Translation unavailable; keeping source text: ${error.message}`);
    }
    return text;
  }
}

async function translateWithRetryUncached(text, tl, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    if (translationBackoffUntil > Date.now()) {
      const error = new Error('translation rate-limit cooldown');
      error.code = 'TRANSLATION_COOLDOWN';
      throw error;
    }
    try {
      return await translator.translate(text, tl);
    } catch (err) {
      lastErr = err;
      const isRateLimited = err.status === 429;
      if (isRateLimited) {
        const wasAlreadyLimited = translationBackoffUntil > Date.now();
        const cooldown = Math.max(
          TRANSLATION_RATE_LIMIT_COOLDOWN_MS,
          err.retryAfterMs || 0
        );
        translationBackoffUntil = Math.max(translationBackoffUntil, Date.now() + cooldown);
        if (!wasAlreadyLimited) {
          console.warn(`Translate rate-limited; pausing requests for ${cooldown}ms`);
        }
        throw err;
      } else {
        console.warn(`Translate failed (attempt ${i + 1}/${attempts}): ${err.message}`);
        await sleep(300 * (i + 1));
      }
    }
  }
  throw lastErr;
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index]);
    }
  }

  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, runWorker));
  return results;
}

function flattenParagraphs(page) {
  const paragraphs = [];
  for (const block of page.blocks || []) {
    for (const para of block.paragraphs || []) {
      if (para.lines && para.lines.length) paragraphs.push(para.lines);
    }
  }
  return paragraphs;
}

function offsetBbox(bbox, offsetY, offsetX = 0) {
  return {
    x0: bbox.x0 + offsetX,
    y0: bbox.y0 + offsetY,
    x1: bbox.x1 + offsetX,
    y1: bbox.y1 + offsetY,
  };
}

function offsetLine(line, offsetY, offsetX = 0) {
  return {
    ...line,
    bbox: offsetBbox(line.bbox, offsetY, offsetX),
    baseline: line.baseline ? {
      ...line.baseline,
      x0: Number.isFinite(line.baseline.x0) ? line.baseline.x0 + offsetX : line.baseline.x0,
      y0: line.baseline.y0 + offsetY,
      x1: Number.isFinite(line.baseline.x1) ? line.baseline.x1 + offsetX : line.baseline.x1,
      y1: line.baseline.y1 + offsetY,
    } : line.baseline,
    words: (line.words || []).map((word) => ({
      ...word,
      bbox: offsetBbox(word.bbox, offsetY, offsetX),
    })),
  };
}

function pageGroups(page, offsetY = 0, keepLine = () => true) {
  return flattenParagraphs(page)
    .map((lines) => lines
      .filter((line) => keepLine(line, offsetY))
      .map((line) => offsetLine(line, offsetY)))
    .filter((lines) => lines.length)
    .flatMap((lines) => splitParagraphByVerticalGap(lines));
}

function mergeTileBoundary(topGroups, bottomGroups) {
  if (!topGroups.length || !bottomGroups.length) return [...topGroups, ...bottomGroups];

  const top = topGroups[topGroups.length - 1];
  const bottom = bottomGroups[0];
  const previous = top[top.length - 1];
  const next = bottom[0];
  const heights = [
    previous.bbox.y1 - previous.bbox.y0,
    next.bbox.y1 - next.bbox.y0,
  ];
  const maxGap = Math.max(8, median(heights) * 0.75);
  const aligned = Math.abs(previous.bbox.x0 - next.bbox.x0) <= median(heights) * 2;

  if (next.bbox.y0 - previous.bbox.y1 <= maxGap && aligned) {
    topGroups[topGroups.length - 1] = [...top, ...bottom];
    return [...topGroups, ...bottomGroups.slice(1)];
  }
  return [...topGroups, ...bottomGroups];
}

async function recognizeParagraphGroups(image) {
  if (image.bitmap.height < OCR_PARALLEL_MIN_HEIGHT || MAX_OCR_WORKERS < 2) {
    const buffer = await image.getBuffer('image/png');
    const { data } = await workers[0].recognize(buffer, {}, { blocks: true });
    return pageGroups(data);
  }

  await ensureOcrWorkerCount(2);

  const splitY = Math.floor(image.bitmap.height / 2);
  const overlap = Math.min(90, Math.max(48, Math.floor(image.bitmap.height * 0.04)));
  const bottomY = Math.max(0, splitY - overlap);
  const topHeight = Math.min(image.bitmap.height, splitY + overlap);
  const bottomHeight = image.bitmap.height - bottomY;
  const topImage = image.clone().crop({ x: 0, y: 0, w: image.bitmap.width, h: topHeight });
  const bottomImage = image.clone().crop({
    x: 0,
    y: bottomY,
    w: image.bitmap.width,
    h: bottomHeight,
  });
  const [topBuffer, bottomBuffer] = await Promise.all([
    topImage.getBuffer('image/png'),
    bottomImage.getBuffer('image/png'),
  ]);
  const [topResult, bottomResult] = await Promise.all([
    workers[0].recognize(topBuffer, {}, { blocks: true }),
    workers[1].recognize(bottomBuffer, {}, { blocks: true }),
  ]);

  const topGroups = pageGroups(
    topResult.data,
    0,
    (line) => (line.bbox.y0 + line.bbox.y1) / 2 < splitY
  );
  const bottomGroups = pageGroups(
    bottomResult.data,
    bottomY,
    (line, offsetY) => (line.bbox.y0 + line.bbox.y1) / 2 + offsetY >= splitY
  );
  return mergeTileBoundary(topGroups, bottomGroups);
}

function flattenLines(groups) {
  return groups.flatMap((group) => group);
}

function bestRecognizedLine(data) {
  const lines = flattenParagraphs(data).flat();
  return lines
    .filter((line) => (line.text || '').trim())
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0] || null;
}

async function refineLowConfidenceLines(image, groups) {
  const candidates = flattenLines(groups)
    .filter((line) => {
      const lineConfidence = Number(line.confidence);
      const lineWidth = line.bbox.x1 - line.bbox.x0;
      const lineHeight = line.bbox.y1 - line.bbox.y0;
      return Number.isFinite(lineConfidence) && lineConfidence < LOW_CONFIDENCE_THRESHOLD &&
        lineWidth >= 20 && lineHeight >= 8;
    })
    .sort((a, b) => (a.confidence || 0) - (b.confidence || 0))
    .slice(0, MAX_LOW_CONFIDENCE_LINES);

  if (!candidates.length) return groups;

  const refined = await mapWithConcurrency(candidates, 2, async (line) => {
    const lineHeight = Math.max(8, line.bbox.y1 - line.bbox.y0);
    const paddingX = Math.max(8, Math.round(lineHeight * 0.65));
    const paddingY = Math.max(5, Math.round(lineHeight * 0.35));
    const x = Math.max(0, Math.floor(line.bbox.x0 - paddingX));
    const y = Math.max(0, Math.floor(line.bbox.y0 - paddingY));
    const right = Math.min(image.bitmap.width, Math.ceil(line.bbox.x1 + paddingX));
    const bottom = Math.min(image.bitmap.height, Math.ceil(line.bbox.y1 + paddingY));
    const width = right - x;
    const height = bottom - y;
    if (width < 8 || height < 8) return null;

    const crop = image.clone().crop({ x, y, w: width, h: height });
    const buffer = await crop.getBuffer('image/png');
    const result = await workers[0].recognize(
      buffer,
      { tessedit_pageseg_mode: PSM.SINGLE_LINE },
      { blocks: true }
    );
    const best = bestRecognizedLine(result.data);
    const originalConfidence = Number(line.confidence);
    const refinedConfidence = Number(best && best.confidence);
    if (!best || !best.text || !Number.isFinite(refinedConfidence) ||
      refinedConfidence <= (Number.isFinite(originalConfidence) ? originalConfidence : 0)) {
      return null;
    }
    return { original: line, refined: offsetLine(best, y, x) };
  });

  const refinedByLine = new Map(
    refined.filter(Boolean).map(({ original, refined: line }) => [original, line])
  );
  return groups.map((group) => group.map((line) => refinedByLine.get(line) || line));
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function colorMetrics({ r, g, b }) {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const delta = max - min;
  let hue = 0;

  if (delta > 0) {
    if (max === r / 255) hue = 60 * (((g - b) / 255 / delta) % 6);
    else if (max === g / 255) hue = 60 * ((b - r) / 255 / delta + 2);
    else hue = 60 * ((r - g) / 255 / delta + 4);
  }
  if (hue < 0) hue += 360;

  return {
    hue,
    saturation: max === 0 ? 0 : delta / max,
    luminance: 0.2126 * r + 0.7152 * g + 0.0722 * b,
  };
}

function colorDistance(a, b) {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
}

function analyzeWordPixels(image, bbox) {
  const x0 = Math.max(0, Math.floor(bbox.x0));
  const y0 = Math.max(0, Math.floor(bbox.y0));
  const x1 = Math.min(image.bitmap.width, Math.ceil(bbox.x1));
  const y1 = Math.min(image.bitmap.height, Math.ceil(bbox.y1));
  const width = x1 - x0;
  const height = y1 - y0;
  if (width < 2 || height < 2) return null;

  const stride = Math.max(1, Math.ceil(Math.sqrt((width * height) / 64)));
  const samples = [];
  const buckets = new Map();

  for (let y = y0; y < y1; y += stride) {
    for (let x = x0; x < x1; x += stride) {
      const color = intToRGBA(image.getPixelColor(x, y));
      if (color.a < 200) continue;
      samples.push(color);
      const key = `${color.r >> 4}:${color.g >> 4}:${color.b >> 4}`;
      const bucket = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0 };
      bucket.count += 1;
      bucket.r += color.r;
      bucket.g += color.g;
      bucket.b += color.b;
      buckets.set(key, bucket);
    }
  }

  if (!samples.length || !buckets.size) return null;
  const dominant = [...buckets.values()].sort((a, b) => b.count - a.count)[0];
  const background = {
    r: dominant.r / dominant.count,
    g: dominant.g / dominant.count,
    b: dominant.b / dominant.count,
  };
  const backgroundMetrics = colorMetrics(background);

  let foregroundCount = 0;
  let blueCount = 0;
  for (const color of samples) {
    if (colorDistance(color, background) < 42) continue;
    foregroundCount += 1;
    const metrics = colorMetrics(color);
    if (metrics.hue >= 185 && metrics.hue <= 235 && metrics.saturation >= 0.35) {
      blueCount += 1;
    }
  }

  return {
    backgroundLuminance: backgroundMetrics.luminance,
    backgroundSaturation: backgroundMetrics.saturation,
    blueRatio: foregroundCount ? blueCount / foregroundCount : 0,
  };
}

function classifyWordStyles(image, words) {
  const analyzed = words.map((word) => ({
    word,
    pixels: analyzeWordPixels(image, word.bbox),
  }));
  const baseline = median(
    analyzed
      .map(({ pixels }) => pixels && pixels.backgroundLuminance)
      .filter(Number.isFinite)
  );

  return analyzed.map(({ word, pixels }) => {
    const style = {};
    if (pixels) {
      const grayBackground = pixels.backgroundSaturation < 0.24 &&
        Math.abs(pixels.backgroundLuminance - baseline) >= 12;
      if (grayBackground) style.code = true;
      if (pixels.blueRatio >= 0.14) style.link = true;
    }
    return { text: word.text, style };
  });
}

// Tesseract đôi khi nhập hai đoạn cách xa nhau thành cùng một paragraph. Tách
// lại khi khoảng trống dọc lớn rõ rệt so với chiều cao chữ của các dòng.
function splitParagraphByVerticalGap(lines) {
  const sorted = [...lines].sort((a, b) => a.bbox.y0 - b.bbox.y0);
  const medianHeight = median(
    sorted.map((line) => line.bbox.y1 - line.bbox.y0).filter((height) => height > 0)
  );
  const gapThreshold = Math.max(8, medianHeight * 0.65);
  const groups = [];

  for (const line of sorted) {
    const current = groups[groups.length - 1];
    const previous = current && current[current.length - 1];
    if (!current || line.bbox.y0 - previous.bbox.y1 > gapThreshold) {
      groups.push([line]);
    } else {
      current.push(line);
    }
  }

  return groups;
}

// Chiều cao khít của 1 dòng dao động theo ký tự có dấu lên/xuống (g, y, p...) dù
// cùng cỡ chữ, nên lấy chiều cao trung bình của cả đoạn để cỡ chữ hiển thị đồng đều.
function paragraphAvgHeight(paraLines) {
  const rowHeights = paraLines
    .map((l) => l.rowAttributes && l.rowAttributes.rowHeight)
    .filter((h) => h > 0);
  if (rowHeights.length) {
    return rowHeights.reduce((a, b) => a + b, 0) / rowHeights.length;
  }
  const bboxHeights = paraLines
    .map((l) => l.bbox.y1 - l.bbox.y0)
    .filter((h) => h > 0);
  return bboxHeights.length ? bboxHeights.reduce((a, b) => a + b, 0) / bboxHeights.length : 0;
}

async function captureAndOcr() {
  if (paused || switchingLang || capturing || (!liveMode && overlayLocked)) return;
  if (!overlayWin || overlayWin.isDestroyed() || !workers.length) return;

  const generation = scanGeneration;
  const scanStartedAt = Date.now();
  capturing = true;
  try {
    const bounds = overlayWin.getBounds();
    const display = screen.getDisplayMatching(bounds);
    const scale = display.scaleFactor || 1;

    const captureBounds = {
      x: bounds.x,
      y: bounds.y + TOOLBAR_HEIGHT,
      width: bounds.width,
      height: Math.max(1, bounds.height - TOOLBAR_HEIGHT),
    };
    const captureResult = await captureScreenRegion(captureBounds, {
      excludeOverlay: liveMode,
    });
    const capturedAt = Date.now();
    if (liveMode && !captureResult.isOverlayExcluded) {
      liveMode = false;
      overlayLocked = true;
      sendStatus('live-unavailable');
      return;
    }
    const image = await Jimp.read(captureResult.buffer);

    const maxW = image.bitmap.width;
    const maxH = image.bitmap.height;

    const relX = Math.round((captureBounds.x - display.bounds.x) * scale);
    const relY = Math.round((captureBounds.y - display.bounds.y) * scale);
    const expectedW = Math.round(captureBounds.width * scale);
    const expectedH = Math.round(captureBounds.height * scale);
    const cropX = captureResult.isRegion
      ? 0
      : Math.min(Math.max(relX, 0), Math.max(maxW - 2, 0));
    const cropY = captureResult.isRegion
      ? 0
      : Math.min(Math.max(relY, 0), Math.max(maxH - 2, 0));
    const cropW = captureResult.isRegion ? maxW : Math.min(expectedW, maxW - cropX);
    const cropH = captureResult.isRegion ? maxH : Math.min(expectedH, maxH - cropY);

    if (cropW <= 4 || cropH <= 4) {
      sendStatus('ok');
      return;
    }

    if (!captureResult.isRegion) image.crop({ x: cropX, y: cropY, w: cropW, h: cropH });
    // Retina screenshots thường có 2 physical pixels / CSS pixel. Tesseract
    // không cần toàn bộ mật độ đó; chuẩn hóa xuống 1.5x giúp giảm mạnh số pixel.
    // Vùng nhỏ non-Retina vẫn được upscale nhẹ để giữ độ chính xác chữ nhỏ.
    let processingScale = 1;
    if (scale > OCR_TARGET_PIXEL_RATIO) {
      processingScale = OCR_TARGET_PIXEL_RATIO / scale;
    } else if (cropW < 700) {
      processingScale = Math.min(1.5, OCR_TARGET_PIXEL_RATIO / scale);
    }
    if (Math.abs(processingScale - 1) >= 0.05) image.scale(processingScale);

    if (liveMode) {
      const currentImageSignature = imageSignature(image);
      if (currentImageSignature === lastImageSignature) {
        if (!lastLiveScanHadText) {
          emptyLiveScans += 1;
          if (emptyLiveScans >= LIVE_EMPTY_SCANS_TO_CLEAR) {
            lastSourceSignature = '';
            sendTranslation([]);
          }
        }
        overlayLocked = false;
        return;
      }
      lastImageSignature = currentImageSignature;
    }

    const recognizedGroups = await recognizeParagraphGroups(image);
    const recognizedAt = Date.now();
    const paragraphGroups = await refineLowConfidenceLines(image, recognizedGroups);
    const refinedAt = Date.now();

    // Gộp các dòng cùng 1 đoạn (paragraph) thành 1 khối văn bản liền mạch để
    // dịch giữ đúng ngữ cảnh/liên kết câu, thay vì dịch rời từng dòng riêng lẻ.
    let paragraphs = [];
    let totalLinesUsed = 0;

    for (const paraLines of paragraphGroups) {
      if (totalLinesUsed >= MAX_LINES) break;

      const filtered = paraLines
        .map((l) => ({
          text: (l.text || '').trim(),
          bbox: l.bbox,
          confidence: l.confidence,
          rowAttributes: l.rowAttributes,
          words: (l.words || []).filter((word) => word.text && word.confidence >= MIN_CONFIDENCE),
        }))
        .filter((l) => l.text.length > 0 && l.confidence >= MIN_CONFIDENCE)
        .slice(0, MAX_LINES - totalLinesUsed);

      if (!filtered.length) continue;
      totalLinesUsed += filtered.length;

      const avgHeight = paragraphAvgHeight(filtered);
      const text = joinParagraphLines(filtered);
      const styledWords = classifyWordStyles(image, filtered.flatMap((l) => l.words));
      const translationPlan = createTranslationPlan(text, styledWords);
      paragraphs.push({
        text,
        translationInput: translationPlan.input,
        protectedItems: translationPlan.protectedItems,
        bbox: {
          x0: Math.min(...filtered.map((l) => l.bbox.x0)),
          y0: Math.min(...filtered.map((l) => l.bbox.y0)),
          x1: Math.max(...filtered.map((l) => l.bbox.x1)),
          y1: Math.max(...filtered.map((l) => l.bbox.y1)),
        },
        uniformHeight: avgHeight || filtered[0].bbox.y1 - filtered[0].bbox.y0,
        textAlign: detectTextAlign(filtered),
      });
    }

    sendStatus('ok');

    if (!paragraphs.length) {
      lastLiveScanHadText = false;
      if (liveMode && captureResult.isOverlayExcluded) {
        emptyLiveScans += 1;
        if (emptyLiveScans >= LIVE_EMPTY_SCANS_TO_CLEAR) {
          lastSourceSignature = '';
          sendTranslation([]);
        }
        overlayLocked = false;
      } else {
        // Vùng chọn rỗng không cần OCR lặp vô hạn; kéo/resize hoặc refresh sẽ mở khóa.
        overlayLocked = true;
      }
      return;
    }

    emptyLiveScans = 0;
    lastLiveScanHadText = true;
    const sourceSignature = paragraphs
      .map((paragraph) => paragraph.translationInput)
      .join('\u001e');
    if (liveMode && captureResult.isOverlayExcluded && sourceSignature === lastSourceSignature) {
      overlayLocked = false;
      return;
    }
    lastSourceSignature = sourceSignature;

    // Dịch một số đoạn song song để giảm độ trễ mà không tạo quá nhiều request
    // cùng lúc tới endpoint Google miễn phí.
    const translations = await mapWithConcurrency(
      paragraphs,
      TRANSLATE_CONCURRENCY,
      async (paragraph) => {
        const translated = await translateWithRetry(paragraph.translationInput, targetLang);
        const runs = restoreStyledRuns(translated, paragraph.protectedItems);
        if (paragraph.protectedItems.length && !runs) {
          return {
            text: await translateWithRetry(paragraph.text, targetLang),
            runs: null,
          };
        }
        return {
          text: runs ? runs.map((run) => run.text).join('') : translated,
          runs,
        };
      }
    );

    const lines = paragraphs.map((p, index) => {
      // bbox toạ độ pixel trên ảnh đã crop+scale -> quy đổi về CSS px trong cửa sổ.
      const x0 = p.bbox.x0 / processingScale / scale;
      const y0 = TOOLBAR_HEIGHT + p.bbox.y0 / processingScale / scale;
      const x1 = p.bbox.x1 / processingScale / scale;
      const y1 = TOOLBAR_HEIGHT + p.bbox.y1 / processingScale / scale;
      return {
        x: x0,
        y: y0,
        width: Math.max(4, x1 - x0),
        height: Math.max(4, y1 - y0),
        fontHeight: p.uniformHeight / processingScale / scale,
        original: p.text,
        translated: translations[index].text,
        runs: translations[index].runs,
        textAlign: p.textAlign,
      };
    });

    if (generation !== scanGeneration) return;

    sendTranslation(lines);
    overlayLocked = !(liveMode && captureResult.isOverlayExcluded);
    const finishedAt = Date.now();
    console.log(
      `[scan] capture=${capturedAt - scanStartedAt}ms ` +
      `ocr=${recognizedAt - capturedAt}ms ` +
      `refine=${refinedAt - recognizedAt}ms ` +
      `translate=${finishedAt - refinedAt}ms total=${finishedAt - scanStartedAt}ms ` +
      `workers=${workers.length}`
    );
  } catch (err) {
    console.error('OCR/translate error:', err);
    sendStatus('error');
    if (!liveMode) overlayLocked = true;
  } finally {
    capturing = false;
  }
}

async function setOcrLanguage(lang) {
  switchingLang = true;
  sendStatus('loading-lang');
  try {
    if (workers.length && workers.every((worker) => typeof worker.reinitialize === 'function')) {
      await Promise.all(workers.map((worker) => worker.reinitialize(lang)));
    } else {
      await Promise.all(workers.map((worker) => worker.terminate()));
      workers = await createOcrWorkers(lang, 1);
    }
    ocrLang = lang;
    requestScan();
    sendStatus(paused ? 'paused' : 'ok');
  } catch (err) {
    console.error('Failed to switch OCR language:', err);
    sendStatus('error');
  } finally {
    switchingLang = false;
  }
}

ipcMain.on('app:set-target-lang', (event, lang) => {
  if (!lang) return;
  targetLang = lang;
  requestScan();
});

ipcMain.on('app:set-ocr-lang', (event, lang) => {
  if (!lang || lang === ocrLang) return;
  setOcrLanguage(lang);
});

ipcMain.on('app:toggle-pause', () => {
  paused = !paused;
  sendStatus(paused ? 'paused' : 'ok');
});

ipcMain.on('app:refresh', () => requestScan());

ipcMain.on('app:set-live-mode', (event, enabled) => {
  liveMode = Boolean(enabled);
  if (liveMode) {
    if (!hasNativeOverlayCapture()) {
      liveMode = false;
      sendStatus('live-unavailable');
      return;
    }
    requestScan({ clearOverlay: false });
  } else {
    requestScan();
  }
});

ipcMain.handle('app:get-state', () => ({
  ocrLang,
  targetLang,
  paused,
  liveMode,
  liveAvailable: hasNativeOverlayCapture(),
}));

ipcMain.on('app:quit', () => app.quit());

app.whenReady().then(async () => {
  overlayWin = createOverlayWindow();

  sendStatus('loading-lang');
  workers = await createOcrWorkers(ocrLang, 1);
  sendStatus('ok');

  requestScan();
  captureTimer = setInterval(captureAndOcr, CAPTURE_INTERVAL_MS);

  overlayWin.on('move', scheduleScan);
  overlayWin.on('resize', scheduleScan);

  overlayWin.on('closed', () => app.quit());
});

app.on('window-all-closed', () => {
  if (captureTimer) clearInterval(captureTimer);
  app.quit();
});

app.on('before-quit', async () => {
  if (captureTimer) clearInterval(captureTimer);
  if (workers.length) {
    try {
      await Promise.all(workers.map((worker) => worker.terminate()));
    } catch {
      // ignore
    }
  }
});
