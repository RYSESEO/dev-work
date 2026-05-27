import { Copy, Key, Plug, Plus, Power, PowerOff, RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { ApiScope, DashboardSnapshot, ExternalIntegration, WebhookServerConfig } from '../../../shared/domain';
import { commandCenterClient } from '../api/client';
import { useToast } from './ToastProvider';

interface Props {
  snapshot: DashboardSnapshot;
  onRefresh(): Promise<void>;
}

type IntegrationType = ExternalIntegration['type'];
const INTEGRATION_TYPES: Array<{ value: IntegrationType; label: string }> = [
  { value: 'cursor', label: 'Cursor' },
  { value: 'copilot', label: 'GitHub Copilot' },
  { value: 'devin', label: 'Devin' },
  { value: 'cli', label: 'CLI / Script' },
  { value: 'ci-cd', label: 'CI/CD Pipeline' },
  { value: 'custom', label: 'Custom' }
];

const ALL_SCOPES: Array<{ value: ApiScope; label: string }> = [
  { value: 'events:write', label: 'Write events' },
  { value: 'events:read', label: 'Read events' },
  { value: 'status:read', label: 'Read status' }
];

export function IntegrationsView({ snapshot, onRefresh }: Props) {
  const toast = useToast();
  const { integrations, apiKeys, webhookServer } = snapshot;

  const [showNewKey, setShowNewKey] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [keyScopes, setKeyScopes] = useState<ApiScope[]>(['events:write', 'events:read', 'status:read']);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [creatingKey, setCreatingKey] = useState(false);

  const [showNewIntegration, setShowNewIntegration] = useState(false);
  const [intName, setIntName] = useState('');
  const [intType, setIntType] = useState<IntegrationType>('custom');
  const [intKeyId, setIntKeyId] = useState('');

  const [serverDraft, setServerDraft] = useState<WebhookServerConfig>(webhookServer);
  const [savingServer, setSavingServer] = useState(false);

  async function handleCreateKey(): Promise<void> {
    if (!keyName.trim()) return;
    setCreatingKey(true);
    try {
      const result = await commandCenterClient.createApiKey(keyName.trim(), keyScopes);
      setCreatedKey(result.rawKey);
      toast.success('API key created. Copy it now — it will not be shown again.');
      setKeyName('');
      await onRefresh();
    } catch (err) {
      toast.error(`Failed to create key: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setCreatingKey(false);
    }
  }

  async function handleRevokeKey(id: string): Promise<void> {
    try {
      await commandCenterClient.revokeApiKey(id);
      toast.success('API key revoked.');
      await onRefresh();
    } catch (err) {
      toast.error(`Failed to revoke key: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  async function handleCreateIntegration(): Promise<void> {
    if (!intName.trim() || !intKeyId) return;
    try {
      await commandCenterClient.createIntegration(intName.trim(), intType, intKeyId);
      toast.success(`Integration "${intName.trim()}" created.`);
      setShowNewIntegration(false);
      setIntName('');
      await onRefresh();
    } catch (err) {
      toast.error(`Failed to create integration: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  async function handleDeleteIntegration(id: string): Promise<void> {
    try {
      await commandCenterClient.deleteIntegration(id);
      toast.success('Integration deleted.');
      await onRefresh();
    } catch (err) {
      toast.error(`Failed to delete: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  async function handleSaveServerConfig(): Promise<void> {
    setSavingServer(true);
    try {
      await commandCenterClient.updateWebhookConfig(serverDraft);
      toast.success(`Webhook server ${serverDraft.enabled ? 'enabled' : 'disabled'} on port ${serverDraft.port}.`);
      await onRefresh();
    } catch (err) {
      toast.error(`Failed to update server config: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSavingServer(false);
    }
  }

  function toggleScope(scope: ApiScope): void {
    setKeyScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  }

  function copyToClipboard(text: string): void {
    void navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard.');
  }

  const activeKeys = apiKeys.filter((k) => !k.revoked);

  return (
    <main className="app-shell">
      <header className="view-header">
        <span className="section-label">Integrations</span>
        <h1>Webhook & API Integrations</h1>
        <p>Connect external AI agents (Cursor, Copilot, Devin, etc.) to report runs and usage into your dashboard.</p>
      </header>

      {/* Webhook Server Config */}
      <section className="panel">
        <div className="panel-heading">
          <span className="panel-icon" aria-hidden="true">{webhookServer.enabled ? <Power size={18} /> : <PowerOff size={18} />}</span>
          <div>
            <h2>Webhook Server</h2>
            <p>HTTP endpoint that receives events from external agents.</p>
          </div>
        </div>
        <div className="sandbox-editor">
          <div className="form-row">
            <label className="form-label">
              <input
                type="checkbox"
                checked={serverDraft.enabled}
                onChange={(e) => setServerDraft({ ...serverDraft, enabled: e.target.checked })}
              />
              Enable webhook server
            </label>
          </div>
          <div className="form-row">
            <label className="form-label">Host</label>
            <input
              className="input"
              value={serverDraft.host}
              onChange={(e) => setServerDraft({ ...serverDraft, host: e.target.value })}
              placeholder="127.0.0.1"
            />
          </div>
          <div className="form-row">
            <label className="form-label">Port</label>
            <input
              className="input"
              type="number"
              value={serverDraft.port}
              onChange={(e) => setServerDraft({ ...serverDraft, port: Number(e.target.value) })}
            />
          </div>
          <div className="form-actions">
            <button
              className="primary-button"
              disabled={savingServer}
              onClick={() => void handleSaveServerConfig()}
            >
              {savingServer ? 'Saving...' : 'Save & Apply'}
            </button>
          </div>
          {webhookServer.enabled && (
            <div className="api-endpoint-info">
              <strong>Endpoint:</strong>
              <code>POST http://{webhookServer.host}:{webhookServer.port}/api/v1/events</code>
              <button className="icon-button" onClick={() => copyToClipboard(`http://${webhookServer.host}:${webhookServer.port}/api/v1/events`)} title="Copy">
                <Copy size={14} />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* API Keys */}
      <section className="panel">
        <div className="panel-heading">
          <span className="panel-icon" aria-hidden="true"><Key size={18} /></span>
          <div>
            <h2>API Keys</h2>
            <p>Manage API keys for authenticating external agent integrations.</p>
          </div>
          <button className="secondary-button panel-action" onClick={() => { setShowNewKey(!showNewKey); setCreatedKey(null); }}>
            <Plus size={14} /> New Key
          </button>
        </div>

        {createdKey && (
          <div className="key-reveal">
            <p><strong>Your new API key (copy now, shown only once):</strong></p>
            <div className="key-value">
              <code>{createdKey}</code>
              <button className="icon-button" onClick={() => copyToClipboard(createdKey)} title="Copy">
                <Copy size={14} />
              </button>
            </div>
            <button className="secondary-button" onClick={() => setCreatedKey(null)}>Dismiss</button>
          </div>
        )}

        {showNewKey && !createdKey && (
          <div className="sandbox-editor">
            <div className="form-row">
              <label className="form-label">Key name</label>
              <input className="input" value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="e.g., Cursor Agent" />
            </div>
            <div className="form-row">
              <label className="form-label">Scopes</label>
              <div className="scope-checkboxes">
                {ALL_SCOPES.map((s) => (
                  <label key={s.value} className="form-label">
                    <input type="checkbox" checked={keyScopes.includes(s.value)} onChange={() => toggleScope(s.value)} />
                    {s.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="form-actions">
              <button className="primary-button" disabled={creatingKey || !keyName.trim()} onClick={() => void handleCreateKey()}>
                {creatingKey ? 'Creating...' : 'Create API Key'}
              </button>
              <button className="secondary-button" onClick={() => setShowNewKey(false)}>Cancel</button>
            </div>
          </div>
        )}

        <table className="data-table" aria-label="API keys">
          <thead>
            <tr>
              <th>Name</th>
              <th>Prefix</th>
              <th>Scopes</th>
              <th>Created</th>
              <th>Last Used</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {apiKeys.length === 0 ? (
              <tr><td colSpan={7} className="empty-cell">No API keys yet. Create one to connect external agents.</td></tr>
            ) : apiKeys.map((key) => (
              <tr key={key.id} className={key.revoked ? 'revoked-row' : ''}>
                <td>{key.name}</td>
                <td><code>{key.prefix}...</code></td>
                <td>{key.scopes.join(', ')}</td>
                <td>{new Date(key.createdAt).toLocaleDateString()}</td>
                <td>{key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : 'Never'}</td>
                <td>
                  <span className={`badge ${key.revoked ? 'badge-danger' : 'badge-success'}`}>
                    {key.revoked ? 'Revoked' : 'Active'}
                  </span>
                </td>
                <td>
                  {!key.revoked && (
                    <button className="icon-button danger" onClick={() => void handleRevokeKey(key.id)} title="Revoke">
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Connected Integrations */}
      <section className="panel">
        <div className="panel-heading">
          <span className="panel-icon" aria-hidden="true"><Plug size={18} /></span>
          <div>
            <h2>Connected Agents</h2>
            <p>External agents reporting into your dashboard.</p>
          </div>
          <button className="secondary-button panel-action" onClick={() => setShowNewIntegration(!showNewIntegration)}>
            <Plus size={14} /> Connect Agent
          </button>
        </div>

        {showNewIntegration && (
          <div className="sandbox-editor">
            <div className="form-row">
              <label className="form-label">Agent name</label>
              <input className="input" value={intName} onChange={(e) => setIntName(e.target.value)} placeholder="e.g., My Cursor Agent" />
            </div>
            <div className="form-row">
              <label className="form-label">Type</label>
              <select className="input" value={intType} onChange={(e) => setIntType(e.target.value as IntegrationType)}>
                {INTEGRATION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label className="form-label">API Key</label>
              <select className="input" value={intKeyId} onChange={(e) => setIntKeyId(e.target.value)}>
                <option value="">Select an API key...</option>
                {activeKeys.map((k) => (
                  <option key={k.id} value={k.id}>{k.name} ({k.prefix}...)</option>
                ))}
              </select>
            </div>
            <div className="form-actions">
              <button className="primary-button" disabled={!intName.trim() || !intKeyId} onClick={() => void handleCreateIntegration()}>
                Connect Agent
              </button>
              <button className="secondary-button" onClick={() => setShowNewIntegration(false)}>Cancel</button>
            </div>
          </div>
        )}

        {integrations.length === 0 ? (
          <div className="empty-state">
            <Plug size={32} />
            <p>No connected agents yet.</p>
            <p>Create an API key, then connect an external agent to start receiving events.</p>
          </div>
        ) : (
          <div className="integration-grid">
            {integrations.map((int) => (
              <div key={int.id} className="integration-card">
                <div className="integration-header">
                  <span className={`integration-type-badge badge-${int.type}`}>{int.type}</span>
                  <span className={`badge ${int.status === 'active' ? 'badge-success' : int.status === 'error' ? 'badge-danger' : 'badge-muted'}`}>
                    {int.status}
                  </span>
                </div>
                <h3>{int.name}</h3>
                <div className="integration-stats">
                  <div className="stat">
                    <span className="stat-label">Events</span>
                    <span className="stat-value">{int.eventCount.toLocaleString()}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Tokens</span>
                    <span className="stat-value">{int.totalTokens.toLocaleString()}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Cost</span>
                    <span className="stat-value">${int.totalCostUsd.toFixed(2)}</span>
                  </div>
                </div>
                <div className="integration-footer">
                  <small>{int.lastSeenAt ? `Last seen: ${new Date(int.lastSeenAt).toLocaleString()}` : 'Never connected'}</small>
                  <button className="icon-button danger" onClick={() => void handleDeleteIntegration(int.id)} title="Remove">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* API Documentation */}
      <section className="panel">
        <div className="panel-heading">
          <span className="panel-icon" aria-hidden="true"><RefreshCw size={18} /></span>
          <div>
            <h2>API Reference</h2>
            <p>How to send events from your external agents.</p>
          </div>
        </div>
        <div className="api-docs">
          <h3>Send an event</h3>
          <pre className="code-block">{`POST http://${webhookServer.host}:${webhookServer.port}/api/v1/events
Authorization: Bearer <your-api-key>
Content-Type: application/json

{
  "type": "run.completed",
  "payload": {
    "runId": "cursor-run-123",
    "agentName": "Cursor",
    "status": "completed",
    "prompt": "Fix the login bug",
    "output": "Fixed authentication flow in auth.ts",
    "durationMs": 45000,
    "metadata": { "model": "gpt-4", "file": "src/auth.ts" }
  }
}`}</pre>

          <h3>Event types</h3>
          <table className="data-table" aria-label="Event types">
            <thead>
              <tr><th>Type</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>run.started</code></td><td>Agent began working on a task</td></tr>
              <tr><td><code>run.progress</code></td><td>Agent progress update</td></tr>
              <tr><td><code>run.completed</code></td><td>Agent finished successfully</td></tr>
              <tr><td><code>run.failed</code></td><td>Agent encountered an error</td></tr>
              <tr><td><code>usage.report</code></td><td>Token/cost usage data</td></tr>
              <tr><td><code>artifact.created</code></td><td>Agent produced a file or report</td></tr>
              <tr><td><code>heartbeat</code></td><td>Agent is alive and running</td></tr>
            </tbody>
          </table>

          <h3>Usage report payload</h3>
          <pre className="code-block">{`{
  "type": "usage.report",
  "payload": {
    "runId": "cursor-run-123",
    "tokens": 4500,
    "costUsd": 0.12,
    "model": "gpt-4",
    "provider": "openai"
  }
}`}</pre>

          <h3>Health check</h3>
          <pre className="code-block">{`GET http://${webhookServer.host}:${webhookServer.port}/api/v1/status
# No auth required — returns { "status": "ok" }`}</pre>
        </div>
      </section>
    </main>
  );
}
