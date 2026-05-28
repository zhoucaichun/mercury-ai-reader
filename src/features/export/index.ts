// T11 Markdown Export — single-article export
//
// Design: T11 export receives assembled data from the UI layer
// (article + optional summary + optional translation) and renders
// a complete Markdown document, then triggers a file download.
//
// Week 1: browser download via Blob + <a> click
// Week 4+: switch to Electron dialog.showSaveDialog() for native UX

import type { MarkdownExportData } from '../../core/types';

// ─── Markdown template renderer ───────────────────────────────────────

function renderExportMarkdown(data: MarkdownExportData): string {
  const lines: string[] = [];

  // Title
  lines.push(`# ${data.title}`);
  lines.push('');

  // Metadata block
  lines.push(`> **原文链接**：[${data.title}](${data.url})`);
  lines.push(`> **作者**：${data.author}`);
  lines.push(`> **发布时间**：${data.publishedAt}`);
  lines.push('');

  lines.push('---');
  lines.push('');

  // Summary section (if available)
  if (data.summaryText) {
    lines.push('## 摘要');
    lines.push('');
    lines.push(data.summaryText);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  // Translation section (if available)
  if (data.translatedText) {
    lines.push('## 译文');
    lines.push('');
    lines.push(data.translatedText);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  // Article body
  lines.push('## 正文');
  lines.push('');
  lines.push(data.canonicalMarkdown);

  return lines.join('\n');
}

// ─── File name sanitizer ──────────────────────────────────────────────

function sanitizeFileName(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'mercury-article';
}

// ─── Browser download ─────────────────────────────────────────────────

export function downloadMarkdownFile(data: MarkdownExportData): void {
  const markdown = renderExportMarkdown(data);
  const fileName = sanitizeFileName(data.title);
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${fileName}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}

// ─── Export preview helper (for UI) ───────────────────────────────────

export function previewExportMarkdown(data: MarkdownExportData): string {
  return renderExportMarkdown(data);
}

// ─── Feature metadata ─────────────────────────────────────────────────

export const exportFeature = {
  key: 'export',
  ownerTasks: ['T11'],
  status: 'week1-export-template-draft'
} as const;
