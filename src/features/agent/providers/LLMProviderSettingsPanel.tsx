import React, { useEffect, useState } from "react";
import type { LLMConnectionTestResult, LLMProviderConfig } from "./types";
import { LLM_PROVIDER_PRESETS } from "./config";
import "./LLMProviderSettingsPanel.css";

export interface LLMProviderSettingsPanelProps {
  value: LLMProviderConfig;
  onSave: (config: LLMProviderConfig) => void;
  onTestConnection?: (
    config: LLMProviderConfig,
  ) => Promise<LLMConnectionTestResult>;
}

export function LLMProviderSettingsPanel({
  value,
  onSave,
  onTestConnection,
}: LLMProviderSettingsPanelProps) {
  const [draft, setDraft] = useState(value);
  const [testResult, setTestResult] = useState<LLMConnectionTestResult | null>(
    null,
  );
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  async function handleTestConnection() {
    if (!onTestConnection) {
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      setTestResult(await onTestConnection(draft));
    } finally {
      setTesting(false);
    }
  }

  return (
    <section className="llm-settings-panel" aria-label="LLM Provider Settings">
      <div className="llm-usage-panel__header">
        <h2>Model Settings</h2>
      </div>

      <div className="llm-settings-panel__form">
        <label>
          <span>Preset</span>
          <select
            value=""
            onChange={(event) => {
              const preset = LLM_PROVIDER_PRESETS.find((item) => {
                return item.providerId === event.target.value;
              });
              if (!preset) {
                return;
              }

              setDraft({
                ...draft,
                providerId: preset.providerId,
                providerName: preset.providerName,
                kind: "openai-compatible",
                baseUrl: preset.baseUrl,
                model: preset.model,
                apiKeyEnv: preset.apiKeyEnv,
              });
            }}
          >
            <option value="">Select preset</option>
            {LLM_PROVIDER_PRESETS.map((preset) => (
              <option key={preset.providerId} value={preset.providerId}>
                {preset.providerName}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Provider ID</span>
          <input
            value={draft.providerId}
            onChange={(event) => {
              setDraft({ ...draft, providerId: event.target.value });
            }}
          />
        </label>

        <label>
          <span>Provider name</span>
          <input
            value={draft.providerName}
            onChange={(event) => {
              setDraft({ ...draft, providerName: event.target.value });
            }}
          />
        </label>

        <label>
          <span>Base URL</span>
          <input
            value={draft.baseUrl}
            onChange={(event) => {
              setDraft({ ...draft, baseUrl: event.target.value });
            }}
          />
        </label>

        <label>
          <span>Model</span>
          <input
            value={draft.model}
            onChange={(event) => {
              setDraft({ ...draft, model: event.target.value });
            }}
          />
        </label>

        <label>
          <span>API key env</span>
          <input
            value={draft.apiKeyEnv ?? ""}
            onChange={(event) => {
              setDraft({ ...draft, apiKeyEnv: event.target.value });
            }}
          />
        </label>

        <label>
          <span>API key</span>
          <input
            type="password"
            placeholder="<your-api-key>"
            value={draft.apiKey ?? ""}
            onChange={(event) => {
              setDraft({ ...draft, apiKey: event.target.value });
            }}
          />
        </label>
      </div>

      <div className="llm-settings-panel__actions">
        <button type="button" onClick={() => onSave(draft)}>
          Save
        </button>
        {onTestConnection ? (
          <button type="button" onClick={handleTestConnection} disabled={testing}>
            {testing ? "Testing" : "Test connection"}
          </button>
        ) : null}
        {testResult ? (
          <span
            className={`llm-usage-panel__status ${
              testResult.ok ? "is-succeeded" : "is-failed"
            }`}
          >
            {testResult.ok ? "Connected" : testResult.errorMessage ?? "Failed"}
          </span>
        ) : null}
      </div>
    </section>
  );
}
