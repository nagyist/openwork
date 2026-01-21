# Z.AI International Endpoint Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a region selector to Z.AI provider form allowing users to choose between China and International endpoints.

**Architecture:** Create dedicated ZaiProviderForm component with segmented control for region selection. Store region in new ZaiCredentials type. Backend uses stored region for API validation and config generation.

**Tech Stack:** React, TypeScript, Electron IPC, Framer Motion

---

## Task 1: Add ZaiCredentials Type

**Files:**
- Modify: `packages/shared/src/types/providerSettings.ts`

**Step 1: Add ZaiRegion type and ZaiCredentials interface**

In `packages/shared/src/types/providerSettings.ts`, add after the existing credential interfaces (around line 60):

```typescript
export type ZaiRegion = 'china' | 'international';

export interface ZaiCredentials {
  type: 'zai';
  keyPrefix: string;
  region: ZaiRegion;
}
```

**Step 2: Update ProviderCredentials union**

Find the `ProviderCredentials` type and add `ZaiCredentials`:

```typescript
export type ProviderCredentials =
  | ApiKeyCredentials
  | BedrockProviderCredentials
  | OllamaCredentials
  | OpenRouterCredentials
  | LiteLLMCredentials
  | ZaiCredentials;
```

**Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS (new types are additive)

**Step 4: Commit**

```bash
git add packages/shared/src/types/providerSettings.ts
git commit -m "feat(shared): add ZaiCredentials type with region support"
```

---

## Task 2: Add ZAI_ENDPOINTS Constant

**Files:**
- Modify: `packages/shared/src/types/provider.ts`

**Step 1: Add endpoint mapping constant**

In `packages/shared/src/types/provider.ts`, add near the top after imports:

```typescript
import type { ZaiRegion } from './providerSettings';

export const ZAI_ENDPOINTS: Record<ZaiRegion, string> = {
  china: 'https://open.bigmodel.cn/api/paas/v4',
  international: 'https://api.z.ai/api/coding/paas/v4',
};
```

**Step 2: Export from shared package index**

In `packages/shared/src/index.ts`, ensure `ZAI_ENDPOINTS` and `ZaiRegion` are exported:

```typescript
export { ZAI_ENDPOINTS } from './types/provider';
export type { ZaiRegion, ZaiCredentials } from './types/providerSettings';
```

**Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/shared/src/types/provider.ts packages/shared/src/index.ts
git commit -m "feat(shared): add ZAI_ENDPOINTS constant for region-based URLs"
```

---

## Task 3: Update IPC Handler for Region-Aware Validation

**Files:**
- Modify: `apps/desktop/src/main/ipc/handlers.ts`

**Step 1: Find the Z.AI validation case**

Search for `case 'zai':` in the file (around line 937). Current code:

```typescript
case 'zai':
  response = await fetchWithTimeout(
    'https://open.bigmodel.cn/api/paas/v4/models',
    ...
  );
  break;
