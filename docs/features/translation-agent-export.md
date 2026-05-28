# T11 Translation Agent / 单篇 Markdown 导出 — 方案分析

> 负责人：余富康 (suzy327) | 协作：T8 (Agent Runtime) / T9 (LLM Provider) / T10 (Summary Agent)

## 1. 模块目标

### Translation Agent
- 对文章 canonical Markdown 内容进行整篇翻译
- 调用 T9 统一 LLM Provider 接口，复用 T8 Agent Runtime 状态机
- 支持配置目标语言（默认英文 → 中文，可扩展）
- 保存译文结果，支持重新生成、复制、失败重试
- 每次调用产出 usage record，交给 T9 用量统计

### 单篇 Markdown 导出
- 将当前文章导出为格式清晰的 Markdown 文件
- 导出内容包含：标题、原文链接、作者、发布时间、摘要（如有）、译文（如有）、正文 Markdown
- 通过浏览器下载触发，保存为 `.md` 文件

## 2. 依赖关系

```
T11 Translation Agent / Export
  ├── T6 (Reader Pipeline) → canonical Markdown 作为翻译输入
  ├── T8 (Agent Runtime)   → Agent 状态机、Prompt 模板渲染（Week 1: T8 暂无代码，T11 内联 system prompt）
  ├── T9 (LLM Provider)    → 统一 Provider 调用接口 (LLMProvider.chat)
  ├── T2 (数据模型)         → TranslationResult 存储、LLMUsageEvent 记录
  └── T7 (阅读器 UI)        → 翻译/导出按钮入口、译文展示区域
```

**关键原则：T11 不单独写模型调用逻辑，所有 LLM 调用走 T9 的 `LLMProvider.chat()` 接口；不单独定义 Agent 状态机，复用 T8 的 runtime。**

### 2.1 T9 接口对齐（2026-05-28 确认）

T9 已在 `origin/feature/T9-llm-provider-usage` 分支实现完整的 LLM Provider 模块（14 文件）。
T11 的接口命名已对齐 T9 的实际代码：

| T11 使用 | T9 定义位置 | 说明 |
|----------|------------|------|
| `LLMProvider.chat(request)` | `types.ts` | 统一调用入口，NOT `complete()` |
| `LLMChatRequest.purpose` | `types.ts` | `'translation'` 已是一等公民 |
| `LLMChatResponse.content` | `types.ts` | 响应文本字段，NOT `text` |
| `LLMChatResponse.usage` | `types.ts` | `LLMUsageInfo { estimated }` — NOT `isEstimated` |
| `LLMUsageEvent` | `types.ts` | usage 记录结构，含 `estimated` 字段 |
| `LLMUsageEventStore` | `usage.ts` | 用量存储接口 |
| `callLLMWithUsage()` | `usage.ts` | 自动记录 usage 的包装函数 |
| `createLLMProvider()` | `providerFactory.ts` | Provider 工厂，支持 mock/openai-compatible |
| `MockLLMProvider` | `mockProvider.ts` | 已支持 `purpose: 'translation'` 生成 mock 内容 |

合并后 T11 的 `src/features/agent/index.ts` 中兼容接口可替换为 T9 的 direct import。

## 3. 推荐数据结构与接口

### 3.1 TranslationResult (落库结构，对齐 T2)

```typescript
type TranslationResult = {
  id: string;
  articleId: string;
  targetLanguage: string;       // 目标语言，默认 'zh-CN'
  translatedText: string;       // 译文正文
  status: AgentRunStatus;       // 复用 T8: idle | running | succeeded | failed
  providerId: string;           // 使用的 Provider ID
  model: string;                // 使用的模型名
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
};
```

### 3.2 TranslationAgent 与 T9 的对接（Week 1 已实现）

```typescript
// T9 Provider 接口 (src/features/llm/types.ts)
interface LLMProvider {
  readonly config: RedactedLLMProviderConfig;
  chat(request: LLMChatRequest): Promise<LLMChatResponse>;  // T9 方法名
}

// T11 通过依赖注入接收 Provider + UsageStore
const agent = createTranslationAgent({
  provider: createLLMProvider(config),   // T9 工厂
  usageStore: new BrowserLocalStorageLLMUsageEventStore(),  // T9 存储
});

// T11 translate() 内部调用
const request: LLMChatRequest = {
  purpose: 'translation',
  messages: [
    { role: 'system', content: '...' },
    { role: 'user', content: canonicalMarkdown },
  ],
  model: 'deepseek-chat',
  metadata: { articleId, targetLanguage },
};
const response: LLMChatResponse = await provider.chat(request);
// response.content  = 译文
// response.usage    = { promptTokens, completionTokens, totalTokens, estimated }
```

### 3.3 Markdown 导出模板

