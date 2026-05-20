import { Bot } from 'lucide-react';
import type { DashboardSnapshot } from '../../../shared/domain';

export function AgentsView({ snapshot }: { snapshot: DashboardSnapshot }) {
  const runsByAgent = new Map<string, typeof snapshot.runs[number]>();
  for (const run of snapshot.runs) {
    const existing = runsByAgent.get(run.agentProfileId);
    if (!existing || (run.startedAt ?? '') > (existing.startedAt ?? '')) {
      runsByAgent.set(run.agentProfileId, run);
    }
  }

  return (
    <main className="app-shell">
      <header className="view-header">
        <span className="section-label">Roster</span>
        <h1>Agents</h1>
        <p>Each profile, its assigned runner, current run state, and reliability counters.</p>
      </header>
      <section className="panel">
        <div className="panel-heading">
          <span className="panel-icon" aria-hidden="true">
            <Bot size={18} />
          </span>
          <div>
            <h2>Agent fleet</h2>
            <p>{snapshot.agents.length} configured agents</p>
          </div>
        </div>
        <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Status</th>
              <th>Current run</th>
              <th>Success</th>
              <th>Failed</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.agents.map((agent) => {
              const run = runsByAgent.get(agent.id);
              return (
                <tr key={agent.id}>
                  <td>{agent.name}</td>
                  <td>{agent.role}</td>
                  <td>{agent.status}</td>
                  <td>{run ? `${run.id} | ${run.status}` : 'Idle'}</td>
                  <td>{agent.successCount}</td>
                  <td>{agent.failureCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </section>
    </main>
  );
}
