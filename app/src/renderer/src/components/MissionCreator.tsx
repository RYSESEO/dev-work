import { PlusCircle } from 'lucide-react';
import { useState } from 'react';
import { commandCenterClient } from '../api/client';

export function MissionCreator({ onRefresh }: { onRefresh(): Promise<void> }) {
  const [title, setTitle] = useState('Build a software feature');
  const [goal, setGoal] = useState('Coordinate agents to plan, implement, verify, and summarize the work.');

  async function submit(): Promise<void> {
    if (!title.trim() || !goal.trim()) return;
    await commandCenterClient.createMission(title.trim(), goal.trim());
    await onRefresh();
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
      <button className="primary-button" onClick={() => void submit()}>
        Create Mission
      </button>
    </section>
  );
}
