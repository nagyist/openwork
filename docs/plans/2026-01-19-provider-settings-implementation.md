# Provider Settings Redesign - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the existing tabbed settings dialog with a provider-centric grid design supporting multiple connected providers.

**Architecture:** New data model persisting connected providers with credentials and selected models. Provider grid UI with expandable settings panels. Auto-pop on task launch when no ready provider exists.

**Tech Stack:** React, TypeScript, Electron Store, existing secure storage for API keys.

---

### Task 1: Create Provider Settings Types

**Files:**
- Create: `packages/shared/src/types/providerSettings.ts`
- Modify: `packages/shared/src/types/index.ts`

**Step 1: Write the type definitions**

```typescript
// packages/shared/src/types/providerSettings.ts

export type ProviderId =
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'xai'
  | 'deepseek'
  | 'zai'
  | 'bedrock'
  | 'ollama'
  | 'openrouter'
  | 'litellm';

export type ProviderCategory = 'classic' | 'aws' | 'local' | 'proxy' | 'hybrid';

export interface ProviderMeta {
  id: ProviderId;
  name: string;
  category: ProviderCategory;
  label: string; // "Service" or "Local Models"
  logoKey: string; // For icon lookup
  helpUrl?: string; // "How can I find it?" link
}

export const PROVIDER_META: Record<ProviderId, ProviderMeta> = {
  anthropic: { id: 'anthropic', name: 'Anthropic', category: 'classic', label: 'Service', logoKey: 'claude', helpUrl: 'https://console.anthropic.com/settings/keys' },
  openai: { id: 'openai', name: 'OpenAI', category: 'classic', label: 'Service', logoKey: 'open-ai', helpUrl: 'https://platform.openai.com/api-keys' },
  google: { id: 'google', name: 'Gemini', category: 'classic', label: 'Service', logoKey: 'google-gen-ai', helpUrl: 'https://aistudio.google.com/app/apikey' },
  xai: { id: 'xai', name: 'XAI', category: 'classic', label: 'Service', logoKey: 'Xai', helpUrl: 'https://x.ai/api' },
  deepseek: { id: 'deepseek', name: 'DeepSeek', category: 'classic', label: 'Service', logoKey: 'Deepseek', helpUrl: 'https://platform.deepseek.com/api_keys' },
  zai: { id: 'zai', name: 'Z-AI', category: 'classic', label: 'Service', logoKey: 'z-ai' },
  bedrock: { id: 'bedrock', name: 'Bedrock', category: 'aws', label: 'Service', logoKey: 'aws-bedrock' },
  ollama: { id: 'ollama', name: 'Ollama', category: 'local', label: 'Local Models', logoKey: 'olama' },
  openrouter: { id: 'openrouter', name: 'OpenRouter', category: 'proxy', label: 'Service', logoKey: 'open-router', helpUrl: 'https://openrouter.ai/keys' },
  litellm: { id: 'litellm', name: 'LiteLLM', category: 'hybrid', label: 'Service', logoKey: 'liteLLM' },
};

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ApiKeyCredentials {
  type: 'api_key';
  keyPrefix: string;
}

export interface BedrockCredentials {
  type: 'bedrock';
  authMethod: 'accessKey' | 'profile';
  region: string;
  accessKeyIdPrefix?: string;
  profileName?: string;
}

export interface OllamaCredentials {
  type: 'ollama';
  serverUrl: string;
}

export interface OpenRouterCredentials {
  type: 'openrouter';
  keyPrefix: string;
}

export interface LiteLLMCredentials {
  type: 'litellm';
  serverUrl: string;
  hasApiKey: boolean;
  keyPrefix?: string;
}

export type ProviderCredentials =
  | ApiKeyCredentials
  | BedrockCredentials
  | OllamaCredentials
  | OpenRouterCredentials
  | LiteLLMCredentials;

export interface ConnectedProvider {
  providerId: ProviderId;
  connectionStatus: ConnectionStatus;
  selectedModelId: string | null;
  credentials: ProviderCredentials;
  lastConnectedAt: string;
  availableModels?: Array<{ id: string; name: string }>; // For dynamic providers
}

export interface ProviderSettings {
  activeProviderId: ProviderId | null;
  connectedProviders: Partial<Record<ProviderId, ConnectedProvider>>;
  debugMode: boolean;
}

export function isProviderReady(provider: ConnectedProvider | undefined): boolean {
  if (!provider) return false;
  return provider.connectionStatus === 'connected' && provider.selectedModelId !== null;
}

export function hasAnyReadyProvider(settings: ProviderSettings): boolean {
  return Object.values(settings.connectedProviders).some(isProviderReady);
}

export function getActiveProvider(settings: ProviderSettings): ConnectedProvider | null {
  if (!settings.activeProviderId) return null;
  return settings.connectedProviders[settings.activeProviderId] ?? null;
}
```

**Step 2: Export from index**

Add to `packages/shared/src/types/index.ts`:

```typescript
export * from './providerSettings';
```

**Step 3: Run typecheck to verify**

Run: `pnpm typecheck`
Expected: PASS (or only unrelated errors)

**Step 4: Commit**

```bash
git add packages/shared/src/types/providerSettings.ts packages/shared/src/types/index.ts
git commit -m "feat: add provider settings types for new settings UI"
```

---

### Task 2: Create Provider Settings Store

**Files:**
- Create: `apps/desktop/src/main/store/providerSettings.ts`

**Step 1: Write the store implementation**

