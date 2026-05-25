import { PlusCircle } from 'lucide-react';
import { useState } from 'react';
import { commandCenterClient } from '../api/client';
import { useToast } from './ToastProvider';

export function MissionCreator({ onRefresh }: { onRefresh(): Promise<void> }) {
  const toast = useToast();
  const [title, setTitle] = useState('Build a software feature');
  const [goal, setGoal] = useState('Coordinate agents to plan, implement, verify, and summarize the work.');
  const [submitting, setSubmitting] = useState(false);

  async function submit(): Promise<void> {
    if (!title.trim() || !goal.trim()) {
      toast.warning('Title and goal are required.');
      return;
    }
    setSubmitting(true);
    try {
      await commandCenterClient.createMission(title.trim(), goal.trim());
      toast.success('Mission created.');
      await onRefresh();
    } catch (err) {
      toast.error(`Failed to create mission: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <span className="panel-icon" aria-hidden="true">
          <PlusCircle size={18} />
        </span>
        <div>
          <h2>Create mission</h2>
          <p>Give the agent crew a clear goal and launch surface.</p>
        </div>
      </div>
      <label className="field-group">
        <span>Title</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} />
        <small>Use a concise mission name agents can reference.</small>
      </label>
      <label className="field-group">
        <span>Goal</span>
        <textarea value={goal} onChange={(event) => setGoal(event.target.value)} />
        <small>Describe the outcome, not only the first task.</small>
      </label>
      <button className="primary-button" disabled={submitting} onClick={() => void submit()}>
        {submitting ? 'Creating...' : 'Create Mission'}
      </button>
    </section>
  );
}
