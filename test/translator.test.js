const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createTranslator,
  parseDeepLResponse,
  parseGoogleCloudResponse,
  parseGoogleCompatibleResponse,
} = require('../lib/translator');

test('parses Google-compatible translation segments', () => {
  assert.equal(
    parseGoogleCompatibleResponse([[['Xin ', 'Hello'], ['thế giới', 'world']]]),
    'Xin thế giới'
  );
});

test('calls Google Cloud Translation with a plain-text POST', async () => {
  let request;
  const translator = createTranslator({
    provider: 'google-cloud',
    googleCloudApiKey: 'test-key',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        json: async () => ({ data: { translations: [{ translatedText: 'Xin chào' }] } }),
      };
    },
  });

  assert.equal(await translator.translate('Hello', 'vi'), 'Xin chào');
  assert.match(request.url, /key=test-key/);
  assert.equal(request.options.method, 'POST');
  assert.deepEqual(JSON.parse(request.options.body), {
    q: ['Hello'],
    target: 'vi',
    format: 'text',
  });
});

test('calls DeepL with its current authorization header', async () => {
  let request;
  const translator = createTranslator({
    provider: 'deepl',
    deeplApiKey: 'test-key',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        json: async () => ({ translations: [{ text: 'Hallo' }] }),
      };
    },
  });

  assert.equal(await translator.translate('Hello', 'de'), 'Hallo');
  assert.equal(request.options.headers.authorization, 'DeepL-Auth-Key test-key');
  assert.deepEqual(JSON.parse(request.options.body), {
    text: ['Hello'],
    target_lang: 'DE',
  });
});

test('rejects an unsupported provider and malformed responses', () => {
  assert.throws(
    () => createTranslator({ provider: 'unknown', fetchImpl: async () => {} }),
    /Unknown translator provider/
  );
  assert.throws(() => parseGoogleCloudResponse({}), /Invalid Google Cloud/);
  assert.throws(() => parseDeepLResponse({}), /Invalid DeepL/);
});
