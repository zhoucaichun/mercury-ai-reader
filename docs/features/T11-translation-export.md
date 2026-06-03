# T11 Translation Agent And Markdown Export

负责人：余富康
任务范围：Translation Agent / 单篇 Markdown 导出
当前阶段：Week 2 接口对齐与 mock 实现，不阻塞 Feed / OPML / Sync / 本地存储 / 文章列表主链路

## 1. 交付说明

本模块负责两件事：

- Translation Agent：基于文章的 `canonicalMarkdown` 生成译文；
- Markdown Export：将单篇文章按 Markdown 模板导出，可包含原文、摘要、译文和来源信息。

本次提交按 `AGENTS.md` 对齐：

- Translation 输入统一使用 T6 / T2 输出的 `canonicalMarkdown`；
- 模型调用统一使用 T9 的 `provider.chat(request)`；
- 模型返回文本统一读取 `response.content`；
- Usage 记录统一走 `LLMUsageEvent`，字段使用 `promptTokens / completionTokens / totalTokens / estimated`；
- Export 只做单篇 Markdown 导出，不做多篇导出。

## 2. Translation 输入结构

```ts
export interface TranslationRequest {
  articleId: string;
  contentId?: string;
  title: string;
  sourceUrl?: string;
  canonicalMarkdown: string;
  targetLanguage: string;
  sourceLanguage?: string;
  model?: string;
  metadata?: Record<string, unknown>;
}
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| `articleId` | 当前文章 ID，由 T2 / T7 提供 |
| `contentId` | 当前文章内容记录 ID，可选 |
| `title` | 文章标题 |
| `sourceUrl` | 原文链接，可选 |
| `canonicalMarkdown` | 统一正文输入，来自 Reader Pipeline / ArticleContent |
| `targetLanguage` | 目标语言，例如 `zh-CN` / `en-US` |
| `sourceLanguage` | 源语言，可选，默认 `auto` |
| `model` | 指定模型，可选 |
| `metadata` | 透传给 Runtime / Provider / Usage 的扩展信息 |

## 3. Translation 输出结构

```ts
export interface TranslationResult {
  id: string;
  articleId: string;
  contentId?: string;
  targetLanguage: string;
  sourceLanguage?: string;
  markdown: string;
  providerId: string;
  providerName: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimated?: boolean;
  createdAt: string;
  updatedAt: string;
}
```

说明：

- 译文统一保存为 `markdown`，便于阅读页展示、复制和导出；
- 时间字段统一使用 ISO string；
- Provider 和 usage 字段用于后续 Usage 面板和模型调用追踪；
- 最终落库字段以 T2 数据模型为准，如数据库字段名不同，需要在 T2 文档中说明映射关系。

## 4. Prompt 参数与模板

Prompt 不硬编码在业务函数中。T11 当前提供 `resources/prompts/translation.default.yaml` 作为模板草案，后续由 T8 Prompt Loader 统一加载和渲染。

主要参数：

| 参数 | 用途 |
| --- | --- |
| `title` | 提供文章主题上下文 |
| `sourceUrl` | 保留来源上下文，可选 |
| `canonicalMarkdown` | 翻译正文输入 |
| `sourceLanguage` | 源语言，默认 `auto` |
| `targetLanguage` | 目标语言 |

## 5. Mock Translation 流程

```text
T7 阅读页点击翻译入口
  -> T11 组装 TranslationRequest
  -> T11 构造 LLMChatRequest
  -> 调用 T9 provider.chat(request)
  -> Usage 模块记录 LLMUsageEvent
  -> T11 从 response.content 读取译文
  -> 生成 TranslationResult
  -> T7 阅读页展示译文
```

当前可使用 `createMockTranslationAgent()` 做本地联调。它使用 T9 的 `MockLLMProvider` 和 usage 模块的 `InMemoryLLMUsageEventStore`。

## 6. 与 T8 Runtime 对接

T11 后续接入 T8 Runtime 时，建议调用形式如下：

```ts
runtime.runAgent({
  taskId: "task-translation-demo",
  agentType: "translation",
  templateId: "translation.default",
  input: translationRequest,
  providerId: "mock-provider",
  model: "mock-translation-v1",
  metadata: {
    articleId: translationRequest.articleId,
    purpose: "translation",
  },
});
```

状态口径按 `AGENTS.md` 第 6 节：

```text
idle / queued / running / succeeded / failed / cancelled
```

其中 `LLMUsageEvent.status` 只记录：

```text
succeeded / failed
```

## 7. 与 T9 Provider / Usage 对接

Translation 不直接写某个模型服务的请求逻辑，只依赖统一 Provider：

```ts
const response = await provider.chat(request);
const translatedMarkdown = response.content;
```

Usage 字段按 `AGENTS.md` 第 8 节：

```ts
purpose: "translation";
providerId: string;
providerName: string;
model: string;
status: "succeeded" | "failed";
promptTokens?: number;
completionTokens?: number;
totalTokens?: number;
estimated?: boolean;
startedAt?: string;
finishedAt?: string;
latencyMs?: number;
```

## 8. 单篇 Markdown 导出

导出输入结构：

```ts
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
```

导出内容建议包含：

- 标题；
- 原文链接；
- 作者、发布时间、来源；
- Summary 结果，可选；
- Translation 结果，可选；
- 原始 canonical Markdown。

当前代码提供：

```ts
renderMarkdownExport(data);
createMarkdownExportFile(data);
previewExportMarkdown(data);
downloadMarkdownFile(data);
```

## 9. 验证方式

本次 PR 验证重点：

- `TranslationRequest` 使用 `canonicalMarkdown`；
- Provider 调用使用 `provider.chat()`；
- 译文读取 `response.content`；
- usage 字段使用 `estimated`，不使用 `isEstimated`；
- Export 只做单篇 Markdown；
- 代码能通过 `npm test` 和 `npm run build`。

## 10. 协作依赖

| 模块 | 需要对齐内容 |
| --- | --- |
| T2 数据模型 | `TranslationResult`、`AgentTaskRun`、`LLMUsageEvent` 落库字段 |
| T6 Reader Pipeline | `canonicalMarkdown` 输出字段与内容稳定性 |
| T7 Reader UI | 翻译入口、译文展示、导出按钮 |
| T8 Agent Runtime | `runAgent()`、状态机、Prompt Loader |
| T9 Provider / Usage | `provider.chat()`、`response.content`、usage 字段 |
| T10 Summary Agent | 导出时是否包含 `SummaryResult.markdown` |

## 11. 后续计划

- 接入 T8 Runtime 的真实 `runAgent()` 调用；
- 使用 T8 Prompt Loader 加载 `translation.default.yaml`；
- 与 T7 联调阅读页翻译入口和导出入口；
- 与 T2 对齐 `TranslationResult` 的最终保存方式；
- 与 T9 联调真实 OpenAI-compatible Provider。
