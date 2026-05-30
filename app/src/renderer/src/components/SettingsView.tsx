import { BarChart3, Bell, Database, Edit, Eye, EyeOff, Key, Moon, Plus, Settings, Sun, Trash2 } from 'lucide-react';
import type { ThemeMode } from '../App';
import { useEffect, useState, type JSX } from 'react';
import type { AnthropicRunnerProfile, CommandRunnerProfile, CustomHttpRunnerProfile, DashboardSnapshot, OllamaRunnerProfile, OpenAIRunnerProfile, RunnerProfile } from '../../../shared/domain';
import { commandCenterClient } from '../api/client';
import { useToast } from './ToastProvider';
import { ConfirmDialog } from './ConfirmDialog';

interface Props {
  snapshot: DashboardSnapshot;
  onRefresh(): Promise<void>;
  themeMode: ThemeMode;
  onThemeChange(mode: ThemeMode): void;
}

type ProfileType = 'command' | 'openai' | 'anthropic' | 'ollama' | 'custom-http';

interface RunnerFormState {
  name: string;
  type: ProfileType;
  command: string;
  args: string;
  workspacePath: string;
  costPerThousandTokensUsd: string;
  model: string;
  maxTokens: string;
  systemPrompt: string;
  envVars: Array<{ key: string; value: string; visible: boolean }>;
}

const emptyForm: RunnerFormState = {
  name: '',
  type: 'command',
  command: '',
  args: '',
  workspacePath: '',
  costPerThousandTokensUsd: '0.01',
  model: 'gpt-4o',
  maxTokens: '4096',
  systemPrompt: 'You are a helpful coding assistant.',
  envVars: []
};

interface LicenseFormState {
  key: string;
  email: string;
}

