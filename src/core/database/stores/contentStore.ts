import type Database from 'better-sqlite3';
import type { Content, ContentLayerState } from '../types';

export type ContentInsert = Omit<Content, 'id' | 'createdAt'>;

export interface IContentStore {
  upsert(content: ContentInsert): Content;
  getByEntryId(entryId: number): Content | null;
  getLayerState(entryId: number): ContentLayerState;
}

export function createContentStore(db: Database.Database): IContentStore {
  const upsertStmt = db.prepare(`
    INSERT INTO content (entryId, html, cleanedHtml, readabilityTitle, readabilityByline,
      readabilityVersion, markdown, markdownVersion, displayMode, documentBaseUrl,
      pipelineType, resolvedIntermediateContent)
    VALUES (@entryId, @html, @cleanedHtml, @readabilityTitle, @readabilityByline,
      @readabilityVersion, @markdown, @markdownVersion, @displayMode, @documentBaseUrl,
      @pipelineType, @resolvedIntermediateContent)
    ON CONFLICT(entryId) DO UPDATE SET
      html = excluded.html,
      cleanedHtml = excluded.cleanedHtml,
      readabilityTitle = excluded.readabilityTitle,
      readabilityByline = excluded.readabilityByline,
      readabilityVersion = excluded.readabilityVersion,
      markdown = excluded.markdown,
      markdownVersion = excluded.markdownVersion,
      displayMode = excluded.displayMode,
      documentBaseUrl = excluded.documentBaseUrl,
      pipelineType = excluded.pipelineType,
      resolvedIntermediateContent = excluded.resolvedIntermediateContent
  `);

  const getByEntryIdStmt = db.prepare('SELECT * FROM content WHERE entryId = ?');

  return {
    upsert(content: ContentInsert): Content {
      const info = upsertStmt.run({
        entryId: content.entryId,
        html: content.html ?? null,
        cleanedHtml: content.cleanedHtml ?? null,
        readabilityTitle: content.readabilityTitle ?? null,
        readabilityByline: content.readabilityByline ?? null,
        readabilityVersion: content.readabilityVersion ?? null,
        markdown: content.markdown ?? null,
        markdownVersion: content.markdownVersion ?? null,
        displayMode: content.displayMode ?? 'web',
        documentBaseUrl: content.documentBaseUrl ?? null,
        pipelineType: content.pipelineType ?? 'default',
        resolvedIntermediateContent: content.resolvedIntermediateContent ?? null,
      });

      if (info.lastInsertRowid > 0) {
        const row = getByEntryIdStmt.get(content.entryId) as Content | undefined;
        return row!;
      }
      return getByEntryIdStmt.get(content.entryId) as Content;
    },

    getByEntryId(entryId: number): Content | null {
      return (getByEntryIdStmt.get(entryId) as Content | undefined) ?? null;
    },

    getLayerState(entryId: number): ContentLayerState {
      const row = getByEntryIdStmt.get(entryId) as Content | undefined;
      if (!row) {
        return {
          hasSourceHtml: false,
          hasCleanedHtml: false,
          hasMarkdown: false,
          readabilityVersion: null,
          markdownVersion: null,
        };
      }
      return {
        hasSourceHtml: row.html !== null,
        hasCleanedHtml: row.cleanedHtml !== null,
        hasMarkdown: row.markdown !== null,
        readabilityVersion: row.readabilityVersion,
        markdownVersion: row.markdownVersion,
      };
    },
  };
}
