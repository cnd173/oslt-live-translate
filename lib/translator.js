const DEFAULT_COMPATIBLE_ENDPOINT =
  'https://translate.googleapis.com/translate_a/single';
const DEFAULT_GOOGLE_CLOUD_ENDPOINT =
  'https://translation.googleapis.com/language/translate/v2';
const DEFAULT_DEEPL_ENDPOINT = 'https://api.deepl.com/v2/translate';

function parseGoogleCompatibleResponse(json) {
  const parts = Array.isArray(json) ? json[0] : null;
  if (!Array.isArray(parts)) {
    throw new Error('Invalid Google-compatible translation response');
  }
  return parts.map((part) => part && part[0]).filter(Boolean).join('');
}

function parseGoogleCloudResponse(json) {
  const translated = json && json.data && json.data.translations;
  if (!Array.isArray(translated) || !translated[0] ||
      typeof translated[0].translatedText !== 'string') {
    throw new Error('Invalid Google Cloud translation response');
  }
  return translated[0].translatedText;
}

function parseDeepLResponse(json) {
  const translated = json && json.translations;
  if (!Array.isArray(translated) || !translated[0] ||
      typeof translated[0].text !== 'string') {
    throw new Error('Invalid DeepL translation response');
  }
  return translated[0].text;
}

function resolveProvider(provider, env = process.env) {
  if (provider) return provider;
  if (env.OSLT_GOOGLE_CLOUD_API_KEY) return 'google-cloud';
  if (env.OSLT_DEEPL_API_KEY) return 'deepl';
  return 'google-compatible';
}

function retryAfterMs(response) {
  if (!response.headers || typeof response.headers.get !== 'function') return 0;
  const value = response.headers.get('retry-after');
  if (!value) return 0;

  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : 0;
}

function validateEndpoint(endpoint, provider) {
  const url = new URL(endpoint);
  const isLoopback = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLoopback)) {
    throw new Error(`${provider} endpoint must use HTTPS (HTTP is allowed only for localhost)`);
  }
  return url;
}

async function requestJson(fetchImpl, provider, url, options = {}) {
  const response = await fetchImpl(url, options);
  if (!response.ok) {
    const error = new Error(`${provider} translation HTTP ${response.status}`);
    error.status = response.status;
    error.retryAfterMs = retryAfterMs(response);
    throw error;
  }
  return response.json();
}

function createCompatibleTranslator(fetchImpl, endpoint) {
  return async (text, targetLang) => {
    const url = validateEndpoint(
      endpoint || DEFAULT_COMPATIBLE_ENDPOINT,
      'Google-compatible'
    );
    url.searchParams.set('client', 'gtx');
    url.searchParams.set('sl', 'auto');
    url.searchParams.set('tl', targetLang);
    url.searchParams.set('dt', 't');
    url.searchParams.set('q', text);
    const json = await requestJson(fetchImpl, 'Google-compatible', url.toString());
    return parseGoogleCompatibleResponse(json);
  };
}

function createGoogleCloudTranslator(fetchImpl, apiKey, endpoint) {
  if (!apiKey) {
    throw new Error('OSLT_GOOGLE_CLOUD_API_KEY is required for google-cloud');
  }

  return async (text, targetLang) => {
    const url = validateEndpoint(endpoint || DEFAULT_GOOGLE_CLOUD_ENDPOINT, 'Google Cloud');
    const json = await requestJson(fetchImpl, 'Google Cloud', url.toString(), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        q: [text],
        target: targetLang,
        format: 'text',
      }),
    });
    return parseGoogleCloudResponse(json);
  };
}

function deepLTargetLanguage(targetLang) {
  return targetLang.toUpperCase() === 'ZH-CN' ? 'ZH' : targetLang.toUpperCase();
}

function createDeepLTranslator(fetchImpl, apiKey, endpoint) {
  if (!apiKey) {
    throw new Error('OSLT_DEEPL_API_KEY is required for deepl');
  }

  return async (text, targetLang) => {
    const url = validateEndpoint(endpoint || DEFAULT_DEEPL_ENDPOINT, 'DeepL');
    const json = await requestJson(
      fetchImpl,
      'DeepL',
      url.toString(),
      {
        method: 'POST',
        headers: {
          authorization: `DeepL-Auth-Key ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          text: [text],
          target_lang: deepLTargetLanguage(targetLang),
        }),
      }
    );
    return parseDeepLResponse(json);
  };
}

function createTranslator({
  provider,
  compatibleEndpoint = process.env.OSLT_TRANSLATE_ENDPOINT,
  googleCloudApiKey = process.env.OSLT_GOOGLE_CLOUD_API_KEY,
  googleCloudEndpoint = process.env.OSLT_GOOGLE_CLOUD_ENDPOINT,
  deeplApiKey = process.env.OSLT_DEEPL_API_KEY,
  deeplEndpoint = process.env.OSLT_DEEPL_ENDPOINT,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('This Node.js version does not provide fetch');
  }

  const normalizedProvider = resolveProvider(
    provider || process.env.OSLT_TRANSLATOR,
    process.env
  ).toLowerCase();
  let translate;
  if (normalizedProvider === 'google-compatible' || normalizedProvider === 'google') {
    translate = createCompatibleTranslator(fetchImpl, compatibleEndpoint);
  } else if (normalizedProvider === 'google-cloud') {
    translate = createGoogleCloudTranslator(
      fetchImpl,
      googleCloudApiKey,
      googleCloudEndpoint
    );
  } else if (normalizedProvider === 'deepl') {
    translate = createDeepLTranslator(fetchImpl, deeplApiKey, deeplEndpoint);
  } else {
    throw new Error(
      `Unknown translator provider "${provider}". Use google-compatible, google-cloud or deepl.`
    );
  }

  return {
    provider: normalizedProvider,
    translate,
  };
}

module.exports = {
  createTranslator,
  parseDeepLResponse,
  parseGoogleCloudResponse,
  parseGoogleCompatibleResponse,
  resolveProvider,
};
