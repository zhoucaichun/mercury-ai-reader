import type Database from 'better-sqlite3';
import type { AgentTaskRun, AgentTaskRunStatus, AgentTaskType } from '../types';

export interface IAgentTaskRunStore {
  create(params: {
    entryId: number;
    taskType: AgentTaskType;
    status: AgentTaskRunStatus;
    agentProfileId?: number | null;
    providerProfileId?: number | null;
    modelProfileId?: number | null;
    promptVersion?: string | null;
    targetLanguage?: string | null;
    templateId?: string | null;
    templateVersion?: string | null;
    runtimeParameterSnapshot?: string | null;
    errorMessage?: string | null;
    errorCode?: string | null;
    durationMs?: number | null;
  }): AgentTaskRun;
  getById(id: number): AgentTaskRun | null;
  getByEntryId(entryId: number): AgentTaskRun[];
  getByEntryIdAndTaskType(entryId: number, taskType: AgentTaskType): AgentTaskRun[];
  updateStatus(id: number, status: AgentTaskRunStatus, params?: {
    durationMs?: number;
    errorMessage?: string;
    errorCode?: string;
  }): void;
  delete(id: number): void;
  deleteByEntryId(entryId: number): void;
}

export function createAgentTaskRunStore(db: Database.Database): IAgentTaskRunStore {
  const insertStmt = db.prepare(`
    INSERT INTO agent_task_run (entryId, taskType, status, agentProfileId, providerProfileId,
      modelProfileId, promptVersion, targetLanguage, templateId, templateVersion,
      runtimeParameterSnapshot, errorMessage, errorCode, durationMs)
    VALUES (@entryId, @taskType, @status, @agentProfileId, @providerProfileId,
      @modelProfileId, @promptVersion, @targetLanguage, @templateId, @templateVersion,
      @runtimeParameterSnapshot, @errorMessage, @errorCode, @durationMs)
  `);

  const getByIdStmt = db.prepare('SELECT * FROM agent_task_run WHERE id = ?');
  const getByEntryIdStmt = db.prepare('SELECT * FROM agent_task_run WHERE entryId = ? ORDER BY updatedAt DESC');
  const getByEntryIdAndTaskTypeStmt = db.prepare('SELECT * FROM agent_task_run WHERE entryId = ? AND taskType = ? ORDER BY updatedAt DESC');
  const updateStatusStmt = db.prepare(`
    UPDATE agent_task_run SET status = @status, updatedAt = datetime('now')
    WHERE id = @id
  `);
  const updateStatusWithParamsStmt = db.prepare(`
    UPDATE agent_task_run
    SET status = @status, durationMs = @durationMs, errorMessage = @errorMessage,
        errorCode = @errorCode, updatedAt = datetime('now')
    WHERE id = @id
  `);
  const deleteStmt = db.prepare('DELETE FROM agent_task_run WHERE id = ?');
  const deleteByEntryIdStmt = db.prepare('DELETE FROM agent_task_run WHERE entryId = ?');

  function mapRow(row: Record<string, unknown>): AgentTaskRun {
    return row as unknown as AgentTaskRun;
  }

  return {
    create(params): AgentTaskRun {
      const info = insertStmt.run({
        entryId: params.entryId,
        taskType: params.taskType,
        status: params.status,
        agentProfileId: params.agentProfileId ?? null,
        providerProfileId: params.providerProfileId ?? null,
        modelProfileId: params.modelProfileId ?? null,
        promptVersion: params.promptVersion ?? null,
        targetLanguage: params.targetLanguage ?? null,
        templateId: params.templateId ?? null,
        templateVersion: params.templateVersion ?? null,
        runtimeParameterSnapshot: params.runtimeParameterSnapshot ?? null,
        errorMessage: params.errorMessage ?? null,
        errorCode: params.errorCode ?? null,
        durationMs: params.durationMs ?? null,
      });
      return mapRow(getByIdStmt.get(info.lastInsertRowid) as Record<string, unknown>);
    },

    getById(id): AgentTaskRun | null {
      const row = getByIdStmt.get(id) as Record<string, unknown> | undefined;
      return row ? mapRow(row) : null;
    },

    getByEntryId(entryId): AgentTaskRun[] {
      return (getByEntryIdStmt.all(entryId) as Array<Record<string, unknown>>).map(mapRow);
    },

    getByEntryIdAndTaskType(entryId, taskType): AgentTaskRun[] {
      return (getByEntryIdAndTaskTypeStmt.all(entryId, taskType) as Array<Record<string, unknown>>).map(mapRow);
    },

    updateStatus(id, status, params?): void {
      if (params) {
        updateStatusWithParamsStmt.run({
          id,
          status,
          durationMs: params.durationMs ?? null,
          errorMessage: params.errorMessage ?? null,
          errorCode: params.errorCode ?? null,
        });
      } else {
        updateStatusStmt.run({ id, status });
      }
    },

    delete(id): void {
      deleteStmt.run(id);
    },

    deleteByEntryId(entryId): void {
      deleteByEntryIdStmt.run(entryId);
    },
  };
}