```typescript
// apps/desktop/src/main/store/providerSettings.ts

import Store from 'electron-store';
import type { ProviderSettings, ProviderId, ConnectedProvider } from '@accomplish/shared';

const DEFAULT_SETTINGS: ProviderSettings = {
  activeProviderId: null,
  connectedProviders: {},
  debugMode: false,
};

const providerSettingsStore = new Store<ProviderSettings>({
  name: 'provider-settings',
  defaults: DEFAULT_SETTINGS,
});

export function getProviderSettings(): ProviderSettings {
  return {
    activeProviderId: providerSettingsStore.get('activeProviderId'),
    connectedProviders: providerSettingsStore.get('connectedProviders'),
    debugMode: providerSettingsStore.get('debugMode'),
  };
}

export function setActiveProvider(providerId: ProviderId | null): void {
  providerSettingsStore.set('activeProviderId', providerId);
}

export function getActiveProviderId(): ProviderId | null {
  return providerSettingsStore.get('activeProviderId');
}

export function getConnectedProvider(providerId: ProviderId): ConnectedProvider | null {
  const providers = providerSettingsStore.get('connectedProviders');
  return providers[providerId] ?? null;
}

export function setConnectedProvider(providerId: ProviderId, provider: ConnectedProvider): void {
  const providers = providerSettingsStore.get('connectedProviders');
  providerSettingsStore.set('connectedProviders', {
    ...providers,
    [providerId]: provider,
  });
}

export function removeConnectedProvider(providerId: ProviderId): void {
  const providers = providerSettingsStore.get('connectedProviders');
  const { [providerId]: _, ...rest } = providers;
  providerSettingsStore.set('connectedProviders', rest);

  // If this was the active provider, clear it
  if (providerSettingsStore.get('activeProviderId') === providerId) {
    providerSettingsStore.set('activeProviderId', null);
  }
}

export function updateProviderModel(providerId: ProviderId, modelId: string | null): void {
  const provider = getConnectedProvider(providerId);
  if (provider) {
    setConnectedProvider(providerId, {
      ...provider,
      selectedModelId: modelId,
    });
  }
}

export function setProviderDebugMode(enabled: boolean): void {
  providerSettingsStore.set('debugMode', enabled);
}

export function getProviderDebugMode(): boolean {
  return providerSettingsStore.get('debugMode');
}

export function clearProviderSettings(): void {
  providerSettingsStore.clear();
}
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/desktop/src/main/store/providerSettings.ts
git commit -m "feat: add provider settings electron store"
```

---

### Task 3: Add IPC Handlers for Provider Settings

**Files:**
- Modify: `apps/desktop/src/main/ipc/handlers.ts`
- Modify: `apps/desktop/src/preload/index.ts`

**Step 1: Add handlers to handlers.ts**

Add these imports at the top of `apps/desktop/src/main/ipc/handlers.ts`:

```typescript
import {
  getProviderSettings,
  setActiveProvider,
  getConnectedProvider,
  setConnectedProvider,
  removeConnectedProvider,
  updateProviderModel,
  setProviderDebugMode,
  getProviderDebugMode,
} from '../store/providerSettings';
import type { ProviderId, ConnectedProvider } from '@accomplish/shared';
```

Add these handlers in the `registerIpcHandlers` function:

```typescript
  // Provider Settings
  ipcMain.handle('provider-settings:get', async () => {
    return getProviderSettings();
  });

  ipcMain.handle('provider-settings:set-active', async (_, providerId: ProviderId | null) => {
    setActiveProvider(providerId);
  });

  ipcMain.handle('provider-settings:get-connected', async (_, providerId: ProviderId) => {
    return getConnectedProvider(providerId);
  });

  ipcMain.handle('provider-settings:set-connected', async (_, providerId: ProviderId, provider: ConnectedProvider) => {
    setConnectedProvider(providerId, provider);
  });

  ipcMain.handle('provider-settings:remove-connected', async (_, providerId: ProviderId) => {
    removeConnectedProvider(providerId);
  });

  ipcMain.handle('provider-settings:update-model', async (_, providerId: ProviderId, modelId: string | null) => {
    updateProviderModel(providerId, modelId);
  });

  ipcMain.handle('provider-settings:set-debug', async (_, enabled: boolean) => {
    setProviderDebugMode(enabled);
  });

  ipcMain.handle('provider-settings:get-debug', async () => {
    return getProviderDebugMode();
  });
```

**Step 2: Add preload API methods**

Add to the `accomplishAPI` object in `apps/desktop/src/preload/index.ts`:

```typescript
  // New Provider Settings API
  getProviderSettings: (): Promise<unknown> =>
    ipcRenderer.invoke('provider-settings:get'),
  setActiveProvider: (providerId: string | null): Promise<void> =>
    ipcRenderer.invoke('provider-settings:set-active', providerId),
  getConnectedProvider: (providerId: string): Promise<unknown> =>
    ipcRenderer.invoke('provider-settings:get-connected', providerId),
  setConnectedProvider: (providerId: string, provider: unknown): Promise<void> =>
    ipcRenderer.invoke('provider-settings:set-connected', providerId, provider),
  removeConnectedProvider: (providerId: string): Promise<void> =>
    ipcRenderer.invoke('provider-settings:remove-connected', providerId),
  updateProviderModel: (providerId: string, modelId: string | null): Promise<void> =>
    ipcRenderer.invoke('provider-settings:update-model', providerId, modelId),
  setProviderDebugMode: (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke('provider-settings:set-debug', enabled),
  getProviderDebugMode: (): Promise<boolean> =>
    ipcRenderer.invoke('provider-settings:get-debug'),
```

**Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/desktop/src/main/ipc/handlers.ts apps/desktop/src/preload/index.ts
git commit -m "feat: add IPC handlers for provider settings"
```

---

### Task 4: Create useProviderSettings Hook

**Files:**
- Create: `apps/desktop/src/renderer/components/settings/hooks/useProviderSettings.ts`

**Step 1: Create the directory structure**

```bash
mkdir -p apps/desktop/src/renderer/components/settings/hooks
```

**Step 2: Write the hook**

```typescript
// apps/desktop/src/renderer/components/settings/hooks/useProviderSettings.ts

import { useState, useEffect, useCallback } from 'react';
import { getAccomplish } from '@/lib/accomplish';
import type {
  ProviderSettings,
  ProviderId,
  ConnectedProvider,
  isProviderReady,
  hasAnyReadyProvider,
} from '@accomplish/shared';

