import { app, safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

export interface SecureProviderConfigInput {
  baseUrl: string;
  model: string;
  apiKey?: string;
  timeoutMs?: number;
}

export interface SecureProviderConfig {
  providerId: string;
  providerName: string;
  kind: 'openai-compatible';
  baseUrl: string;
  model: string;
  apiKey: string;
  enabled: boolean;
  timeoutMs: number;
}

interface SecureProviderState {
  current?: SecureProviderConfig;
  profiles: SecureProviderConfig[];
}

const STORE_FILE = 'secure-provider-config.json';

export function loadProviderConfig(): SecureProviderConfig | null {
  return loadState().current ?? null;
}

export function listProviderProfiles(): SecureProviderConfig[] {
  return loadState().profiles;
}

export function saveProviderConfig(input: SecureProviderConfigInput): SecureProviderConfig {
  const state = loadState();
  const apiKey = input.apiKey?.trim() || state.current?.apiKey || '';
  const config = normalizeConfig({
    providerId: 'school',
    providerName: 'School Model',
    kind: 'openai-compatible',
    baseUrl: input.baseUrl,
    model: input.model,
    apiKey,
    enabled: true,
    timeoutMs: input.timeoutMs ?? state.current?.timeoutMs ?? 30000
  });

  const nextState: SecureProviderState = {
    current: config,
    profiles: upsertProfile(state.profiles, config)
  };
  saveState(nextState);
  return config;
}

export function activateProviderProfile(profile: SecureProviderConfig): SecureProviderConfig {
  const state = loadState();
  const config = normalizeConfig(profile);
  const nextState: SecureProviderState = {
    current: config,
    profiles: upsertProfile(state.profiles, config)
  };
  saveState(nextState);
  return config;
}

function upsertProfile(profiles: SecureProviderConfig[], config: SecureProviderConfig): SecureProviderConfig[] {
  return [
    config,
    ...profiles.filter((profile) => profile.baseUrl !== config.baseUrl || profile.model !== config.model)
  ].slice(0, 12);
}

function normalizeConfig(input: SecureProviderConfig): SecureProviderConfig {
  const baseUrl = input.baseUrl.trim();
  const model = input.model.trim();
  const apiKey = input.apiKey.trim();

  if (!baseUrl) {
    throw new Error('Base URL is required.');
  }
  if (!model) {
    throw new Error('Model is required.');
  }
  if (!apiKey) {
    throw new Error('API key is required.');
  }

  return {
    providerId: input.providerId || 'school',
    providerName: input.providerName || 'School Model',
    kind: 'openai-compatible',
    baseUrl,
    model,
    apiKey,
    enabled: true,
    timeoutMs: input.timeoutMs ?? 30000
  };
}

function loadState(): SecureProviderState {
  const filePath = storePath();
  if (!fs.existsSync(filePath)) {
    return { profiles: [] };
  }

  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as { encrypted?: string; plain?: SecureProviderState };
    if (raw.encrypted && safeStorage.isEncryptionAvailable()) {
      const decrypted = safeStorage.decryptString(Buffer.from(raw.encrypted, 'base64'));
      return normalizeState(JSON.parse(decrypted) as SecureProviderState);
    }
    if (raw.plain) {
      return normalizeState(raw.plain);
    }
  } catch {
    return { profiles: [] };
  }

  return { profiles: [] };
}

function saveState(state: SecureProviderState): void {
  const filePath = storePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(JSON.stringify(state)).toString('base64');
    fs.writeFileSync(filePath, JSON.stringify({ encrypted }, null, 2), 'utf8');
    return;
  }

  fs.writeFileSync(filePath, JSON.stringify({ plain: state }, null, 2), 'utf8');
}

function normalizeState(state: SecureProviderState): SecureProviderState {
  const profiles = Array.isArray(state.profiles)
    ? state.profiles.map((profile) => {
        try {
          return normalizeConfig(profile);
        } catch {
          return null;
        }
      }).filter((profile): profile is SecureProviderConfig => Boolean(profile))
    : [];

  let current: SecureProviderConfig | undefined;
  if (state.current) {
    try {
      current = normalizeConfig(state.current);
    } catch {
      current = profiles[0];
    }
  }

  return {
    current,
    profiles: current ? upsertProfile(profiles, current) : profiles
  };
}

function storePath(): string {
  return path.join(app.getPath('userData'), STORE_FILE);
}
