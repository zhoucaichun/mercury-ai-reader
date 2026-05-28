/**
 * T6 Reader Pipeline — TypeScript 接口草案
 *
 * 本文件定义了 T6 Pipeline 的输入输出接口，
 * 以及与 T2（存储）、T5（Sync）、T7（阅读器）、T10/T11（AI Agent）的交互契约。
 *
 * 负责人：杜茗天（jieshibang520）
 * Week 1 版本 —— 接口方向性定义，后续实现时可能微调
 */

// ============================================================
// 1. Pipeline 核心接口
// ============================================================

/** Pipeline 完整产出 */
export interface PipelineResult {
  /** 原始网页 HTML，来自 T5 Sync */
  sourceHtml: string;

  /** 清洗后的 HTML（正文提取 + 去噪） */
  cleanedHtml: string;

  /** 规范 Markdown —— 下游模块（T7/T10/T11）的唯一标准输入 */
  markdown: string;

  /** 文章标题（从 HTML <title> 或 readability 提取） */
  title: string;

  /** 文章来源 URL */
  url: string;

  /** Pipeline 版本号，T2 用来判断旧数据是否需要重新清洗 */
  pipelineVersion: number;

  /** 清洗时间（ISO 8601） */
  cleanedAt: string;
}

/** Pipeline 主入口函数签名 */
export type RunPipeline = (
  sourceHtml: string,
  url?: string
) => PipelineResult;


// ============================================================
// 2. 内部子模块接口
// ============================================================

/** Step 1: 正文提取结果 */
export interface ExtractedContent {
  title: string;
  contentHtml: string; // readability 提取的原始正文 HTML
  byline?: string;     // 作者署名
  excerpt?: string;    // 摘要
}

/** Step 2: HTML 清洗配置 */
export interface CleanConfig {
  /** 允许保留的 HTML 标签（白名单） */
  allowedTags: string[];
  /** 允许保留的 HTML 属性 */
  allowedAttributes: Record<string, string[]>;
  /** 需要移除的 CSS 选择器列表（噪声区域） */
  removeSelectors: string[];
}

/** Step 3: Markdown 转换配置 */
export interface MarkdownConfig {
  headingStyle: 'atx' | 'setext';
  bulletListMarker: '-' | '*' | '+';
  codeBlockStyle: 'fenced' | 'indented';
  emDelimiter: '_' | '*';
  strongDelimiter: '__' | '**';
}


// ============================================================
// 3. 与 T2 存储的接口契约
// ============================================================

/**
 * T6 需要 T2 在 ArticleContent 表中至少提供以下字段。
 *
 * 写入流程：
 *   T5 Sync 创建 Article 记录
 *   → T6 Pipeline 运行
 *   → T6 调用 T2 的 saveArticleContent() 写入三层内容
 *
 * 读取流程：
 *   T7 阅读器：T2 返回 markdown → 渲染
 *   T10/T11 AI：T2 返回 markdown → 作为 LLM 输入
 *   重洗旧文章：T2 返回 sourceHtml/cleanedHtml → T6 重新处理
 */
export interface ArticleContentRecord {
  articleId: string;
  sourceHtml: string;
  cleanedHtml: string;
  markdown: string;
  pipelineVersion: number;
  cleanedAt: string; // ISO 8601
}

/** T2 存储接口 —— T6 需要调用的方法 */
export interface T6StorageAPI {
  /** 保存或更新文章的三层内容 */
  saveArticleContent(record: ArticleContentRecord): Promise<void>;

  /** 获取文章的存储内容（用于重洗判断） */
  getArticleContent(articleId: string): Promise<ArticleContentRecord | null>;

  /** 按 pipelineVersion 查找需要重新清洗的文章 */
  findArticlesNeedingRefresh(
    currentVersion: number
  ): Promise<ArticleContentRecord[]>;
}


// ============================================================
// 4. 与 T5 Sync 的接口契约
// ============================================================

/**
 * T5 Sync 调用 T6 Pipeline 的约定方式：
 *
 * T5 抓取完成一篇新文章后：
 *   1. 保存 sourceHtml
 *   2. 调用 t6.runPipeline(sourceHtml, articleUrl)
 *   3. 拿到 PipelineResult 后，调 T2 存储接口持久化
 *
 * 或者：
 *   1. T5 只负责抓取 + 存储 sourceHtml
 *   2. 后续由调度层统一触发 T6 Pipeline
 */
export interface T5ToT6Contract {
  /** 文章 ID（由 T5 或 T2 生成） */
  articleId: string;

  /** 原始网页 URL */
  url: string;

  /** 原始网页 HTML */
  sourceHtml: string;
}


// ============================================================
// 5. 与 T7/T10/T11 下游模块的接口契约
// ============================================================

/**
 * 下游模块只需从 T2 读取 markdown 字段，不直接依赖 T6。
 *
 * 约束：
 *   - markdown 是下游唯一标准输入，不要绕过它直接读 cleanedHtml 或 sourceHtml
 *   - markdown 格式为标准 CommonMark/GFM，任何标准 Markdown 解析器都能处理
 */
export interface T6DownstreamContract {
  /**
   * 提供给下游的 Markdown 内容保证：
   *   1. 首行是 `# 标题`（ATX h1）
   *   2. 代码块使用 ```围栏语法（fenced code blocks）
   *   3. 表格使用 GFM 表格格式
   *   4. 链接使用 [text](url) 内联格式
   *   5. 不包含 <script>、<style>、<iframe> 等标签
   *   6. 不包含广告、导航、评论等噪声
   *   7. 首尾无多余空行
   */
  readonly markdown: string;
  readonly title: string;
}


// ============================================================
// 6. Pipeline 版本管理
// ============================================================

/**
 * 每次修改 cleaner 或 converter 逻辑时 +1。
 *
 * 用途：
 *   - T2 存储时将 pipelineVersion 写入 ArticleContent
 *   - 查询 pipelineVersion < PIPELINE_VERSION 的文章 → 需要重新清洗
 *   - 重洗时从 sourceHtml 或 cleanedHtml 开始（不需要重新下载原文）
 */
export const PIPELINE_VERSION = 1;

/**
 * 判断已存储的文章是否需要重新清洗
 */
export function needsRefresh(
  storedVersion: number | undefined,
  currentVersion: number = PIPELINE_VERSION
): boolean {
  return !storedVersion || storedVersion < currentVersion;
}
