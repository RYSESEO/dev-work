import { Activity, ClipboardCheck } from 'lucide-react';
import type { DashboardSnapshot } from '../../../shared/domain';
import type { AppTab } from './TabNav';

interface Props {
  snapshot: DashboardSnapshot;
  onNavigate(tab: AppTab): void;
}

export function TasksView({ snapshot, onNavigate }: Props) {
  const agentsById = new Map(snapshot.agents.map((agent) => [agent.id, agent.name]));

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
