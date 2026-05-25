import { ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import type { DashboardSnapshot } from '../../../shared/domain';
import { commandCenterClient } from '../api/client';
import { useToast } from './ToastProvider';

interface Props {
  snapshot: DashboardSnapshot;
  onRefresh(): Promise<void>;
}

export function ApprovalQueue({ snapshot, onRefresh }: Props) {
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const pending = snapshot.approvals.filter((approval) => approval.status === 'pending');

  async function approve(id: string): Promise<void> {
    setBusyId(id);
    try {
      await commandCenterClient.approveRequest(id);
      toast.success('Request approved.');
      await onRefresh();
    } catch (err) {
      toast.error(`Failed to approve: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string): Promise<void> {
    setBusyId(id);
    try {
      await commandCenterClient.rejectRequest(id, 'Rejected from dashboard');
      toast.success('Request rejected.');
      await onRefresh();
    } catch (err) {
      toast.error(`Failed to reject: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className={pending.length > 0 ? 'panel approval-panel has-pending' : 'panel approval-panel'}>
      <div className="panel-heading">
        <span className="panel-icon" aria-hidden="true">
          <ShieldAlert size={18} />
        </span>
        <div>
          <h2>Approvals</h2>
          <p>Session grants clear future repeats for the active run.</p>
        </div>
      </div>
      <ul className="item-list">
        {pending.map((approval) => {
          const isBusy = busyId === approval.id;
          return (
            <li className="item" key={approval.id}>
              <div className="item-title-row">
                <strong>{approval.title}</strong>
                <span className={`risk-chip risk-${approval.riskLevel}`}>{approval.riskLevel}</span>
              </div>
              <p>{approval.description}</p>
              <div className="item-meta">
                <span>{approval.scope.kind}</span>
                <span>{approval.runId}</span>
              </div>
              <div className="button-row">
                <button className="primary-button" disabled={isBusy} onClick={() => void approve(approval.id)}>
                  {isBusy ? 'Processing...' : 'Approve Session'}
                </button>
                <button className="danger-button" disabled={isBusy} onClick={() => void reject(approval.id)}>
                  Reject
                </button>
              </div>
            </li>
          );
        })}
        {pending.length === 0 && <li className="empty-row">No approvals waiting.</li>}
      </ul>
    </section>
  );
}