export function SettingsView({ snapshot, onRefresh, themeMode, onThemeChange }: Props): JSX.Element {
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RunnerFormState>({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const [licenseForm, setLicenseForm] = useState<LicenseFormState>({ key: '', email: '' });
  const [licenseLoading, setLicenseLoading] = useState(false);

  const [notifPrefs, setNotifPrefs] = useState({
    enabled: true,
    onApprovalRequest: true,
    onRunComplete: true,
    onRunFailed: true
  });

  const [telemetryPrefs, setTelemetryPrefs] = useState({ enabled: false, webhookUrl: '' });
  const [webhookDraft, setWebhookDraft] = useState('');

  useEffect(() => {
    void commandCenterClient.getNotificationPrefs().then(setNotifPrefs);
    void commandCenterClient.getTelemetryPrefs().then((p) => {
      setTelemetryPrefs(p);
      setWebhookDraft(p.webhookUrl);
    });
  }, []);

  async function updateNotifPref(key: string, value: boolean): Promise<void> {
    try {
      const updated = await commandCenterClient.setNotificationPrefs({ [key]: value });
      setNotifPrefs(updated);
    } catch (err) {
      toast.error(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  function openAdd(): void {
    setEditingId(null);
    setForm({ ...emptyForm });
    setShowForm(true);
  }

  function openEdit(profile: RunnerProfile): void {
    const envEntries = Object.entries(profile.env).map(([key, value]) => ({ key, value, visible: false }));
    setEditingId(profile.id);
    setForm({
      name: profile.name,
      type: profile.type,
      command: profile.type === 'command' ? profile.command : '',
      args: profile.type === 'command' ? profile.args.join(' ') : '',
      workspacePath: profile.workspacePath,
      costPerThousandTokensUsd: String(profile.costPerThousandTokensUsd),
      model: (profile.type === 'openai' || profile.type === 'anthropic') ? profile.model : profile.type === 'ollama' ? profile.model : 'gpt-4o',
      maxTokens: (profile.type === 'openai' || profile.type === 'anthropic') ? String(profile.maxTokens) : '4096',
      systemPrompt: (profile.type === 'openai' || profile.type === 'anthropic') ? profile.systemPrompt : '',
      envVars: envEntries
    });
    setShowForm(true);
  }

  function cancelForm(): void {
    setShowForm(false);
    setEditingId(null);
  }

  function addEnvVar(): void {
    setForm((prev) => ({ ...prev, envVars: [...prev.envVars, { key: '', value: '', visible: false }] }));
  }

  function updateEnvVar(index: number, field: 'key' | 'value', val: string): void {
    setForm((prev) => {
      const envVars = [...prev.envVars];
      envVars[index] = { ...envVars[index], [field]: val };
      return { ...prev, envVars };
    });
  }

  function toggleEnvVarVisible(index: number): void {
    setForm((prev) => {
      const envVars = [...prev.envVars];
      envVars[index] = { ...envVars[index], visible: !envVars[index].visible };
      return { ...prev, envVars };
    });
  }

  function removeEnvVar(index: number): void {
    setForm((prev) => ({ ...prev, envVars: prev.envVars.filter((_, i) => i !== index) }));
  }

  async function handleSave(): Promise<void> {
    if (!form.name.trim()) { toast.error('Name is required.'); return; }
    if (!form.workspacePath.trim()) { toast.error('Workspace path is required.'); return; }
    setSaving(true);
    try {
      const env: Record<string, string> = {};
      for (const v of form.envVars) {
        if (v.key.trim()) env[v.key.trim()] = v.value;
      }
      const cost = parseFloat(form.costPerThousandTokensUsd) || 0;

      if (editingId) {
        const fields: Partial<Omit<RunnerProfile, 'id'>> = {
          name: form.name.trim(),
          workspacePath: form.workspacePath.trim(),
          env,
          costPerThousandTokensUsd: cost
        };
        if (form.type === 'command') {
          (fields as Partial<CommandRunnerProfile>).command = form.command.trim();
          (fields as Partial<CommandRunnerProfile>).args = form.args.split(/\s+/).filter(Boolean);
        } else {
          (fields as Partial<OpenAIRunnerProfile>).model = form.model.trim();
          (fields as Partial<OpenAIRunnerProfile>).maxTokens = parseInt(form.maxTokens, 10) || 4096;
          (fields as Partial<OpenAIRunnerProfile>).systemPrompt = form.systemPrompt;
        }
        await commandCenterClient.updateRunnerProfile(editingId, fields);
        toast.success('Runner profile updated.');
      } else {
        const id = `runner_${Date.now()}`;
        if (form.type === 'command') {
          const profile: CommandRunnerProfile = {
            id,
            name: form.name.trim(),
            type: 'command',
            command: form.command.trim(),
            args: form.args.split(/\s+/).filter(Boolean),
            workspacePath: form.workspacePath.trim(),
            env,
            costPerThousandTokensUsd: cost
          };
          await commandCenterClient.addRunnerProfile(profile);
        } else if (form.type === 'anthropic') {
          const profile: AnthropicRunnerProfile = {
            id,
            name: form.name.trim(),
            type: 'anthropic',
            model: form.model.trim() || 'claude-sonnet-4-20250514',
            workspacePath: form.workspacePath.trim(),
            env,
            costPerThousandTokensUsd: cost,
            maxTokens: parseInt(form.maxTokens, 10) || 4096,
            systemPrompt: form.systemPrompt
          };
          await commandCenterClient.addRunnerProfile(profile);
        } else if (form.type === 'ollama') {
          const profile: OllamaRunnerProfile = {
            id,
            name: form.name.trim(),
            type: 'ollama',
            model: form.model.trim() || 'llama3',
            workspacePath: form.workspacePath.trim(),
            env,
            costPerThousandTokensUsd: cost,
            ollamaHost: env.OLLAMA_HOST || 'http://localhost:11434'
          };
          await commandCenterClient.addRunnerProfile(profile);
        } else if (form.type === 'custom-http') {
          const profile: CustomHttpRunnerProfile = {
            id,
            name: form.name.trim(),
            type: 'custom-http',
            workspacePath: form.workspacePath.trim(),
            env,
            costPerThousandTokensUsd: cost,
            endpointUrl: env.ENDPOINT_URL || '',
            headers: {}
          };
          await commandCenterClient.addRunnerProfile(profile);
        } else {
          const profile: OpenAIRunnerProfile = {
            id,
            name: form.name.trim(),
            type: 'openai',
            model: form.model.trim(),
            workspacePath: form.workspacePath.trim(),
            env,
            costPerThousandTokensUsd: cost,
            maxTokens: parseInt(form.maxTokens, 10) || 4096,
            systemPrompt: form.systemPrompt
          };
          await commandCenterClient.addRunnerProfile(profile);
        }
        toast.success('Runner profile created.');
      }
      setShowForm(false);
      setEditingId(null);
      await onRefresh();
    } catch (err) {
      toast.error(`Failed to save: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(profileId: string): Promise<void> {
    setDeletingId(profileId);
    try {
      await commandCenterClient.removeRunnerProfile(profileId);
      toast.success('Runner profile deleted.');
      await onRefresh();
    } catch (err) {
      toast.error(`Failed to delete: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  }

  async function handleLicenseActivate(): Promise<void> {
    if (!licenseForm.key.trim() || !licenseForm.email.trim()) {
      toast.error('License key and email are required.');
      return;
    }
    setLicenseLoading(true);
    try {
      await commandCenterClient.activateLicense(licenseForm.key, licenseForm.email);
      toast.success('License activated successfully.');
      setLicenseForm({ key: '', email: '' });
      await onRefresh();
    } catch (err) {
      toast.error(`Activation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLicenseLoading(false);
    }
  }

  async function handleLicenseDeactivate(): Promise<void> {
    setLicenseLoading(true);
    try {
      await commandCenterClient.deactivateLicense();
      toast.success('License deactivated.');
      await onRefresh();
    } catch (err) {
      toast.error(`Deactivation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLicenseLoading(false);
    }
  }

  const lic = snapshot.license;

  return (
    <main className="app-shell">
      <header className="view-header">
        <span className="section-label">Runtime</span>
        <h1>Settings</h1>
        <p>Manage runner profiles, environment variables, and your license.</p>
      </header>

      {/* License section */}
      <section className="panel">
        <div className="panel-heading">
          <span className="panel-icon" aria-hidden="true"><Key size={18} /></span>
          <div>
            <h2>License</h2>
            <p>
              Current tier: <strong style={{ textTransform: 'capitalize' }}>{lic.tier}</strong>
              {lic.activated && lic.validUntil && <> &mdash; Valid until {new Date(lic.validUntil).toLocaleDateString()}</>}
            </p>
          </div>
        </div>
        <div className="settings-license-info">
          <div className="settings-limits-row">
            <span>Agents: {lic.maxAgents === 999 ? 'Unlimited' : lic.maxAgents}</span>
            <span>Runners: {lic.maxRunners === 999 ? 'Unlimited' : lic.maxRunners}</span>
            <span>Users: {lic.maxUsers === 999 ? 'Unlimited' : lic.maxUsers}</span>
          </div>
          {lic.features.length > 0 && (
            <div className="settings-features">
              {lic.features.map((f) => (
                <span key={f} className="tag-chip">{f.replace(/_/g, ' ')}</span>
              ))}
            </div>
          )}
        </div>
        {lic.activated ? (
          <div className="form-actions" style={{ marginTop: '0.75rem' }}>
            <button className="secondary-button danger-button" disabled={licenseLoading} onClick={() => void handleLicenseDeactivate()}>
              {licenseLoading ? 'Deactivating...' : 'Deactivate License'}
            </button>
          </div>
        ) : (
          <div className="settings-license-form" style={{ marginTop: '0.75rem' }}>
            <div className="form-row">
              <input
                type="text"
                placeholder="License key (e.g., DEVWORK.… signed key)"
                value={licenseForm.key}
                onChange={(e) => setLicenseForm((prev) => ({ ...prev, key: e.target.value }))}
                className="text-input"
              />
              <input
                type="email"
                placeholder="Email"
                value={licenseForm.email}
                onChange={(e) => setLicenseForm((prev) => ({ ...prev, email: e.target.value }))}
                className="text-input"
              />
              <button className="primary-button" disabled={licenseLoading} onClick={() => void handleLicenseActivate()}>
                {licenseLoading ? 'Activating...' : 'Activate'}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Theme */}
      <section className="panel">
        <div className="panel-heading">
          <span className="panel-icon" aria-hidden="true">{themeMode === 'dark' || (themeMode === 'system' && document.documentElement.getAttribute('data-theme') === 'dark') ? <Moon size={18} /> : <Sun size={18} />}</span>
          <div>
            <h2>Appearance</h2>
            <p>Switch between light, dark, or follow your system preference.</p>
          </div>
        </div>
        <div className="settings-theme-toggle" style={{ padding: '0.75rem 1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {(['light', 'dark', 'system'] as const).map((mode) => (
              <button
                key={mode}
                className={themeMode === mode ? 'primary-button' : 'secondary-button'}
                onClick={() => onThemeChange(mode)}
                style={{ textTransform: 'capitalize' }}
              >
                {mode === 'light' && <Sun size={14} />}
                {mode === 'dark' && <Moon size={14} />}
                {mode}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Notifications */}
      <section className="panel">
        <div className="panel-heading">
          <span className="panel-icon" aria-hidden="true"><Bell size={18} /></span>
          <div>
            <h2>Notifications</h2>
            <p>Desktop notification preferences for system events.</p>
          </div>
        </div>
        <div style={{ padding: '0.75rem 1rem' }}>
          {[
            { key: 'enabled', label: 'Enable desktop notifications' },
            { key: 'onApprovalRequest', label: 'Approval requests' },
            { key: 'onRunComplete', label: 'Run completions' },
            { key: 'onRunFailed', label: 'Run failures' }
          ].map(({ key, label }) => (
            <label key={key} className="settings-toggle-row">
              <input
                type="checkbox"
                checked={notifPrefs[key as keyof typeof notifPrefs]}
                onChange={(e) => void updateNotifPref(key, e.target.checked)}
                disabled={key !== 'enabled' && !notifPrefs.enabled}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Telemetry */}
      <section className="panel">
        <div className="panel-heading">
          <span className="panel-icon" aria-hidden="true"><BarChart3 size={18} /></span>
          <div>
            <h2>Telemetry</h2>
            <p>Anonymous usage analytics (opt-in). No data leaves your machine unless a webhook is configured.</p>
          </div>
        </div>
        <div style={{ padding: '0.75rem 1rem' }}>
          <label className="settings-toggle-row">
            <input
              type="checkbox"
              checked={telemetryPrefs.enabled}
              onChange={async (e) => {
                try {
                  const updated = await commandCenterClient.setTelemetryPrefs({ enabled: e.target.checked });
                  setTelemetryPrefs(updated);
                } catch (err) {
                  toast.error(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
                }
              }}
            />
            <span>Enable usage tracking</span>
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', alignItems: 'center' }}>
            <input
              className="text-input"
              style={{ flex: 1 }}
              placeholder="Webhook URL (optional)"
              value={webhookDraft}
              onChange={(e) => setWebhookDraft(e.target.value)}
              disabled={!telemetryPrefs.enabled}
            />
            <button
              className="secondary-button"
              disabled={!telemetryPrefs.enabled || webhookDraft === telemetryPrefs.webhookUrl}
              onClick={async () => {
                try {
                  const updated = await commandCenterClient.setTelemetryPrefs({ webhookUrl: webhookDraft });
                  setTelemetryPrefs(updated);
                  toast.success('Webhook URL saved.');
                } catch (err) {
                  toast.error(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
                }
              }}
            >Save</button>
          </div>
        </div>
      </section>

      {/* Backup & Restore */}
      <section className="panel">
        <div className="panel-heading">
          <span className="panel-icon" aria-hidden="true"><Database size={18} /></span>
          <div>
            <h2>Backup &amp; Restore</h2>
            <p>Export and import your data for safekeeping.</p>
          </div>
        </div>
        <div style={{ padding: '0.75rem 1rem', display: 'flex', gap: '0.5rem' }}>
          <button
            className="secondary-button"
            onClick={async () => {
              try {
                const backupPath = await commandCenterClient.autoBackup('.');
                toast.success(`Backup created: ${backupPath}`);
              } catch (err) {
                toast.error(`Backup failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
              }
            }}
          >Create Backup</button>
        </div>
      </section>

      {/* Runner profiles */}
      <section className="panel">
        <div className="panel-heading">
          <span className="panel-icon" aria-hidden="true"><Settings size={18} /></span>
          <div>
            <h2>Runner profiles</h2>
            <p>{snapshot.runnerProfiles.length} execution profiles</p>
          </div>
          <button className="primary-button" style={{ marginLeft: 'auto' }} onClick={openAdd}>
            <Plus size={15} /> Add Runner
          </button>
        </div>

        {showForm && (
          <div className="settings-runner-form" style={{ padding: '1rem', borderBottom: '1px solid var(--border)' }}>
            <div className="form-row">
              <label>
                Name
                <input type="text" className="text-input" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
              </label>
              <label>
                Type
                <select className="text-input" value={form.type} disabled={!!editingId} onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as ProfileType }))}>
                  <option value="command">Command</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic Claude</option>
                  <option value="ollama">Ollama (Local)</option>
                  <option value="custom-http">Custom HTTP</option>
                </select>
              </label>
            </div>

            {form.type === 'command' ? (
              <div className="form-row">
                <label>
                  Command
                  <input type="text" className="text-input" placeholder="e.g., node" value={form.command} onChange={(e) => setForm((prev) => ({ ...prev, command: e.target.value }))} />
                </label>
                <label>
                  Args
                  <input type="text" className="text-input" placeholder="e.g., scripts/agent.mjs" value={form.args} onChange={(e) => setForm((prev) => ({ ...prev, args: e.target.value }))} />
                </label>
              </div>
            ) : (
              <div className="form-row">
                <label>
                  Model
                  <input type="text" className="text-input" placeholder="gpt-4o" value={form.model} onChange={(e) => setForm((prev) => ({ ...prev, model: e.target.value }))} />
                </label>
                <label>
                  Max tokens
                  <input type="number" className="text-input" value={form.maxTokens} onChange={(e) => setForm((prev) => ({ ...prev, maxTokens: e.target.value }))} />
                </label>
              </div>
            )}

            {(form.type === 'openai' || form.type === 'anthropic') && (
              <div className="form-row">
                <label style={{ flex: 1 }}>
                  System prompt
                  <textarea className="text-input" rows={3} value={form.systemPrompt} onChange={(e) => setForm((prev) => ({ ...prev, systemPrompt: e.target.value }))} />
                </label>
              </div>
            )}

            <div className="form-row">
              <label>
                Workspace path
                <input type="text" className="text-input" placeholder="/path/to/workspace" value={form.workspacePath} onChange={(e) => setForm((prev) => ({ ...prev, workspacePath: e.target.value }))} />
              </label>
              <label>
                Cost per 1K tokens ($)
                <input type="number" step="0.001" className="text-input" value={form.costPerThousandTokensUsd} onChange={(e) => setForm((prev) => ({ ...prev, costPerThousandTokensUsd: e.target.value }))} />
              </label>
            </div>

            {/* Env vars editor */}
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <strong>Environment Variables</strong>
                <button className="secondary-button" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }} onClick={addEnvVar}>
                  <Plus size={12} /> Add
                </button>
              </div>
              {form.envVars.map((v, i) => (
                <div key={i} className="form-row" style={{ marginBottom: '0.25rem' }}>
                  <input type="text" className="text-input" placeholder="KEY" value={v.key} onChange={(e) => updateEnvVar(i, 'key', e.target.value)} style={{ flex: 1 }} />
                  <div style={{ position: 'relative', flex: 2, display: 'flex' }}>
                    <input
                      type={v.visible ? 'text' : 'password'}
                      className="text-input"
                      placeholder="value"
                      value={v.value}
                      onChange={(e) => updateEnvVar(i, 'value', e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button className="secondary-button" style={{ padding: '0.25rem', marginLeft: '0.25rem' }} onClick={() => toggleEnvVarVisible(i)} title={v.visible ? 'Hide' : 'Show'}>
                      {v.visible ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <button className="secondary-button danger-button" style={{ padding: '0.25rem' }} onClick={() => removeEnvVar(i)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

            <div className="form-actions" style={{ marginTop: '0.75rem' }}>
              <button className="primary-button" disabled={saving} onClick={() => void handleSave()}>
                {saving ? 'Saving...' : editingId ? 'Update Profile' : 'Create Profile'}
              </button>
              <button className="secondary-button" onClick={cancelForm}>Cancel</button>
            </div>
          </div>
        )}

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Command / Model</th>
                <th>Workspace</th>
                <th>Cost rate</th>
                <th>Env vars</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.runnerProfiles.map((profile) => (
                <tr key={profile.id}>
                  <td>{profile.name}</td>
                  <td>{profile.type}</td>
                  <td>{profile.type === 'command' ? `${profile.command} ${profile.args.join(' ')}` : profile.type === 'custom-http' ? 'HTTP endpoint' : 'model' in profile ? profile.model : '—'}</td>
                  <td>{profile.workspacePath}</td>
                  <td>${profile.costPerThousandTokensUsd.toFixed(4)} / 1K</td>
                  <td>{Object.keys(profile.env).length} vars</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button className="secondary-button" style={{ padding: '0.25rem 0.5rem' }} onClick={() => openEdit(profile)}>
                        <Edit size={14} />
                      </button>
                      <button
                        className="secondary-button danger-button"
                        style={{ padding: '0.25rem 0.5rem' }}
                        disabled={deletingId === profile.id}
                        onClick={() => setConfirmDelete(profile.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {snapshot.runnerProfiles.length === 0 && (
                <tr>
                  <td colSpan={7}>No runner profiles configured. Click &quot;Add Runner&quot; to create one.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete runner profile?"
          message="This will permanently remove this runner profile. Agents using it will no longer be able to launch runs."
          onConfirm={() => void handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </main>
  );
}
