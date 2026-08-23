const test = require('node:test');
const assert = require('node:assert/strict');
const { createPromiseCache } = require('../lib/promise-cache');

test('deduplicates concurrent work for the same key', async () => {
  const cache = createPromiseCache(4);
  let calls = 0;
  const factory = async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return 'translated';
  };

  const results = await Promise.all([
    cache.getOrCreate('same', factory),
    cache.getOrCreate('same', factory),
  ]);

  assert.deepEqual(results, ['translated', 'translated']);
  assert.equal(calls, 1);
});

test('does not keep rejected work in the cache', async () => {
  const cache = createPromiseCache(4);
  let calls = 0;

  await assert.rejects(cache.getOrCreate('retry', async () => {
    calls += 1;
    throw new Error('temporary');
  }), /temporary/);

  await assert.rejects(cache.getOrCreate('retry', async () => {
    calls += 1;
    throw new Error('temporary again');
  }), /temporary again/);

  assert.equal(calls, 2);
  assert.equal(cache.size, 0);
});

test('evicts the least recently used key at the limit', async () => {
  const cache = createPromiseCache(2);
  await cache.getOrCreate('a', async () => 'A');
  await cache.getOrCreate('b', async () => 'B');
  await cache.getOrCreate('a', async () => 'A-new');
  await cache.getOrCreate('c', async () => 'C');

  let calls = 0;
  await cache.getOrCreate('b', async () => {
    calls += 1;
    return 'B-new';
  });
  assert.equal(calls, 1);
});
