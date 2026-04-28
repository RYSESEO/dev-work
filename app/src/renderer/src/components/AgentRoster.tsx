import { Bot } from 'lucide-react';
import type { DashboardSnapshot } from '../../../shared/domain';

export function AgentRoster({ snapshot }: { snapshot: DashboardSnapshot }) {
  const activeRunByAgent = new Map(snapshot.runs.map((run) => [run.agentProfileId, run]));

  return (
    <section className="panel compact-panel">
      <div className="panel-heading">
        <span className="panel-icon" aria-hidden="true">
          <Bot size={18} />
        </span>
        <div>
          <h2>Agents</h2>
          <p>Live capacity and run state.</p>
        </div>
      </div>
      <ul className="item-list">
        {snapshot.agents.map((agent) => {
          const run = activeRunByAgent.get(agent.id);
          return (
            <li className="item" key={agent.id}>
              <div className="agent-row">
                <span className={`status-dot ${agent.status === 'running' ? 'live' : ''}`} />
                <div>
                  <strong>{agent.name}</strong>
                  <p>{agent.role}</p>
                </div>
              </div>
              <div className="item-meta">
                <span>{agent.status}</span>
                <span>{run ? run.status : 'no active run'}</span>
                <span>success {agent.successCount}</span>
                <span>failed {agent.failureCount}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