```

**Step 2: Update to accept region parameter**

First, update the handler signature to accept options. Find the `validate-api-key` handler and update the Z.AI case:

```typescript
case 'zai': {
  const zaiRegion = (options?.region as string) || 'international';
  const zaiEndpoint = zaiRegion === 'china'
    ? 'https://open.bigmodel.cn/api/paas/v4/models'
    : 'https://api.z.ai/api/coding/paas/v4/models';

  response = await fetchWithTimeout(
    zaiEndpoint,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${sanitizedKey}`,
      },
    },
    API_KEY_VALIDATION_TIMEOUT_MS
  );
  break;
}
```

**Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/desktop/src/main/ipc/handlers.ts
git commit -m "feat(desktop): support region parameter in Z.AI API key validation"
```

---

## Task 4: Update Config Generator for Dynamic Endpoint

**Files:**
- Modify: `apps/desktop/src/main/opencode/config-generator.ts`

**Step 1: Import ZaiCredentials type**

At the top of the file, update imports:

```typescript
import type { ZaiCredentials } from '@accomplish/shared';
```

**Step 2: Find the Z.AI config generation**

Search for `zai-coding-plan` (around line 511-532). Current code hardcodes the China endpoint.

**Step 3: Update to use dynamic endpoint**

Replace the Z.AI config generation with:

```typescript
// Z.AI - use endpoint based on stored region
const zaiCredentials = connectedProviders.zai?.credentials as ZaiCredentials | undefined;
const zaiRegion = zaiCredentials?.region || 'international';
const zaiEndpoint = zaiRegion === 'china'
  ? 'https://open.bigmodel.cn/api/paas/v4'
  : 'https://api.z.ai/api/coding/paas/v4';

providerConfig['zai-coding-plan'] = {
  npm: '@ai-sdk/openai-compatible',
  name: 'Z.AI Coding Plan',
  options: {
    baseURL: zaiEndpoint,
  },
  models: zaiModels,
};
```

**Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/desktop/src/main/opencode/config-generator.ts
git commit -m "feat(desktop): use dynamic endpoint for Z.AI based on stored region"
```

---

## Task 5: Create ZaiProviderForm Component

**Files:**
- Create: `apps/desktop/src/renderer/components/settings/providers/ZaiProviderForm.tsx`

**Step 1: Create the component file**

Create `apps/desktop/src/renderer/components/settings/providers/ZaiProviderForm.tsx`:

```typescript
// apps/desktop/src/renderer/components/settings/providers/ZaiProviderForm.tsx

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getAccomplish } from '@/lib/accomplish';
import { settingsVariants, settingsTransitions } from '@/lib/animations';
import type { ConnectedProvider, ZaiCredentials, ZaiRegion } from '@accomplish/shared';
import { PROVIDER_META, DEFAULT_PROVIDERS, getDefaultModelForProvider } from '@accomplish/shared';
import {
  ModelSelector,
  ConnectButton,
  ConnectedControls,
  ProviderFormHeader,
  FormError,
} from '../shared';

import zaiLogo from '/assets/ai-logos/zai.svg';

interface ZaiProviderFormProps {
  connectedProvider?: ConnectedProvider;
  onConnect: (provider: ConnectedProvider) => void;
  onDisconnect: () => void;
  onModelChange: (modelId: string) => void;
  showModelError: boolean;
}

export function ZaiProviderForm({
  connectedProvider,
  onConnect,
  onDisconnect,
  onModelChange,
  showModelError,
}: ZaiProviderFormProps) {
  const [apiKey, setApiKey] = useState('');
  const [region, setRegion] = useState<ZaiRegion>('international');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = PROVIDER_META['zai'];
  const providerConfig = DEFAULT_PROVIDERS.find(p => p.id === 'zai');
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
      const validation = await accomplish.validateApiKeyForProvider('zai', apiKey.trim(), { region });

      if (!validation.valid) {
        setError(validation.error || 'Invalid API key');
        setConnecting(false);
        return;
      }

      await accomplish.addApiKey('zai', apiKey.trim());

      const defaultModel = getDefaultModelForProvider('zai');
      const trimmedKey = apiKey.trim();

      const provider: ConnectedProvider = {
        providerId: 'zai',
        connectionStatus: 'connected',
        selectedModelId: defaultModel,
        credentials: {
          type: 'zai',
          keyPrefix: trimmedKey.length > 40
            ? trimmedKey.substring(0, 40) + '...'
            : trimmedKey.substring(0, Math.min(trimmedKey.length, 20)) + '...',
          region,
        } as ZaiCredentials,
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

  const storedCredentials = connectedProvider?.credentials as ZaiCredentials | undefined;

  return (
    <div className="rounded-xl border border-border bg-card p-5" data-testid="provider-settings-panel">
      <ProviderFormHeader logoSrc={zaiLogo} providerName={meta.name} />

      <div className="space-y-3">
        <AnimatePresence mode="wait">
          {!isConnected ? (
            <motion.div
              key="disconnected"
              variants={settingsVariants.fadeSlide}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={settingsTransitions.enter}
              className="space-y-3"
            >
              {/* Region Selector */}
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">Region</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setRegion('china')}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      region === 'china'
                        ? 'bg-[#4A7C59] text-white'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    China
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegion('international')}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      region === 'international'
                        ? 'bg-[#4A7C59] text-white'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    International
                  </button>
                </div>
              </div>

              {/* API Key Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-foreground">API Key</label>
                  {meta.helpUrl && (
                    <a
                      href={meta.helpUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-primary underline"
                    >
                      How can I find it?
                    </a>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter API Key"
                    disabled={connecting}
                    data-testid="api-key-input"
                    className="flex-1 rounded-md border border-input bg-background px-3 py-2.5 text-sm disabled:opacity-50"
                  />
                  <button
                    onClick={() => setApiKey('')}
                    className="rounded-md border border-border p-2.5 text-muted-foreground hover:text-foreground transition-colors"
                    type="button"
                    disabled={!apiKey}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              <FormError error={error} />
              <ConnectButton onClick={handleConnect} connecting={connecting} disabled={!apiKey.trim()} />
            </motion.div>
          ) : (
            <motion.div
              key="connected"
              variants={settingsVariants.fadeSlide}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={settingsTransitions.enter}
              className="space-y-3"
            >
              {/* Display stored region */}
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">Region</label>
                <input
                  type="text"
                  value={storedCredentials?.region === 'china' ? 'China' : 'International'}
                  disabled
                  className="w-full rounded-md border border-input bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground"
                />
              </div>

              {/* Display stored API key */}
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">API Key</label>
                <input
                  type="text"
                  value={storedCredentials?.keyPrefix || 'API key saved'}
                  disabled
                  data-testid="api-key-display"
                  className="w-full rounded-md border border-input bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground"
                />
              </div>

              <ConnectedControls onDisconnect={onDisconnect} />

              <ModelSelector
                models={models}
                value={connectedProvider?.selectedModelId || null}
                onChange={onModelChange}
                error={showModelError && !connectedProvider?.selectedModelId}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: May show errors about validateApiKeyForProvider signature - will fix in next task

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/components/settings/providers/ZaiProviderForm.tsx
git commit -m "feat(desktop): create ZaiProviderForm with region selector"
```

---

## Task 6: Update Preload/IPC Types for Region Parameter

**Files:**
- Modify: `apps/desktop/src/preload/index.ts`
- Modify: `apps/desktop/src/renderer/lib/accomplish.ts`

**Step 1: Update preload to pass options**

Find the `validateApiKeyForProvider` function in `apps/desktop/src/preload/index.ts` and update signature to accept options:

```typescript
validateApiKeyForProvider: (providerId: string, apiKey: string, options?: Record<string, unknown>) =>
  ipcRenderer.invoke('validate-api-key', providerId, apiKey, options),
```

**Step 2: Update renderer lib type**

In `apps/desktop/src/renderer/lib/accomplish.ts`, update the type:

```typescript
validateApiKeyForProvider: (providerId: string, apiKey: string, options?: Record<string, unknown>) => Promise<{ valid: boolean; error?: string }>,
```

**Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/desktop/src/preload/index.ts apps/desktop/src/renderer/lib/accomplish.ts
git commit -m "feat(desktop): add options parameter to validateApiKeyForProvider IPC"
```

---

## Task 7: Route Z.AI to New Form Component

**Files:**
- Modify: `apps/desktop/src/renderer/components/settings/ProviderSettingsPanel.tsx`

**Step 1: Import ZaiProviderForm**

Add import at top of file:

```typescript
import { ZaiProviderForm } from './providers/ZaiProviderForm';
```

**Step 2: Add case for zai provider**

Find the switch statement that routes providers to forms (look for `case 'classic':`). Add a specific case for Z.AI before the classic case:

```typescript
// Handle Z.AI separately (has region selector)
if (providerId === 'zai') {
  return (
    <ZaiProviderForm
      connectedProvider={connectedProvider}
      onConnect={handleConnect}
      onDisconnect={handleDisconnect}
      onModelChange={handleModelChange}
      showModelError={showModelError}
    />
  );
}

// Then continue with switch for other providers
switch (meta.category) {
  case 'classic':
    // ... existing code (now excludes zai)
```

**Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/desktop/src/renderer/components/settings/ProviderSettingsPanel.tsx
git commit -m "feat(desktop): route Z.AI provider to dedicated ZaiProviderForm"
```

---

## Task 8: Final Verification

**Step 1: Run full typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 2: Run lint**

Run: `pnpm lint`
Expected: PASS (or only pre-existing warnings)

**Step 3: Build the app**

Run: `pnpm build:desktop`
Expected: Build completes successfully

**Step 4: Manual testing checklist**

Run: `pnpm dev`

Test the following:
1. [ ] Open Settings, click Z.AI provider
2. [ ] Verify region selector shows with "International" pre-selected
3. [ ] Verify clicking "China" switches the selection
4. [ ] Enter valid international API key with International selected → should connect
5. [ ] Disconnect, switch to China, try international key → should fail
6. [ ] After connecting, verify region displays in read-only mode
7. [ ] Close and reopen app → verify region persists

**Step 5: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address any issues found during testing"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add ZaiCredentials type | providerSettings.ts |
| 2 | Add ZAI_ENDPOINTS constant | provider.ts, index.ts |
| 3 | Update IPC handler for region | handlers.ts |
| 4 | Update config generator | config-generator.ts |
| 5 | Create ZaiProviderForm | ZaiProviderForm.tsx |
| 6 | Update IPC types | preload/index.ts, accomplish.ts |
| 7 | Route to new form | ProviderSettingsPanel.tsx |
| 8 | Final verification | - |
