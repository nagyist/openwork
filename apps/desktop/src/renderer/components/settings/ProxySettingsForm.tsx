'use client';

import { useState, useEffect, useCallback } from 'react';
import { getAccomplish } from '@/lib/accomplish';
import type { ProxyConfig } from '@accomplish/shared';

interface ProxySettingsFormProps {
  onSaved?: () => void;
}

export function ProxySettingsForm({ onSaved }: ProxySettingsFormProps) {
  const [enabled, setEnabled] = useState(false);
  const [host, setHost] = useState('');
  const [port, setPort] = useState('');
  const [bypassRules, setBypassRules] = useState('localhost,127.0.0.1');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const accomplish = getAccomplish();

  // Load current config on mount
  useEffect(() => {
    accomplish.getProxyConfig().then((config) => {
      if (config) {
        setEnabled(config.enabled);
        setHost(config.host);
        setPort(config.port.toString());
        setBypassRules(config.bypassRules || 'localhost,127.0.0.1');
      }
      setLoading(false);
    });
  }, [accomplish]);

  // Track changes
  useEffect(() => {
    setHasChanges(true);
    setTestResult(null);
    setError(null);
  }, [enabled, host, port, bypassRules]);

  const handleTestConnection = useCallback(async () => {
    if (!host || !port) {
      setError('Host and port are required');
      return;
    }

    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      setError('Port must be a number between 1 and 65535');
      return;
    }

    setTesting(true);
    setTestResult(null);
    setError(null);

    try {
      const result = await accomplish.testProxyConnection(host, portNum);
      setTestResult(result);
    } catch (err) {
      setTestResult({ success: false, error: err instanceof Error ? err.message : 'Test failed' });
    } finally {
      setTesting(false);
    }
  }, [host, port, accomplish]);

  const handleSave = useCallback(async () => {
    setError(null);

    if (enabled) {
      if (!host) {
        setError('Host is required when proxy is enabled');
        return;
      }
      const portNum = parseInt(port, 10);
      if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
        setError('Port must be a number between 1 and 65535');
        return;
      }
    }

    setSaving(true);

    try {
      const config: ProxyConfig | null = enabled
        ? {
            enabled: true,
            host,
            port: parseInt(port, 10),
            bypassRules: bypassRules || undefined,
          }
        : null;

      await accomplish.setProxyConfig(config);
      setHasChanges(false);
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save proxy settings');
    } finally {
      setSaving(false);
    }
  }, [enabled, host, port, bypassRules, accomplish, onSaved]);

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center justify-center py-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="font-medium text-foreground">HTTP Proxy</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Route all requests through an HTTP proxy server.
          </p>
        </div>
        <div className="ml-4">
          <button
            data-testid="proxy-toggle"
            onClick={() => setEnabled(!enabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
              enabled ? 'bg-primary' : 'bg-muted'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {enabled && (
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Host
              </label>
              <input
                data-testid="proxy-host-input"
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="proxy.example.com"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Port
              </label>
              <input
                data-testid="proxy-port-input"
                type="text"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="8080"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Bypass Rules (optional)
            </label>
            <input
              data-testid="proxy-bypass-input"
              type="text"
              value={bypassRules}
              onChange={(e) => setBypassRules(e.target.value)}
              placeholder="localhost,127.0.0.1"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Comma-separated list of hosts to bypass the proxy
            </p>
          </div>

          {/* Test Result */}
          {testResult && (
            <div
              className={`rounded-md p-3 text-sm ${
                testResult.success
                  ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                  : 'bg-destructive/10 text-destructive'
              }`}
            >
              {testResult.success
                ? 'Connection successful!'
                : `Connection failed: ${testResult.error || 'Unknown error'}`}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              data-testid="proxy-test-button"
              onClick={handleTestConnection}
              disabled={testing || !host || !port}
              className="flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testing ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Testing...
                </>
              ) : (
                'Test Connection'
              )}
            </button>
            <button
              data-testid="proxy-save-button"
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
