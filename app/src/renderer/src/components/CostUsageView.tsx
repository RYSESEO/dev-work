import { BarChart3 } from 'lucide-react';
import type { DashboardSnapshot } from '../../../shared/domain';

export function CostUsageView({ snapshot }: { snapshot: DashboardSnapshot }) {
  const rows = snapshot.agents.map((agent) => {
    const runs = snapshot.runs.filter((run) => run.agentProfileId === agent.id);
    return {
      agent,
      runCount: runs.length,
      estimatedTokens: runs.reduce((sum, run) => sum + run.estimatedTokens, 0),
      estimatedCostUsd: runs.reduce((sum, run) => sum + run.estimatedCostUsd, 0),
      approvals: snapshot.approvals.filter((approval) => runs.some((run) => run.id === approval.runId)).length
    };
  });
  const totalCost = rows.reduce((sum, row) => sum + row.estimatedCostUsd, 0);
  const totalTokens = rows.reduce((sum, row) => sum + row.estimatedTokens, 0);

  return (
    <main className="app-shell">
      <header className="view-header">
        <span className="section-label">Usage</span>
        <h1>Cost and usage</h1>
        <p>Per-agent estimates for tokens, cost, runs, and approval pressure.</p>
      </header>
      <section className="metric-strip">
        <article className="metric">
          <span className="metric-label">Total estimated tokens</span>
          <strong className="metric-value">{totalTokens.toLocaleString()}</strong>
        </article>
        <article className="metric">
          <span className="metric-label">Total estimated cost</span>
          <strong className="metric-value">${totalCost.toFixed(4)}</strong>
        </article>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <span className="panel-icon" aria-hidden="true">
            <BarChart3 size={18} />
          </span>
          <div>
            <h2>Usage by agent</h2>
            <p>Costs are local estimates from runner usage events.</p>
          </div>
        </div>
        <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Agent</th>
              <th>Role</th>
              <th>Runs</th>
              <th>Tokens</th>
              <th>Cost</th>
              <th>Approvals</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ agent, runCount, estimatedTokens, estimatedCostUsd, approvals }) => (
              <tr key={agent.id}>
                <td>{agent.name}</td>
                <td>{agent.role}</td>
                <td>{runCount}</td>
                <td>{estimatedTokens.toLocaleString()}</td>
                <td>${estimatedCostUsd.toFixed(4)}</td>
                <td>{approvals}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6}>No usage recorded yet.</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </section>
    </main>
  );
}
