import { Command, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import type { DashboardSnapshot } from '../../../shared/domain';
import { ActivityTimeline } from './ActivityTimeline';
import { AgentRoster } from './AgentRoster';
import { ApprovalQueue } from './ApprovalQueue';
import { MetricStrip } from './MetricStrip';
import { MissionCreator } from './MissionCreator';
import { OneClickLaunchers } from './OneClickLaunchers';
import { TaskBoard } from './TaskBoard';

interface Props {
  snapshot: DashboardSnapshot;
  onRefresh(): Promise<void>;
}

export function MissionControl({ snapshot, onRefresh }: Props) {
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null);
  const mission = snapshot.missions.find((m) => m.id === activeMissionId) ?? snapshot.missions[0] ?? null;
  const activeRuns = snapshot.runs.filter((run) => run.status === 'running' || run.status === 'paused_for_approval').length;
  const pendingApprovals = snapshot.approvals.filter((approval) => approval.status === 'pending').length;

  return (
    <main className="app-shell mission-shell">
      <header className="command-header">
        <div className="command-copy">
          <span className="section-label">Mission Studio</span>
          <h1>{mission?.title ?? 'No active mission'}</h1>
          {snapshot.missions.length > 1 && (
            <select
              className="mission-selector"
              value={mission?.id ?? ''}
              onChange={(e) => setActiveMissionId(e.target.value)}
              aria-label="Select mission"
            >
              {snapshot.missions.map((m) => (
                <option key={m.id} value={m.id}>{m.title}</option>
              ))}
            </select>
          )}
          <p className="mission-goal">{mission?.goal ?? 'Create a mission to begin coordinating agents.'}</p>
        </div>
        <div className="command-actions">
          <div className="status-pill">
            <span className={activeRuns > 0 ? 'status-dot live' : 'status-dot'} />
            {mission?.status ?? 'standby'}
          </div>
          <button className="secondary-button icon-button" onClick={() => void onRefresh()}>
            <RefreshCw size={17} aria-hidden="true" />
            Refresh
          </button>
        </div>
        <div className="command-input" aria-label="Mission command context">
          <Command size={18} aria-hidden="true" />
          <span>Coordinate agents around the current mission</span>
          <strong>
            {activeRuns} active / {pendingApprovals} waiting
          </strong>
        </div>
      </header>
      <MetricStrip snapshot={snapshot} />
      <section className="mission-grid">
        <aside className="mission-left">
          {snapshot.missions.length === 0 ? (
            <MissionCreator onRefresh={onRefresh} />
          ) : (
            <OneClickLaunchers snapshot={snapshot} onRefresh={onRefresh} />
          )}
        </aside>
        <section className="mission-center">
          <TaskBoard snapshot={snapshot} />
          <ApprovalQueue snapshot={snapshot} onRefresh={onRefresh} />
        </section>
        <aside className="mission-right">
          <AgentRoster snapshot={snapshot} />
          <ActivityTimeline snapshot={snapshot} />
        </aside>
      </section>
    </main>
  );
}
