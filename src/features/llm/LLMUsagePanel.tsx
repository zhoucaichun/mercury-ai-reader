import React from "react";
import { formatTokenCount, summarizeUsage } from "./usage";
import type { LLMUsageEvent } from "./types";
import "./LLMUsagePanel.css";

export interface LLMUsagePanelProps {
  events: LLMUsageEvent[];
  recentLimit?: number;
  title?: string;
  onRefresh?: () => void;
}

export function LLMUsagePanel({
  events,
  recentLimit = 12,
  title = "LLM Usage",
  onRefresh,
}: LLMUsagePanelProps) {
  const summary = summarizeUsage(events, { recentLimit });

  return (
    <section className="llm-usage-panel" aria-label={title}>
      <div className="llm-usage-panel__header">
        <h2>{title}</h2>
        {onRefresh ? (
          <button type="button" onClick={onRefresh}>
            刷新
          </button>
        ) : null}
      </div>

      <div className="llm-usage-panel__metrics">
        <Metric label="总调用" value={summary.totalCalls} />
        <Metric label="成功" value={summary.succeededCalls} tone="success" />
        <Metric label="失败" value={summary.failedCalls} tone="danger" />
        <Metric label="Token" value={formatTokenCount(summary.totalTokens)} />
      </div>

      <div className="llm-usage-panel__grid">
        <UsageGroupTable title="功能类型" rows={summary.byPurpose} />
        <UsageGroupTable title="Provider" rows={summary.byProvider} />
        <UsageGroupTable title="Model" rows={summary.byModel} />
      </div>

      <div className="llm-usage-panel__section">
        <h3>最近调用</h3>
        <div className="llm-usage-panel__table-wrap">
          <table>
            <thead>
              <tr>
                <th>时间</th>
                <th>功能</th>
                <th>Provider</th>
                <th>Model</th>
                <th>状态</th>
                <th>Token</th>
              </tr>
            </thead>
            <tbody>
              {summary.recent.length === 0 ? (
                <tr>
                  <td colSpan={6}>暂无调用记录</td>
                </tr>
              ) : (
                summary.recent.map((event) => (
                  <tr key={event.id}>
                    <td>{formatDateTime(event.startedAt)}</td>
                    <td>{formatPurpose(event.purpose)}</td>
                    <td>{event.providerName}</td>
                    <td>{event.model}</td>
                    <td>
                      <span className={`llm-usage-panel__status is-${event.status}`}>
                        {event.status === "succeeded" ? "成功" : "失败"}
                      </span>
                    </td>
                    <td>
                      {formatTokenCount(event.usage.totalTokens)}
                      {event.usage.estimated ? " 估算" : ""}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "success" | "danger";
}) {
  return (
    <div className={`llm-usage-panel__metric ${tone ? `is-${tone}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function UsageGroupTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<{
    key: string;
    label: string;
    calls: number;
    succeeded: number;
    failed: number;
    totalTokens: number;
  }>;
}) {
  return (
    <div className="llm-usage-panel__section">
      <h3>{title}</h3>
      <div className="llm-usage-panel__table-wrap">
        <table>
          <thead>
            <tr>
              <th>名称</th>
              <th>调用</th>
              <th>成功</th>
              <th>失败</th>
              <th>Token</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5}>暂无数据</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.key}>
                  <td>{row.label}</td>
                  <td>{row.calls}</td>
                  <td>{row.succeeded}</td>
                  <td>{row.failed}</td>
                  <td>{formatTokenCount(row.totalTokens)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatPurpose(purpose: LLMUsageEvent["purpose"]): string {
  const labels: Record<LLMUsageEvent["purpose"], string> = {
    summary: "Summary",
    translation: "Translation",
    "connection-test": "Test",
    other: "Other",
  };

  return labels[purpose];
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
