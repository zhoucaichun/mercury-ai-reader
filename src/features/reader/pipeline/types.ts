/**
 * T6 Reader Pipeline — 类型定义
 *
 * 对齐 AGENTS.md 5. Core Data Contracts：
 * - 字段统一 camelCase
 * - 时间统一 ISO string
 * - canonicalMarkdown 是下游唯一标准输入
 */

export type ISODateString = string;

export interface PipelineResult {
  sourceHtml: string;
  cleanedHtml: string;
  canonicalMarkdown: string;
  title: string;
  url: string;
  pipelineVersion: number;
  cleanedAt: ISODateString;
}

export interface ExtractedContent {
  title: string;
  contentHtml: string;
  byline?: string;
}

/** 对齐 AGENTS.md 5A Week2ArticleContent */
export interface Week2ArticleContent {
  articleId: string;
  sourceHtml: string;
  cleanedHtml: string;
  canonicalMarkdown: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export const PIPELINE_VERSION = 1;

export function needsRefresh(storedVersion?: number): boolean {
  return !storedVersion || storedVersion < PIPELINE_VERSION;
}
