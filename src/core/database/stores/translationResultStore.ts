import type Database from 'better-sqlite3';
import type { TranslationResult, AgentTaskRun } from '../types';
import { createAgentTaskRunStore } from './agentTaskRunStore';
import type { IAgentTaskRunStore } from './agentTaskRunStore';

export interface ITranslationResultStore {
  save(params: {
    entryId: number;
    targetLanguage: string;
    sourceContentHash: string;
    segmenterVersion: string;
    outputLanguage: string;
    markdown: string;
    providerProfileId?: number | null;
    modelProfileId?: number | null;
    promptVersion?: string | null;
    templateId?: string | null;
    templateVersion?: string | null;
    durationMs?: number | null;
  }): { run: AgentTaskRun; result: TranslationResult };
  getByEntryId(entryId: number): TranslationResult[];
  getLatestByEntryId(entryId: number): TranslationResult | null;
  deleteByTaskRunId(taskRunId: number): void;
}

export function createTranslationResultStore(db: Database.Database): ITranslationResultStore {
  const taskRunStore: IAgentTaskRunStore = createAgentTaskRunStore(db);

  const insertResultStmt = db.prepare(`
    INSERT INTO translation_result (taskRunId, entryId, targetLanguage, sourceContentHash,
      segmenterVersion, outputLanguage, runStatus, markdown)
    VALUES (@taskRunId, @entryId, @targetLanguage, @sourceContentHash,
      @segmenterVersion, @outputLanguage, @runStatus, @markdown)
    ON CONFLICT(entryId, targetLanguage) DO UPDATE SET
      taskRunId = excluded.taskRunId,
      sourceContentHash = excluded.sourceContentHash,
      segmenterVersion = excluded.segmenterVersion,
      outputLanguage = excluded.outputLanguage,
      runStatus = excluded.runStatus,
      markdown = excluded.markdown,
      updatedAt = datetime('now')
  `);

  const getByEntryIdStmt = db.prepare('SELECT * FROM translation_result WHERE entryId = ? ORDER BY updatedAt DESC');
  const getLatestByEntryIdStmt = db.prepare('SELECT * FROM translation_result WHERE entryId = ? ORDER BY updatedAt DESC LIMIT 1');
  const deleteByTaskRunIdStmt = db.prepare('DELETE FROM translation_result WHERE taskRunId = ?');

  return {
    save(params): { run: AgentTaskRun; result: TranslationResult } {
      return db.transaction(() => {
        const run = taskRunStore.create({
          entryId: params.entryId,
          taskType: 'translation',
          status: 'succeeded',
          targetLanguage: params.targetLanguage,
          providerProfileId: params.providerProfileId,
          modelProfileId: params.modelProfileId,
          promptVersion: params.promptVersion,
          templateId: params.templateId,
          templateVersion: params.templateVersion,
          durationMs: params.durationMs,
        });

        insertResultStmt.run({
          taskRunId: run.id,
          entryId: params.entryId,
          targetLanguage: params.targetLanguage,
          sourceContentHash: params.sourceContentHash,
          segmenterVersion: params.segmenterVersion,
          outputLanguage: params.outputLanguage,
          runStatus: 'succeeded',
          markdown: params.markdown,
        });

        const result = getLatestByEntryIdStmt.get(params.entryId) as TranslationResult;
        return { run, result };
      })();
    },

    getByEntryId(entryId): TranslationResult[] {
      return getByEntryIdStmt.all(entryId) as TranslationResult[];
    },

    getLatestByEntryId(entryId): TranslationResult | null {
      return (getLatestByEntryIdStmt.get(entryId) as TranslationResult | undefined) ?? null;
    },

    deleteByTaskRunId(taskRunId): void {
      deleteByTaskRunIdStmt.run(taskRunId);
    },
  };
}
