import type Database from 'better-sqlite3';

export interface Migration {
  version: number;
  name: string;
  up: (db: Database.Database) => void;
}

function createFeedTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS feed (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      feedUrl TEXT NOT NULL,
      siteUrl TEXT,
      description TEXT,
      feedParserVersion INTEGER,
      lastFetchedAt TEXT,
      isEnabled INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_feed_feedUrl ON feed(feedUrl);
  `);
}

function createEntryTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS entry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      feedId INTEGER NOT NULL REFERENCES feed(id) ON DELETE CASCADE,
      guid TEXT,
      url TEXT,
      title TEXT,
      author TEXT,
      publishedAt TEXT,
      summary TEXT,
      isRead INTEGER NOT NULL DEFAULT 0,
      isStarred INTEGER NOT NULL DEFAULT 0,
      isDeleted INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_entry_feed_guid ON entry(feedId, guid);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_entry_feed_url ON entry(feedId, url);
    CREATE INDEX IF NOT EXISTS idx_entry_feedId ON entry(feedId);
    CREATE INDEX IF NOT EXISTS idx_entry_isRead_publishedAt ON entry(isRead, publishedAt, createdAt);
    CREATE INDEX IF NOT EXISTS idx_entry_feed_publishedAt ON entry(feedId, publishedAt, createdAt);
    CREATE INDEX IF NOT EXISTS idx_entry_publishedAt ON entry(publishedAt, createdAt);
  `);
}

function createContentTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS content (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entryId INTEGER NOT NULL REFERENCES entry(id) ON DELETE CASCADE,
      html TEXT,
      cleanedHtml TEXT,
      readabilityTitle TEXT,
      readabilityByline TEXT,
      readabilityVersion INTEGER,
      markdown TEXT,
      markdownVersion INTEGER,
      displayMode TEXT NOT NULL DEFAULT 'web',
      documentBaseUrl TEXT,
      pipelineType TEXT NOT NULL DEFAULT 'default',
      resolvedIntermediateContent TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_content_entryId ON content(entryId);
  `);
}

function createAppSettingsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function addFeedEnabledColumn(db: Database.Database): void {
  const columns = db.prepare('PRAGMA table_info(feed)').all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === 'isEnabled')) {
    db.exec('ALTER TABLE feed ADD COLUMN isEnabled INTEGER NOT NULL DEFAULT 1');
  }
}

function createAgentTaskRunTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_task_run (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entryId INTEGER NOT NULL REFERENCES entry(id) ON DELETE CASCADE,
      taskType TEXT NOT NULL,
      status TEXT NOT NULL,
      agentProfileId INTEGER,
      providerProfileId INTEGER,
      modelProfileId INTEGER,
      promptVersion TEXT,
      targetLanguage TEXT,
      templateId TEXT,
      templateVersion TEXT,
      runtimeParameterSnapshot TEXT,
      errorMessage TEXT,
      errorCode TEXT,
      durationMs INTEGER,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_atr_entryId ON agent_task_run(entryId);
    CREATE INDEX IF NOT EXISTS idx_atr_taskType ON agent_task_run(taskType);
    CREATE INDEX IF NOT EXISTS idx_atr_status ON agent_task_run(status);
    CREATE INDEX IF NOT EXISTS idx_atr_updatedAt ON agent_task_run(updatedAt);
  `);
}

function createSummaryResultTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS summary_result (
      taskRunId INTEGER NOT NULL PRIMARY KEY REFERENCES agent_task_run(id) ON DELETE CASCADE,
      entryId INTEGER NOT NULL REFERENCES entry(id) ON DELETE CASCADE,
      targetLanguage TEXT NOT NULL,
      detailLevel TEXT NOT NULL,
      outputLanguage TEXT NOT NULL,
      markdown TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_summary_slot ON summary_result(entryId, targetLanguage, detailLevel);
    CREATE INDEX IF NOT EXISTS idx_summary_entryId ON summary_result(entryId);
    CREATE INDEX IF NOT EXISTS idx_summary_updatedAt ON summary_result(updatedAt);
  `);
}

function createTranslationResultTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS translation_result (
      taskRunId INTEGER NOT NULL PRIMARY KEY REFERENCES agent_task_run(id) ON DELETE CASCADE,
      entryId INTEGER NOT NULL REFERENCES entry(id) ON DELETE CASCADE,
      targetLanguage TEXT NOT NULL,
      sourceContentHash TEXT NOT NULL,
      segmenterVersion TEXT NOT NULL,
      outputLanguage TEXT NOT NULL,
      runStatus TEXT NOT NULL DEFAULT 'running',
      markdown TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_translation_slot ON translation_result(entryId, targetLanguage);
    CREATE INDEX IF NOT EXISTS idx_translation_entryId ON translation_result(entryId);
    CREATE INDEX IF NOT EXISTS idx_translation_updatedAt ON translation_result(updatedAt);
  `);
}

function createTranslationSegmentTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS translation_segment (
      taskRunId INTEGER NOT NULL REFERENCES translation_result(taskRunId) ON DELETE CASCADE,
      sourceSegmentId TEXT NOT NULL,
      orderIndex INTEGER NOT NULL,
      sourceTextSnapshot TEXT,
      translatedText TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (taskRunId, sourceSegmentId)
    );
    CREATE INDEX IF NOT EXISTS idx_ts_order ON translation_segment(taskRunId, orderIndex);
  `);
}

function createLLMUsageEventTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS llm_usage_event (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      taskRunId INTEGER REFERENCES agent_task_run(id) ON DELETE SET NULL,
      entryId INTEGER REFERENCES entry(id) ON DELETE SET NULL,
      taskType TEXT NOT NULL,
      purpose TEXT NOT NULL,
      providerId TEXT NOT NULL,
      providerName TEXT NOT NULL,
      model TEXT NOT NULL,
      providerProfileId INTEGER,
      modelProfileId INTEGER,
      providerBaseUrlSnapshot TEXT NOT NULL DEFAULT '',
      providerResolvedUrlSnapshot TEXT,
      providerResolvedHostSnapshot TEXT,
      providerResolvedPathSnapshot TEXT,
      providerNameSnapshot TEXT,
      modelNameSnapshot TEXT NOT NULL,
      requestPhase TEXT NOT NULL DEFAULT 'normal',
      requestStatus TEXT NOT NULL,
      promptTokens INTEGER,
      completionTokens INTEGER,
      totalTokens INTEGER,
      estimated INTEGER NOT NULL DEFAULT 0,
      latencyMs INTEGER,
      startedAt TEXT,
      finishedAt TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_lue_createdAt ON llm_usage_event(createdAt);
    CREATE INDEX IF NOT EXISTS idx_lue_taskType_createdAt ON llm_usage_event(taskType, createdAt);
    CREATE INDEX IF NOT EXISTS idx_lue_taskRunId ON llm_usage_event(taskRunId);
    CREATE INDEX IF NOT EXISTS idx_lue_entryId ON llm_usage_event(entryId);
  `);
}

const migrations: Migration[] = [
  { version: 1, name: 'createFeed', up: createFeedTable },
  { version: 2, name: 'createEntry', up: createEntryTable },
  { version: 3, name: 'createContent', up: createContentTable },
  { version: 4, name: 'createAppSettings', up: createAppSettingsTable },
  { version: 5, name: 'addFeedEnabledColumn', up: addFeedEnabledColumn },
  { version: 6, name: 'createAgentTaskRun', up: createAgentTaskRunTable },
  { version: 7, name: 'createSummaryResult', up: createSummaryResultTable },
  { version: 8, name: 'createTranslationResult', up: createTranslationResultTable },
  { version: 9, name: 'createTranslationSegment', up: createTranslationSegmentTable },
  { version: 10, name: 'createLLMUsageEvent', up: createLLMUsageEventTable },
];

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      appliedAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const appliedRows = db
    .prepare('SELECT version FROM _migrations')
    .all() as Array<{ version: number }>;
  const appliedVersions = new Set(appliedRows.map((r) => r.version));

  for (const migration of migrations) {
    if (!appliedVersions.has(migration.version)) {
      db.transaction(() => {
        migration.up(db);
        db.prepare(
          'INSERT INTO _migrations (version, name) VALUES (?, ?)',
        ).run(migration.version, migration.name);
      })();
    }
  }
}
