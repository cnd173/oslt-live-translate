# OSLT — Overlay Screen Live Translate

[Tiếng Việt](README.md) · [English](README.en.md)

OSLT is an Electron desktop overlay that captures a selected screen region, recognizes text with Tesseract.js, translates complete paragraphs, and draws the result back over the original layout.

> OSLT is an early OSS prototype. macOS is the primary tested platform; Windows and Linux are not fully verified yet.

## Features

- Always-on-top, movable and resizable translation overlay.
- macOS native ScreenCaptureKit mode that excludes the overlay from its own capture.
- OCR with paragraph grouping, bounding boxes, line breaks, and alignment inference.
- Stable results: unchanged source regions are skipped and a successful translation is locked until a refresh is requested.
- Translation cache and request de-duplication to reduce latency and rate-limit pressure.
- Style heuristics for code, URLs, gray backgrounds, and blue links.
- Translation patches keep the source position and shrink to fit the original text region.
- Screenshot support includes the overlay and translated text.
- Google-compatible, Google Cloud Translation, and DeepL adapters.
- No telemetry and no API key is required for the default configuration.

## Requirements

- Node.js 18 or later and npm.
- macOS 12 or later is recommended.
- Internet access for the first OCR language download and translation requests.
- Screen Recording permission on macOS.

## Install and run

```bash
git clone https://github.com/cnd173/oslt-live-translate.git
cd oslt-live-translate
npm install
npm run build:native  # macOS; optional, enables safer live capture
npm start
```

On macOS, grant Screen Recording permission to the terminal or application that runs OSLT:

1. Open **System Settings → Privacy & Security → Screen Recording**.
2. Enable the terminal or application used to start OSLT.
3. Quit and reopen that terminal or application.
4. Run `npm start` again.

The first OCR run for a language can be slower while Tesseract downloads its trained data. A smaller, tighter selection region is faster and usually more accurate.

## Usage

1. Start OSLT with `npm start`.
2. Drag the purple toolbar to position the overlay.
3. Drag an edge or corner to select the text region.
4. Choose the source OCR language and target language.
5. Wait for OCR and translation to finish.
6. Press `↻` when the source content changes.

The toolbar includes refresh, safe live mode, style preservation, OCR/translation toggle, pause/resume, and quit controls. Safe live mode is available on macOS after the native helper has been built.

## Translation providers

The default provider is a Google Translate-compatible endpoint and does not require an API key. It is unofficial, may be rate-limited, and should not be used for sensitive or production data.

For long-term use, configure an official provider. When `OSLT_TRANSLATOR` is unset, the app automatically prefers Google Cloud if `OSLT_GOOGLE_CLOUD_API_KEY` exists, then DeepL if `OSLT_DEEPL_API_KEY` exists.

```bash
# Google Cloud Translation v2
OSLT_TRANSLATOR=google-cloud \
OSLT_GOOGLE_CLOUD_API_KEY=your-key \
npm start

# DeepL
OSLT_TRANSLATOR=deepl \
OSLT_DEEPL_API_KEY=your-key \
OSLT_DEEPL_ENDPOINT=https://api-free.deepl.com/v2/translate \
npm start
```

Custom translation endpoints must use HTTPS. HTTP is allowed only for localhost development proxies. API keys are read from process environment variables and must never be committed.

## Development commands

```bash
npm start
npm run build:native
npm run package:mac
npm run benchmark -- /path/to/sample.png eng
npm run check
npm test
```

## Architecture

```text
Screen region
    ↓ ScreenCaptureKit or screen capture fallback
Jimp crop / optional upscale
    ↓
Tesseract.js OCR + bounding boxes
    ↓
Paragraph grouping and layout inference
    ↓
Translation cache + provider adapter
    ↓
IPC → positioned HTML translation patches
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

## macOS releases

The public [v1.0.2 release](https://github.com/cnd173/oslt-live-translate/releases/tag/v1.0.2) contains unsigned DMGs for Apple Silicon (`arm64`) and Intel (`x64`). Unsigned builds may require **Open** from the Finder context menu or an approval in macOS Privacy & Security.

Release automation runs tests and builds both architectures. Developer ID signing and notarization are optional in the workflow and require Apple Developer credentials; they are not required to build or publish the source project.

## Privacy and security

- Screenshots are processed locally with Jimp and Tesseract.js.
- OCR text is sent to the selected translation provider.
- OSLT has no telemetry and does not intentionally persist screenshots or translation history.
- Do not place passwords, recovery keys, confidential documents, or sensitive personal data inside the capture region unless you accept sending the OCR text to a third-party translation service.

See [SECURITY.md](SECURITY.md) for the security policy.

## Known limitations

- OCR accuracy depends on resolution, contrast, font, background effects, and language selection.
- Source font family and bold/italic styling are approximated rather than reproduced exactly.
- Translations longer than the source region are reduced to fit.
- Windows, Linux, and multi-monitor setups are not fully tested.
- Safe live mode requires macOS 14 or later and the native capture helper.

## Contributing

Issues and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before making changes and run `npm test` before submitting a pull request.

## License

[MIT](LICENSE)
