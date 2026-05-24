import { GitBranch, Play, Plus } from 'lucide-react';
import { useState } from 'react';
import type { DashboardSnapshot, WorkflowStep } from '../../../shared/domain';
import { commandCenterClient } from '../api/client';
import { createId } from '../../../shared/domain';

interface Props {
  snapshot: DashboardSnapshot;
  onRefresh(): Promise<void>;
}

export function WorkflowsView({ snapshot, onRefresh }: Props) {
  const [showCreator, setShowCreator] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState<WorkflowStep[]>([]);

  function addStep(): void {
    setSteps([
      ...steps,
      {
        id: createId('workflow'),
        name: '',
        agentRole: 'Builder',
        promptTemplate: '',
        dependsOn: [],
        onFailure: 'stop',
        maxRetries: 0
      }
    ]);
  }

  function updateStep(index: number, update: Partial<WorkflowStep>): void {
    setSteps(steps.map((s, i) => (i === index ? { ...s, ...update } : s)));
  }

  function removeStep(index: number): void {
    setSteps(steps.filter((_, i) => i !== index));
  }

  async function handleCreate(): Promise<void> {
    if (!name.trim() || steps.length === 0) return;
    await commandCenterClient.createWorkflow(name.trim(), description.trim(), steps);
    setName('');
    setDescription('');
    setSteps([]);
    setShowCreator(false);
    await onRefresh();
  }

  async function handleLaunch(workflowId: string): Promise<void> {
    const missionId = snapshot.missions[0]?.id ?? null;
    await commandCenterClient.launchWorkflow(workflowId, missionId);
    await onRefresh();
  }

  return (
    <main className="app-shell">
      <header className="view-header">
        <span className="section-label">Automation</span>
        <h1>Workflows</h1>
        <p>Create reusable multi-step workflows where agents hand off tasks to each other.</p>
      </header>

      <section className="panel">
        <div className="panel-heading">
          <span className="panel-icon" aria-hidden="true"><GitBranch size={18} /></span>
          <div>
            <h2>Workflow templates</h2>
            <p>{snapshot.workflows.length} template{snapshot.workflows.length !== 1 ? 's' : ''}</p>
          </div>
          <button className="primary-button" onClick={() => setShowCreator(!showCreator)} style={{ marginLeft: 'auto' }}>
            <Plus size={15} /> New workflow
          </button>
        </div>

        {showCreator && (
          <div className="workflow-creator">
            <div className="form-row">
              <input className="input" placeholder="Workflow name" value={name} onChange={(e) => setName(e.target.value)} />
              <input className="input" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <div className="workflow-steps">
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '12px 0 8px' }}>Steps</h3>
              {steps.map((step, i) => (
                <div key={step.id} className="workflow-step-editor">
                  <span className="step-number">{i + 1}</span>
                  <input className="input" placeholder="Step name" value={step.name} onChange={(e) => updateStep(i, { name: e.target.value })} />
                  <select className="input" value={step.agentRole} onChange={(e) => updateStep(i, { agentRole: e.target.value })}>
                    <option value="Planner">Planner</option>
                    <option value="Builder">Builder</option>
                    <option value="Reviewer">Reviewer</option>
                    <option value="Reporter">Reporter</option>
                  </select>
                  <input className="input" placeholder="Prompt template" value={step.promptTemplate} onChange={(e) => updateStep(i, { promptTemplate: e.target.value })} />
                  <select className="input compact-input" value={step.onFailure} onChange={(e) => updateStep(i, { onFailure: e.target.value as 'stop' | 'skip' | 'retry' })}>
                    <option value="stop">Stop on fail</option>
                    <option value="skip">Skip on fail</option>
                    <option value="retry">Retry on fail</option>
                  </select>
                  <button className="secondary-button danger-button compact-button" onClick={() => removeStep(i)}>Remove</button>
                </div>
              ))}
              <button className="secondary-button" onClick={addStep}><Plus size={14} /> Add step</button>
            </div>

            <div className="form-actions">
              <button className="primary-button" onClick={() => void handleCreate()} disabled={!name.trim() || steps.length === 0}>Create workflow</button>
              <button className="secondary-button" onClick={() => setShowCreator(false)}>Cancel</button>
            </div>
          </div>
        )}

        <div className="workflow-list">
          {snapshot.workflows.map((workflow) => {
            const runs = snapshot.workflowRuns.filter((r) => r.workflowId === workflow.id);
            const lastRun = runs[runs.length - 1];
            return (
              <article key={workflow.id} className="workflow-card">
                <div className="workflow-card-header">
                  <strong>{workflow.name}</strong>
                  <span className="marketplace-version">{workflow.steps.length} steps</span>
                </div>
                <p>{workflow.description}</p>
                <div className="workflow-step-preview">
                  {workflow.steps.map((step, i) => (
                    <span key={step.id} className="step-preview-chip">
                      {i + 1}. {step.name || step.agentRole}
                    </span>
                  ))}
                </div>
                {lastRun && (
                  <div className="workflow-run-status">
                    Last run: <span className={`level-chip level-${lastRun.status === 'completed' ? 'success' : lastRun.status === 'failed' ? 'error' : 'info'}`}>{lastRun.status}</span>
                    ({lastRun.stepResults.filter((s) => s.status === 'completed').length}/{lastRun.stepResults.length} steps done)
                  </div>
                )}
                <div className="marketplace-actions">
                  <button className="primary-button" onClick={() => void handleLaunch(workflow.id)}>
                    <Play size={15} /> Launch
                  </button>
                </div>
              </article>
            );
          })}
          {snapshot.workflows.length === 0 && !showCreator && (
            <p className="empty-state">No workflows yet. Create one to automate multi-step agent pipelines.</p>
          )}
        </div>
      </section>

      {snapshot.workflowRuns.length > 0 && (
        <section className="panel">
          <div className="panel-heading">
            <span className="panel-icon" aria-hidden="true"><Play size={18} /></span>
            <div>
              <h2>Workflow runs</h2>
              <p>{snapshot.workflowRuns.length} run{snapshot.workflowRuns.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Workflow</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Started</th>
                  <th>Completed</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.workflowRuns.map((run) => {
                  const wf = snapshot.workflows.find((w) => w.id === run.workflowId);
                  const done = run.stepResults.filter((s) => s.status === 'completed').length;
                  return (
                    <tr key={run.id}>
                      <td>{wf?.name ?? run.workflowId}</td>
                      <td><span className={`level-chip level-${run.status === 'completed' ? 'success' : run.status === 'failed' ? 'error' : 'info'}`}>{run.status}</span></td>
                      <td>{done}/{run.stepResults.length}</td>
                      <td>{run.startedAt ? new Date(run.startedAt).toLocaleString() : '-'}</td>
                      <td>{run.completedAt ? new Date(run.completedAt).toLocaleString() : '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
