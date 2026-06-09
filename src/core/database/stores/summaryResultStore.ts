import type Database from 'better-sqlite3';
import type { SummaryResult, SummaryDetailLevel, AgentTaskRun } from '../types';
import { createAgentTaskRunStore } from './agentTaskRunStore';
import type { IAgentTaskRunStore } from './agentTaskRunStore';

export interface ISummaryResultStore {
  save(params: {
    entryId: number;
    targetLanguage: string;
    detailLevel: SummaryDetailLevel;
    outputLanguage: string;
    markdown: string;
    providerProfileId?: number | null;
    modelProfileId?: number | null;
    promptVersion?: string | null;
    templateId?: string | null;
    templateVersion?: string | null;
    durationMs?: number | null;
  }): { run: AgentTaskRun; result: SummaryResult };
  getByEntryId(entryId: number): SummaryResult[];
  getLatestByEntryId(entryId: number): SummaryResult | null;
  deleteByTaskRunId(taskRunId: number): void;
}

export function createSummaryResultStore(db: Database.Database): ISummaryResultStore {
  const taskRunStore: IAgentTaskRunStore = createAgentTaskRunStore(db);

  const insertResultStmt = db.prepare(`
    INSERT INTO summary_result (taskRunId, entryId, targetLanguage, detailLevel, outputLanguage, markdown)
    VALUES (@taskRunId, @entryId, @targetLanguage, @detailLevel, @outputLanguage, @markdown)
    ON CONFLICT(entryId, targetLanguage, detailLevel) DO UPDATE SET
      taskRunId = excluded.taskRunId,
      outputLanguage = excluded.outputLanguage,
      markdown = excluded.markdown,
      updatedAt = datetime('now')
  `);

  const getByEntryIdStmt = db.prepare('SELECT * FROM summary_result WHERE entryId = ? ORDER BY updatedAt DESC');
  const getLatestByEntryIdStmt = db.prepare('SELECT * FROM summary_result WHERE entryId = ? ORDER BY updatedAt DESC LIMIT 1');
  const deleteByTaskRunIdStmt = db.prepare('DELETE FROM summary_result WHERE taskRunId = ?');

  return {
    save(params): { run: AgentTaskRun; result: SummaryResult } {
      return db.transaction(() => {
        const run = taskRunStore.create({
          entryId: params.entryId,
          taskType: 'summary',
          status: 'succeeded',
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
          detailLevel: params.detailLevel,
          outputLanguage: params.outputLanguage,
          markdown: params.markdown,
        });

        const result = getLatestByEntryIdStmt.get(params.entryId) as SummaryResult;
        return { run, result };
      })();
    },

    getByEntryId(entryId): SummaryResult[] {
      return getByEntryIdStmt.all(entryId) as SummaryResult[];
    },

    getLatestByEntryId(entryId): SummaryResult | null {
      return (getLatestByEntryIdStmt.get(entryId) as SummaryResult | undefined) ?? null;
    },

    deleteByTaskRunId(taskRunId): void {
      deleteByTaskRunIdStmt.run(taskRunId);
    },
  };
}
