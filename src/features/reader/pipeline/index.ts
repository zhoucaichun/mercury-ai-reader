export { PIPELINE_VERSION, needsRefresh } from './types.js';
export type { ExtractedContent, PipelineResult, Week2ArticleContent } from './types.js';

import type { Week2ArticleContent } from './types.js';

export interface Week2ReaderPipeline {
  runPipeline(input: {
    articleId: string;
    sourceHtml: string;
    url?: string;
  }): Promise<Week2ArticleContent>;
}

export function createReaderPipeline(): Week2ReaderPipeline {
  return {
    async runPipeline(input) {
      const now = new Date().toISOString();
      const sourceHtml = input.sourceHtml || '';
      const cleanedHtml = cleanHtml(sourceHtml);
      const canonicalMarkdown = htmlToMarkdown(cleanedHtml);

      return {
        articleId: input.articleId,
        sourceHtml,
        cleanedHtml,
        canonicalMarkdown,
        createdAt: now,
        updatedAt: now
      };
    }
  };
}

export function createMockPipeline(): Week2ReaderPipeline {
  return createReaderPipeline();
}

export function cleanHtml(sourceHtml: string): string {
  const body = extractBody(sourceHtml)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/\s(on\w+|style)=(".*?"|'.*?'|[^\s>]+)/gi, '')
    .replace(/\s(href|src)=["']javascript:[^"']*["']/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return body || '<p>No readable content.</p>';
}

export function htmlToMarkdown(cleanedHtml: string): string {
  return decodeHtmlEntities(
    cleanedHtml
      .replace(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
      .replace(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
      .replace(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
      .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/section>/gi, '\n')
      .replace(/<\/article>/gi, '\n')
      .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
      .replace(/<strong\b[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
      .replace(/<b\b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
      .replace(/<em\b[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
      .replace(/<i\b[^>]*>([\s\S]*?)<\/i>/gi, '*$1*')
      .replace(/<[^>]+>/g, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
      .trim()
  );
}

function extractBody(html: string): string {
  const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  return bodyMatch?.[1] ?? html;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)));
}
