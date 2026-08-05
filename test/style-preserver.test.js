const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createTranslationPlan,
  isTechnicalToken,
  restoreStyledRuns,
} = require('../lib/style-preserver');

test('detects common technical tokens', () => {
  assert.equal(isTechnicalToken('process.kill()'), true);
  assert.equal(isTechnicalToken('/api/companies'), true);
  assert.equal(isTechnicalToken('docs/DECISIONS.md'), true);
  assert.equal(isTechnicalToken('ordinary'), false);
});

test('protects styled and technical words in source order', () => {
  const plan = createTranslationPlan('Open docs/README.md and GitHub now', [
    { text: 'docs/README.md' },
    { text: 'GitHub', style: { link: true } },
  ]);

  assert.equal(plan.input, 'Open __OSLT0__ and __OSLT1__ now');
  assert.deepEqual(plan.protectedItems, [
    { text: 'docs/README.md', style: { code: true } },
    { text: 'GitHub', style: { link: true } },
  ]);
});

test('restores styled runs when placeholders move during translation', () => {
  const items = [
    { text: 'docs/README.md', style: { code: true } },
    { text: 'GitHub', style: { link: true } },
  ];
  const runs = restoreStyledRuns('__OSLT1__ mở __OSLT0__', items);

  assert.deepEqual(runs, [
    { text: 'GitHub', style: { link: true } },
    { text: ' mở ', style: null },
    { text: 'docs/README.md', style: { code: true } },
  ]);
});

test('returns null when a placeholder is lost', () => {
  const runs = restoreStyledRuns('Bản dịch không còn token', [
    { text: '/api/test', style: { code: true } },
  ]);
  assert.equal(runs, null);
});
