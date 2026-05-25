import { Check, Sparkles } from 'lucide-react';
import type { DashboardSnapshot } from '../../../shared/domain';
import type { AppTab } from './TabNav';

interface Props {
  snapshot: DashboardSnapshot;
  onNavigate(tab: AppTab): void;
}

export function GettingStarted({ snapshot, onNavigate }: Props) {
  const hasMission = snapshot.missions.length > 0;
  const hasRun = snapshot.runs.length > 0;
  const hasApproval = snapshot.approvals.some((a) => a.status === 'approved' || a.status === 'rejected');
  const hasWorkflow = snapshot.workflows.length > 0;

  const items = [
    { done: hasMission, label: 'Create a mission', action: undefined },
    { done: hasRun, label: 'Launch your first agent run', action: undefined },
    { done: hasApproval, label: 'Review an approval request', action: undefined },
    { done: hasWorkflow, label: 'Create a workflow', action: () => onNavigate('workflows') }
  ];

  const completed = items.filter((i) => i.done).length;
  if (completed === items.length) return null;

  return (
    <section className="panel getting-started-panel">
      <div className="panel-heading">
        <span className="panel-icon" aria-hidden="true">
          <Sparkles size={18} />
        </span>
        <div>
          <h2>Getting started</h2>
          <p>{completed}/{items.length} completed</p>
        </div>
      </div>
      <ul className="checklist">
        {items.map((item) => (
          <li key={item.label} className={`checklist-item ${item.done ? 'done' : ''}`}>
            <span className="checklist-icon">{item.done ? <Check size={13} /> : ''}</span>
            {item.action && !item.done ? (
              <button className="checklist-link" onClick={item.action}>{item.label}</button>
            ) : (
              <span>{item.label}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
