# Prism Reader Technical Stack

This document records the technical choices used by Prism Reader and the rationale behind them.

## Product Goal

Prism Reader is a local-first desktop feed reader with AI-assisted summary and translation. The project focuses on:

- RSS / Atom subscription and article synchronization;
- OPML import;
- local article storage and reading state;
- cleaned article content and canonical Markdown;
- AI summary and translation through OpenAI-compatible providers;
- LLM usage records;
- single-article Markdown export;
- cross-platform desktop delivery.

## Selected Stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| Desktop shell | Electron | Package the application as a desktop app for Windows, macOS, and Linux. |
| UI | React | Build the reader interface, settings, panels, and interactive states. |
| Language | TypeScript | Keep cross-module contracts explicit and reduce integration errors. |
| Build tool | Vite | Provide fast development server and production renderer build. |
| Local storage | SQLite / better-sqlite3 | Store feeds, articles, content, AI results, usage records, and settings locally. |
| Feed parsing | rss-parser | Parse RSS and Atom feeds. |
| Network requests | undici / platform fetch | Fetch Feed content, article content, and model API responses. |
| Content pipeline | project pipeline utilities | Convert `sourceHtml` into `cleanedHtml` and `canonicalMarkdown`. |
| AI provider | OpenAI-compatible API | Support multiple remote or local model services through one provider contract. |
| Icons | lucide-react | Provide consistent interface icons. |
| Project workflow | GitHub Issues / Pull Requests / Releases | Track tasks, review changes, and publish packaged builds. |

## Rationale

Electron, React, TypeScript, and Vite were selected because they allow the team to deliver a cross-platform desktop product with a familiar web development workflow. SQLite supports the local-first product direction and avoids requiring a backend server. OpenAI-compatible providers keep AI features independent of a single model vendor.

The project does not use a cloud account system. User data is stored locally, and API keys are encrypted in the desktop app through Electron `safeStorage`.

## Architecture Notes

- The renderer owns the user interface.
- The Electron main process owns desktop capabilities, local storage access, OPML import, feed synchronization, and AI IPC boundaries.
- Feed, reader, agent, usage, and export features are kept under `src/features/`.
- Shared data contracts are defined in `AGENTS.md` and implemented through TypeScript interfaces.

## Validation Commands

```bash
npm test
npm run build
npm run smoke:week2
npm run pack:win:zip
```

These commands validate unit tests, production build, real Feed synchronization, duplicate prevention, article content availability, and Windows packaging.
