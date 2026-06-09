import type Database from 'better-sqlite3';
import type {
  LLMUsageEvent, LLMUsageEventContext, LLMUsageSummary,
  AgentTaskType, LLMUsagePurpose,
} from '../types';

export interface ILLMUsageEventStore {
  record(context: LLMUsageEventContext): LLMUsageEvent;
  linkRecentEventsToTaskRun(
    taskRunId: number,
    entryId: number,
    taskType: AgentTaskType,
    startedAt: string,
    finishedAt: string,
  ): void;
  getByTaskRunId(taskRunId: number): LLMUsageEvent[];
  getByEntryId(entryId: number): LLMUsageEvent[];
  getRecentEvents(params?: {
    taskType?: AgentTaskType;
    purpose?: LLMUsagePurpose;
    limit?: number;
  }): LLMUsageEvent[];
  getUsageSummary(): LLMUsageSummary;
  deleteByEntryId(entryId: number): void;
}

export function createLLMUsageEventStore(db: Database.Database): ILLMUsageEventStore {
  const insertStmt = db.prepare(`
    INSERT INTO llm_usage_event (taskRunId, entryId, taskType, purpose,
      providerId, providerName, model, providerProfileId, modelProfileId,
      providerBaseUrlSnapshot, providerResolvedUrlSnapshot, providerResolvedHostSnapshot,
      providerResolvedPathSnapshot, providerNameSnapshot, modelNameSnapshot,
      requestPhase, requestStatus, promptTokens, completionTokens, totalTokens,
      estimated, latencyMs, startedAt, finishedAt)
    VALUES (@taskRunId, @entryId, @taskType, @purpose,
      @providerId, @providerName, @model, @providerProfileId, @modelProfileId,
      @providerBaseUrlSnapshot, @providerResolvedUrlSnapshot, @providerResolvedHostSnapshot,
      @providerResolvedPathSnapshot, @providerNameSnapshot, @modelNameSnapshot,
      @requestPhase, @requestStatus, @promptTokens, @completionTokens, @totalTokens,
      @estimated, @latencyMs, @startedAt, @finishedAt)
  `);

  const getByIdStmt = db.prepare('SELECT * FROM llm_usage_event WHERE id = ?');
  const getByTaskRunIdStmt = db.prepare('SELECT * FROM llm_usage_event WHERE taskRunId = ? ORDER BY createdAt DESC');
  const getByEntryIdStmt = db.prepare('SELECT * FROM llm_usage_event WHERE entryId = ? ORDER BY createdAt DESC');
  const linkStmt = db.prepare(`
    UPDATE llm_usage_event SET taskRunId = ?
    WHERE taskRunId IS NULL AND entryId = ? AND taskType = ?
      AND datetime(startedAt) >= datetime(?, '-1 second')
      AND datetime(finishedAt) <= datetime(?, '+1 second')
  `);
  const deleteByEntryIdStmt = db.prepare('DELETE FROM llm_usage_event WHERE entryId = ?');

  return {
    record(context: LLMUsageEventContext): LLMUsageEvent {
      const info = insertStmt.run({
        taskRunId: context.taskRunId,
        entryId: context.entryId,
        taskType: context.taskType,
        purpose: context.purpose,
        providerId: context.providerId,
        providerName: context.providerName,
        model: context.model,
        providerProfileId: context.providerProfileId,
        modelProfileId: context.modelProfileId,
        providerBaseUrlSnapshot: context.providerBaseUrlSnapshot,
        providerResolvedUrlSnapshot: context.providerResolvedUrlSnapshot,
        providerResolvedHostSnapshot: context.providerResolvedHostSnapshot,
        providerResolvedPathSnapshot: context.providerResolvedPathSnapshot,
        providerNameSnapshot: context.providerNameSnapshot,
        modelNameSnapshot: context.modelNameSnapshot,
        requestPhase: context.requestPhase,
        requestStatus: context.requestStatus,
        promptTokens: context.promptTokens,
        completionTokens: context.completionTokens,
        totalTokens: (context.promptTokens != null && context.completionTokens != null)
          ? context.promptTokens + context.completionTokens : null,
        estimated: context.estimated ? 1 : 0,
        latencyMs: context.latencyMs,
        startedAt: context.startedAt,
        finishedAt: context.finishedAt,
      });
      return getByIdStmt.get(info.lastInsertRowid) as LLMUsageEvent;
    },

    linkRecentEventsToTaskRun(taskRunId, entryId, taskType, startedAt, finishedAt): void {
      linkStmt.run(taskRunId, entryId, taskType, startedAt, finishedAt);
    },

    getByTaskRunId(taskRunId): LLMUsageEvent[] {
      return getByTaskRunIdStmt.all(taskRunId) as LLMUsageEvent[];
    },

    getByEntryId(entryId): LLMUsageEvent[] {
      return getByEntryIdStmt.all(entryId) as LLMUsageEvent[];
    },

    getRecentEvents(params?): LLMUsageEvent[] {
      let sql = 'SELECT * FROM llm_usage_event WHERE 1=1';
      const values: unknown[] = [];

      if (params?.taskType) {
        sql += ' AND taskType = ?';
        values.push(params.taskType);
      }
      if (params?.purpose) {
        sql += ' AND purpose = ?';
        values.push(params.purpose);
      }
      sql += ' ORDER BY createdAt DESC';
      if (params?.limit) {
        sql += ' LIMIT ?';
        values.push(params.limit);
      }
      return db.prepare(sql).all(...values) as LLMUsageEvent[];
    },

    getUsageSummary(): LLMUsageSummary {
      const row = db.prepare(`
        SELECT
          COUNT(*) as totalRequests,
          SUM(CASE WHEN requestStatus = 'succeeded' THEN 1 ELSE 0 END) as successCount,
          SUM(CASE WHEN requestStatus != 'succeeded' THEN 1 ELSE 0 END) as failureCount,
          COALESCE(SUM(promptTokens), 0) as totalPromptTokens,
          COALESCE(SUM(completionTokens), 0) as totalCompletionTokens,
          COALESCE(SUM(totalTokens), 0) as totalTokens
        FROM llm_usage_event
      `).get() as Record<string, number>;

      return {
        totalRequests: row.totalRequests,
        successCount: row.successCount,
        failureCount: row.failureCount,
        totalPromptTokens: row.totalPromptTokens,
        totalCompletionTokens: row.totalCompletionTokens,
        totalTokens: row.totalTokens,
      };
    },

    deleteByEntryId(entryId): void {
      deleteByEntryIdStmt.run(entryId);
    },
  };
}