export function useProviderSettings() {
  const [settings, setSettings] = useState<ProviderSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const accomplish = getAccomplish();
      const data = await accomplish.getProviderSettings() as ProviderSettings;
      setSettings(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const setActiveProvider = useCallback(async (providerId: ProviderId | null) => {
    const accomplish = getAccomplish();
    await accomplish.setActiveProvider(providerId);
    setSettings(prev => prev ? { ...prev, activeProviderId: providerId } : null);
  }, []);

  const connectProvider = useCallback(async (providerId: ProviderId, provider: ConnectedProvider) => {
    const accomplish = getAccomplish();
    await accomplish.setConnectedProvider(providerId, provider);
    setSettings(prev => {
      if (!prev) return null;
      return {
        ...prev,
        connectedProviders: {
          ...prev.connectedProviders,
          [providerId]: provider,
        },
      };
    });
  }, []);

  const disconnectProvider = useCallback(async (providerId: ProviderId) => {
    const accomplish = getAccomplish();
    await accomplish.removeConnectedProvider(providerId);
    setSettings(prev => {
      if (!prev) return null;
      const { [providerId]: _, ...rest } = prev.connectedProviders;
      return {
        ...prev,
        connectedProviders: rest,
        activeProviderId: prev.activeProviderId === providerId ? null : prev.activeProviderId,
      };
    });
  }, []);

  const updateModel = useCallback(async (providerId: ProviderId, modelId: string | null) => {
    const accomplish = getAccomplish();
    await accomplish.updateProviderModel(providerId, modelId);
    setSettings(prev => {
      if (!prev) return null;
      const provider = prev.connectedProviders[providerId];
      if (!provider) return prev;
      return {
        ...prev,
        connectedProviders: {
          ...prev.connectedProviders,
          [providerId]: { ...provider, selectedModelId: modelId },
        },
      };
    });
  }, []);

  const setDebugMode = useCallback(async (enabled: boolean) => {
    const accomplish = getAccomplish();
    await accomplish.setProviderDebugMode(enabled);
    setSettings(prev => prev ? { ...prev, debugMode: enabled } : null);
  }, []);

  return {
    settings,
    loading,
    error,
    refetch: fetchSettings,
    setActiveProvider,
    connectProvider,
    disconnectProvider,
    updateModel,
    setDebugMode,
  };
}
```

**Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/desktop/src/renderer/components/settings/hooks/useProviderSettings.ts
git commit -m "feat: add useProviderSettings hook"
```

---

### Task 5: Create Shared UI Components

**Files:**
- Create: `apps/desktop/src/renderer/components/settings/shared/ConnectionStatus.tsx`
- Create: `apps/desktop/src/renderer/components/settings/shared/ApiKeyInput.tsx`
- Create: `apps/desktop/src/renderer/components/settings/shared/ModelSelector.tsx`
- Create: `apps/desktop/src/renderer/components/settings/shared/RegionSelector.tsx`

**Step 1: Create the directory**

```bash
mkdir -p apps/desktop/src/renderer/components/settings/shared
```

**Step 2: Write ConnectionStatus.tsx**

```typescript
// apps/desktop/src/renderer/components/settings/shared/ConnectionStatus.tsx

import type { ConnectionStatus as ConnectionStatusType } from '@accomplish/shared';

interface ConnectionStatusProps {
  status: ConnectionStatusType;
  onDisconnect?: () => void;
}

export function ConnectionStatus({ status, onDisconnect }: ConnectionStatusProps) {
  if (status === 'disconnected') {
    return null;
  }

  if (status === 'connecting') {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
          <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75" />
        </svg>
        Connecting...
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex items-center gap-2 text-sm text-destructive">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        An error has occurred
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        className="flex-1 flex items-center justify-center gap-2 rounded-md bg-[#4A7C59] px-4 py-2.5 text-sm font-medium text-white"
        disabled
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Connected
      </button>
      {onDisconnect && (
        <button
          onClick={onDisconnect}
          className="rounded-md border border-border p-2.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          title="Disconnect"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
    </div>
  );
}
```

**Step 3: Write ApiKeyInput.tsx**

```typescript
// apps/desktop/src/renderer/components/settings/shared/ApiKeyInput.tsx

interface ApiKeyInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  helpUrl?: string;
  error?: string | null;
  disabled?: boolean;
}

export function ApiKeyInput({
  value,
  onChange,
  placeholder = 'Enter API Key',
  label = 'API Key',
  helpUrl,
  error,
  disabled,
}: ApiKeyInputProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-foreground">{label}</label>
        {helpUrl && (
          <a
            href={helpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-primary"
          >
            How can I find it?
          </a>
        )}
      </div>
      <div className="relative">
        <input
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm pr-10 disabled:opacity-50"
        />
        {value && (
          <button
            onClick={() => onChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            type="button"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
```

**Step 4: Write ModelSelector.tsx**

```typescript
// apps/desktop/src/renderer/components/settings/shared/ModelSelector.tsx

interface Model {
  id: string;
  name: string;
}

interface ModelSelectorProps {
  models: Model[];
  value: string | null;
  onChange: (modelId: string) => void;
  loading?: boolean;
  error?: boolean;
  errorMessage?: string;
  placeholder?: string;
}

export function ModelSelector({
  models,
  value,
  onChange,
  loading,
  error,
  errorMessage = 'Please select a model',
  placeholder = 'Select model...',
}: ModelSelectorProps) {
  if (loading) {
    return (
      <div className="h-10 animate-pulse rounded-md bg-muted" />
    );
  }

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-foreground">Model</label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-md border bg-background px-3 py-2.5 text-sm ${
          error ? 'border-destructive' : 'border-input'
        }`}
      >
        <option value="" disabled>{placeholder}</option>
        {models.map((model) => (
          <option key={model.id} value={model.id}>
            {model.name}
          </option>
        ))}
      </select>
      {error && !value && (
        <p className="mt-2 text-sm text-destructive">{errorMessage}</p>
      )}
    </div>
  );
}
```

**Step 5: Write RegionSelector.tsx**

```typescript
// apps/desktop/src/renderer/components/settings/shared/RegionSelector.tsx

const AWS_REGIONS = [
  { id: 'us-east-1', name: 'US East (N. Virginia)' },
  { id: 'us-east-2', name: 'US East (Ohio)' },
  { id: 'us-west-1', name: 'US West (N. California)' },
  { id: 'us-west-2', name: 'US West (Oregon)' },
  { id: 'eu-west-1', name: 'Europe (Ireland)' },
  { id: 'eu-west-2', name: 'Europe (London)' },
  { id: 'eu-west-3', name: 'Europe (Paris)' },
  { id: 'eu-central-1', name: 'Europe (Frankfurt)' },
  { id: 'ap-northeast-1', name: 'Asia Pacific (Tokyo)' },
  { id: 'ap-northeast-2', name: 'Asia Pacific (Seoul)' },
  { id: 'ap-southeast-1', name: 'Asia Pacific (Singapore)' },
  { id: 'ap-southeast-2', name: 'Asia Pacific (Sydney)' },
  { id: 'ap-south-1', name: 'Asia Pacific (Mumbai)' },
];