```markdown
# {article.title}

> 原文链接：[{article.title}]({article.url})
> 作者：{article.author}
> 发布时间：{article.publishedAt}

---

## 摘要

{summary.text}

---

## 译文

{translation.text}

---

## 正文

{article.canonicalMarkdown}
```

### 3.4 Prompt Template 草案

```yaml
# resources/prompts/translation.default.yaml
task: translation
version: 1
template:
  system: |
    You are a professional translator. Translate the following article
    from {sourceLanguage} to {targetLanguage}.
    - Preserve the original Markdown formatting (headings, lists, links, code blocks).
    - Keep technical terms accurate.
    - Do not add commentary or summaries.
    - Output ONLY the translated text.
  user: |
    {articleContent}
  defaults:
    sourceLanguage: auto
    targetLanguage: zh-CN
```

## 4. 具体实现步骤

### Week 1 (本周)：方案 + Mock 流程

1. 完成本分析文档，贴到 T11 Issue
2. 在 `src/core/types.ts` 补充 `TranslationResult` 类型
3. 在 `src/core/mockData.ts` 补充翻译 mock 数据
4. 创建 `resources/prompts/translation.default.yaml` 模板文件
5. 在 `src/features/agent/` 添加 Translation Agent 调用骨架（mock 实现，展示与 T8/T9 的对接点）
6. 在 `src/features/export/` 实现 Markdown 导出逻辑（基于现有 `downloadMarkdown` 增强）
7. 更新 `src/app/App.tsx` 展示翻译 mock 流程（含状态切换：idle → running → succeeded）

### Week 2：接口对齐，改为接收 Article / Content

1. 与 T6 对齐 canonical Markdown 输入格式
2. 将 mock 输入切换为 ArticleContent.canonicalMarkdown
3. 与 T8 对齐 Agent Runtime 调用方式

### Week 3：使用真实 Markdown 输入

1. 确认 canonical Markdown 是翻译的标准输入
2. 完善 Translation Agent 调用流程

### Week 4：真实 LLM 调用 + 导出完善

1. 接入 T9 真实 Provider，完成真实翻译
2. 译文落库
3. 完善 Markdown 导出，包含摘要和译文
4. 持续产出 usage record

## 5. 需要确认的问题

1. **T9 Provider 调用签名**：✅ 已确认。T9 使用 `LLMProvider.chat(request: LLMChatRequest): Promise<LLMChatResponse>`，`LLMChatResponse` 包含 `content` / `providerId` / `providerName` / `model` / `usage`。T11 已对齐。
2. **T9 usage 字段名**：✅ 已确认。`LLMUsageInfo` 使用 `estimated`（非 `isEstimated`）、`promptTokens` / `completionTokens` / `totalTokens`。T11 已对齐。
3. **T8 Agent Runtime**：⚠️ T8 当前无代码实现。Week 1 T11 内联 system prompt，Week 3 改由 T8 template engine 渲染。
4. **T2 TranslationResult 存储**：待确认。`TranslationResult` 是独立表还是复用 `AITaskRun` + JSON 字段？需要 T2 确认。
5. **目标语言选择**：MVP 阶段固定为"英文→中文"。
6. **导出路径**：Electron 环境下的文件保存是用 `dialog.showSaveDialog()` 还是保持浏览器 `download` 方式？需要 T1/T7 确认。
7. **目录冲突**：T9 创建了 `src/features/llm/`，但 README/T1 说LLM代码放 `src/features/agent/`。需要 T0/T1/T9 确认最终目录。T11 当前兼容两种方式：在 `agent/index.ts` 定义兼容接口，合并后改为从 `llm/` import。

## 6. 验收标准

- [ ] 能对文章生成译文（mock 或真实）
- [ ] 译文能展示和保存
- [ ] 翻译失败有提示
- [ ] 调用记录能交给用量统计
- [ ] 当前文章能导出 Markdown
- [ ] 导出内容格式清晰（含标题、原文链接、正文）
- [ ] Summary 和 Translation 都通过统一 Agent 调用契约执行
- [ ] Translation 不自己写 fetch/模型调用逻辑
- [ ] Prompt 不硬编码在 Translation 函数内部

## 7. 可能的风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| T8/T9 接口未及时稳定 | T11 调用方式需要反复调整 | 先用 mock 实现，预留适配层，不把 Provider 调用写死在业务逻辑里 |
| 长文章翻译 token 超限 | 翻译截断或失败 | MVP 阶段先限制输入长度（如截取前 8000 字符），后续再做分段翻译 |
| Translation 和 Summary 各自实现调用 | Reviewer 和组长会要求整改 | 从 Week 1 起就明确调用边界，代码 review 时互相检查 |
| 导出路径在 Electron 下行为不一致 | 用户体验差 | 先用浏览器 download 实现，Electron 下后续切换为原生 dialog |
