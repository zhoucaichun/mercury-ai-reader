# Prism Reader

Prism Reader is a local-first, cross-platform AI feed reader built as a course team project. It supports RSS / Atom subscriptions, OPML import, real article synchronization, local storage, reader-focused content display, AI summary and translation, usage tracking, and single-article Markdown export.

The application does not require user registration or login. Subscriptions, articles, reading state, notes, AI results, usage records, and model settings are stored on the user's device. In the desktop application, API keys are encrypted with Electron `safeStorage`; real keys are not committed to the repository or uploaded to a server.

## Current Features

- Feed subscriptions: add a Feed URL, synchronize real RSS / Atom articles, import OPML files, enable, disable, and delete subscriptions.
- Article synchronization: fetch real articles, deduplicate feeds and entries, store article list and article content locally.
- Reader UI: three-column layout for subscriptions, article list, and reading view, with responsive panels and reading settings.
- Content pipeline: keeps `sourceHtml`, `cleanedHtml`, and `canonicalMarkdown` as the shared content layers for reading, AI, and export.
- AI summary: generate summaries from the current article and reuse saved results when available instead of repeatedly calling the model.
- AI translation: support full-article translation, selected-text translation, bilingual paragraph display, and progress feedback.
- Provider settings: save multiple OpenAI-compatible model configurations, choose default models for summary and translation, delete saved profiles, and test connectivity.
- Usage tracking: record purpose, provider, model, token usage, status, and latency for AI calls.
- Markdown export: export the current article, with optional summary and translation content.
- Reader enhancements: themes, read/unread and saved states, tags, reading progress, highlights, underlines, notes, and AI history.

## Download

Windows x64 release:

https://github.com/zhoucaichun/mercury-ai-reader/releases/tag/v0.1.0-prism-reader

Download `Prism.Reader-0.1.0-Windows-x64.zip`, unzip it, and run:

```text
Prism Reader.exe
```

Notes:

- The current public release provides a Windows x64 zip package.
- macOS and Linux targets are reserved in the build configuration and can be built from source.
- If Windows shows a security warning for the unsigned course project build, choose "Run anyway".

## Basic Usage

1. Open Prism Reader.
2. Enter a Feed URL and click sync, or leave the input empty to sync the default real feeds.
3. Use OPML import to add multiple subscriptions from a `.opml` file.
4. Select a subscription and an article to read the cleaned content.
5. Configure an OpenAI-compatible model in settings if AI summary or translation is needed.
6. Use summary, translation, selected-text translation, notes, highlights, tags, usage, and Markdown export from the reader page.

Test Feed examples:

```text
https://www.ruanyifeng.com/blog/atom.xml
https://blog.mozilla.org/en/feed/
https://xkcd.com/atom.xml
```

OPML examples are available in:

```text
test-opml/
```

## AI Model Configuration

Prism Reader uses OpenAI-compatible APIs. Common examples:

| Provider | Base URL Example | Model Example | API Key |
| --- | --- | --- | --- |
| OpenAI-compatible service | `https://api.example.com/v1` | Provided by service | Provided by service |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` | DeepSeek API Key |
| Local Ollama | `http://localhost:11434/v1` | `qwen2.5:7b` | Any non-empty placeholder |

API keys are stored only on the current device. The desktop build encrypts saved keys through Electron `safeStorage`; browser preview mode is only a development fallback.

## Tech Stack

- Electron: cross-platform desktop shell.
- React: user interface.
- TypeScript: typed contracts and implementation.
- Vite: development and build tooling.
- SQLite / better-sqlite3: local-first storage.
- rss-parser: RSS / Atom parsing.
- OpenAI-compatible API: unified model provider interface.
- lucide-react: UI icons.

## Project Structure

```text
electron/                         Electron main process, preload, storage and AI IPC
src/
  app/                            React application entry
  core/                           Shared types, database stores, adapters, and seed data
  features/
    feed/
      parser/                     RSS / Atom parser
      opml/                       OPML parsing
      subscriptions/              Subscription management
      sync/                       Feed sync, deduplication, and storage integration
    reader/                       Reader UI and reader data port
      pipeline/                   Content cleaning pipeline
    agent/
      runtime/                    Agent runtime contracts
      prompts/                    Prompt loading and rendering
      providers/                  LLM provider configuration and calls
      summary/                    Summary agent
      translation/                Translation agent
    usage/                        LLM usage records and aggregation
    export/                       Single-article Markdown export
  styles/                         Global styles
resources/prompts/                Prompt templates
docs/features/                    Feature design and module documentation
docs/reports/                     Module progress and validation reports
task-documents/                   Formal project planning and technical documents
test-opml/                        OPML files for import testing
```

