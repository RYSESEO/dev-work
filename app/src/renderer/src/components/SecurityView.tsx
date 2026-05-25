import { Lock, Shield, Server } from 'lucide-react';
import { useState } from 'react';
import type { DashboardSnapshot, SandboxConfig } from '../../../shared/domain';
import { commandCenterClient } from '../api/client';
import { useToast } from './ToastProvider';

interface Props {
  snapshot: DashboardSnapshot;
  onRefresh(): Promise<void>;
}

export function SecurityView({ snapshot, onRefresh }: Props) {
  const toast = useToast();
  const config = snapshot.sandboxConfig;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<SandboxConfig>(config);
  const [saving, setSaving] = useState(false);

  function startEditing(): void {
    setDraft({ ...config });
    setEditing(true);
  }

  async function handleSave(): Promise<void> {
    setSaving(true);
    try {
      await commandCenterClient.updateSandboxConfig(draft);
      toast.success('Sandbox configuration saved.');
      setEditing(false);
      await onRefresh();
    } catch (err) {
      toast.error(`Failed to save config: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="view-header">
        <span className="section-label">Security</span>
        <h1>Sandbox & Security</h1>
        <p>Configure execution sandboxing, network policies, and remote execution settings.</p>
      </header>

      <section className="panel">
        <div className="panel-heading">
          <span className="panel-icon" aria-hidden="true"><Shield size={18} /></span>
          <div>
            <h2>Sandbox configuration</h2>
            <p>Control how agent code executes in isolated environments.</p>
          </div>
          {!editing && (
            <button className="secondary-button panel-action" onClick={startEditing}>Edit</button>
          )}
        </div>

        {editing ? (
          <div className="sandbox-editor">
            <div className="form-row">
              <label className="form-label">
                <input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
                Enable sandbox
              </label>
            </div>
            <div className="form-row">
              <label className="form-label">Runtime</label>
              <select className="input" value={draft.runtime} onChange={(e) => setDraft({ ...draft, runtime: e.target.value as SandboxConfig['runtime'] })}>
                <option value="none">None</option>
                <option value="docker">Docker</option>
                <option value="firecracker">Firecracker</option>
              </select>
            </div>
            <div className="form-row">
              <label className="form-label">Container image</label>
              <input className="input" value={draft.image} onChange={(e) => setDraft({ ...draft, image: e.target.value })} placeholder="e.g., node:20-slim" />
            </div>
            <div className="form-row">
              <label className="form-label">Memory limit (MB)</label>
              <input className="input" type="number" value={draft.memoryLimitMb} onChange={(e) => setDraft({ ...draft, memoryLimitMb: Number(e.target.value) })} />
            </div>
            <div className="form-row">
              <label className="form-label">CPU limit</label>
              <input className="input" type="number" value={draft.cpuLimit} step="0.5" onChange={(e) => setDraft({ ...draft, cpuLimit: Number(e.target.value) })} />
            </div>
            <div className="form-row">
              <label className="form-label">Timeout (seconds)</label>
              <input className="input" type="number" value={draft.timeoutSeconds} onChange={(e) => setDraft({ ...draft, timeoutSeconds: Number(e.target.value) })} />
            </div>
            <div className="form-row">
              <label className="form-label">
                <input type="checkbox" checked={draft.networkAccess} onChange={(e) => setDraft({ ...draft, networkAccess: e.target.checked })} />
                Allow network access
              </label>
            </div>
            <div className="form-actions">
              <button className="primary-button" disabled={saving} onClick={() => void handleSave()}>
                {saving ? 'Saving...' : 'Save configuration'}
              </button>
              <button className="secondary-button" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="sandbox-summary">
            <div className="config-grid">
              <ConfigItem icon={Shield} label="Sandbox" value={config.enabled ? 'Enabled' : 'Disabled'} status={config.enabled} />
              <ConfigItem icon={Server} label="Runtime" value={config.runtime} status={config.runtime !== 'none'} />
              <ConfigItem icon={Lock} label="Network" value={config.networkAccess ? 'Allowed' : 'Blocked'} status={!config.networkAccess} />
              <ConfigItem icon={Server} label="Memory" value={`${config.memoryLimitMb} MB`} status={true} />
              <ConfigItem icon={Server} label="CPU" value={`${config.cpuLimit} core${config.cpuLimit !== 1 ? 's' : ''}`} status={true} />
              <ConfigItem icon={Lock} label="Timeout" value={`${config.timeoutSeconds}s`} status={true} />
            </div>
            {config.image && (
              <p className="sandbox-image-note">
                Image: <code>{config.image}</code>
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

function ConfigItem({ icon: Icon, label, value, status }: { icon: typeof Shield; label: string; value: string; status: boolean }) {
  return (
    <div className="config-item">
      <span className="config-icon" aria-hidden="true"><Icon size={16} /></span>
      <span className="config-label">{label}</span>
      <strong className={`config-value ${status ? 'config-good' : 'config-warn'}`}>{value}</strong>
    </div>
  );
}
