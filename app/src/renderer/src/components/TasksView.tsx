import { Activity, ClipboardCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { DashboardSnapshot } from '../../../shared/domain';
import { commandCenterClient } from '../api/client';
import type { AppTab } from './TabNav';
import { useToast } from './ToastProvider';

interface Props {
  snapshot: DashboardSnapshot;
  onRefresh(): Promise<void>;
  onNavigate(tab: AppTab): void;
}

export function TasksView({ snapshot, onRefresh, onNavigate }: Props) {
  const toast = useToast();
  const agentsById = new Map(snapshot.agents.map((agent) => [agent.id, agent.name]));
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(taskId: string, taskTitle: string): Promise<void> {
    setDeletingId(taskId);
    try {
      await commandCenterClient.deleteTask(taskId);
      toast.success(`Task "${taskTitle}" deleted.`);
      await onRefresh();
    } catch (err) {
      toast.error(`Failed to delete: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="app-shell">
      <header className="view-header">
        <span className="section-label">Work queue</span>
        <h1>Tasks</h1>
        <p>Mission work items, priorities, assignments, and execution state.</p>
      </header>
      <section className="panel">
        <div className="panel-heading">
          <span className="panel-icon" aria-hidden="true">
            <ClipboardCheck size={18} />
          </span>
          <div>
            <h2>Task ledger</h2>
            <p>{snapshot.tasks.length} tracked tasks</p>
          </div>
        </div>
        {snapshot.tasks.length > 0 ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Assignee</th>
                  <th>Description</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.tasks.map((task) => (
                  <tr key={task.id}>
                    <td>{task.title}</td>
                    <td><span className={`status-chip status-${task.status}`}>{task.status}</span></td>
                    <td><span className={`priority-chip priority-${task.priority}`}>{task.priority}</span></td>
                    <td>{task.assigneeAgentId ? agentsById.get(task.assigneeAgentId) ?? task.assigneeAgentId : 'Unassigned'}</td>
                    <td>{task.description}</td>
                    <td>
                      <button
                        className="icon-button-sm danger"
                        disabled={deletingId === task.id}
                        onClick={() => void handleDelete(task.id, task.title)}
                        title="Delete task"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rich-empty-state">
            <Activity size={36} />
            <h3>No tasks yet</h3>
            <p>Tasks are created when you launch agent runs from Mission Control.</p>
            <button className="primary-button" onClick={() => onNavigate('mission')}>Go to Mission Control</button>
          </div>
        )}
      </section>
    </main>
  );
}