## Team Contributions

| Member | Responsibility | Repository Evidence |
| --- | --- | --- |
| T0 周彩纯 | Project management, integration, testing, release packaging, documentation | `README.md`, `AGENTS.md`, `task-documents/`, release assets, integration commits |
| T1 张珈鸣 | Project skeleton, Electron / React / Vite setup, build scripts | `package.json`, `electron/`, `src/app/`, `src/main.tsx`, `vite.config.ts` |
| T2 林杨 | Data model, SQLite storage, stores, storage adapters | `src/core/database/`, `docs/features/T2-data-model.md` |
| T3 周康 | Feed URL adding, RSS / Atom parser, parser tests and reports | `src/features/feed/parser/`, `test/`, `docs/features/T3-feed-parser.md`, `docs/reports/T3-*` |
| T4 李欣然 | OPML import and subscription management | `src/features/feed/opml/`, `src/features/feed/subscriptions/`, `docs/features/T4-opml-subscriptions.md`, `test-opml/` |
| T5 夏培玮 | Feed synchronization, article deduplication, Week 2 smoke chain | `src/features/feed/sync/`, `docs/features/T5-sync-design.md` |
| T6 杜茗天 | Reader pipeline, cleaned content and canonical Markdown | `src/features/reader/pipeline/`, `docs/features/T6-reader-pipeline.md`, `docs/features/T6-reader-pipeline-fixtures/` |
| T7 余婧 | Reader UI, interaction design, themes, notes, highlights, reading states | `src/features/reader/`, `docs/features/T7-reader-ui-plan.md`, `docs/features/T7-ux-review-checklist.md` |
| T8 曾夏杨 | Agent runtime, prompt loading, shared AI task state | `src/features/agent/runtime/`, `src/features/agent/prompts/`, `docs/features/T8-agent-runtime.md` |
| T9 蔡钦楠 | LLM providers, model configuration, usage records and settings panel | `src/features/agent/providers/`, `src/features/usage/`, `docs/features/T9-llm-provider-usage.md` |
| T10 宋金淼 | Summary agent, summary result contract and tests | `src/features/agent/summary/`, `docs/features/T10-summary-agent.md` |
| T11 余富康 | Translation agent and single-article Markdown export | `src/features/agent/translation/`, `src/features/export/`, `docs/features/T11-translation-export.md` |

## Local Development

Requirements:

- Node.js 24.x
- npm 11.x
- Git

Install dependencies:

```bash
npm install
```

Run the desktop application in development mode:

```bash
npm run dev
```

Run only the renderer preview:

```bash
npm run dev:renderer
```

Build:

```bash
npm run build
```

Start the built desktop application:

```bash
npm run start
```

## Tests And Validation

Run unit tests:

```bash
npm test
```

Validate Feed parsing:

```bash
npm run smoke:feed
```

Validate the main Feed sync chain:

```bash
npm run smoke:week2
```

`smoke:week2` synchronizes real feeds, writes feeds / articles / article content, verifies `getArticleContent(articleId)`, and checks that repeated syncs do not create duplicate feeds or articles.

Build Windows zip:

```bash
npm run pack:win:zip
```

The generated package is placed under:

```text
release/Prism Reader-0.1.0-Windows-x64.zip
```

## Privacy And Security

- No registration or login is required.
- The app does not proactively upload subscriptions, articles, reading records, notes, or AI results.
- Article data, reading state, AI results, and usage records are stored locally first.
- Desktop API keys are encrypted with Electron `safeStorage`.
- Real API keys are not committed to the repository.
- Example configuration uses placeholders only.

## Project Documents

- [AGENTS.md](AGENTS.md): shared coding contracts, data contracts, directory rules, and AI integration rules.
- [Feature documents](docs/features): module-level design and implementation notes.
- [Reports](docs/reports): parser progress and validation reports.
- [Technical stack](task-documents/mercury-tech-stack.md): selected technology stack and rationale.
- [Integration plan](task-documents/mercury-four-week-integration-plan.md): four-week project integration and validation plan.
