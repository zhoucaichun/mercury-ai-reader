export interface MarkdownExportData {
  title: string;
  url: string;
  author?: string;
  publishedAt?: string;
  feedTitle?: string;
  canonicalMarkdown: string;
  summaryMarkdown?: string;
  translationMarkdown?: string;
  exportedAt?: string;
}

export interface MarkdownExportFile {
  fileName: string;
  markdown: string;
}

export type Week3MarkdownExportData = MarkdownExportData;
export type Week3MarkdownExportFile = MarkdownExportFile;

export function renderMarkdownExport(data: MarkdownExportData): string {
  const exportedAt = data.exportedAt ?? new Date().toISOString();
  const sections = [
    "---",
    `title: ${escapeFrontMatterValue(data.title)}`,
    `sourceUrl: ${escapeFrontMatterValue(data.url)}`,
    data.author ? `author: ${escapeFrontMatterValue(data.author)}` : undefined,
    data.feedTitle ? `feed: ${escapeFrontMatterValue(data.feedTitle)}` : undefined,
    data.publishedAt ? `publishedAt: ${data.publishedAt}` : undefined,
    `exportedAt: ${exportedAt}`,
    "---",
    "",
    `# ${data.title}`,
    "",
    `Source: ${data.url}`,
    data.author ? `Author: ${data.author}` : undefined,
    data.publishedAt ? `Published: ${data.publishedAt}` : undefined,
    "",
    data.summaryMarkdown ? "## Summary" : undefined,
    data.summaryMarkdown?.trim(),
    data.translationMarkdown ? "## Translation" : undefined,
    data.translationMarkdown?.trim(),
    "## Original Markdown",
    data.canonicalMarkdown.trim(),
    "",
  ];

  return sections.filter((section) => section != null && section !== "").join("\n");
}

export function createMarkdownExportFile(
  data: MarkdownExportData,
): MarkdownExportFile {
  return {
    fileName: `${sanitizeFileName(data.title)}.md`,
    markdown: renderMarkdownExport(data),
  };
}

export function previewExportMarkdown(data: MarkdownExportData): string {
  return renderMarkdownExport(data);
}

export async function exportCurrentArticle(
  data: Week3MarkdownExportData,
): Promise<Week3MarkdownExportFile> {
  return createMarkdownExportFile(data);
}

export function downloadMarkdownFile(data: MarkdownExportData): MarkdownExportFile {
  const file = createMarkdownExportFile(data);

  if (typeof document === "undefined") {
    return file;
  }

  const blob = new Blob([file.markdown], {
    type: "text/markdown;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.fileName;
  anchor.click();
  URL.revokeObjectURL(url);

  return file;
}

export function sanitizeFileName(input: string): string {
  const normalized = input
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 80);

  return normalized || "mercury-article";
}

function escapeFrontMatterValue(value: string): string {
  return JSON.stringify(value);
}

export const exportFeature = {
  key: "export",
  ownerTasks: ["T11"],
  status: "single-article-markdown-export",
} as const;
