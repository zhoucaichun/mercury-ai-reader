## 1. 模块目标

T4 负责 Mercury 的 OPML 导入和订阅源管理模块，目标是把用户导入的 OPML 文件转换为系统内统一的订阅源数据，并为后续订阅源列表展示、Feed 同步、文章入库提供稳定输入。

本模块职责包括：

- 解析 OPML 文件；
- 提取订阅源列表；
- 处理 URL 校验与标准化；
- 执行订阅源去重；
- 将合法订阅源写入本地存储；
- 提供订阅源查询、启用、禁用、删除等基础管理接口。

## 2. T4 数据链路方案

主链路如下：

`OPML 文件 -> T4 解析 outline -> 提取 feed 字段 -> URL 标准化 -> 校验 -> 去重 -> 写入 subscriptions -> T7 展示订阅源列表 -> T5 读取 active subscriptions 做 Sync -> T5 回写同步状态`

详细步骤：

1. 用户选择 `.opml` 文件。
2. T4 读取 OPML 文本并解析 XML 结构。
3. 递归遍历 `outline` 节点，提取带 `xmlUrl` 的订阅项。
4. 将 OPML 字段映射为统一订阅源结构：
   - `title`
   - `feedUrl`
   - `siteUrl`
   - `groupName`
   - `feedType`
5. 对 `feedUrl` 做标准化，生成 `normalizedFeedUrl`。
6. 执行基础校验：
   - 是否存在 `feedUrl/xmlUrl`
   - 是否为合法 URL
   - 是否为 `http/https`
7. 执行两层去重：
   - OPML 文件内部去重
   - 与数据库已有订阅源去重
8. 将合法且不重复的订阅源写入本地 `subscriptions` 表。
9. 对外提供订阅源列表和 active subscriptions，供 T7 和 T5 使用。
10. 后续 T5 完成同步后，回写 `lastSyncedAt`、`lastError`、`status` 等字段。

## 3. 技术细节

### 3.1 OPML 解析

建议使用：

- `fast-xml-parser`

原因：

- 适合 TypeScript 项目；
- 解析 XML 更通用；
- 方便自定义字段映射和递归遍历；
- 后续更容易和本地数据模型统一。

支持的 OPML 结构：

- 标准 OPML 2.0
- 多层嵌套 `outline`
- 文件夹 / 分组节点
- 单个对象或数组形式的 `outline`

规则：

- 只有带 `xmlUrl` 的 `outline` 视为实际订阅源；
- 不带 `xmlUrl` 的 `outline` 当作分组节点处理。

### 3.2 字段设计

建议统一订阅源结构：

```ts
type Subscription = {
  id: string;
  title: string;
  feedUrl: string;
  normalizedFeedUrl: string;
  siteUrl?: string;
  groupName?: string;
  feedType?: string;
  status: "active" | "disabled" | "error";
  source: "manual" | "opml";
  createdAt: string;
  updatedAt: string;
  lastSyncedAt?: string;
  lastError?: string;
};
```

字段来源：

- `xmlUrl -> feedUrl`
- `htmlUrl -> siteUrl`
- `title/text -> title`
- 外层文件夹名 -> `groupName`
- `type -> feedType`

### 3.3 URL 标准化

建议对 `feedUrl` 做以下标准化：

- 去掉首尾空格
- 主机名转小写
- 去掉末尾 `/`
- 去掉空 hash
- 保留 query 参数
- 不强制把 `http` 改成 `https`

生成：

- `normalizedFeedUrl`

### 3.4 去重规则

主判重键：

- `normalizedFeedUrl`

去重分两层：

1. 同一 OPML 文件内部去重
2. 与数据库已有订阅源去重

处理方式：

- 重复项不重复新增
- 记录为 `skipped`
- 返回原因，如：
  - `duplicate_in_file`
  - `duplicate_in_db`

说明：

- `title` 不能作为主判重依据
- `siteUrl` 不能替代 `feedUrl` 判重

### 3.5 错误处理

采用“单条失败不影响整体”的导入策略。

常见错误类型：

- `invalid_opml_format`
- `missing_feed_url`
- `invalid_url`
- `unsupported_protocol`
- `duplicate_in_file`
- `duplicate_in_db`
- `storage_error`