interface RegionSelectorProps {
  value: string;
  onChange: (region: string) => void;
}

export function RegionSelector({ value, onChange }: RegionSelectorProps) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-foreground">Region</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm"
      >
        {AWS_REGIONS.map((region) => (
          <option key={region.id} value={region.id}>
            {region.id}
          </option>
        ))}
      </select>
    </div>
  );
}
```

**Step 6: Create index export**

```typescript
// apps/desktop/src/renderer/components/settings/shared/index.ts

export { ConnectionStatus } from './ConnectionStatus';
export { ApiKeyInput } from './ApiKeyInput';
export { ModelSelector } from './ModelSelector';
export { RegionSelector } from './RegionSelector';
```

**Step 7: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 8: Commit**

```bash
git add apps/desktop/src/renderer/components/settings/shared/
git commit -m "feat: add shared settings UI components"
```

---

### Task 6: Create ProviderCard Component

**Files:**
- Create: `apps/desktop/src/renderer/components/settings/ProviderCard.tsx`

**Step 1: Write the component**

```typescript
// apps/desktop/src/renderer/components/settings/ProviderCard.tsx

import type { ProviderId, ProviderMeta, ConnectedProvider } from '@accomplish/shared';
import { PROVIDER_META, isProviderReady } from '@accomplish/shared';

// Import provider logos
import claudeLogo from '/assets/ai-logos/claude.svg';
import openaiLogo from '/assets/ai-logos/openai.svg';
import googleLogo from '/assets/ai-logos/google-gen-ai.svg';
import xaiLogo from '/assets/ai-logos/xai.svg';
import deepseekLogo from '/assets/ai-logos/deepseek.svg';
import zaiLogo from '/assets/ai-logos/z-ai.svg';
import bedrockLogo from '/assets/ai-logos/aws-bedrock.svg';
import ollamaLogo from '/assets/ai-logos/ollama.svg';
import openrouterLogo from '/assets/ai-logos/open-router.svg';
import litellmLogo from '/assets/ai-logos/litellm.svg';

const LOGO_MAP: Record<string, string> = {
  'claude': claudeLogo,
  'open-ai': openaiLogo,
  'google-gen-ai': googleLogo,
  'Xai': xaiLogo,
  'Deepseek': deepseekLogo,
  'z-ai': zaiLogo,
  'aws-bedrock': bedrockLogo,
  'olama': ollamaLogo,
  'open-router': openrouterLogo,
  'liteLLM': litellmLogo,
};

interface ProviderCardProps {
  providerId: ProviderId;
  connectedProvider?: ConnectedProvider;
  isActive: boolean;
  isSelected: boolean;
  onClick: () => void;
}

