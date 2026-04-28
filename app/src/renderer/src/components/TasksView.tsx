import { ClipboardCheck } from 'lucide-react';
import type { DashboardSnapshot } from '../../../shared/domain';

export function TasksView({ snapshot }: { snapshot: DashboardSnapshot }) {
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
                <td>{task.status}</td>
                <td>{task.priority}</td>
                <td>{task.assigneeAgentId ? agentsById.get(task.assigneeAgentId) ?? task.assigneeAgentId : 'Unassigned'}</td>
                <td>{task.description}</td>
              </tr>
            ))}
            {snapshot.tasks.length === 0 && (
              <tr>
                <td colSpan={5}>No tasks yet.</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </section>
    </main>
  );
}
