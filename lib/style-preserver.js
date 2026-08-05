const PLACEHOLDER_PATTERN = /__\s*OSLT\s*(\d+)\s*__/gi;

function isTechnicalToken(text) {
  const value = text.replace(/^[([{]+/, '').replace(/[}\],;:!?]+$/, '');
  return /^(?:https?:\/\/|www\.)/i.test(value) ||
    /^(?:[A-Za-z]:\\|\/)[^\s]+/.test(value) ||
    /[A-Za-z0-9_.-]+\/[A-Za-z0-9_./-]+/.test(value) ||
    /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\([^)]*\)$/.test(value) ||
    /^[A-Za-z_$][\w$]*\.[A-Za-z_$][\w$]*$/.test(value) ||
    /^--?[a-z][\w-]*$/i.test(value);
}

function normalizedStyle(word) {
  const style = { ...(word.style || {}) };
  if (isTechnicalToken(word.text)) style.code = true;
  return style.code || style.link ? style : null;
}

function createTranslationPlan(sourceText, words) {
  const protectedItems = [];
  let input = '';
  let cursor = 0;

  for (const word of words) {
    const style = normalizedStyle(word);
    if (!style || !word.text) continue;

    const index = sourceText.indexOf(word.text, cursor);
    if (index < 0) continue;

    input += sourceText.slice(cursor, index);
    const token = `__OSLT${protectedItems.length}__`;
    input += token;
    protectedItems.push({ text: word.text, style });
    cursor = index + word.text.length;
  }

  input += sourceText.slice(cursor);
  return { input, protectedItems };
}

function mergeRuns(runs) {
  const merged = [];
  for (const run of runs) {
    if (!run.text) continue;
    const previous = merged[merged.length - 1];
    const sameStyle = JSON.stringify(previous && previous.style || null) ===
      JSON.stringify(run.style || null);
    if (previous && sameStyle) previous.text += run.text;
    else merged.push({ text: run.text, style: run.style || null });
  }
  return merged;
}

function restoreStyledRuns(translatedText, protectedItems) {
  if (!protectedItems.length) return null;

  const runs = [];
  const seen = new Set();
  let cursor = 0;
  let match;
  PLACEHOLDER_PATTERN.lastIndex = 0;

  while ((match = PLACEHOLDER_PATTERN.exec(translatedText)) !== null) {
    const index = Number(match[1]);
    const item = protectedItems[index];
    if (!item || seen.has(index)) return null;

    runs.push({ text: translatedText.slice(cursor, match.index), style: null });
    runs.push({ text: item.text, style: item.style });
    seen.add(index);
    cursor = match.index + match[0].length;
  }

  if (seen.size !== protectedItems.length) return null;
  runs.push({ text: translatedText.slice(cursor), style: null });
  return mergeRuns(runs);
}

module.exports = {
  createTranslationPlan,
  isTechnicalToken,
  restoreStyledRuns,
};
