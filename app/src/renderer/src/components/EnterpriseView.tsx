import { useState, type JSX } from 'react';
import type { DashboardSnapshot, CloudSyncConfig, SsoConfig, RestApiConfig } from '../../../shared/domain';
import { commandCenterClient } from '../api/client';
import { useToast } from './ToastProvider';

interface Props {
  snapshot: DashboardSnapshot;
  onRefresh: () => Promise<void>;
}

type Section = 'cloud' | 'sso' | 'sandbox' | 'compliance' | 'api';

export function EnterpriseView({ snapshot, onRefresh }: Props): JSX.Element {
  const toast = useToast();
  const [section, setSection] = useState<Section>('cloud');
  const [loading, setLoading] = useState(false);
  const ent = snapshot.enterprise;

  const hasLicense = snapshot.license.features.includes('cloud_sync') ||
    snapshot.license.features.includes('sso_auth') ||
    snapshot.license.features.includes('rest_api_server');

  if (!hasLicense) {
    return (
      <div className="view-container">
        <h2>Enterprise &amp; Cloud</h2>
        <div className="notice" style={{ textAlign: 'center', padding: '3rem' }}>
          <h3>Team License Required</h3>
          <p>Enterprise features require a Team license. Upgrade to unlock cloud sync, SSO, sandbox execution, compliance reporting, and REST API server.</p>
          <button className="btn btn-primary" onClick={() => toast.warning('Go to Settings → License to activate')}>
            Upgrade License in Settings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="view-container">
      <h2>Enterprise &amp; Cloud</h2>
      <div className="tab-bar" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {(['cloud', 'sso', 'sandbox', 'compliance', 'api'] as Section[]).map((s) => (
          <button
            key={s}
            className={s === section ? 'btn btn-primary' : 'btn'}
            onClick={() => setSection(s)}
          >
            {s === 'cloud' ? 'Cloud Sync' : s === 'sso' ? 'SSO / SAML' : s === 'sandbox' ? 'Sandbox' : s === 'compliance' ? 'Compliance' : 'REST API'}
          </button>
        ))}
      </div>

      {section === 'cloud' && <CloudSyncSection config={ent.cloudSync} loading={loading} setLoading={setLoading} onRefresh={onRefresh} toast={toast} />}
      {section === 'sso' && <SsoSection config={ent.sso} loading={loading} setLoading={setLoading} onRefresh={onRefresh} toast={toast} />}
      {section === 'sandbox' && <SandboxSection snapshot={snapshot} loading={loading} setLoading={setLoading} onRefresh={onRefresh} toast={toast} />}
      {section === 'compliance' && <ComplianceSection snapshot={snapshot} />}
      {section === 'api' && <RestApiSection config={ent.restApi} status={ent.restApiStatus} loading={loading} setLoading={setLoading} onRefresh={onRefresh} toast={toast} />}
    </div>
  );
}

// ── Cloud Sync ──────────────────────────────────────────────────────

function CloudSyncSection({ config, loading, setLoading, onRefresh, toast }: {
  config: CloudSyncConfig;
  loading: boolean;
  setLoading: (v: boolean) => void;
  onRefresh: () => Promise<void>;
  toast: ReturnType<typeof useToast>;
}): JSX.Element {
  const [endpoint, setEndpoint] = useState(config.endpoint);
  const [teamId, setTeamId] = useState(config.teamId);
  const [interval, setInterval_] = useState(config.syncIntervalSeconds);
  const [resolution, setResolution] = useState(config.conflictResolution);

  async function handleSave(): Promise<void> {
    setLoading(true);
    try {
      await commandCenterClient.updateCloudSyncConfig({
        endpoint,
        teamId,
        syncIntervalSeconds: interval,
        conflictResolution: resolution
      });
      await onRefresh();
      toast.success('Cloud sync settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(): Promise<void> {
    setLoading(true);
    try {
      await commandCenterClient.updateCloudSyncConfig({ enabled: !config.enabled });
      await onRefresh();
      toast.success(config.enabled ? 'Cloud sync disabled' : 'Cloud sync enabled');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to toggle');
    } finally {
      setLoading(false);
    }
  }

  async function handleSync(): Promise<void> {
    setLoading(true);
    try {
      const records = await commandCenterClient.triggerCloudSync();
      await onRefresh();
      toast.success(`Sync complete — ${records.length} collections synced`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="metric-row" style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="metric-card">
          <span className="metric-label">Status</span>
          <span className="metric-value">{config.status}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Encryption</span>
          <span className="metric-value">{config.encryptionEnabled ? 'AES-256-GCM' : 'Disabled'}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Last Sync</span>
          <span className="metric-value">{config.lastSyncAt ? new Date(config.lastSyncAt).toLocaleString() : 'Never'}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Collections</span>
          <span className="metric-value">{config.syncedCollections.length}</span>
        </div>
      </div>

      <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <label>
          <span>Sync Endpoint</span>
          <input type="url" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="https://sync.example.com/api" />
        </label>
        <label>
          <span>Team ID</span>
          <input type="text" value={teamId} onChange={(e) => setTeamId(e.target.value)} placeholder="team-abc123" />
        </label>
        <label>
          <span>Sync Interval (seconds)</span>
          <input type="number" value={interval} onChange={(e) => setInterval_(Number(e.target.value))} min={30} />
        </label>
        <label>
          <span>Conflict Resolution</span>
          <select value={resolution} onChange={(e) => setResolution(e.target.value as CloudSyncConfig['conflictResolution'])}>
            <option value="local_wins">Local Wins</option>
            <option value="remote_wins">Remote Wins</option>
            <option value="manual">Manual</option>
          </select>
        </label>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button className="btn btn-primary" onClick={() => void handleSave()} disabled={loading}>
          {loading ? 'Saving...' : 'Save Settings'}
        </button>
        <button className="btn" onClick={() => void handleToggle()} disabled={loading}>
          {config.enabled ? 'Disable Sync' : 'Enable Sync'}
        </button>
        {config.enabled && (
          <button className="btn" onClick={() => void handleSync()} disabled={loading}>
            {loading ? 'Syncing...' : 'Sync Now'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── SSO / SAML ──────────────────────────────────────────────────────

function SsoSection({ config, loading, setLoading, onRefresh, toast }: {
  config: SsoConfig;
  loading: boolean;
  setLoading: (v: boolean) => void;
  onRefresh: () => Promise<void>;
  toast: ReturnType<typeof useToast>;
}): JSX.Element {
  const [provider, setProvider] = useState(config.provider);
  const [issuerUrl, setIssuerUrl] = useState(config.issuerUrl);
  const [clientId, setClientId] = useState(config.clientId);
  const [callbackUrl, setCallbackUrl] = useState(config.callbackUrl);
  const [domains, setDomains] = useState(config.allowedDomains.join(', '));
  const [autoProvision, setAutoProvision] = useState(config.autoProvision);

  async function handleSave(): Promise<void> {
    setLoading(true);
    try {
      await commandCenterClient.updateSsoConfig({
        provider,
        issuerUrl,
        clientId,
        callbackUrl,
        allowedDomains: domains.split(',').map((d) => d.trim()).filter(Boolean),
        autoProvision
      });
      await onRefresh();
      toast.success('SSO settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(): Promise<void> {
    setLoading(true);
    try {
      await commandCenterClient.updateSsoConfig({ enabled: !config.enabled });
      await onRefresh();
      toast.success(config.enabled ? 'SSO disabled' : 'SSO enabled');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to toggle');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="metric-row" style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="metric-card">
          <span className="metric-label">Status</span>
          <span className="metric-value">{config.enabled ? 'Active' : 'Inactive'}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Provider</span>
          <span className="metric-value">{config.provider.toUpperCase()}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Auto-Provision</span>
          <span className="metric-value">{config.autoProvision ? 'Yes' : 'No'}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Domains</span>
          <span className="metric-value">{config.allowedDomains.length || 'All'}</span>
        </div>
      </div>

      <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <label>
          <span>Provider</span>
          <select value={provider} onChange={(e) => setProvider(e.target.value as SsoConfig['provider'])}>
            <option value="oidc">OpenID Connect (OIDC)</option>
            <option value="saml">SAML 2.0</option>
            <option value="oauth2">OAuth 2.0</option>
          </select>
        </label>
        <label>
          <span>Issuer URL</span>
          <input type="url" value={issuerUrl} onChange={(e) => setIssuerUrl(e.target.value)} placeholder="https://login.example.com" />
        </label>
        <label>
          <span>Client ID</span>
          <input type="text" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="your-client-id" />
        </label>
        <label>
          <span>Callback URL</span>
          <input type="url" value={callbackUrl} onChange={(e) => setCallbackUrl(e.target.value)} />
        </label>
        <label>
          <span>Allowed Domains (comma-separated)</span>
          <input type="text" value={domains} onChange={(e) => setDomains(e.target.value)} placeholder="example.com, corp.io" />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input type="checkbox" checked={autoProvision} onChange={(e) => setAutoProvision(e.target.checked)} />
          <span>Auto-provision new users on first login</span>
        </label>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button className="btn btn-primary" onClick={() => void handleSave()} disabled={loading}>
          {loading ? 'Saving...' : 'Save Settings'}
        </button>
        <button className="btn" onClick={() => void handleToggle()} disabled={loading}>
          {config.enabled ? 'Disable SSO' : 'Enable SSO'}
        </button>
      </div>
    </div>
  );
}

// ── Sandbox ─────────────────────────────────────────────────────────

function SandboxSection({ snapshot, loading, setLoading, onRefresh, toast }: {
  snapshot: DashboardSnapshot;
  loading: boolean;
  setLoading: (v: boolean) => void;
  onRefresh: () => Promise<void>;
  toast: ReturnType<typeof useToast>;
}): JSX.Element {
  const executions = snapshot.enterprise.sandboxExecutions;

  async function handleStop(id: string): Promise<void> {
    setLoading(true);
    try {
      await commandCenterClient.stopSandboxExecution(id);
      await onRefresh();
      toast.success('Sandbox stopped');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to stop');
    } finally {
      setLoading(false);
    }
  }

  async function handleDestroy(id: string): Promise<void> {
    setLoading(true);
    try {
      await commandCenterClient.destroySandboxExecution(id);
      await onRefresh();
      toast.success('Sandbox destroyed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to destroy');
    } finally {
      setLoading(false);
    }
  }

  const running = executions.filter((e) => e.status === 'running').length;
  const total = executions.length;

  return (
    <div>
      <div className="metric-row" style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="metric-card">
          <span className="metric-label">Running</span>
          <span className="metric-value">{running}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Total</span>
          <span className="metric-value">{total}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Runtime</span>
          <span className="metric-value">{snapshot.sandboxConfig.runtime}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Network Policy</span>
          <span className="metric-value">{snapshot.sandboxConfig.networkAccess ? 'Allowed' : 'Blocked'}</span>
        </div>
      </div>

      {executions.length === 0 ? (
        <p className="empty-state">No sandbox executions yet. Sandbox containers are created automatically when runs execute with sandbox enabled.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Runtime</th>
              <th>Image</th>
              <th>Status</th>
              <th>Network</th>
              <th>CPU %</th>
              <th>Memory</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {executions.map((exec) => (
              <tr key={exec.id}>
                <td title={exec.id}>{exec.id.slice(0, 12)}...</td>
                <td>{exec.runtime}</td>
                <td>{exec.image}</td>
                <td>
                  <span className={`badge badge-${exec.status === 'running' ? 'success' : exec.status === 'failed' ? 'error' : 'default'}`}>
                    {exec.status}
                  </span>
                </td>
                <td>{exec.networkPolicy}</td>
                <td>{exec.resourceUsage.cpuPercent.toFixed(1)}%</td>
                <td>{exec.resourceUsage.memoryMb} MB</td>
                <td>
                  {exec.status === 'running' && (
                    <button className="btn btn-sm" onClick={() => void handleStop(exec.id)} disabled={loading}>Stop</button>
                  )}
                  {(exec.status === 'stopped' || exec.status === 'failed') && (
                    <button className="btn btn-sm btn-danger" onClick={() => void handleDestroy(exec.id)} disabled={loading}>Destroy</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Compliance ──────────────────────────────────────────────────────

function ComplianceSection({ snapshot }: { snapshot: DashboardSnapshot }): JSX.Element {
  const report = snapshot.enterprise.compliance;
  const categoryOrder = ['access_control', 'data_protection', 'audit_logging', 'encryption', 'availability', 'change_management'] as const;

  return (
    <div>
      <div className="metric-row" style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="metric-card">
          <span className="metric-label">Framework</span>
          <span className="metric-value">SOC 2 Type I</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Overall Score</span>
          <span className="metric-value" style={{ color: report.overallScore >= 80 ? 'var(--color-success)' : report.overallScore >= 50 ? 'var(--color-warning)' : 'var(--color-error)' }}>
            {report.overallScore}%
          </span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Compliant</span>
          <span className="metric-value">{report.compliantControls} / {report.totalControls}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Gaps</span>
          <span className="metric-value">{report.gaps.length}</span>
        </div>
      </div>

      {report.gaps.length > 0 && (
        <div className="notice warning" style={{ marginBottom: '1.5rem' }}>
          <strong>Compliance Gaps</strong>
          <ul style={{ margin: '0.5rem 0 0 1.5rem', padding: 0 }}>
            {report.gaps.map((gap, i) => (
              <li key={i}>{gap}</li>
            ))}
          </ul>
        </div>
      )}

      {categoryOrder.map((category) => {
        const controls = report.controls.filter((c) => c.category === category);
        if (controls.length === 0) return null;
        const label = category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        return (
          <div key={category} style={{ marginBottom: '1.5rem' }}>
            <h4>{label}</h4>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Control</th>
                  <th>Status</th>
                  <th>Evidence</th>
                </tr>
              </thead>
              <tbody>
                {controls.map((control) => (
                  <tr key={control.id}>
                    <td>
                      <strong>{control.name}</strong>
                      <br />
                      <small>{control.description}</small>
                    </td>
                    <td>
                      <span className={`badge badge-${control.status === 'compliant' ? 'success' : control.status === 'partial' ? 'warning' : control.status === 'non_compliant' ? 'error' : 'default'}`}>
                        {control.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td><small>{control.evidence}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        Report generated: {new Date(report.generatedAt).toLocaleString()}
      </p>
    </div>
  );
}

// ── REST API ────────────────────────────────────────────────────────

function RestApiSection({ config, status, loading, setLoading, onRefresh, toast }: {
  config: RestApiConfig;
  status: { running: boolean; port: number; host: string; uptime: number; requestCount: number; startedAt: string | null };
  loading: boolean;
  setLoading: (v: boolean) => void;
  onRefresh: () => Promise<void>;
  toast: ReturnType<typeof useToast>;
}): JSX.Element {
  const [port, setPort] = useState(config.port);
  const [host, setHost] = useState(config.host);
  const [rateLimit, setRateLimit] = useState(config.rateLimitPerMinute);
  const [corsOrigins, setCorsOrigins] = useState(config.corsOrigins.join(', '));

  async function handleSave(): Promise<void> {
    setLoading(true);
    try {
      await commandCenterClient.updateRestApiConfig({
        port,
        host,
        rateLimitPerMinute: rateLimit,
        corsOrigins: corsOrigins.split(',').map((o) => o.trim()).filter(Boolean)
      });
      await onRefresh();
      toast.success('REST API settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(): Promise<void> {
    setLoading(true);
    try {
      if (status.running) {
        await commandCenterClient.stopRestApiServer();
        toast.success('REST API server stopped');
      } else {
        await commandCenterClient.startRestApiServer();
        toast.success('REST API server started');
      }
      await onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to toggle server');
    } finally {
      setLoading(false);
    }
  }

  function formatUptime(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  }

  return (
    <div>
      <div className="metric-row" style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="metric-card">
          <span className="metric-label">Status</span>
          <span className="metric-value" style={{ color: status.running ? 'var(--color-success)' : 'var(--text-muted)' }}>
            {status.running ? 'Running' : 'Stopped'}
          </span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Endpoint</span>
          <span className="metric-value">{status.host}:{status.port}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Uptime</span>
          <span className="metric-value">{formatUptime(status.uptime)}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Requests</span>
          <span className="metric-value">{status.requestCount}</span>
        </div>
      </div>

      <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <label>
          <span>Port</span>
          <input type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} min={1024} max={65535} />
        </label>
        <label>
          <span>Host</span>
          <input type="text" value={host} onChange={(e) => setHost(e.target.value)} />
        </label>
        <label>
          <span>Rate Limit (req/min)</span>
          <input type="number" value={rateLimit} onChange={(e) => setRateLimit(Number(e.target.value))} min={1} />
        </label>
        <label>
          <span>CORS Origins (comma-separated)</span>
          <input type="text" value={corsOrigins} onChange={(e) => setCorsOrigins(e.target.value)} placeholder="http://localhost:3000, https://app.example.com" />
        </label>
      </div>

      <div className="notice" style={{ marginBottom: '1rem' }}>
        <strong>Available Endpoints</strong>
        <ul style={{ margin: '0.5rem 0 0 1.5rem', padding: 0, fontSize: '0.9rem' }}>
          <li><code>GET /api/v1/health</code> — Health check</li>
          <li><code>GET /api/v1/status</code> — System status summary</li>
          <li><code>GET /api/v1/missions</code> — List all missions</li>
          <li><code>GET /api/v1/tasks</code> — List all tasks</li>
          <li><code>GET /api/v1/agents</code> — List all agents</li>
          <li><code>GET /api/v1/runs</code> — List all runs</li>
        </ul>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button className="btn btn-primary" onClick={() => void handleSave()} disabled={loading}>
          {loading ? 'Saving...' : 'Save Settings'}
        </button>
        <button
          className={status.running ? 'btn btn-danger' : 'btn btn-primary'}
          onClick={() => void handleToggle()}
          disabled={loading}
        >
          {loading ? 'Working...' : status.running ? 'Stop Server' : 'Start Server'}
        </button>
      </div>
    </div>
  );
}
