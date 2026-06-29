# Prism Reader Four-Week Integration Plan

This document records the project schedule, integration milestones, and final validation scope for Prism Reader.

## Integration Strategy

The project was organized as a four-week team integration cycle:

```text
Week 1: project setup, technical stack, interfaces, and reader prototype
Week 2: real Feed / OPML / sync / storage / article-list main chain
Week 3: AI summary, translation, usage, export, and reader interaction integration
Week 4: final testing, bug fixing, documentation, packaging, and release
```

The main branch should remain buildable and testable. Shared contracts are defined in `AGENTS.md`, and feature evidence is kept in `docs/features/`, `docs/reports/`, and source directories.

## Week 1: Setup And Contracts

Goals:

- choose the technical stack;
- create the Electron / React / TypeScript / Vite project skeleton;
- define module directories and shared data contracts;
- prepare reader UI prototype and module design documents.

Delivered evidence:

- `package.json`, `electron/`, `src/app/`, `src/main.tsx`;
- `AGENTS.md`;
- `docs/features/T2-data-model.md`;
- `docs/features/T3-feed-parser.md`;
- `docs/features/T6-reader-pipeline.md`;
- `docs/features/T7-reader-ui-plan.md`;
- `docs/features/T8-agent-runtime.md`;
- `docs/features/T9-llm-provider-usage.md`;
- `docs/features/T10-summary-agent.md`;
- `docs/features/T11-translation-export.md`.

## Week 2: Main Feed Chain

Goals:

- parse real RSS / Atom feeds;
- support OPML parsing and subscription management;
- synchronize real articles into the local storage contract;
- expose feed and article data to the reader page;
- provide a smoke test for the main chain.

Delivered evidence:

- `src/features/feed/parser/`;
- `src/features/feed/opml/`;
- `src/features/feed/subscriptions/`;
- `src/features/feed/sync/`;
- `src/core/database/`;
- `electron/week2-sync.ts`;
- `test-opml/`;
- `npm run smoke:week2`.

Validation:

```bash
npm run smoke:week2
```

The smoke test verifies real feed synchronization, feed storage, article storage, article content availability, and duplicate prevention.

## Week 3: AI, Export, Usage, And Reader Integration

Goals:

- connect summary and translation to the reader page;
- support OpenAI-compatible provider configuration;
- save multiple model profiles and choose defaults for summary and translation;
- record usage events;
- export the current article as Markdown;
- improve reader interaction states, reading progress, highlights, notes, tags, and AI history.

Delivered evidence:

- `src/features/agent/runtime/`;
- `src/features/agent/prompts/`;
- `src/features/agent/providers/`;
- `src/features/agent/summary/`;
- `src/features/agent/translation/`;
- `src/features/usage/`;
- `src/features/export/`;
- `src/features/reader/ReaderApp.tsx`;
- `electron/week3-ai.ts`;
- `electron/secure-provider-store.ts`.

## Week 4: Final Validation And Release

Goals:

- clean repository documents;
- verify feature evidence for each member;
- fix final product issues found during testing;
- build and upload the Windows release package;
- keep release notes and README usable for review.

Final validation commands:

```bash
npm test
npm run build
npm run smoke:week2
npm run pack:win:zip
```

Release package:

```text
https://github.com/zhoucaichun/mercury-ai-reader/releases/tag/v0.1.0-prism-reader
```

## Final Review Scope

The final repository should show:

- runnable desktop application source code;
- release package for direct testing;
- formal README with usage, privacy, validation, and member contribution information;
- shared contracts in `AGENTS.md`;
- module documents in `docs/features/`;
- validation reports in `docs/reports/`;
- OPML test files in `test-opml/`;
- no real API keys, personal paths, or internal planning drafts committed to the repository.
