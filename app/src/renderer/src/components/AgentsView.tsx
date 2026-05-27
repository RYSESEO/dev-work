import { Bot, FileText } from 'lucide-react';
import { useState, type JSX } from 'react';
import type { DashboardSnapshot } from '../../../shared/domain';
import { RunLogViewer } from './RunLogViewer';

export function AgentsView({ snapshot }: { snapshot: DashboardSnapshot }): JSX.Element {
  const [viewingLogRunId, setViewingLogRunId] = useState<string | null>(null);
  const viewingRun = viewingLogRunId ? snapshot.runs.find((r) => r.id === viewingLogRunId) : null;

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
              <th>Log</th>
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
                  <td>
                    {run && (
                      <button
                        className="secondary-button"
                        style={{ padding: '0.2rem 0.4rem' }}
                        onClick={() => setViewingLogRunId(run.id)}
                        title="View run log"
                      >
                        <FileText size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </section>

      {viewingLogRunId && viewingRun && (
        <RunLogViewer
          runId={viewingLogRunId}
          runStatus={viewingRun.status}
          onClose={() => setViewingLogRunId(null)}
        />
      )}
    </main>
  );
}