导入结果建议返回：

```ts
type ImportOpmlResult = {
  total: number;
  imported: number;
  skipped: number;
  failed: number;
  items: {
    title: string;
    feedUrl: string;
    status: "imported" | "skipped" | "failed";
    reason?: string;
  }[];
};
```

## 4. 基本接口草案

### OPML 解析接口

```ts
parseOpml(content: string): {
  feeds: ParsedOpmlFeed[];
  warnings: string[];
}
```

### OPML 导入接口

```ts
importFromOpml(content: string): Promise<ImportOpmlResult>
```

### 订阅源管理接口

```ts
createSubscription(input): Promise<Subscription>
listSubscriptions(): Promise<Subscription[]>
listActiveSubscriptions(): Promise<Subscription[]>
getSubscriptionById(id: string): Promise<Subscription | null>
updateSubscription(id, patch): Promise<Subscription>
setSubscriptionEnabled(id, enabled): Promise<Subscription>
deleteSubscription(id): Promise<void>
```

## 5. 与其他模块的对接

### 与 T2 数据模型 / 本地存储

需要对齐：

- `subscriptions` 表结构
- `normalizedFeedUrl` 唯一索引
- `status/source` 枚举值
- 时间字段格式
- `lastSyncedAt/lastError` 命名

建议表字段：

- `id`
- `title`
- `feed_url`
- `normalized_feed_url`
- `site_url`
- `group_name`
- `feed_type`
- `status`
- `source`
- `created_at`
- `updated_at`
- `last_synced_at`
- `last_error`

### 与 T3 Feed 解析 / Feed URL 添加

需要对齐：

- `feedUrl` 字段命名
- 手动添加和 OPML 导入是否共用创建逻辑
- Feed 解析成功后是否允许回填 `title/siteUrl/feedType`

### 与 T5 Sync / 文章同步 / 入库

需要对齐：

- T5 通过 `listActiveSubscriptions()` 读取同步输入
- T5 同步成功后回写 `lastSyncedAt`
- T5 同步失败后回写 `lastError`
- `status = disabled` 的订阅源默认不参与同步

### 与 T7 UI / 订阅源列表

需要对齐：

- 列表展示字段
- 启用 / 禁用 / 删除操作
- 导入结果展示方式
- 错误状态展示方式

## 6. 还需要补充的细节

当前除主链路外，还建议在组内统一以下细节：

- `normalizedFeedUrl` 的最终标准化规则
- 订阅源 `status` 的枚举定义是否固定为 `active/disabled/error`
- 导入时重复项是否允许“覆盖已有标题/分组”
- 删除订阅源时是否逻辑删除还是物理删除
- OPML 导入结果是否需要保留日志
- T5 回写错误时是否直接把状态改为 `error`
- UI 是否需要显示 `groupName` / 最近同步时间 / 错误提示

## 7. 第 2 周计划

第 2 周目标是让 T4 从“分析设计”进入“可接入主链路”。

计划交付：

1. 确认并固定 `Subscription` 字段结构
2. 与 T2 对齐 `subscriptions` 表结构
3. 实现 OPML 基础解析
4. 实现 URL 标准化与校验
5. 实现导入去重逻辑
6. 实现基础接口：
   - `importFromOpml`
   - `listSubscriptions`
   - `listActiveSubscriptions`
   - `setSubscriptionEnabled`
   - `deleteSubscription`
7. 提供 1 个可联调的 OPML 示例文件
8. 与 T5 联调 active subscriptions 输入
9. 与 T7 联调订阅源列表读取

## 8. 合入 main 前的最低要求

建议 T4 在合入 `main` 前满足以下条件：

- 能导入常见 OPML 文件
- 能提取多个 feed 地址
- 能将合法订阅源保存到本地数据层
- 重复订阅源不会重复添加
- 无效订阅源有错误记录或提示
- 能提供可读取的订阅源列表
- 能给 T5 提供 active subscriptions

## 9. 当前产出

当前已完成的初版产出包括：

- OPML 导入 / 订阅源管理设计说明
- 订阅源字段与接口草案
- 数据链路说明

后续将继续推进第 2 周的接口实现和联调工作。