export function ProviderCard({
  providerId,
  connectedProvider,
  isActive,
  isSelected,
  onClick,
}: ProviderCardProps) {
  const meta = PROVIDER_META[providerId];
  const isConnected = connectedProvider?.connectionStatus === 'connected';
  const ready = isProviderReady(connectedProvider);
  const logo = LOGO_MAP[meta.logoKey];

  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center rounded-xl border p-4 transition-all duration-200 min-w-[120px] ${
        isActive
          ? 'border-[#4A7C59] border-2 bg-[#4A7C59]/5'
          : isSelected
          ? 'border-primary bg-muted'
          : 'border-border hover:border-ring'
      }`}
    >
      {/* Connected badge */}
      {isConnected && (
        <div className="absolute top-2 right-2">
          <svg className="h-4 w-4 text-[#4A7C59]" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd" />
          </svg>
        </div>
      )}

      {/* Logo */}
      <div className="mb-2 h-10 w-10 flex items-center justify-center">
        {logo ? (
          <img src={logo} alt={meta.name} className="h-10 w-10 object-contain" />
        ) : (
          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-lg font-bold">
            {meta.name.charAt(0)}
          </div>
        )}
      </div>

      {/* Name */}
      <span className={`text-sm font-medium ${isActive ? 'text-[#4A7C59]' : 'text-foreground'}`}>
        {meta.name}
      </span>

      {/* Label */}
      <span className={`text-xs ${isActive ? 'text-[#4A7C59]/70' : 'text-muted-foreground'}`}>
        {meta.label}
      </span>
    </button>
  );
}
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS (may have missing logo assets - that's OK for now)

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/components/settings/ProviderCard.tsx
git commit -m "feat: add ProviderCard component"
```

---

### Task 7: Create Provider Form Components

**Files:**
- Create: `apps/desktop/src/renderer/components/settings/providers/ClassicProviderForm.tsx`
- Create: `apps/desktop/src/renderer/components/settings/providers/BedrockProviderForm.tsx`
- Create: `apps/desktop/src/renderer/components/settings/providers/OllamaProviderForm.tsx`
- Create: `apps/desktop/src/renderer/components/settings/providers/OpenRouterProviderForm.tsx`
- Create: `apps/desktop/src/renderer/components/settings/providers/LiteLLMProviderForm.tsx`
- Create: `apps/desktop/src/renderer/components/settings/providers/index.ts`

**Step 1: Create directory**

```bash
mkdir -p apps/desktop/src/renderer/components/settings/providers
```

**Step 2: Write ClassicProviderForm.tsx**

```typescript
// apps/desktop/src/renderer/components/settings/providers/ClassicProviderForm.tsx

import { useState } from 'react';
import { getAccomplish } from '@/lib/accomplish';
import type { ProviderId, ConnectedProvider, ApiKeyCredentials } from '@accomplish/shared';
import { PROVIDER_META, DEFAULT_PROVIDERS } from '@accomplish/shared';
import { ApiKeyInput, ConnectionStatus, ModelSelector } from '../shared';

interface ClassicProviderFormProps {
  providerId: ProviderId;
  connectedProvider?: ConnectedProvider;
  onConnect: (provider: ConnectedProvider) => void;
  onDisconnect: () => void;
  onModelChange: (modelId: string) => void;
  showModelError: boolean;
}

export function ClassicProviderForm({
  providerId,
  connectedProvider,
  onConnect,
  onDisconnect,
  onModelChange,
  showModelError,
}: ClassicProviderFormProps) {
  const [apiKey, setApiKey] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = PROVIDER_META[providerId];
  const providerConfig = DEFAULT_PROVIDERS.find(p => p.id === providerId);
  const models = providerConfig?.models.map(m => ({ id: m.fullId, name: m.displayName })) || [];
  const isConnected = connectedProvider?.connectionStatus === 'connected';

  const handleConnect = async () => {
    if (!apiKey.trim()) {
      setError('Please enter an API key');
      return;
    }

    setConnecting(true);
    setError(null);

    try {
      const accomplish = getAccomplish();
      const validation = await accomplish.validateApiKeyForProvider(providerId, apiKey.trim());

      if (!validation.valid) {
        setError(validation.error || 'Invalid API key');
        setConnecting(false);
        return;
      }

      // Save the API key
      await accomplish.addApiKey(providerId, apiKey.trim());

      // Create connected provider
      const provider: ConnectedProvider = {
        providerId,
        connectionStatus: 'connected',
        selectedModelId: null,
        credentials: {
          type: 'api_key',
          keyPrefix: apiKey.trim().substring(0, 10) + '...',
        } as ApiKeyCredentials,
        lastConnectedAt: new Date().toISOString(),
      };

      onConnect(provider);
      setApiKey('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">{meta.name} Settings</span>
      </div>

      {!isConnected ? (
        <>
          <ApiKeyInput
            value={apiKey}
            onChange={setApiKey}
            helpUrl={meta.helpUrl}
            error={error}
            disabled={connecting}
          />
          <button
            onClick={handleConnect}
            disabled={connecting || !apiKey.trim()}
            className="w-full flex items-center justify-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            {connecting ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                  <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75" />
                </svg>
                Connecting...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Connect
              </>
            )}
          </button>
        </>
      ) : (
        <>
          <ConnectionStatus status="connected" onDisconnect={onDisconnect} />
          <ModelSelector
            models={models}
            value={connectedProvider?.selectedModelId || null}
            onChange={onModelChange}
            error={showModelError && !connectedProvider?.selectedModelId}
          />
        </>
      )}
    </div>
  );
}
```

**Step 3: Write BedrockProviderForm.tsx**

```typescript
// apps/desktop/src/renderer/components/settings/providers/BedrockProviderForm.tsx

import { useState } from 'react';
import { getAccomplish } from '@/lib/accomplish';
import type { ConnectedProvider, BedrockCredentials } from '@accomplish/shared';
import { ConnectionStatus, ModelSelector, RegionSelector } from '../shared';

interface BedrockProviderFormProps {
  connectedProvider?: ConnectedProvider;
  onConnect: (provider: ConnectedProvider) => void;
  onDisconnect: () => void;
  onModelChange: (modelId: string) => void;
  showModelError: boolean;
}

export function BedrockProviderForm({
  connectedProvider,
  onConnect,
  onDisconnect,
  onModelChange,
  showModelError,
}: BedrockProviderFormProps) {
  const [authTab, setAuthTab] = useState<'accessKey' | 'profile'>('accessKey');
  const [accessKeyId, setAccessKeyId] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [profileName, setProfileName] = useState('default');
  const [region, setRegion] = useState('us-east-1');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<Array<{ id: string; name: string }>>([]);

  const isConnected = connectedProvider?.connectionStatus === 'connected';

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);

    try {
      const accomplish = getAccomplish();

      const credentials = authTab === 'accessKey'
        ? {
            authType: 'accessKeys' as const,
            accessKeyId: accessKeyId.trim(),
            secretAccessKey: secretKey.trim(),
            sessionToken: sessionToken.trim() || undefined,
            region,
          }
        : {
            authType: 'profile' as const,
            profileName: profileName.trim() || 'default',
            region,
          };

      const validation = await accomplish.validateBedrockCredentials(credentials);

      if (!validation.valid) {
        setError(validation.error || 'Invalid credentials');
        setConnecting(false);
        return;
      }

      // Save credentials
      await accomplish.saveBedrockCredentials(credentials);

      // TODO: Fetch available models from AWS
      // For now, use preset models
      const models = [
        { id: 'amazon-bedrock/anthropic.claude-opus-4-5-20251101-v1:0', name: 'Claude Opus 4.5' },
        { id: 'amazon-bedrock/anthropic.claude-sonnet-4-5-20250929-v1:0', name: 'Claude Sonnet 4.5' },
        { id: 'amazon-bedrock/anthropic.claude-haiku-4-5-20251001-v1:0', name: 'Claude Haiku 4.5' },
      ];
      setAvailableModels(models);

      const provider: ConnectedProvider = {
        providerId: 'bedrock',
        connectionStatus: 'connected',
        selectedModelId: null,
        credentials: {
          type: 'bedrock',
          authMethod: authTab,
          region,
          ...(authTab === 'accessKey'
            ? { accessKeyIdPrefix: accessKeyId.substring(0, 8) + '...' }
            : { profileName: profileName.trim() || 'default' }
          ),
        } as BedrockCredentials,
        lastConnectedAt: new Date().toISOString(),
        availableModels: models,
      };

      onConnect(provider);
      setSecretKey('');
      setSessionToken('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  const models = connectedProvider?.availableModels || availableModels;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">Bedrock Settings</span>
      </div>

      {!isConnected ? (
        <>
          {/* Auth tabs */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setAuthTab('accessKey')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                authTab === 'accessKey'
                  ? 'bg-[#4A7C59] text-white'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              Access Key
            </button>
            <button
              onClick={() => setAuthTab('profile')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                authTab === 'profile'
                  ? 'bg-[#4A7C59] text-white'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              AWS Profile
            </button>
          </div>

          {authTab === 'accessKey' ? (
            <>
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">Access Key ID</label>
                <input
                  type="text"
                  value={accessKeyId}
                  onChange={(e) => setAccessKeyId(e.target.value)}
                  placeholder="AKIA..."
                  className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">Secret Access Key</label>
                <input
                  type="password"
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  placeholder="Enter secret access key"
                  className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  Session Token <span className="text-muted-foreground">(Optional)</span>
                </label>
                <input
                  type="password"
                  value={sessionToken}
                  onChange={(e) => setSessionToken(e.target.value)}
                  placeholder="For temporary credentials"
                  className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm"
                />
              </div>
            </>
          ) : (
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Profile Name</label>
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="default"
                className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm"
              />
            </div>
          )}

          <RegionSelector value={region} onChange={setRegion} />

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            onClick={handleConnect}
            disabled={connecting}
            className="w-full flex items-center justify-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            {connecting ? 'Connecting...' : 'Connect'}
          </button>
        </>
      ) : (
        <>
          <ConnectionStatus status="connected" onDisconnect={onDisconnect} />
          <ModelSelector
            models={models}
            value={connectedProvider?.selectedModelId || null}
            onChange={onModelChange}
            error={showModelError && !connectedProvider?.selectedModelId}
          />
        </>
      )}
    </div>
  );
}
```

**Step 4: Write OllamaProviderForm.tsx**

```typescript
// apps/desktop/src/renderer/components/settings/providers/OllamaProviderForm.tsx

import { useState } from 'react';
import { getAccomplish } from '@/lib/accomplish';
import type { ConnectedProvider, OllamaCredentials } from '@accomplish/shared';
import { ConnectionStatus, ModelSelector } from '../shared';

interface OllamaProviderFormProps {
  connectedProvider?: ConnectedProvider;
  onConnect: (provider: ConnectedProvider) => void;
  onDisconnect: () => void;
  onModelChange: (modelId: string) => void;
  showModelError: boolean;
}

export function OllamaProviderForm({
  connectedProvider,
  onConnect,
  onDisconnect,
  onModelChange,
  showModelError,
}: OllamaProviderFormProps) {
  const [serverUrl, setServerUrl] = useState('http://localhost:11434');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<Array<{ id: string; name: string }>>([]);

  const isConnected = connectedProvider?.connectionStatus === 'connected';

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);

    try {
      const accomplish = getAccomplish();
      const result = await accomplish.testOllamaConnection(serverUrl);

      if (!result.success) {
        setError(result.error || 'Connection failed');
        setConnecting(false);
        return;
      }

      const models = result.models?.map(m => ({
        id: `ollama/${m.id}`,
        name: m.displayName,
      })) || [];
      setAvailableModels(models);

      const provider: ConnectedProvider = {
        providerId: 'ollama',
        connectionStatus: 'connected',
        selectedModelId: null,
        credentials: {
          type: 'ollama',
          serverUrl,
        } as OllamaCredentials,
        lastConnectedAt: new Date().toISOString(),
        availableModels: models,
      };

      onConnect(provider);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  const models = connectedProvider?.availableModels || availableModels;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">Ollama Settings</span>
      </div>

      {!isConnected ? (
        <>
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">Ollama Server URL</label>
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="http://localhost:11434"
              className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {error}
            </div>
          )}

          <button
            onClick={handleConnect}
            disabled={connecting}
            className="w-full flex items-center justify-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            {connecting ? 'Connecting...' : 'Connect'}
          </button>
        </>
      ) : (
        <>
          <ConnectionStatus status="connected" onDisconnect={onDisconnect} />
          <ModelSelector
            models={models}
            value={connectedProvider?.selectedModelId || null}
            onChange={onModelChange}
            error={showModelError && !connectedProvider?.selectedModelId}
          />
        </>
      )}
    </div>
  );
}
```

**Step 5: Write OpenRouterProviderForm.tsx**

```typescript
// apps/desktop/src/renderer/components/settings/providers/OpenRouterProviderForm.tsx

import { useState } from 'react';
import { getAccomplish } from '@/lib/accomplish';
import type { ConnectedProvider, OpenRouterCredentials } from '@accomplish/shared';
import { ApiKeyInput, ConnectionStatus, ModelSelector } from '../shared';
import { PROVIDER_META } from '@accomplish/shared';

interface OpenRouterProviderFormProps {
  connectedProvider?: ConnectedProvider;
  onConnect: (provider: ConnectedProvider) => void;
  onDisconnect: () => void;
  onModelChange: (modelId: string) => void;
  showModelError: boolean;
}

export function OpenRouterProviderForm({
  connectedProvider,
  onConnect,
  onDisconnect,
  onModelChange,
  showModelError,
}: OpenRouterProviderFormProps) {
  const [apiKey, setApiKey] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<Array<{ id: string; name: string }>>([]);

  const meta = PROVIDER_META.openrouter;
  const isConnected = connectedProvider?.connectionStatus === 'connected';

  const handleConnect = async () => {
    if (!apiKey.trim()) {
      setError('Please enter an API key');
      return;
    }

    setConnecting(true);
    setError(null);

    try {
      const accomplish = getAccomplish();

      // Validate key
      const validation = await accomplish.validateApiKeyForProvider('openrouter', apiKey.trim());
      if (!validation.valid) {
        setError(validation.error || 'Invalid API key');
        setConnecting(false);
        return;
      }

      // Save key
      await accomplish.addApiKey('openrouter', apiKey.trim());

      // Fetch models
      const result = await accomplish.fetchOpenRouterModels();
      if (!result.success) {
        setError(result.error || 'Failed to fetch models');
        setConnecting(false);
        return;
      }

      const models = result.models?.map(m => ({
        id: `openrouter/${m.id}`,
        name: m.name,
      })) || [];
      setAvailableModels(models);

      const provider: ConnectedProvider = {
        providerId: 'openrouter',
        connectionStatus: 'connected',
        selectedModelId: null,
        credentials: {
          type: 'openrouter',
          keyPrefix: apiKey.trim().substring(0, 10) + '...',
        } as OpenRouterCredentials,
        lastConnectedAt: new Date().toISOString(),
        availableModels: models,
      };

      onConnect(provider);
      setApiKey('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  const models = connectedProvider?.availableModels || availableModels;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">OpenRouter Settings</span>
      </div>

      {!isConnected ? (
        <>
          <ApiKeyInput
            value={apiKey}
            onChange={setApiKey}
            placeholder="sk-or-..."
            helpUrl={meta.helpUrl}
            error={error}
            disabled={connecting}
          />
          <button
            onClick={handleConnect}
            disabled={connecting || !apiKey.trim()}
            className="w-full flex items-center justify-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            {connecting ? 'Connecting...' : 'Connect'}
          </button>
        </>
      ) : (
        <>
          <ConnectionStatus status="connected" onDisconnect={onDisconnect} />
          <ModelSelector
            models={models}
            value={connectedProvider?.selectedModelId || null}
            onChange={onModelChange}
            error={showModelError && !connectedProvider?.selectedModelId}
          />
        </>
      )}
    </div>
  );
}
```

**Step 6: Write LiteLLMProviderForm.tsx**

```typescript
// apps/desktop/src/renderer/components/settings/providers/LiteLLMProviderForm.tsx

import { useState } from 'react';
import type { ConnectedProvider, LiteLLMCredentials } from '@accomplish/shared';
import { ApiKeyInput, ConnectionStatus, ModelSelector } from '../shared';

interface LiteLLMProviderFormProps {
  connectedProvider?: ConnectedProvider;
  onConnect: (provider: ConnectedProvider) => void;
  onDisconnect: () => void;
  onModelChange: (modelId: string) => void;
  showModelError: boolean;
}

export function LiteLLMProviderForm({
  connectedProvider,
  onConnect,
  onDisconnect,
  onModelChange,
  showModelError,
}: LiteLLMProviderFormProps) {
  const [serverUrl, setServerUrl] = useState('http://localhost:4000');
  const [apiKey, setApiKey] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConnected = connectedProvider?.connectionStatus === 'connected';

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);

    try {
      // TODO: Implement LiteLLM connection logic
      // For now, just create a placeholder connected state
      const provider: ConnectedProvider = {
        providerId: 'litellm',
        connectionStatus: 'connected',
        selectedModelId: null,
        credentials: {
          type: 'litellm',
          serverUrl,
          hasApiKey: !!apiKey.trim(),
          keyPrefix: apiKey.trim() ? apiKey.trim().substring(0, 10) + '...' : undefined,
        } as LiteLLMCredentials,
        lastConnectedAt: new Date().toISOString(),
        availableModels: [],
      };

      onConnect(provider);
      setApiKey('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  const models = connectedProvider?.availableModels || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">LiteLLM Settings</span>
      </div>

      {!isConnected ? (
        <>
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">Server URL</label>
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="http://localhost:4000"
              className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm"
            />
          </div>
          <ApiKeyInput
            value={apiKey}
            onChange={setApiKey}
            label="API Key (Optional)"
            placeholder="Optional API key"
            error={error}
            disabled={connecting}
          />
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="w-full flex items-center justify-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            {connecting ? 'Connecting...' : 'Connect'}
          </button>
        </>
      ) : (
        <>
          <ConnectionStatus status="connected" onDisconnect={onDisconnect} />
          <ModelSelector
            models={models}
            value={connectedProvider?.selectedModelId || null}
            onChange={onModelChange}
            error={showModelError && !connectedProvider?.selectedModelId}
          />
        </>
      )}
    </div>
  );
}
```

**Step 7: Create index export**

```typescript
// apps/desktop/src/renderer/components/settings/providers/index.ts

export { ClassicProviderForm } from './ClassicProviderForm';
export { BedrockProviderForm } from './BedrockProviderForm';
export { OllamaProviderForm } from './OllamaProviderForm';
export { OpenRouterProviderForm } from './OpenRouterProviderForm';
export { LiteLLMProviderForm } from './LiteLLMProviderForm';
```

**Step 8: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 9: Commit**

```bash
git add apps/desktop/src/renderer/components/settings/providers/
git commit -m "feat: add provider form components"
```

---

### Task 8: Create ProviderGrid Component

**Files:**
- Create: `apps/desktop/src/renderer/components/settings/ProviderGrid.tsx`

**Step 1: Write the component**

```typescript
// apps/desktop/src/renderer/components/settings/ProviderGrid.tsx

import { useState, useMemo } from 'react';
import type { ProviderId, ProviderSettings } from '@accomplish/shared';
import { PROVIDER_META } from '@accomplish/shared';
import { ProviderCard } from './ProviderCard';

const PROVIDER_ORDER: ProviderId[] = [
  'anthropic',
  'openai',
  'google',
  'deepseek',
  'zai',
  'xai',
  'bedrock',
  'ollama',
  'openrouter',
  'litellm',
];

interface ProviderGridProps {
  settings: ProviderSettings;
  selectedProvider: ProviderId | null;
  onSelectProvider: (providerId: ProviderId) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
}

export function ProviderGrid({
  settings,
  selectedProvider,
  onSelectProvider,
  expanded,
  onToggleExpanded,
}: ProviderGridProps) {
  const [search, setSearch] = useState('');

  const filteredProviders = useMemo(() => {
    if (!search.trim()) return PROVIDER_ORDER;
    const query = search.toLowerCase();
    return PROVIDER_ORDER.filter(id => {
      const meta = PROVIDER_META[id];
      return meta.name.toLowerCase().includes(query);
    });
  }, [search]);

  const displayedProviders = expanded ? filteredProviders : filteredProviders.slice(0, 6);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-foreground">Providers</span>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Providers"
            className="w-48 rounded-md border border-input bg-background pl-9 pr-3 py-1.5 text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className={`grid gap-3 ${expanded ? 'grid-cols-3' : 'grid-cols-6'}`}>
        {displayedProviders.map(providerId => (
          <ProviderCard
            key={providerId}
            providerId={providerId}
            connectedProvider={settings.connectedProviders[providerId]}
            isActive={settings.activeProviderId === providerId}
            isSelected={selectedProvider === providerId}
            onClick={() => onSelectProvider(providerId)}
          />
        ))}
      </div>

      {/* Show All / Hide toggle */}
      <div className="mt-4 text-center">
        <button
          onClick={onToggleExpanded}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {expanded ? 'Hide' : 'Show All'}
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/components/settings/ProviderGrid.tsx
git commit -m "feat: add ProviderGrid component"
```

---

### Task 9: Create ProviderSettings Panel Component

**Files:**
- Create: `apps/desktop/src/renderer/components/settings/ProviderSettingsPanel.tsx`

**Step 1: Write the component**

```typescript
// apps/desktop/src/renderer/components/settings/ProviderSettingsPanel.tsx

import type { ProviderId, ConnectedProvider, ProviderCategory } from '@accomplish/shared';
import { PROVIDER_META } from '@accomplish/shared';
import {
  ClassicProviderForm,
  BedrockProviderForm,
  OllamaProviderForm,
  OpenRouterProviderForm,
  LiteLLMProviderForm,
} from './providers';

interface ProviderSettingsPanelProps {
  providerId: ProviderId;
  connectedProvider?: ConnectedProvider;
  onConnect: (provider: ConnectedProvider) => void;
  onDisconnect: () => void;
  onModelChange: (modelId: string) => void;
  showModelError: boolean;
}

export function ProviderSettingsPanel({
  providerId,
  connectedProvider,
  onConnect,
  onDisconnect,
  onModelChange,
  showModelError,
}: ProviderSettingsPanelProps) {
  const meta = PROVIDER_META[providerId];

  // Route to appropriate form based on provider category
  switch (meta.category) {
    case 'classic':
      return (
        <ClassicProviderForm
          providerId={providerId}
          connectedProvider={connectedProvider}
          onConnect={onConnect}
          onDisconnect={onDisconnect}
          onModelChange={onModelChange}
          showModelError={showModelError}
        />
      );

    case 'aws':
      return (
        <BedrockProviderForm
          connectedProvider={connectedProvider}
          onConnect={onConnect}
          onDisconnect={onDisconnect}
          onModelChange={onModelChange}
          showModelError={showModelError}
        />
      );

    case 'local':
      return (
        <OllamaProviderForm
          connectedProvider={connectedProvider}
          onConnect={onConnect}
          onDisconnect={onDisconnect}
          onModelChange={onModelChange}
          showModelError={showModelError}
        />
      );

    case 'proxy':
      return (
        <OpenRouterProviderForm
          connectedProvider={connectedProvider}
          onConnect={onConnect}
          onDisconnect={onDisconnect}
          onModelChange={onModelChange}
          showModelError={showModelError}
        />
      );

    case 'hybrid':
      return (
        <LiteLLMProviderForm
          connectedProvider={connectedProvider}
          onConnect={onConnect}
          onDisconnect={onDisconnect}
          onModelChange={onModelChange}
          showModelError={showModelError}
        />
      );

    default:
      return <div>Unknown provider type</div>;
  }
}
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/components/settings/ProviderSettingsPanel.tsx
git commit -m "feat: add ProviderSettingsPanel component"
```

---

### Task 10: Replace SettingsDialog Internals

**Files:**
- Modify: `apps/desktop/src/renderer/components/layout/SettingsDialog.tsx`

**Step 1: Rewrite SettingsDialog.tsx**

Replace the entire contents of `apps/desktop/src/renderer/components/layout/SettingsDialog.tsx` with the new implementation. Due to length, see the component code in the design document and adapt it to use the new components we created.

The key changes:
1. Use `useProviderSettings` hook instead of individual state
2. Replace tabs with `ProviderGrid`
3. Show `ProviderSettingsPanel` when a provider is selected
4. Add close validation (prevent close if no ready provider)
5. Keep Debug Mode toggle at bottom

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Run the app to test**

Run: `pnpm dev`
Expected: Settings dialog opens with new UI

**Step 4: Commit**

```bash
git add apps/desktop/src/renderer/components/layout/SettingsDialog.tsx
git commit -m "feat: replace SettingsDialog with new provider-centric UI"
```

---

### Task 11: Add Task Launch Guard

**Files:**
- Modify: `apps/desktop/src/renderer/components/TaskLauncher/TaskLauncher.tsx`

**Step 1: Add ready provider check**

In `TaskLauncher.tsx`, before starting a task, check if there's a ready provider:

```typescript
import { hasAnyReadyProvider } from '@accomplish/shared';

// In the task start handler:
const settings = await accomplish.getProviderSettings();
if (!hasAnyReadyProvider(settings)) {
  // Open settings dialog
  onOpenSettings();
  return;
}
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Test the guard**

Run: `pnpm dev`
Expected: Launching a task without a ready provider opens settings

**Step 4: Commit**

```bash
git add apps/desktop/src/renderer/components/TaskLauncher/TaskLauncher.tsx
git commit -m "feat: add task launch guard for ready provider"
```

---

### Task 12: Add Provider Logo Assets

**Files:**
- Create: `apps/desktop/public/assets/ai-logos/` directory with logo files

**Step 1: Ensure logo directory exists**

```bash
mkdir -p apps/desktop/public/assets/ai-logos
```

**Step 2: Add placeholder or actual logo files**

Add SVG files for each provider:
- `claude.svg`
- `openai.svg`
- `google-gen-ai.svg`
- `xai.svg`
- `deepseek.svg`
- `z-ai.svg`
- `aws-bedrock.svg`
- `ollama.svg`
- `open-router.svg`
- `litellm.svg`

**Step 3: Commit**

```bash
git add apps/desktop/public/assets/ai-logos/
git commit -m "feat: add provider logo assets"
```

---

### Task 13: Update accomplish.ts Types

**Files:**
- Modify: `apps/desktop/src/renderer/lib/accomplish.ts`

**Step 1: Add typed methods for new IPC calls**

Add TypeScript types for the new provider settings methods in the accomplish wrapper.

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/lib/accomplish.ts
git commit -m "feat: add provider settings types to accomplish API"
```

---

### Task 14: Integration Testing

**Step 1: Run the full app**

Run: `pnpm dev`

**Step 2: Manual test checklist**

- [ ] Settings dialog opens
- [ ] Provider grid displays all providers
- [ ] Search filters providers
- [ ] Show All / Hide works
- [ ] Clicking a provider shows its settings panel
- [ ] Classic provider: can enter API key and connect
- [ ] Connected providers show key badge
- [ ] Model dropdown appears after connection
- [ ] Cannot close dialog without a ready provider
- [ ] Can switch between connected providers
- [ ] Active provider has green border
- [ ] Debug Mode toggle works

**Step 3: Run E2E tests (if any)**

Run: `pnpm -F @accomplish/desktop test:e2e`

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete provider settings redesign implementation"
```

---

## Summary

This plan creates a new provider-centric settings experience with:

1. **Types** - New `ProviderSettings` types in shared package
2. **Storage** - New electron-store for provider settings
3. **IPC** - Handlers for CRUD operations on provider settings
4. **Hooks** - `useProviderSettings` for React state management
5. **Components**:
   - `ProviderCard` - Individual provider display
   - `ProviderGrid` - Grid of all providers with search
   - `ProviderSettingsPanel` - Routes to appropriate form
   - Provider forms for each category (Classic, Bedrock, Ollama, OpenRouter, LiteLLM)
   - Shared components (ConnectionStatus, ApiKeyInput, ModelSelector, RegionSelector)
6. **Integration** - Task launch guard to ensure ready provider
