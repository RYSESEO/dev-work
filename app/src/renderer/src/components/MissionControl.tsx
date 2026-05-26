import { Archive, Command, Edit2, RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { DashboardSnapshot, MissionStatus } from '../../../shared/domain';
import { commandCenterClient } from '../api/client';
import { ActivityTimeline } from './ActivityTimeline';
import { AgentRoster } from './AgentRoster';
import { ApprovalQueue } from './ApprovalQueue';
import { ConfirmDialog } from './ConfirmDialog';
import { GettingStarted } from './GettingStarted';
import { MetricStrip } from './MetricStrip';
import { MissionCreator } from './MissionCreator';
import { OneClickLaunchers } from './OneClickLaunchers';
import type { AppTab } from './TabNav';
import { TaskBoard } from './TaskBoard';
import { useToast } from './ToastProvider';

interface Props {
  snapshot: DashboardSnapshot;
  onRefresh(): Promise<void>;
  onNavigate(tab: AppTab): void;
}

export function MissionControl({ snapshot, onRefresh, onNavigate }: Props) {
  const toast = useToast();
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editGoal, setEditGoal] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const mission = snapshot.missions.find((m) => m.id === activeMissionId) ?? snapshot.missions[0] ?? null;
  const activeRuns = snapshot.runs.filter((run) => run.status === 'running' || run.status === 'paused_for_approval').length;
  const pendingApprovals = snapshot.approvals.filter((approval) => approval.status === 'pending').length;

  function startEditing(): void {
    if (!mission) return;
    setEditTitle(mission.title);
    setEditGoal(mission.goal);
    setEditing(true);
  }

  async function saveEdit(): Promise<void> {
    if (!mission || !editTitle.trim()) return;
    try {
      await commandCenterClient.updateMission(mission.id, { title: editTitle.trim(), goal: editGoal.trim() });
      toast.success('Mission updated.');
      setEditing(false);
      await onRefresh();
    } catch (err) {
      toast.error(`Failed to update: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  async function handleArchive(): Promise<void> {
    if (!mission) return;
    try {
      const newStatus: MissionStatus = mission.status === 'archived' ? 'active' : 'archived';
      await commandCenterClient.updateMission(mission.id, { status: newStatus });
      toast.success(newStatus === 'archived' ? 'Mission archived.' : 'Mission restored.');
      await onRefresh();
    } catch (err) {
      toast.error(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  async function handleDelete(): Promise<void> {
    if (!mission) return;
    try {
      await commandCenterClient.deleteMission(mission.id);
      toast.success('Mission deleted.');
      setConfirmDelete(false);
      setActiveMissionId(null);
      await onRefresh();
    } catch (err) {
      toast.error(`Failed to delete: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  return (
    <main className="app-shell mission-shell">
      <header className="command-header">
        <div className="command-copy">
          <span className="section-label">Mission Studio</span>
          {editing ? (
            <div className="inline-edit-row">
              <input className="input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Mission title" />
              <button className="primary-button" onClick={() => void saveEdit()}>Save</button>
              <button className="secondary-button" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          ) : (
            <h1>{mission?.title ?? 'No active mission'}</h1>
          )}
          {snapshot.missions.length > 1 && !editing && (
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
          {editing ? (
            <input className="input" value={editGoal} onChange={(e) => setEditGoal(e.target.value)} placeholder="Mission goal" style={{ marginTop: 6 }} />
          ) : (
            <p className="mission-goal">{mission?.goal ?? 'Create a mission to begin coordinating agents.'}</p>
          )}
        </div>
        <div className="command-actions">
          <div className="status-pill">
            <span className={activeRuns > 0 ? 'status-dot live' : 'status-dot'} />
            {mission?.status ?? 'standby'}
          </div>
          {mission && !editing && (
            <>
              <button className="icon-button-sm" onClick={startEditing} title="Edit mission">
                <Edit2 size={15} />
              </button>
              <button className="icon-button-sm" onClick={() => void handleArchive()} title={mission.status === 'archived' ? 'Restore' : 'Archive'}>
                <Archive size={15} />
              </button>
              <button className="icon-button-sm danger" onClick={() => setConfirmDelete(true)} title="Delete mission">
                <Trash2 size={15} />
              </button>
            </>
          )}
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
          <GettingStarted snapshot={snapshot} onNavigate={onNavigate} />
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

      {confirmDelete && (
        <ConfirmDialog
          title="Delete mission?"
          message={`"${mission?.title}" and all its data will be permanently removed. This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={() => void handleDelete()}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </main>
  );
}
