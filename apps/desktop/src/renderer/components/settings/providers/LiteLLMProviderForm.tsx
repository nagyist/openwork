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
    <div className="space-y-4" data-testid="provider-settings-panel">
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
              data-testid="litellm-server-url"
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
