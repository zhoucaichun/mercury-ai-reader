/**
 * T6 Reader Pipeline — 主入口
 *
 * Week 2 提供接口草案和 mock 实现，
 * T1 骨架就绪后接入真实 readability/sanitize-html/turndown。
 */

export { PIPELINE_VERSION, needsRefresh } from './types';
export type { PipelineResult, ExtractedContent, Week2ArticleContent } from './types';

// ---- Week 2 Mock Pipeline ----
// 本周不作为主链路阻塞项，先提供 mock 实现，
// 确保 T5/T7 调用 getArticleContent 不为空。

import type { Week2ArticleContent } from './types';

export interface Week2ReaderPipeline {
  runPipeline(sourceHtml: string, url?: string): Promise<Week2ArticleContent>;
}

const PIPELINE_VERSION = 1;

export function createMockPipeline(): Week2ReaderPipeline {
  return {
    async runPipeline(sourceHtml: string, url?: string): Promise<Week2ArticleContent> {
      return {
        articleId: '',
        sourceHtml,
        cleanedHtml: sourceHtml,
        canonicalMarkdown: sourceHtml,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    },
  };
}
