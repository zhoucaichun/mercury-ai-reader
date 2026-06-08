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
            Refresh
          </button>
        ) : null}
      </div>

      <div className="llm-usage-panel__metrics">
        <Metric label="Calls" value={summary.totalCalls} />
        <Metric label="Succeeded" value={summary.succeededCalls} tone="success" />
        <Metric label="Failed" value={summary.failedCalls} tone="danger" />
        <Metric label="Token" value={formatTokenCount(summary.totalTokens)} />
      </div>

      <div className="llm-usage-panel__grid">
        <UsageGroupTable
          title="Purpose"
          rows={summary.byPurpose.map((row) => ({
            key: row.purpose,
            label: formatPurpose(row.purpose),
            calls: row.calls,
            totalTokens: row.totalTokens,
          }))}
        />
        <UsageGroupTable
          title="Provider"
          rows={summary.byProvider.map((row) => ({
            key: row.providerId,
            label: row.providerName,
            calls: row.calls,
            totalTokens: row.totalTokens,
          }))}
        />
        <UsageGroupTable
          title="Model"
          rows={summary.byModel.map((row) => ({
            key: row.model,
            label: row.model,
            calls: row.calls,
            totalTokens: row.totalTokens,
          }))}
        />
      </div>

      <div className="llm-usage-panel__section">
        <h3>Recent Calls</h3>
        <div className="llm-usage-panel__table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Purpose</th>
                <th>Provider</th>
                <th>Model</th>
                <th>Status</th>
                <th>Token</th>
              </tr>
            </thead>
            <tbody>
              {summary.recent.length === 0 ? (
                <tr>
                  <td colSpan={6}>No usage events yet.</td>
                </tr>
              ) : (
                summary.recent.map((event) => (
                  <tr key={event.id}>
                    <td>{event.startedAt ? formatDateTime(event.startedAt) : "-"}</td>
                    <td>{formatPurpose(event.purpose)}</td>
                    <td>{event.providerName}</td>
                    <td>{event.model}</td>
                    <td>
                      <span className={`llm-usage-panel__status is-${event.status}`}>
                        {event.status === "succeeded" ? "Succeeded" : "Failed"}
                      </span>
                    </td>
                    <td>
                      {formatTokenCount(event.totalTokens ?? 0)}
                      {event.estimated ? " est." : ""}
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
              <th>Name</th>
              <th>Calls</th>
              <th>Token</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3}>No data.</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.key}>
                  <td>{row.label}</td>
                  <td>{row.calls}</td>
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
