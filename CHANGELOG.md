# Changelog

All notable changes to OSLT are documented here.

## [1.0.2] — 2026-08-23

### Added

- Automatic preference for Google Cloud Translation or DeepL when their API key is configured.
- HTTPS validation for custom remote translation endpoints.
- Optional macOS hardened runtime, code-signing, and notarization workflow configuration.
- Public macOS release builds for both Apple Silicon (`arm64`) and Intel (`x64`).
- English project documentation and release metadata.

### Security

- Google Cloud API keys are sent in request headers instead of query strings.
- Electron renderer isolation, sandboxing, web security, and a restrictive renderer Content Security Policy are enabled.

### Fixed

- Release automation now tolerates missing Apple signing secrets and produces clearly labeled unsigned DMGs.
- Intel builds use the supported `macos-15-intel` GitHub-hosted runner.

## [1.0.1] — 2026-08-23

### Added

- Stable locked translation results to prevent OCR feedback loops and flicker.
- Paragraph grouping, layout alignment, style preservation, and screenshot support.
- macOS native capture helper with overlay exclusion and full-screen fallback.
- CI, Dependabot, security policy, contribution guide, and issue templates.

### Security

- Public Git history was scrubbed of local paths and personal email addresses.
- No API keys, tokens, private keys, or credentials are tracked in the repository.

## [1.0.0]

Initial public prototype release.
