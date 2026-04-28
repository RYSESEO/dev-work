import { GitBranch, UserRound } from 'lucide-react';
import type { DashboardSnapshot } from '../../../shared/domain';

export function TaskBoard({ snapshot }: { snapshot: DashboardSnapshot }) {
  const agentsById = new Map(snapshot.agents.map((agent) => [agent.id, agent]));

  return (
    <section className="panel task-panel">
      <div className="panel-heading">
        <span className="panel-icon" aria-hidden="true">
          <GitBranch size={18} />
        </span>
        <div>
          <h2>Tasks</h2>
          <p>Prioritized work moving through the agent crew.</p>
        </div>
      </div>
      <ul className="item-list">
        {snapshot.tasks.map((task) => (
          <li className="item" key={task.id}>
            <div className="item-title-row">
              <strong>{task.title}</strong>
              <span className={`status-chip status-${task.status}`}>{task.status}</span>
            </div>
            <p>{task.description}</p>
            <div className="item-meta">
              <span className={`priority-chip priority-${task.priority}`}>{task.priority}</span>
              <span>
                <UserRound size={14} aria-hidden="true" />
                {task.assigneeAgentId ? agentsById.get(task.assigneeAgentId)?.name ?? 'Assigned' : 'Unassigned'}
              </span>
            </div>
          </li>
        ))}
        {snapshot.tasks.length === 0 && <li className="empty-row">No tasks yet.</li>}
      </ul>
    </section>
  );
}
