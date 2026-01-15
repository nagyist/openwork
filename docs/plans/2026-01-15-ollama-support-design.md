# Ollama Support Design

Date: 2026-01-15

## Overview

Add support for Ollama local models in the Openwork desktop app, allowing users to run tasks with locally-hosted LLMs alongside existing cloud providers (Anthropic, OpenAI, Google).

## Requirements

- Dynamic model discovery via Ollama API
- Configurable server URL (default `http://localhost:11434`)
- Tab-based UI separation between cloud and local providers
- Connection validation before model selection (similar to API key validation)
- Seamless integration with existing OpenCode CLI

## Architecture

### Data Flow

```
Settings UI (Local Models Tab)
    ↓ Enter Ollama URL (default: http://localhost:11434)
    ↓ Click "Test Connection"
Main Process IPC Handler
    ↓ GET http://{url}/api/tags
    ↓ Return model list or error
Settings UI
    ↓ Populate model dropdown with discovered models
    ↓ User selects model, clicks Save
appSettings.ts
    ↓ Store: { provider: 'ollama', model: 'llama3', baseUrl: 'http://...' }
OpenCode Adapter
    ↓ Pass model as 'ollama/llama3' to CLI
    ↓ Set OLLAMA_HOST env var to configured URL
```

### Key Decisions

- Ollama URL stored in `electron-store` (appSettings), not keychain - not a secret
- Model discovery is on-demand (user clicks test), not automatic
- Selected model includes `baseUrl` so we know which Ollama server to use
- OpenCode receives `OLLAMA_HOST` environment variable for non-default URLs
- Tabs are for configuration only; model selection uses existing unified dropdown

## Implementation Details

### 1. Type System Changes

**`packages/shared/src/types/provider.ts`**

```typescript
// Update ProviderType to include 'ollama'
export type ProviderType = 'anthropic' | 'openai' | 'google' | 'ollama' | 'custom';

// Extend SelectedModel to carry baseUrl for Ollama
export interface SelectedModel {
  provider: ProviderType;
  model: string;
  baseUrl?: string;  // Only for ollama
}

// New interface for Ollama connection settings
export interface OllamaConfig {
  baseUrl: string;
  enabled: boolean;
  lastValidated?: number;  // Timestamp of last successful connection
}
```

### 2. App Settings Storage

**`apps/desktop/src/main/store/appSettings.ts`**

Add ollamaConfig to stored settings:

```typescript
interface AppSettings {
  selectedModel: SelectedModel | null;
  debugMode: boolean;
  onboardingComplete: boolean;
  ollamaConfig: OllamaConfig | null;  // NEW
}
```

New methods:
- `getOllamaConfig(): OllamaConfig | null`
- `setOllamaConfig(config: OllamaConfig): void`

### 3. IPC Handlers

**`apps/desktop/src/main/ipc/handlers.ts`**

New handlers:

```typescript
// Test connection and discover models
ipcMain.handle('ollama:test-connection', async (_, url: string) => {
  try {
    const response = await fetch(`${url}/api/tags`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return {
      success: true,
      models: data.models.map(m => ({
        id: m.name,
        displayName: m.name,
        size: m.size
      }))
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get stored Ollama config
ipcMain.handle('ollama:get-config', () => getOllamaConfig());

// Save Ollama config
ipcMain.handle('ollama:set-config', (_, config: OllamaConfig) => setOllamaConfig(config));
```

### 4. Preload API

**`apps/desktop/src/preload/index.ts`**

```typescript
ollama: {
  testConnection: (url: string) => ipcRenderer.invoke('ollama:test-connection', url),
  getConfig: () => ipcRenderer.invoke('ollama:get-config'),
  setConfig: (config) => ipcRenderer.invoke('ollama:set-config', config),
}
```

### 5. Settings UI

**`apps/desktop/src/renderer/components/layout/SettingsDialog.tsx`**

Tab-based layout with Cloud Providers and Local Models tabs:

```
┌─────────────────────────────────────────────────────┐
│ Settings                                        [X] │
├─────────────────────────────────────────────────────┤
│ [Cloud Providers] [Local Models]                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Ollama Server                                       │
│ ┌───────────────────────────────────┐ ┌──────────┐ │
│ │ http://localhost:11434            │ │  Test    │ │
│ └───────────────────────────────────┘ └──────────┘ │
│                                                     │
│ ✓ Connected - 3 models available                    │
│                                                     │
│ Select Model                                        │
│ ┌───────────────────────────────────┐              │
│ │ llama3:latest                   ▼ │              │
│ └───────────────────────────────────┘              │
│                                                     │
│                              [Save Configuration]   │
└─────────────────────────────────────────────────────┘
```

Key behaviors:
- Default URL pre-populated: `http://localhost:11434`
- "Test" button triggers connection check and model fetch
- Model dropdown only enabled after successful connection
- Model sizes shown for user context
- Save disabled until connection validated + model selected

### 6. OpenCode CLI Integration

**`apps/desktop/src/main/opencode/adapter.ts`**

```typescript
async function runOpenCode(prompt: string) {
  const selectedModel = getSelectedModel();
  const ollamaConfig = getOllamaConfig();

  const env = { ...process.env };

  // Set API keys for cloud providers
  const apiKeys = await getAllApiKeys();
  if (apiKeys.anthropic) env.ANTHROPIC_API_KEY = apiKeys.anthropic;
  if (apiKeys.openai) env.OPENAI_API_KEY = apiKeys.openai;
  // ... etc

  // Set Ollama host if using Ollama model
  if (selectedModel?.provider === 'ollama' && selectedModel.baseUrl) {
    env.OLLAMA_HOST = selectedModel.baseUrl;
  }

  const modelArg = `${selectedModel.provider}/${selectedModel.model}`;
  const args = ['run', prompt, '--format', 'json', '--model', modelArg, '--agent', 'accomplish'];
  // ... spawn opencode
}
```

**`apps/desktop/src/main/opencode/config-generator.ts`**

```typescript
function generateConfig() {
  const ollamaConfig = getOllamaConfig();

  const enabledProviders = ['anthropic', 'openai', 'google', 'groq'];
  if (ollamaConfig?.enabled) {
    enabledProviders.push('ollama');
  }

  return {
    enabled_providers: enabledProviders,
    // ... rest of config
  };
}
```

## Files to Modify

| File | Changes |
|------|---------|
| `packages/shared/src/types/provider.ts` | Add `'ollama'` to ProviderType, add `OllamaConfig` interface, add `baseUrl` to SelectedModel |
| `apps/desktop/src/main/store/appSettings.ts` | Add ollamaConfig storage methods |
| `apps/desktop/src/main/ipc/handlers.ts` | Add 3 new handlers: test-connection, get-config, set-config |
| `apps/desktop/src/preload/index.ts` | Expose ollama IPC methods to renderer |
| `apps/desktop/src/renderer/components/layout/SettingsDialog.tsx` | Add Cloud/Local tabs, Ollama config UI |
| `apps/desktop/src/main/opencode/adapter.ts` | Set OLLAMA_HOST env var when using Ollama |
| `apps/desktop/src/main/opencode/config-generator.ts` | Add 'ollama' to enabled_providers when configured |

## Testing

1. **Manual testing**: Test with real Ollama installation
2. **E2E tests**: Stub Ollama endpoint for settings flow testing
3. **Edge cases**: Handle Ollama not running, invalid URL, empty model list
