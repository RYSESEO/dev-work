import { Settings } from 'lucide-react';
import type { DashboardSnapshot } from '../../../shared/domain';

export function SettingsView({ snapshot }: { snapshot: DashboardSnapshot }) {
  return (
    <main className="app-shell">
      <header className="view-header">
        <span className="section-label">Runtime</span>
        <h1>Runner settings</h1>
        <p>Command runners, workspace roots, and token cost assumptions used by agents.</p>
      </header>
      <section className="panel">
        <div className="panel-heading">
          <span className="panel-icon" aria-hidden="true">
            <Settings size={18} />
          </span>
          <div>
            <h2>Runner profiles</h2>
            <p>{snapshot.runnerProfiles.length} execution profiles</p>
          </div>
        </div>
        <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Command</th>
              <th>Args</th>
              <th>Workspace</th>
              <th>Cost rate</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.runnerProfiles.map((profile) => (
              <tr key={profile.id}>
                <td>{profile.name}</td>
                <td>{profile.command}</td>
                <td>{profile.args.join(' ')}</td>
                <td>{profile.workspacePath}</td>
                <td>${profile.costPerThousandTokensUsd.toFixed(4)} / 1K tokens</td>
              </tr>
            ))}
            {snapshot.runnerProfiles.length === 0 && (
              <tr>
                <td colSpan={5}>No runner profiles configured.</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </section>
    </main>
  );
}
