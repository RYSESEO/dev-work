import { Activity, Banknote, ShieldAlert, TimerReset } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { DashboardSnapshot } from '../../../shared/domain';

export function MetricStrip({ snapshot }: { snapshot: DashboardSnapshot }) {
  const activeRuns = snapshot.runs.filter((run) => run.status === 'running' || run.status === 'paused_for_approval').length;
  const pendingApprovals = snapshot.approvals.filter((approval) => approval.status === 'pending').length;
  const estimatedCost = snapshot.runs.reduce((sum, run) => sum + run.estimatedCostUsd, 0);
  const estimatedTokens = snapshot.runs.reduce((sum, run) => sum + run.estimatedTokens, 0);

  return (
    <section className="metric-strip" aria-label="Mission metrics">
      <Metric label="Active runs" value={activeRuns.toString()} icon={Activity} />
      <Metric label="Pending approvals" value={pendingApprovals.toString()} icon={ShieldAlert} />
      <Metric label="Estimated tokens" value={estimatedTokens.toLocaleString()} icon={TimerReset} />
      <Metric label="Estimated cost" value={`$${estimatedCost.toFixed(4)}`} icon={Banknote} />
    </section>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <article className="metric">
      <span className="metric-icon" aria-hidden="true">
        <Icon size={18} />
      </span>
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
    </article>
  );
}
