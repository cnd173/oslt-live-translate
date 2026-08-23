function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function range(values) {
  return values.length ? Math.max(...values) - Math.min(...values) : 0;
}

function detectTextAlign(lines) {
  const validLines = lines.filter((line) => line && line.bbox);
  if (validLines.length < 2) return 'left';

  const lineHeight = median(
    validLines
      .map((line) => line.bbox.y1 - line.bbox.y0)
      .filter((height) => height > 0)
  );
  const tolerance = Math.max(3, lineHeight * 0.55);
  const leftSpread = range(validLines.map((line) => line.bbox.x0));
  const rightSpread = range(validLines.map((line) => line.bbox.x1));

  if (leftSpread <= tolerance) return 'left';
  if (rightSpread <= tolerance) return 'right';
  if (validLines.length >= 3 && Math.abs(leftSpread - rightSpread) <= tolerance * 1.5) {
    return 'center';
  }
  return 'left';
}

function joinParagraphLines(lines) {
  return lines.map((line) => (line.text || '').trim()).join('\n');
}

module.exports = {
  detectTextAlign,
  joinParagraphLines,
};
