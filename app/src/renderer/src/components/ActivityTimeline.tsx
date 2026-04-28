import { Radio } from 'lucide-react';
import type { DashboardSnapshot } from '../../../shared/domain';

export function ActivityTimeline({ snapshot }: { snapshot: DashboardSnapshot }) {
  const events = [...snapshot.events].slice(-8).reverse();

  return (
    <section className="panel compact-panel">
      <div className="panel-heading">
        <span className="panel-icon" aria-hidden="true">
          <Radio size={18} />
        </span>
        <div>
          <h2>Significant events</h2>
          <p>Recent signals from active runs.</p>
        </div>
      </div>
      <ul className="item-list">
        {events.map((event) => (
          <li className="item" key={event.id}>
            <div className="item-title-row">
              <strong>{event.title}</strong>
              <span className={`level-chip level-${event.level}`}>{event.level}</span>
            </div>
            <p>{event.body}</p>
            <div className="item-meta">
              <span>{event.at || 'just now'}</span>
            </div>
          </li>
        ))}
        {events.length === 0 && <li className="empty-row">No events yet.</li>}
      </ul>
    </section>
  );
}
