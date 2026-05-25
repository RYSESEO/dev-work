import { Download, Package, Star, Trash2 } from 'lucide-react';
import { useState, type JSX } from 'react';
import type { DashboardSnapshot } from '../../../shared/domain';
import { commandCenterClient } from '../api/client';
import { useToast } from './ToastProvider';

interface Props {
  snapshot: DashboardSnapshot;
  onRefresh(): Promise<void>;
}

export function MarketplaceView({ snapshot, onRefresh }: Props) {
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const runners = snapshot.marketplace.filter((e) => e.category === 'runner');
  const plugins = snapshot.marketplace.filter((e) => e.category === 'plugin');

  async function handleInstall(entryId: string, name: string): Promise<void> {
    setBusyId(entryId);
    try {
      await commandCenterClient.installMarketplaceEntry(entryId);
      toast.success(`${name} installed successfully.`);
      await onRefresh();
    } catch (err) {
      toast.error(`Failed to install ${name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setBusyId(null);
    }
  }

  async function handleUninstall(entryId: string, name: string): Promise<void> {
    setBusyId(entryId);
    try {
      await commandCenterClient.uninstallMarketplaceEntry(entryId);
      toast.success(`${name} uninstalled.`);
      await onRefresh();
    } catch (err) {
      toast.error(`Failed to uninstall ${name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setBusyId(null);
    }
  }

  function renderCard(entry: typeof runners[number]): JSX.Element {
    const isBusy = busyId === entry.id;
    return (
      <article key={entry.id} className="marketplace-card">
        <div className="marketplace-card-header">
          <strong>{entry.name}</strong>
          <span className="marketplace-version">v{entry.version}</span>
        </div>
        <p>{entry.description}</p>
        <div className="marketplace-meta">
          <span className="marketplace-author">{entry.author}</span>
          <span className="marketplace-rating"><Star size={13} /> {entry.rating}</span>
          <span className="marketplace-downloads"><Download size={13} /> {entry.downloads}</span>
        </div>
        <div className="marketplace-tags">
          {entry.tags.map((tag) => (
            <span key={tag} className="tag-chip">{tag}</span>
          ))}
        </div>
        <div className="marketplace-actions">
          {entry.installed ? (
            <button className="secondary-button danger-button" disabled={isBusy} onClick={() => void handleUninstall(entry.id, entry.name)}>
              <Trash2 size={15} /> {isBusy ? 'Removing...' : 'Uninstall'}
            </button>
          ) : (
            <button className="primary-button" disabled={isBusy} onClick={() => void handleInstall(entry.id, entry.name)}>
              <Download size={15} /> {isBusy ? 'Installing...' : 'Install'}
            </button>
          )}
          {entry.installed && <span className="installed-badge">Installed</span>}
        </div>
      </article>
    );
  }

  return (
    <main className="app-shell">
      <header className="view-header">
        <span className="section-label">Marketplace</span>
        <h1>Runners & Plugins</h1>
        <p>Browse, install, and manage runners and plugins to extend your command center.</p>
      </header>

      <section className="panel">
        <div className="panel-heading">
          <span className="panel-icon" aria-hidden="true"><Package size={18} /></span>
          <div>
            <h2>Available Runners</h2>
            <p>{runners.length} runner packages</p>
          </div>
        </div>
        <div className="marketplace-grid">
          {runners.map(renderCard)}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <span className="panel-icon" aria-hidden="true"><Package size={18} /></span>
          <div>
            <h2>Available Plugins</h2>
            <p>{plugins.length} plugin packages</p>
          </div>
        </div>
        <div className="marketplace-grid">
          {plugins.map(renderCard)}
        </div>
      </section>
    </main>
  );
}
